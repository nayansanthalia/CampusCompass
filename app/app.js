'use strict';

const byId = id => document.getElementById(id);
const { corpus, prompts, tests, components, modelCases, modelRuns, modelSummary } = DATA;
const engine = CampusEngine;
const scopeFields = ['program', 'year', 'semester', 'audience'];
const pageNames = {
  ask: 'Helpdesk', lab: 'Prompt Studio', sources: 'Evidence Library', tests: 'Evaluation', project: 'Project',
};
const statusLabels = {
  answered: 'Answer found',
  clarify: 'More details needed',
  not_found: 'No matching evidence',
  conflict: 'Conflicting evidence',
  refused: 'Request outside scope',
};
const helpdeskUrl = 'https://helpdesk.bennett.edu.in/index.php';
const historyKey = 'campuscompass.recent.v2';
const historyLimit = 5;
const isHttp = ['http:', 'https:'].includes(location.protocol);

let selectedVersion = 'V5';
let currentPage = 'ask';
let runtime = null;
let runtimeProbe = null;
let runtimeTimer;
let activeAnswer;
let activeModel;
let lastAnswer;
let toastTimer;
let benchRows;
let recent = loadHistory();

function element(tag, text, parent, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  if (parent) parent.append(item);
  return item;
}

function icon(name, parent) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  const use = document.createElementNS(namespace, 'use');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#i-' + name);
  svg.append(use);
  parent.append(svg);
  return svg;
}

function link(text, url, parent, className) {
  const item = element('a', text, parent, className || 'support-link');
  item.href = url;
  item.target = '_blank';
  item.rel = 'noopener noreferrer';
  icon('external', item);
  return item;
}

function toast(message) {
  const status = byId('toast');
  clearTimeout(toastTimer);
  status.textContent = message;
  status.hidden = false;
  toastTimer = setTimeout(() => { status.hidden = true; }, 3000);
}

function getScope() {
  return Object.fromEntries(scopeFields.flatMap(key => {
    const value = byId(key).value;
    return value ? [[key, value]] : [];
  }));
}

function inputSnapshot() {
  return { question: byId('question').value.trim(), scope: getScope() };
}

function fillQuestion(question, scope = {}) {
  byId('question').value = question;
  for (const key of scopeFields) byId(key).value = scope[key] || '';
  byId('scope-details').open = Boolean(Object.keys(scope).length);
  onInput();
}

function onNavigation(event) {
  const target = event.currentTarget.dataset.view;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (location.hash !== '#' + target) {
    try {
      history.pushState(null, '', '#' + target);
    } catch {
      location.hash = target;
    }
  }
  showPage(target, currentPage !== target);
}

function routeFromHash() {
  const target = location.hash.slice(1);
  if (target === 'main-content') return;
  showPage(Object.hasOwn(pageNames, target) ? target : 'ask', false);
}

