import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrototypeServer } from '../src/server.mjs';

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(prototypeRoot, 'evidence', `.offline-state-${process.pid}`);
await mkdir(dataDirectory, { recursive: true });
const externalRequests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) externalRequests.push(url.href);
  return originalFetch(input, options);
};

let instance;
try {
  instance = await createPrototypeServer({ dataDirectory });
  const page = await fetch(instance.url);
  if (!page.ok) throw new Error(`Local page returned HTTP ${page.status}.`);
  const html = await page.text();
  for (const resource of ['/styles.css', '/app.mjs', '/core/input-parser.mjs', '/core/recommendation.mjs']) {
    const response = await fetch(`${instance.url}${resource}`);
    if (!response.ok) throw new Error(`Local resource failed: ${resource}`);
  }
  if (/<(?:img|iframe|object)\b/i.test(html) || /(?:src|href)=["']https?:/i.test(html)) {
    throw new Error('The page declares a remote-loadable asset.');
  }
  if (externalRequests.length) throw new Error(`External requests observed: ${externalRequests.join(', ')}`);
  console.log(`OFFLINE_OK loopback_requests=5 external_requests=${externalRequests.length}`);
} finally {
  globalThis.fetch = originalFetch;
  if (instance) await instance.close();
  await rm(dataDirectory, { recursive: true, force: true });
}
