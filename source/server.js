'use strict';

const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Readable } = require('node:stream');
const { parseArgs } = require('node:util');

const engine = require('./engine');
const { createApi } = require('./api');
const { startModel } = require('./local_model');
const corpus = require('../data/corpus.json');
const prompts = require('../data/prompts.json');

const pages = new Set(['/', '/index.html', '/CampusCompass.html']);
const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function createCampusServer({ html = readFileSync(join(__dirname, '..', 'CampusCompass.html')), model } = {}) {
  const api = createApi({ engine, corpus, prompts, runtime: 'local', model });
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (!host || !req.url?.startsWith('/') || req.url.startsWith('//') || !/^[\w.:[\]-]+$/.test(host)) {
        res.writeHead(400, baseHeaders).end();
        return;
      }
      const proxied = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const scheme = proxied && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const url = new URL(scheme + '://' + host + req.url);
      const isRead = ['GET', 'HEAD'].includes(req.method);
      if (url.pathname.startsWith('/api/')) {
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          ...(isRead ? {} : { body: Readable.toWeb(req), duplex: 'half' }),
        });
        const response = await api(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (pages.has(url.pathname)) {
        if (!isRead) {
          res.writeHead(405, { ...baseHeaders, Allow: 'GET, HEAD' }).end();
          return;
        }
        res.writeHead(200, {
          ...baseHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Content-Length': html.length,
        }).end(req.method === 'HEAD' ? undefined : html);
        return;
      }
      res.writeHead(404, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' }).end('Page not found.');
    } catch {
      if (!res.headersSent) res.writeHead(400, baseHeaders);
      res.end();
    }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.on('close', () => model?.close?.());
  return server;
}

function main() {
  const { values } = parseArgs({
    options: {
      port: { type: 'string' },
      host: { type: 'string' },
      // Preview launchers pass this flag. Node already fails if the port is in use.
      strictPort: { type: 'boolean' },
      model: { type: 'string' },
      python: { type: 'string' },
    },
  });
  const port = Number(values.port || process.env.PORT || '8000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Choose a port between 1 and 65535.');
    process.exitCode = 1;
    return;
  }
  const html = readFileSync(join(__dirname, '..', 'CampusCompass.html'));
  let model;
  if (values.model) {
    model = startModel({
      filename: values.model,
      python: values.python,
      onStatus(status) {
        if (status === 'ready') console.log('Local model is ready.');
        else console.error('Local model is unavailable. Check the GGUF path and inference dependency.');
      },
    });
  }
  const server = createCampusServer({ html, model });
  server.on('error', error => {
    console.error('Could not start CampusCompass: ' + error.message);
    model?.close();
    process.exitCode = 1;
  });
  const host = values.host || '127.0.0.1';
  server.listen(port, host, () => {
    console.log('CampusCompass is listening on ' + host + ':' + port);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      model?.close();
      server.close();
    });
  }
}

if (require.main === module) main();
module.exports = { createCampusServer };