function showPage(page, focus) {
  currentPage = page;
  byId('view-name').textContent = pageNames[page];
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== page;
  for (const item of document.querySelectorAll('.nav [data-view]')) {
    if (item.dataset.view === page) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  clearTimeout(runtimeTimer);
  if (page === 'lab') {
    renderPrompt();
    renderReplay();
    probeRuntime();
  }
  if (page === 'sources') renderLibrary();
  if (page === 'tests' && !benchRows) runBench();
  if (focus) {
    byId(page + '-title').focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}

async function fetchJson(path, { body, signal } = {}) {
  const response = await fetch(path, {
    cache: 'no-store', signal,
    headers: body ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The service is unavailable.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'The request could not be completed.');
  return result;
}

function renderRuntime(value) {
  runtime = value;
  byId('runtime').dataset.mode = value ? 'connected' : 'offline';
  byId('runtime-label').textContent = ({ local: 'Local API connected', hosted: 'Campus API connected' })[value?.runtime] || 'Offline mode';
  renderLiveControls();
}

function probeRuntime() {
  if (!isHttp) return Promise.resolve(null);
  if (runtimeProbe) return runtimeProbe;
  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), 2300);
  runtimeProbe = fetchJson('/api/health', { signal: control.signal })
    .then(result => result.status === 'ok' && result.version === DATA.release ? result : null)
    .catch(() => null)
    .then(value => {
      renderRuntime(value);
      clearTimeout(runtimeTimer);
      if (currentPage === 'lab' && value?.model === 'starting') runtimeTimer = setTimeout(probeRuntime, 2200);
      return value;
    })
    .finally(() => {
      clearTimeout(timeout);
      runtimeProbe = null;
    });
  return runtimeProbe;
}

function setAskBusy(busy) {
  byId('ask-form').setAttribute('aria-busy', String(busy));
  byId('askbtn').disabled = busy;
  byId('ask-label').textContent = busy ? 'Checking sources…' : 'Find evidence';
}

function questionError(message = '') {
  const error = byId('ask-error');
  error.textContent = message;
  error.hidden = !message;
  if (message) byId('question').setAttribute('aria-invalid', 'true');
  else byId('question').removeAttribute('aria-invalid');
}

function onInput() {
  activeAnswer?.abort();
  activeAnswer = null;
  setAskBusy(false);
  questionError();
  byId('answer').hidden = true;
  byId('answer-announcement').textContent = '';
  if (lastAnswer) {
    lastAnswer = null;
    renderProofs(null);
  }
  const count = Object.keys(getScope()).length;
  byId('scope-summary').textContent = count ? count + ' selected' : 'Optional';
  clearValidation();
  resetModel();
  if (currentPage === 'lab') renderPrompt();
}

async function ask(event) {
  event.preventDefault();
  const payload = inputSnapshot();
  if (!payload.question) {
    questionError('Enter a campus question.');
    byId('question').focus();
    return;
  }
  questionError();
  if (activeAnswer) return;
  const controller = new AbortController();
  activeAnswer = controller;
  setAskBusy(true);
  let result;
  let service = runtime || await probeRuntime();
  if (activeAnswer !== controller) return;

  if (service) {
    const timeout = setTimeout(() => controller.abort(), 4300);
    try {
      result = await fetchJson('/api/answer', { body: payload, signal: controller.signal });
      if (!Object.hasOwn(statusLabels, result.status) || !Array.isArray(result.citations)) throw new Error('Unexpected answer');
    } catch {
      if (activeAnswer === controller) renderRuntime(null);
      service = null;
      result = null;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (activeAnswer !== controller) return;
  activeAnswer = null;
  setAskBusy(false);
  if (!result) result = engine.render(engine.resolve(payload.question, payload.scope, corpus), corpus);

  lastAnswer = result;
  renderAnswer(result, Boolean(service));
  renderProofs(result);
  if (result.status === 'answered') remember(payload);
  byId('answer-announcement').textContent = statusLabels[result.status] + '. ' + result.answer;
  if (currentPage === 'ask') byId('answer').scrollIntoView({ block: 'nearest' });
}

function renderAnswer(result, connected) {
  const panel = byId('answer');
  panel.replaceChildren();
  panel.hidden = false;
  const header = element('div', undefined, panel, 'row panel-row');
  const title = element('h2', 'Helpdesk result', header);
  title.id = 'answer-title';
  const status = element('span', undefined, header, 'pill ' + result.status);
  icon(result.status === 'answered' ? 'check' : 'info', status);
  status.append(statusLabels[result.status]);
  element('p', result.answer, panel, 'answer-text');

  const fields = Object.values(result.scope);
  if (fields.length) {
    const tags = element('div', undefined, panel, 'scope-tags');
    for (const value of fields) element('span', value, tags, 'pill');
  }
  if (result.caution) {
    const caution = element('p', undefined, panel, 'notice');
    icon('alert', caution);
    caution.append(result.caution);
  }
  if (result.next) element('p', result.next, panel, 'answer-next');
  const actions = element('div', undefined, panel, 'actions');
  element('span', connected ? 'CampusCompass API' : 'Offline evidence workflow', actions, 'muted');
  if (result.citations.length) {
    const sourceLink = element('a', 'View answer sources', actions, 'answer-source-link');
    sourceLink.href = '#answer-sources';
    sourceLink.addEventListener('click', event => {
      event.preventDefault();
      const target = byId('answer-sources');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest' });
    });
    const button = element('button', undefined, actions, 'button secondary');
    button.type = 'button';
    icon('copy', button);
    button.append('Copy with sources');
    button.addEventListener('click', () => {
      const sources = result.citations.map(citation => citation.title + ' · ' + citation.section + '\n' + citation.url);
      copyText([result.answer, result.caution, sources.join('\n\n')].filter(Boolean).join('\n\n'), 'Answer and sources copied.');
    });
  } else {
    link('Open university service desk', helpdeskUrl, actions);
  }
  const details = element('details', undefined, panel);
  element('summary', 'Inspect evidence decision', details);
  const trace = element('pre', JSON.stringify(result, null, 2), details, 'code');
  trace.tabIndex = 0;
  trace.setAttribute('aria-label', 'Evidence decision JSON');
}

function renderProofs(result) {
  const container = byId('proofs');
  container.replaceChildren();
  const citations = result?.citations || [];
  const count = new Set(citations.map(citation => citation.source_id)).size;
  byId('proofcount').textContent = result ? count + (count === 1 ? ' official source' : ' official sources') : 'Quotes and applicability';
  if (!citations.length) {
    const empty = element('div', undefined, container, 'proof-empty');
    element('strong', result ? 'This result has no citations' : 'Citations appear here', empty);
    element('p', result ? 'The library did not support a factual answer.' : 'Submit a question to see its source excerpts and dates.', empty);
    return;
  }
  for (const citation of citations) {
    const item = element('div', undefined, container, 'proof');
    element('span', citation.source_id + ' · ' + citation.fact_id, item, 'source-kind');
    if (citation.historical) element('span', 'Historical', item, 'pill historical');
    element('h3', citation.title, item);
    element('blockquote', citation.quote, item);
    element('p', citation.section + ' · ' + citation.issued, item, 'muted');
    element('p', citation.scope, item, 'muted');
    link('Open official source', citation.url, item);
  }
}

function loadHistory() {
  try {
    const entries = JSON.parse(localStorage.getItem(historyKey) || '[]');
    if (!Array.isArray(entries)) return [];
    return entries.filter(entry => entry && typeof entry.question === 'string'
      && entry.question.length > 0 && entry.question.length <= engine.MAX_QUESTION
      && entry.scope && engine.normalizeScope(entry.scope).issues.length === 0).slice(0, historyLimit);
  } catch {
    return [];
  }
}

function remember(payload) {
  const key = JSON.stringify(payload);
  recent = [payload, ...recent.filter(item => JSON.stringify(item) !== key)].slice(0, historyLimit);
  saveHistory();
}

function saveHistory() {
  try {
    if (recent.length) localStorage.setItem(historyKey, JSON.stringify(recent));
    else localStorage.removeItem(historyKey);
  } catch {
    // The current page can still show recent questions when browser storage is unavailable.
  }
  renderHistory();
}

function renderHistory() {
  byId('activity').hidden = !recent.length;
  const list = byId('history-list');
  list.replaceChildren();
  for (const entry of recent) {
    const item = element('li', undefined, list);
    const button = element('button', entry.question, item, 'history-question');
    button.type = 'button';
    button.title = entry.question;
    button.addEventListener('click', () => {
      fillQuestion(entry.question, entry.scope);
      byId('ask-form').requestSubmit();
    });
  }
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
    return;
  } catch {
    const focused = document.activeElement;
    const buffer = element('textarea', undefined, document.body, 'copy-buffer');
    buffer.value = text;
    buffer.readOnly = true;
    buffer.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      // The browser can block clipboard access in an embedded or offline view.
    } finally {
      buffer.remove();
      focused?.focus({ preventScroll: true });
    }
    toast(copied ? successMessage : 'Clipboard unavailable in this browser.');
  }
}

function promptAssembly() {
  const { question, scope } = inputSnapshot();
  return engine.assemble(question, scope, selectedVersion, corpus, prompts);
}

function renderPrompt() {
  const selected = prompts.find(prompt => prompt.id === selectedVersion);
  const assembly = promptAssembly();
  byId('versiontitle').textContent = selected.id + ' · ' + selected.name;
  byId('change').textContent = selected.change;
  byId('lab-question').textContent = assembly.decision.question || 'Choose a helpdesk question or load a recorded run.';
  byId('prompttext').textContent = 'SYSTEM\n' + assembly.system + '\n\nUSER\n' + assembly.user;
  for (const control of byId('versions').children) {
    control.setAttribute('aria-pressed', String(control.dataset.version === selectedVersion));
  }
}

function clearValidation() {
  byId('validation').hidden = true;
  byId('validation').replaceChildren();
}

function showValidation(result) {
  const container = byId('validation');
  container.replaceChildren();
  container.hidden = false;
  container.className = 'review' + (result.pass ? '' : ' review-fail');
  element('strong', result.pass ? 'Contract accepted' : 'Held for review', container);
  if (result.pass) {
    element('p', result.result.answer, container);
    const citations = result.result.citations;
    if (citations.length) element('p', 'Approved evidence · ' + citations.map(citation => citation.fact_id).join(', '), container);
  } else {
    const list = element('ul', undefined, container);
    for (const issue of result.issues) element('li', issue, list);
  }
}

function validateDraft() {
  showValidation(engine.validate(byId('draft').value, promptAssembly().decision, corpus));
}

function findReplay() {
  return modelRuns.find(run => run.case === byId('replaycase').value && run.version === selectedVersion);
}

function renderReplay() {
  const run = findReplay();
  byId('modelraw').textContent = run?.raw_output || 'No recorded result for this case and version.';
  const verdict = run?.contract_pass === undefined ? '' : run.contract_pass ? ' · Archive contract accepted' : ' · Archive contract held';
  byId('replaymeta').textContent = run ? run.seconds + ' s · ' + (run.usage?.completion_tokens ?? '—') + ' generated tokens' + verdict : '';
  byId('load-replay').disabled = !run;
}

function loadReplay() {
  const run = findReplay();
  const test = modelCases.find(item => item.id === run?.case);
  if (!test) return;
  fillQuestion(test.question, test.scope);
  byId('draft').value = run.raw_output;
  validateDraft();
  byId('draft').focus();
}

function resetModel() {
  activeModel?.abort();
  activeModel = null;
  byId('live-result').hidden = true;
  renderLiveControls();
}

function renderLiveControls() {
  const state = runtime?.model;
  byId('livebtn').disabled = state !== 'ready' || Boolean(activeModel);
  byId('live-note').textContent = activeModel ? 'Running the selected prompt…'
    : state === 'ready' ? 'Run the selected prompt and helpdesk question on the local GGUF model.'
      : state === 'starting' ? 'The local model is loading.'
        : state === 'unavailable' ? 'The local model could not start. Check the model path and dependency.'
          : 'Recorded results work here. To run new inference, start the local server with a GGUF model.';
}

async function runModel() {
  const payload = { ...inputSnapshot(), version: selectedVersion };
  if (!payload.question) {
    toast('Choose a helpdesk question or load a recorded run.');
    return;
  }
  const controller = new AbortController();
  resetModel();
  clearValidation();
  activeModel = controller;
  renderLiveControls();
  const deadline = setTimeout(() => controller.abort(), 65_000);
  try {
    const result = await fetchJson('/api/model', { body: payload, signal: controller.signal });
    if (activeModel !== controller) return;
    byId('live-result').hidden = false;
    byId('live-raw').textContent = result.raw_output;
    byId('live-meta').textContent = 'Fresh local inference · ' + result.seconds + ' s';
    byId('draft').value = result.raw_output;
    showValidation(result.validation);
  } catch (error) {
    if (activeModel === controller) {
      toast(controller.signal.aborted ? 'The local model run timed out.' : error.message);
      probeRuntime();
    }
  } finally {
    clearTimeout(deadline);
    if (activeModel === controller) {
      activeModel = null;
      renderLiveControls();
    }
  }
}

function renderLibrary() {
  const query = engine.norm(byId('source-search').value).split(/\s+/).filter(Boolean);
  const filter = byId('source-filter').value;
  const grid = byId('sourcecards');
  grid.replaceChildren();
  let count = 0;
  for (const source of corpus.sources) {
    if (filter !== 'all' && source.historical !== (filter === 'historical')) continue;
    const facts = corpus.facts.filter(fact => fact.source_id === source.id);
    const sourceText = engine.norm([source.id, source.title, source.scope, source.issued].join(' '));
    const matching = facts.filter(fact => {
      const text = engine.norm([fact.id, fact.topic, ...fact.aliases, fact.text, fact.quote, fact.section].join(' '));
      return query.every(term => sourceText.includes(term) || text.includes(term));
    });
    if (!matching.length) continue;
    count += 1;
    const card = element('article', undefined, grid, 'panel');
    const header = element('div', undefined, card, 'source-top');
    element('span', source.id + ' · Official source', header, 'source-kind');
    if (source.historical) element('span', 'Historical', header, 'pill historical');
    element('h2', source.title, card);
    element('p', source.issued, card, 'muted');
    element('p', source.scope, card, 'muted');
    link('Open official source', source.url, card);
    const details = element('details', undefined, card, 'source-facts');
    details.open = query.length > 0;
    element('summary', matching.length + (matching.length === 1 ? ' evidence card' : ' evidence cards'), details);
    for (const fact of matching) {
      const excerpt = element('div', undefined, details, 'fact');
      element('h3', fact.id + ' · ' + fact.section, excerpt);
      element('p', fact.text, excerpt);
      element('blockquote', fact.quote, excerpt);
    }
  }
  byId('source-summary').textContent = count + (count === 1 ? ' source' : ' sources');
  if (!count) element('p', 'No evidence matches. Try a different term or source filter.', grid, 'panel empty-library');
}

function table(headers, rows, parent, label) {
  const wrap = element('div', undefined, parent, 'table-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', label);
  const result = element('table', undefined, wrap);
  const header = element('tr', undefined, element('thead', undefined, result));
  for (const labelText of headers) element('th', labelText, header).scope = 'col';
  const body = element('tbody', undefined, result);
  for (const row of rows) {
    const line = element('tr', undefined, body);
    for (const value of row) {
      const cell = element('td', undefined, line);
      if (typeof value === 'string') cell.textContent = value;
      else cell.append(value);
    }
  }
}

function runBench() {
  benchRows = tests.map(test => {
    const result = engine.resolve(test.question, test.scope, corpus);
    const facts = result.selected.map(fact => fact.id);
    return { ...test, status: result.status, facts, pass: result.status === test.expected_status
      && (test.expected_fact ? facts.includes(test.expected_fact) : facts.length === 0) };
  });
  renderBench();
}

function renderBench() {
  if (!benchRows) return;
  const filter = byId('bench-filter').value;
  const rows = benchRows.filter(row => filter === 'all' || filter === row.split);
  byId('bench-summary').textContent = rows.filter(row => row.pass).length + ' of ' + rows.length + ' checks passed';
  const region = byId('bench');
  region.replaceChildren();
  table(['Case', 'Question', 'Expected', 'Actual', 'Evidence IDs', 'Result'], rows.map(row => [
    row.id, row.question, statusLabels[row.expected_status], statusLabels[row.status],
    row.facts.join(', ') || '—', element('span', row.pass ? 'Pass' : 'Review', undefined, 'pill ' + (row.pass ? 'pass' : 'fail')),
  ]), region, 'Helpdesk check results');
}

function setupEvaluation() {
  const stats = components.summary;
  const data = [
    [stats.status_pass + '/' + stats.questions, 'Question status agreement'],
    [stats.retrieval.hits + '/' + stats.retrieval.n, 'Evidence in top four'],
    [stats.validator.pass + '/' + stats.validator.n, 'Draft validation checks'],
    [String(modelSummary.total_runs), 'Recorded model completions'],
  ];
  for (const [value, label] of data) {
    const metric = element('div', undefined, byId('metrics'), 'panel metric');
    element('strong', value, metric);
    element('span', label, metric);
  }
  table(['Version', 'Valid JSON', 'Status match', 'Contract accepted'], modelSummary.versions.map(row => [
    row.version, row.json_valid + '/' + row.n, row.status_correct + '/' + row.n, row.contract_pass + '/' + row.n,
  ]), byId('modeltable'), 'Archived model experiment scores');
}

for (const nav of document.querySelectorAll('[data-view]')) nav.addEventListener('click', onNavigation);
window.addEventListener('popstate', routeFromHash);
window.addEventListener('hashchange', routeFromHash);
byId('ask-form').addEventListener('submit', ask);
byId('question').addEventListener('input', onInput);
byId('question').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    byId('ask-form').requestSubmit();
  }
});
for (const key of scopeFields) byId(key).addEventListener('change', onInput);
for (const chip of document.querySelectorAll('[data-question]')) {
  chip.addEventListener('click', () => {
    fillQuestion(chip.dataset.question);
    byId('ask-form').requestSubmit();
  });
}

