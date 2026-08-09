import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createPrototypeServer } from '../../src/server.mjs';

const conditionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const testRoot = path.join(conditionRoot, 'prototype/test');
const sampleFiles = ['BACKLOG.md', 'GIT_LOG.txt'];

async function request(instance, route, options = {}) {
  return fetch(`${instance.url}${route}`, {
    ...options,
    headers: { ...(options.headers ?? {}), 'X-Launch-Token': instance.token }
  });
}

function acceptedState() {
  return {
    schemaVersion: 1,
    projectLabel: 'Moonwake',
    role: 'programmer',
    outcome: 'accepted',
    candidateSnapshot: {
      id: 'candidate:programmer-save-corruption',
      title: 'Investigate the reported save corruption after force-close',
      actionType: 'direct',
      evidenceLocators: [{ file: 'BACKLOG.md', line: 6 }]
    },
    recordedAt: '2026-08-09T12:00:00.000Z'
  };
}

test('loopback service persists valid choices across restart and recovers from corruption', async (t) => {
  const dataDirectory = await mkdtemp(path.join(testRoot, '.tmp-state-'));
  t.after(async () => rm(dataDirectory, { recursive: true, force: true }));
  const before = await Promise.all(sampleFiles.map((name) => readFile(path.join(conditionRoot, 'sample-project', name), 'utf8')));

  let instance = await createPrototypeServer({ dataDirectory });
  assert.equal(instance.server.address().address, '127.0.0.1');
  let response = await request(instance, '/api/state');
  assert.deepEqual(await response.json(), { state: null });

  response = await request(instance, '/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(acceptedState())
  });
  assert.equal(response.status, 200);
  await instance.close();

  instance = await createPrototypeServer({ dataDirectory });
  t.after(() => instance.close().catch(() => {}));
  response = await request(instance, '/api/state');
  assert.deepEqual((await response.json()).state, acceptedState());

  await writeFile(instance.store.stateFile, '{broken', 'utf8');
  response = await request(instance, '/api/state');
  const corrupt = await response.json();
  assert.equal(corrupt.state, null);
  assert.equal(corrupt.warning.code, 'corrupt_state');
  const after = await Promise.all(sampleFiles.map((name) => readFile(path.join(conditionRoot, 'sample-project', name), 'utf8')));
  assert.deepEqual(after, before, 'state operations must not change sample-project');
});

test('service denies invalid token/origin, arbitrary APIs, and invalid state', async (t) => {
  const dataDirectory = await mkdtemp(path.join(testRoot, '.tmp-state-'));
  t.after(async () => rm(dataDirectory, { recursive: true, force: true }));
  const instance = await createPrototypeServer({ dataDirectory });
  t.after(() => instance.close().catch(() => {}));

  let response = await fetch(`${instance.url}/api/state`);
  assert.equal(response.status, 401);
  response = await request(instance, '/api/state', { headers: { Origin: 'https://evil.invalid' } });
  assert.equal(response.status, 403);
  response = await request(instance, '/api/project-path', { method: 'POST' });
  assert.equal(response.status, 404);
  response = await request(instance, '/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...acceptedState(), absolutePath: 'D:\\Moonwake' })
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid_state');
});

test('server delivers only local static assets and injects the per-launch token', async (t) => {
  const dataDirectory = await mkdtemp(path.join(testRoot, '.tmp-state-'));
  t.after(async () => rm(dataDirectory, { recursive: true, force: true }));
  const instance = await createPrototypeServer({ dataDirectory, token: 'test-token' });
  t.after(() => instance.close().catch(() => {}));
  const htmlResponse = await fetch(instance.url);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(html, /content="test-token"/);
  assert.ok(!html.includes('__LAUNCH_TOKEN__'));
  assert.match(htmlResponse.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal((await fetch(`${instance.url}/core/input-parser.mjs`)).status, 200);
  assert.equal((await fetch(`${instance.url}/not-present`)).status, 404);
});
