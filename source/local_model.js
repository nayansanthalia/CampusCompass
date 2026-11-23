'use strict';

const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { join } = require('node:path');

function startModel({ filename, python = 'python3', onStatus = () => {} }) {
  let status = 'starting';
  let closing = false;
  let pending = null;
  const child = spawn(python, ['-u', join(__dirname, 'model_worker.py'), filename], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true,
  });
  const responses = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const unavailable = () => {
    clearTimeout(startup);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Model unavailable'));
      pending = null;
    }
    if (status !== 'unavailable') {
      status = 'unavailable';
      if (!closing) onStatus(status);
    }
  };
  const startup = setTimeout(() => {
    unavailable();
    child.kill();
  }, 120_000);

  child.once('error', unavailable);
  child.once('close', unavailable);
  child.stdin.on('error', unavailable);
  responses.on('line', line => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.ready && status === 'starting') {
      clearTimeout(startup);
      status = 'ready';
      onStatus(status);
      return;
    }
    if (!pending) return;
    const request = pending;
    pending = null;
    clearTimeout(request.timer);
    if (typeof message.output === 'string') request.resolve(message.output);
    else request.reject(new Error('Model generation failed'));
  });

  return {
    status: () => status,
    async generate(messages) {
      if (status !== 'ready') throw new Error('Model unavailable');
      if (pending) throw Object.assign(new Error('Model busy'), { code: 'busy' });
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending = null;
          reject(Object.assign(new Error('Model timed out'), { code: 'timeout' }));
          unavailable();
          child.kill();
        }, 60_000);
        pending = { resolve, reject, timer };
        child.stdin.write(JSON.stringify({ messages }) + '\n');
      });
    },
    close() {
      closing = true;
      unavailable();
      child.kill();
    },
  };
}

module.exports = { startModel };