byId('clear-history').addEventListener('click', () => {
  recent = [];
  saveHistory();
  byId('question').focus({ preventScroll: true });
  toast('Recent questions cleared.');
});
byId('draft').addEventListener('input', clearValidation);
byId('validatebtn').addEventListener('click', validateDraft);
byId('forgedbtn').addEventListener('click', () => {
  byId('draft').value = JSON.stringify({ status: 'answered', fact_ids: ['F999'] }, null, 2);
  validateDraft();
});
byId('copybtn').addEventListener('click', () => copyText(byId('prompttext').textContent, 'Prompt copied.'));
byId('replaycase').addEventListener('change', renderReplay);
byId('load-replay').addEventListener('click', loadReplay);
byId('livebtn').addEventListener('click', runModel);
byId('source-search').addEventListener('input', renderLibrary);
byId('source-filter').addEventListener('change', renderLibrary);
byId('bench-filter').addEventListener('change', renderBench);
byId('runbench').addEventListener('click', runBench);

for (const prompt of prompts) {
  const button = element('button', prompt.id, byId('versions'));
  button.type = 'button';
  button.dataset.version = prompt.id;
  button.title = prompt.name;
  button.addEventListener('click', () => {
    selectedVersion = prompt.id;
    resetModel();
    clearValidation();
    renderPrompt();
    renderReplay();
  });
}
for (const test of modelCases) {
  const option = element('option', test.id + ' · ' + test.question, byId('replaycase'));
  option.value = test.id;
}
for (const name of corpus.team.members) element('li', name, byId('team'));
byId('coverage-sources').textContent = corpus.sources.length;
byId('coverage-facts').textContent = corpus.facts.length;
renderProofs(null);
renderHistory();
setupEvaluation();
routeFromHash();
probeRuntime();
