'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { scanProject, ProjectError } = require('./project');
const { generateCandidates } = require('./candidates');
const { StateStore } = require('./state');

const ROOT = path.resolve(__dirname, '..');
const UI_ROOT = path.join(__dirname, 'ui');
const DEFAULT_DATA_DIR = process.env.START_WORKBENCH_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'StartWorkbench');
const MAX_BODY = 1024 * 1024;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) {
      const error = new Error('请求体超过 1 MiB。');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('请求体不是有效 JSON。');
    error.status = 400;
    throw error;
  }
}

function folderDialog() {
  return new Promise((resolve, reject) => {
    const script = path.join(ROOT, 'scripts', 'choose-folder.ps1');
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script], {
      cwd: ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 2) return resolve(null);
      if (code !== 0) return reject(new Error(stderr.trim() || '文件夹选择器启动失败。'));
      resolve(stdout.trim() || null);
    });
  });
}

function createApp(options = {}) {
  const token = options.token || crypto.randomBytes(24).toString('base64url');
  const store = new StateStore(options.dataDirectory || DEFAULT_DATA_DIR);
  let port = null;
  let currentSnapshot = null;

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");

    const host = req.headers.host || '';
    if (!new RegExp(`^(127\\.0\\.0\\.1|localhost):${port}$`, 'i').test(host)) {
      return json(res, 403, { error: { code: 'HOST_REJECTED', message: '仅接受当前 loopback 服务 Host。' } });
    }

    const url = new URL(req.url, `http://${host}`);
    if (url.pathname.startsWith('/api/')) {
      const suppliedToken = req.headers['x-session-token'] || url.searchParams.get('token');
      if (suppliedToken !== token) return json(res, 401, { error: { code: 'TOKEN_REQUIRED', message: '会话令牌无效。' } });
      const origin = req.headers.origin;
      if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
        return json(res, 403, { error: { code: 'ORIGIN_REJECTED', message: '拒绝非本地页面来源。' } });
      }
    }

    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        return json(res, 200, { ok: true, address: '127.0.0.1' });
      }
      if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
        return json(res, 200, {
          state: store.snapshot(),
          stateWarning: store.warning,
          dataDirectory: store.dataDirectory,
          boundaries: ['仅读取项目根目录中的 BACKLOG.md 与 Git 历史来源', '不会修改或执行项目内容', '完全本地、离线、无账号、无遥测']
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/folder-dialog') {
        return json(res, 200, { path: await folderDialog() });
      }
      if (req.method === 'POST' && url.pathname === '/api/projects/scan') {
        const body = await readJson(req);
        currentSnapshot = await scanProject(body.path);
        return json(res, 200, currentSnapshot);
      }
      if (req.method === 'POST' && url.pathname === '/api/candidates') {
        const body = await readJson(req);
        if (!currentSnapshot || body.snapshotId !== currentSnapshot.snapshotId) {
          return json(res, 409, { error: { code: 'SNAPSHOT_STALE', message: '请重新扫描项目后再更新候选。' } });
        }
        return json(res, 200, generateCandidates(currentSnapshot, body.role, body.goal, body.skippedIds));
      }
      if (req.method === 'POST' && url.pathname === '/api/decision') {
        const body = await readJson(req);
        if (!currentSnapshot || body.snapshotId !== currentSnapshot.snapshotId) {
          return json(res, 409, { error: { code: 'SNAPSHOT_STALE', message: '候选已过期，请重新扫描。' } });
        }
        const generated = generateCandidates(currentSnapshot, body.role, body.goal, body.skippedIds || []);
        const candidate = generated.candidates.find((entry) => entry.id === body.candidateId);
        if (!candidate) return json(res, 400, { error: { code: 'CANDIDATE_INVALID', message: '选择不属于当前候选。' } });
        const decision = {
          projectId: currentSnapshot.project.id,
          selectedAt: new Date().toISOString(),
          candidateSnapshot: candidate
        };
        const context = { lastProjectPath: currentSnapshot.project.path, role: body.role, todayGoal: body.goal || '' };
        if (body.consentToSave === true) {
          const state = await store.save({
            ...store.snapshot(),
            ...context,
            consentedAt: store.snapshot().consentedAt || new Date().toISOString(),
            lastDecision: decision
          });
          return json(res, 200, { persisted: true, state });
        }
        return json(res, 200, { persisted: false, state: store.setMemoryDecision(decision, context) });
      }
      if (req.method === 'DELETE' && url.pathname === '/api/decision') {
        return json(res, 200, { state: await store.clearDecision() });
      }
      if (req.method === 'DELETE' && url.pathname === '/api/local-state') {
        return json(res, 200, { state: await store.clearAll() });
      }

      if (req.method !== 'GET') return json(res, 404, { error: { code: 'NOT_FOUND', message: '未找到本地接口。' } });
      const files = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
        '/styles.css': ['styles.css', 'text/css; charset=utf-8']
      };
      const selected = files[url.pathname];
      if (!selected) return json(res, 404, { error: { code: 'NOT_FOUND', message: '未找到本地资源。' } });
      const content = await fs.readFile(path.join(UI_ROOT, selected[0]));
      res.writeHead(200, { 'Content-Type': selected[1] });
      return res.end(content);
    } catch (error) {
      const status = error.status || (error instanceof ProjectError ? error.status : 500);
      return json(res, status, {
        error: {
          code: error.code || 'INTERNAL_ERROR',
          message: status >= 500 && !error.code ? '本地服务遇到未预期错误。' : error.message
        }
      });
    }
  });

  return {
    token,
    store,
    server,
    async listen(requestedPort = 0) {
      await store.load();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(requestedPort, '127.0.0.1', resolve);
      });
      port = server.address().port;
      return { port, url: `http://127.0.0.1:${port}/?token=${encodeURIComponent(token)}` };
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

function openBrowser(url) {
  const child = spawn('cmd.exe', ['/d', '/s', '/c', 'start', '', url], {
    cwd: ROOT,
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
}

if (require.main === module) {
  const app = createApp();
  app.listen(Number(process.env.START_WORKBENCH_PORT || 0)).then(({ url, port }) => {
    process.stdout.write(`开工台正在运行：http://127.0.0.1:${port}/\n`);
    process.stdout.write('项目只读 · 完全本地 · 按 Ctrl+C 停止\n');
    if (process.argv.includes('--open')) openBrowser(url);
    else process.stdout.write(`${url}\n`);
  }).catch((error) => {
    process.stderr.write(`启动失败：${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { createApp };
