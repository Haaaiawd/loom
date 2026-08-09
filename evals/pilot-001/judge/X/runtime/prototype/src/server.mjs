import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStateStore } from './state/store.mjs';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const MAX_STATE_BYTES = 16 * 1024;
const staticFiles = new Map([
  ['/styles.css', ['ui/styles.css', 'text/css; charset=utf-8']],
  ['/app.mjs', ['ui/app.mjs', 'text/javascript; charset=utf-8']],
  ['/core/input-parser.mjs', ['core/input-parser.mjs', 'text/javascript; charset=utf-8']],
  ['/core/recommendation.mjs', ['core/recommendation.mjs', 'text/javascript; charset=utf-8']]
]);

function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(value));
}

function requestIsLocal(request) {
  return /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(request.headers.host ?? '');
}

function originIsLocal(request) {
  const origin = request.headers.origin;
  return !origin || origin === `http://${request.headers.host}`;
}

async function readStateBody(request) {
  const declared = Number(request.headers['content-length'] ?? 0);
  if (declared > MAX_STATE_BYTES) throw Object.assign(new Error('State body exceeds 16 KiB.'), { code: 'body_too_large' });
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_STATE_BYTES) throw Object.assign(new Error('State body exceeds 16 KiB.'), { code: 'body_too_large' });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('State body must be valid JSON.'), { code: 'invalid_json' });
  }
}

export async function createPrototypeServer({ dataDirectory, port = 0, token = randomBytes(24).toString('hex') } = {}) {
  const store = createStateStore({ dataDirectory });
  const indexTemplate = await readFile(path.join(sourceRoot, 'ui/index.html'), 'utf8');

  const server = http.createServer(async (request, response) => {
    try {
      if (!requestIsLocal(request) || !originIsLocal(request)) {
        sendJson(response, 403, { code: 'forbidden_origin', message: 'Only this loopback app may access the service.' });
        return;
      }
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        if (request.headers['x-launch-token'] !== token) {
          sendJson(response, 401, { code: 'invalid_launch_token', message: 'Launch token is missing or invalid.' });
          return;
        }
        if (url.pathname === '/api/state' && request.method === 'GET') {
          sendJson(response, 200, await store.read());
          return;
        }
        if (url.pathname === '/api/state' && request.method === 'PUT') {
          if (!(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
            sendJson(response, 415, { code: 'unsupported_content_type', message: 'Use application/json.' });
            return;
          }
          const state = await readStateBody(request);
          await store.write(state);
          sendJson(response, 200, { state });
          return;
        }
        sendJson(response, 404, { code: 'not_found', message: 'No such API endpoint.' });
        return;
      }
      if (request.method !== 'GET') {
        sendJson(response, 405, { code: 'method_not_allowed', message: 'Only GET is allowed for app assets.' });
        return;
      }
      if (url.pathname === '/') {
        const html = indexTemplate.replace('__LAUNCH_TOKEN__', token);
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          'X-Content-Type-Options': 'nosniff'
        });
        response.end(html);
        return;
      }
      const entry = staticFiles.get(url.pathname);
      if (!entry) {
        sendJson(response, 404, { code: 'not_found', message: 'No such app resource.' });
        return;
      }
      response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(await readFile(path.join(sourceRoot, entry[0])));
    } catch (error) {
      const status = error.code === 'body_too_large' ? 413 : error.code === 'invalid_json' || error.code === 'invalid_state' ? 400 : 500;
      sendJson(response, status, { code: error.code ?? 'internal_error', message: error.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  return {
    server,
    url,
    token,
    store,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const instance = await createPrototypeServer();
  console.log(`READY ${instance.url}`);
  const close = async () => {
    await instance.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
