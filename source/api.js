/* Fetch-compatible HTTP layer shared by the local server and the hosted Worker. */
(function expose(root) {
  'use strict';

  const RELEASE = '2.0.0';
  const MAX_BODY_BYTES = 16384;
  const MAX_DRAFT_LENGTH = 6000;
  const HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };

  class RequestError extends Error {
    constructor(status, code, message, headers) {
      super(message);
      Object.assign(this, { status, code, headers });
    }
  }

  function json(data, status = 200, headers = {}, omitBody = false) {
    return new Response(omitBody ? null : JSON.stringify(data), {
      status, headers: { ...HEADERS, ...headers },
    });
  }

  function invalid(message) {
    return new RequestError(400, 'invalid_request', message);
  }

  function tooLarge() {
    return new RequestError(413, 'body_too_large', 'The request exceeds 16 KiB.');
  }

  async function readJson(request) {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new RequestError(415, 'unsupported_media_type', 'Send application/json.');
    }
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw tooLarge();
    if (!request.body) throw invalid('Send a JSON object.');

    const reader = request.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let length = 0;
    let text = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BODY_BYTES) throw tooLarge();
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
      const payload = JSON.parse(text);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid('Send a JSON object.');
      return payload;
    } catch (error) {
      reader.cancel().catch(() => {});
      if (error instanceof RequestError) throw error;
      throw invalid('Send a valid UTF-8 JSON object.');
    } finally {
      reader.releaseLock();
    }
  }

  function validateOrigin(request, origin) {
    const supplied = request.headers.get('origin');
    if ((supplied && supplied !== origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      throw new RequestError(403, 'origin_denied', 'Use this API from the CampusCompass site.');
    }
  }

  function createApi({ engine, corpus, prompts, runtime, model }) {
    const routes = {
      '/api/health': ['GET', 'HEAD'],
      '/api/sources': ['GET', 'HEAD'],
      '/api/answer': ['POST'],
      '/api/validate': ['POST'],
      '/api/model': ['POST'],
    };
    const versions = new Set(prompts.map(prompt => prompt.id));
    const sources = { schema_version: corpus.schema_version, sources: corpus.sources, facts: corpus.facts };

    function questionInput(payload, allowedKeys) {
      if (Object.keys(payload).some(key => !allowedKeys.includes(key))) {
        throw invalid('The request contains an unsupported field.');
      }
      if (typeof payload.question !== 'string' || !payload.question.trim() || payload.question.length > engine.MAX_QUESTION) {
        throw invalid('Enter a question of 1 to 2,000 characters.');
      }
      const { scope, issues } = engine.normalizeScope(payload.scope);
      if (issues.length) throw invalid(issues.join(' '));
      return { question: payload.question.trim(), scope };
    }

    return async function handle(request) {
      const url = new URL(request.url);
      const path = url.pathname;
      const head = request.method === 'HEAD';
      try {
        if (!Object.hasOwn(routes, path)) throw new RequestError(404, 'not_found', 'This endpoint was not found.');
        if (!routes[path].includes(request.method)) {
          throw new RequestError(405, 'method_not_allowed', 'This method is not supported here.', {
            Allow: routes[path].join(', '),
          });
        }
        if (path === '/api/health') {
          return json({ status: 'ok', version: RELEASE, runtime, model: model?.status() || 'disabled' }, 200, {}, head);
        }
        if (path === '/api/sources') return json(sources, 200, {}, head);

        validateOrigin(request, url.origin);
        const payload = await readJson(request);

        if (path === '/api/answer') {
          const { question, scope } = questionInput(payload, ['question', 'scope']);
          return json(engine.render(engine.resolve(question, scope, corpus), corpus));
        }

        if (path === '/api/validate') {
          const { question, scope } = questionInput(payload, ['question', 'scope', 'draft']);
          const { draft } = payload;
          if (typeof draft !== 'string' && (!draft || typeof draft !== 'object')) {
            throw invalid('Supply a JSON draft as text or an object.');
          }
          if (typeof draft === 'string' && draft.length > MAX_DRAFT_LENGTH) throw invalid('Shorten the draft to 6,000 characters.');
          return json(engine.validate(draft, engine.resolve(question, scope, corpus), corpus));
        }

        const { question, scope } = questionInput(payload, ['question', 'scope', 'version']);
        const version = payload.version === undefined ? 'V5' : payload.version;
        if (!versions.has(version)) throw invalid('Choose a prompt version from V0 through V5.');
        if (!model || model.status() !== 'ready') {
          throw new RequestError(503, 'model_unavailable', 'Local inference is unavailable. Recorded runs are available in Prompt Studio.');
        }

        const input = engine.assemble(question, scope, version, corpus, prompts);
        const started = performance.now();
        let raw;
        try {
          raw = await model.generate([
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ]);
          if (typeof raw !== 'string' || raw.length > MAX_DRAFT_LENGTH) throw new Error('Invalid model response');
        } catch (error) {
          if (error.code === 'busy') {
            throw new RequestError(429, 'model_busy', 'A local model run is in progress. Try again shortly.', { 'Retry-After': '2' });
          }
          if (error.code === 'timeout') throw new RequestError(504, 'model_timeout', 'Local inference timed out.');
          throw new RequestError(502, 'model_error', 'The local model could not complete this run.');
        }
        return json({
          raw_output: raw,
          validation: engine.validate(raw, input.decision, corpus),
          seconds: Math.round(performance.now() - started) / 1000,
        });
      } catch (error) {
        const known = error instanceof RequestError;
        return json(
          { error: { code: known ? error.code : 'internal_error', message: known ? error.message : 'CampusCompass could not complete the request.' } },
          known ? error.status : 500, known ? error.headers : {}, head,
        );
      }
    };
  }

  const api = { createApi, RELEASE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusApi = api;
})(globalThis);
