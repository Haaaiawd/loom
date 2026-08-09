import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrototypeServer } from '../../src/server.mjs';

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataDirectory = path.join(prototypeRoot, 'evidence', `.smoke-state-${process.pid}`);
await mkdir(dataDirectory, { recursive: true });
let instance;
try {
  console.log(`NODE_VERSION ${process.version}`);
  instance = await createPrototypeServer({ dataDirectory });
  console.log(`READY ${instance.url}`);
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(instance.url)) throw new Error('Server did not bind an assigned loopback port.');
  const state = {
    schemaVersion: 1,
    projectLabel: 'Moonwake smoke fixture',
    role: 'programmer',
    outcome: 'skipped',
    recordedAt: '2026-08-09T12:00:00.000Z'
  };
  const headers = { 'X-Launch-Token': instance.token, 'Content-Type': 'application/json' };
  let response = await fetch(`${instance.url}/api/state`, { method: 'PUT', headers, body: JSON.stringify(state) });
  if (!response.ok) throw new Error(`State PUT failed with ${response.status}.`);
  response = await fetch(`${instance.url}/api/state`, { headers: { 'X-Launch-Token': instance.token } });
  const restored = (await response.json()).state;
  if (JSON.stringify(restored) !== JSON.stringify(state)) throw new Error('State round trip did not match.');
  console.log('STATE_ROUND_TRIP true');
  await instance.close();
  instance = null;
  console.log('GRACEFUL_SHUTDOWN true');
} finally {
  if (instance) await instance.close();
  await rm(dataDirectory, { recursive: true, force: true });
}
