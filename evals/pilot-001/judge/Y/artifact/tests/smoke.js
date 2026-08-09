'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createApp } = require('../src/server');

(async () => {
  const dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'start-workbench-smoke-'));
  const app = createApp({ dataDirectory });
  try {
    const { port, url } = await app.listen(0);
    const base = `http://127.0.0.1:${port}`;
    const headers = { 'Content-Type': 'application/json', 'X-Session-Token': app.token, Origin: base };
    const page = await fetch(url);
    if (!page.ok || !(await page.text()).includes('开工台')) throw new Error('本地页面未正确提供。');
    const health = await fetch(`${base}/api/health`, { headers });
    if (!health.ok) throw new Error('健康检查失败。');
    process.stdout.write(`SMOKE_OK loopback=127.0.0.1 port=${port} page=200 health=200\n`);
  } finally {
    await app.close();
    await fs.rm(dataDirectory, { recursive: true, force: true });
  }
})().catch((error) => {
  process.stderr.write(`SMOKE_FAILED ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
