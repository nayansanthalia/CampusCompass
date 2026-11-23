'use strict';

const { once } = require('node:events');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { createCampusServer } = require('./server');
const engine = require('./engine');
const { RELEASE } = require('./api');
const corpus = require('../data/corpus.json');

const example = { question: 'What is the minimum attendance requirement?' };
const query = (path, init) => fetch(origin + path, init);
let server;
let origin;
let modelOutput;
const model = {
  status: () => 'ready',
  async generate(messages) {
    assert.equal(messages[0].role, 'system');
    assert.equal(messages[1].role, 'user');
    const { APPLICATION_GATE, QUESTION } = JSON.parse(messages[1].content);
    assert.deepEqual(APPLICATION_GATE, { status: 'answered', allowed_fact_ids: ['F01'] });
    assert.equal(QUESTION, example.question);
    if (modelOutput instanceof Error) throw modelOutput;
    return modelOutput;
  },
};

before(async () => {
  server = createCampusServer({ model });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  server.close();
  server.closeAllConnections();
  await once(server, 'close');
});

function post(path, value, headers = {}) {
  return query(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
}

test('health, source index and HEAD advertise the same release data', async () => {
  assert.equal(RELEASE, require('../package.json').version);
  const response = await query('/api/health');
  assert.deepEqual(await response.json(), { status: 'ok', version: RELEASE, runtime: 'local', model: 'ready' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const head = await query('/api/health', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const data = await (await query('/api/sources')).json();
  assert.deepEqual(data.sources, corpus.sources);
  assert.deepEqual(data.facts, corpus.facts);
});

test('answer responses match the offline engine including scope and citations', async () => {
  for (const payload of [
    example,
    { question: 'When do classes start?', scope: { audience: 'Returning', year: '2026–2027' } },
    { question: 'When are odd semester exams?' },
    { question: 'What is the attendance rule?', scope: { year: '2026-27' } },
  ]) {
    const response = await post('/api/answer', payload, { Origin: origin });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), engine.render(engine.resolve(payload.question, payload.scope, corpus), corpus));
  }
});

test('invalid inputs produce actionable 400 responses', async () => {
  for (const payload of [null, [], {}, { question: ' ' }, { question: 'x'.repeat(2001) },
    { ...example, scope: null }, { ...example, scope: { year: '2026-28' } },
    { ...example, scope: { audience: 'unexpected' } }, { ...example, extra: 'unexpected' }]) {
    const response = await post('/api/answer', payload);
    assert.equal(response.status, 400);
    const { error } = await response.json();
    assert.equal(error.code, 'invalid_request');
    assert.ok(error.message);
  }
});

test('JSON parser requires the right media type and a complete UTF-8 document', async () => {
  const text = await query('/api/answer', { method: 'POST', body: 'question' });
  assert.equal(text.status, 415);
  for (const body of ['{', Buffer.from([0xff, 0x7d])]) {
    const response = await query('/api/answer', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body,
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'invalid_request');
  }
});

test('size limits apply to fixed and streamed request bodies', async () => {
  const fixed = await post('/api/answer', { question: 'x'.repeat(20_000) });
  assert.equal(fixed.status, 413);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(Buffer.alloc(9000, 'a'));
      controller.enqueue(Buffer.alloc(9000, 'b'));
      controller.close();
    },
  });
  const chunked = await query('/api/answer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half',
  });
  assert.equal(chunked.status, 413);
  assert.equal((await chunked.json()).error.code, 'body_too_large');
});

test('wrong origin, wrong methods and unrelated file paths have stable errors', async () => {
  assert.equal((await post('/api/answer', example, { Origin: 'https://different.example' })).status, 403);
  assert.equal((await post('/api/answer', example, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const wrongMethod = await query('/api/answer');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');
  assert.equal((await query('/api/unknown')).status, 404);
  assert.equal((await query('/source/server.js')).status, 404);
  assert.equal((await query('/CampusCompass.html')).status, 200);
});

test('draft endpoint accepts supported IDs and withholds unapproved claims', async () => {
  const accepted = await (await post('/api/validate', {
    ...example, draft: { status: 'answered', fact_ids: ['F01'] },
  })).json();
  assert.equal(accepted.pass, true);
  assert.equal(accepted.result.citations[0].fact_id, 'F01');
  const held = await (await post('/api/validate', {
    ...example, draft: '{"status":"answered","fact_ids":["F99"]}',
  })).json();
  assert.equal(held.pass, false);
  assert.equal(held.result, null);
});

test('model adapter returns raw output but renders only curated claims', async () => {
  modelOutput = '{"status":"answered","fact_ids":["F01"]}';
  let response = await post('/api/model', { ...example, version: 'V5' });
  assert.equal(response.status, 200);
  const accepted = await response.json();
  assert.equal(accepted.raw_output, modelOutput);
  assert.equal(accepted.validation.pass, true);
  assert.equal(accepted.validation.result.citations[0].source_id, 'S1');
  modelOutput = '{"status":"answered","fact_ids":["F99"]}';
  response = await post('/api/model', example);
  assert.equal((await response.json()).validation.pass, false);
  assert.equal((await post('/api/model', { ...example, version: 'V99' })).status, 400);
  assert.equal((await post('/api/model', { ...example, messages: [] })).status, 400);
});

test('model congestion, timeouts and failures have distinct responses', async () => {
  for (const [code, expectedStatus, expectedCode] of [
    ['busy', 429, 'model_busy'], ['timeout', 504, 'model_timeout'], ['unexpected', 502, 'model_error'],
  ]) {
    modelOutput = Object.assign(new Error('Internal model detail'), { code });
    const response = await post('/api/model', example);
    assert.equal(response.status, expectedStatus);
    if (code === 'busy') assert.equal(response.headers.get('retry-after'), '2');
    const result = await response.json();
    assert.equal(result.error.code, expectedCode);
    assert.doesNotMatch(result.error.message, /Internal model detail/);
  }
});

test('deployed Worker serves the same UI and evidence API without local inference', async () => {
  const source = await readFile(join(__dirname, '..', 'dist/server/index.js'));
  const { default: worker } = await import('data:text/javascript;base64,' + source.toString('base64'));
  const invoke = (path, init) => worker.fetch(new Request('https://campus.test' + path, init));
  const health = await (await invoke('/api/health')).json();
  assert.deepEqual(health, { status: 'ok', version: RELEASE, runtime: 'hosted', model: 'disabled' });
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(example) };
  const result = await (await invoke('/api/answer', init)).json();
  assert.deepEqual(result, engine.render(engine.resolve(example.question, {}, corpus), corpus));
  const noModel = await invoke('/api/model', init);
  assert.equal(noModel.status, 503);
  assert.equal((await noModel.json()).error.code, 'model_unavailable');
  const page = await invoke('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Campus answers,/);
  const legacy = await invoke('/submission/TEAM_AETHERMIND_Milestone2.pdf');
  assert.equal(legacy.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await legacy.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
});
