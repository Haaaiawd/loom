'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { scanProject, parseBacklog, parseFixtureLog } = require('../src/project');
const { generateCandidates } = require('../src/candidates');
const { createApp } = require('../src/server');

const CONDITION_ROOT = path.resolve(__dirname, '..');
const SAMPLE = path.join(CONDITION_ROOT, 'sample-project');

async function directoryDigest(root) {
  const hash = crypto.createHash('sha256');
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      hash.update(`${entry.isDirectory() ? 'd' : 'f'}:${relative}\0`);
      if (entry.isDirectory()) await walk(absolute);
      else hash.update(await fs.readFile(absolute));
    }
  }
  await walk(root);
  return hash.digest('hex');
}

function requestStatus({ port, path: requestPath, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

test('parsers preserve backlog lines and mark malformed fixture rows', () => {
  const backlog = parseBacklog('# List\n\n- First\n* Second\n  - nested\n- [ ] checkbox');
  assert.deepEqual(backlog.items.map((entry) => [entry.text, entry.line]), [['First', 3], ['Second', 4]]);
  assert.equal(backlog.warnings.length, 2);

  const commits = parseFixtureLog('abcdef1 valid subject\nnot-a-hash invalid\n');
  assert.deepEqual(commits.commits, [{ hash: 'abcdef1', subject: 'valid subject' }]);
  assert.equal(commits.warnings.length, 1);
});

test('sample scan yields traceable 5 backlog items and 4 fixture commits without writing project', async () => {
  const before = await directoryDigest(SAMPLE);
  const snapshot = await scanProject(SAMPLE);
  const after = await directoryDigest(SAMPLE);

  assert.equal(after, before);
  assert.equal(snapshot.backlog.length, 5);
  assert.equal(snapshot.commits.length, 4);
  assert.equal(snapshot.gitSource, 'fixture-export');
  assert.equal(snapshot.backlog[3].line, 6);
  assert.match(snapshot.backlog[3].text, /save corruption/i);
  assert.match(snapshot.warnings.join(' '), /验收夹具/);
});

test('programming candidates are deterministic and lead with data-loss risk', async () => {
  const snapshot = await scanProject(SAMPLE);
  const first = generateCandidates(snapshot, 'programming', '', []);
  const second = generateCandidates(snapshot, 'programming', '', []);
  assert.deepEqual(first, second);
  assert.equal(first.candidates.length, 3);
  assert.equal(new Set(first.candidates.map((entry) => entry.backlogItemId)).size, 3);
  assert.match(first.candidates[0].title, /save corruption/i);
  assert.equal(first.candidates[0].lens, 'risk-blocker');
  assert.ok(first.candidates[0].evidence.some((ref) => ref.kind === 'commit' && ref.source === 'fixture-export'));
  assert.match(first.candidates[0].caveat, /可能相关/);
  assert.match(first.candidates[1].title, /tutorial/i);
  assert.match(first.candidates[2].title, /camera jitter/i);
  assert.deepEqual(first.candidates[2].evidence.map((ref) => ref.kind), ['backlog']);
});

test('role and goal change relevance without hiding cross-role risk', async () => {
  const snapshot = await scanProject(SAMPLE);
  const art = generateCandidates(snapshot, 'art', '', []);
  assert.match(art.candidates[0].title, /save corruption/i);
  assert.ok(art.candidates.some((entry) => /flooded archive/i.test(entry.title)));
  assert.ok(art.candidates.some((entry) => /capsule images/i.test(entry.title)));

  const goal = generateCandidates(snapshot, 'programming', 'prepare playtest', []);
  assert.ok(goal.candidates.some((entry) => /capsule images/i.test(entry.title)));
});

test('skips refill deterministically and a short backlog is never padded', async () => {
  const snapshot = await scanProject(SAMPLE);
  const initial = generateCandidates(snapshot, 'programming', '', []);
  const skipped = generateCandidates(snapshot, 'programming', '', [initial.candidates[0].backlogItemId]);
  assert.equal(skipped.candidates.length, 3);
  assert.ok(!skipped.candidates.some((entry) => entry.backlogItemId === initial.candidates[0].backlogItemId));

  const short = { ...snapshot, backlog: snapshot.backlog.slice(0, 2) };
  const result = generateCandidates(short, 'unrestricted', '', []);
  assert.equal(result.candidates.length, 2);
  assert.match(result.notice, /仅有 2 个/);
});

test('real .git is rejected explicitly until a read-only adapter exists', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'start-workbench-real-git-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'BACKLOG.md'), '- One item\n');
  await fs.mkdir(path.join(root, '.git'));
  await assert.rejects(() => scanProject(root), (error) => error.code === 'REAL_GIT_NOT_IMPLEMENTED' && error.status === 501);
});

test('loopback API enforces token, Host, Origin and completes scan/candidate/decision persistence', async (t) => {
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'start-workbench-state-'));
  const app = createApp({ dataDirectory, token: 'test-session-token' });
  const { port } = await app.listen(0);
  assert.equal(app.server.address().address, '127.0.0.1');
  t.after(async () => {
    await app.close();
    await fs.rm(dataDirectory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Session-Token': app.token, Origin: base };

  const missingToken = await fetch(`${base}/api/health`);
  assert.equal(missingToken.status, 401);

  const badOrigin = await fetch(`${base}/api/health`, { headers: { ...headers, Origin: 'https://evil.example' } });
  assert.equal(badOrigin.status, 403);

  const badHostStatus = await requestStatus({
    port,
    path: '/api/health',
    headers: { 'X-Session-Token': app.token, Origin: base, Host: `evil.example:${port}` }
  });
  assert.equal(badHostStatus, 403);

  const health = await fetch(`${base}/api/health`, { headers });
  assert.deepEqual(await health.json(), { ok: true, address: '127.0.0.1' });

  const page = await fetch(`${base}/?token=${app.token}`);
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(page.headers.get('cache-control'), 'no-store');

  const scanResponse = await fetch(`${base}/api/projects/scan`, { method: 'POST', headers, body: JSON.stringify({ path: SAMPLE }) });
  assert.equal(scanResponse.status, 200);
  const snapshot = await scanResponse.json();

  const candidateResponse = await fetch(`${base}/api/candidates`, {
    method: 'POST', headers,
    body: JSON.stringify({ snapshotId: snapshot.snapshotId, role: 'programming', goal: '', skippedIds: [] })
  });
  assert.equal(candidateResponse.status, 200);
  const generated = await candidateResponse.json();

  const decisionResponse = await fetch(`${base}/api/decision`, {
    method: 'POST', headers,
    body: JSON.stringify({
      snapshotId: snapshot.snapshotId,
      candidateId: generated.candidates[0].id,
      role: 'programming', goal: '', skippedIds: [], consentToSave: true
    })
  });
  assert.equal(decisionResponse.status, 200);
  const decision = await decisionResponse.json();
  assert.equal(decision.persisted, true);
  assert.match(decision.state.lastDecision.candidateSnapshot.title, /save corruption/i);
  const onDisk = JSON.parse(await fs.readFile(path.join(dataDirectory, 'state.json'), 'utf8'));
  assert.match(onDisk.lastDecision.candidateSnapshot.title, /save corruption/i);
  assert.equal(onDisk.lastProjectPath, SAMPLE);

  await app.close();
  const restarted = createApp({ dataDirectory, token: 'restarted-session-token' });
  try {
    const restartInfo = await restarted.listen(0);
    const restartBase = `http://127.0.0.1:${restartInfo.port}`;
    const bootstrap = await fetch(`${restartBase}/api/bootstrap`, {
      headers: { 'X-Session-Token': restarted.token, Origin: restartBase }
    });
    assert.equal(bootstrap.status, 200);
    const restored = await bootstrap.json();
    assert.match(restored.state.lastDecision.candidateSnapshot.title, /save corruption/i);
  } finally {
    await restarted.close();
  }
});

test('UI is self-contained and contains no remote resource URLs', async () => {
  const files = await Promise.all(['index.html', 'styles.css', 'app.js'].map((name) => fs.readFile(path.join(CONDITION_ROOT, 'src', 'ui', name), 'utf8')));
  const combined = files.join('\n');
  assert.doesNotMatch(combined, /https?:\/\//i);
  assert.doesNotMatch(combined, /cdn|analytics|telemetry/i);
  assert.match(files[0], /本地读取 · 项目只读/);
  assert.match(files[0], /三个可以开始的切入口/);
});
