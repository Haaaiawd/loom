import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const conditionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const [html, css, app] = await Promise.all([
  readFile(path.join(conditionRoot, 'prototype/src/ui/index.html'), 'utf8'),
  readFile(path.join(conditionRoot, 'prototype/src/ui/styles.css'), 'utf8'),
  readFile(path.join(conditionRoot, 'prototype/src/ui/app.mjs'), 'utf8')
]);

test('keyboard-visible UI exposes fixed role, folder, accept, and skip controls', () => {
  assert.match(html, /type="file" webkitdirectory multiple/);
  for (const role of ['producer_designer', 'programmer', 'artist']) assert.match(html, new RegExp(`value="${role}"`));
  assert.doesNotMatch(html, /type="text"[^>]*(goal|today)/i);
  assert.match(html, /id="skip"/);
  assert.match(app, /Accept this action/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 800px\)/);
});

test('idle, reading, ready, input_error, shortfall, accepted, skipped, and restored are reachable', () => {
  for (const state of ['idle', 'reading', 'ready', 'input_error', 'shortfall', 'accepted', 'skipped', 'restored']) {
    assert.ok(html.includes(state) || app.includes(state), `missing reachable UI state: ${state}`);
  }
  assert.match(app, /role\.addEventListener\('change'/);
  assert.match(app, /project-files.*addEventListener\('change'/s);
});

test('UI renders untrusted evidence as text and declares no remote assets', () => {
  assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(app, /copy\.textContent = value/);
  assert.match(app, /paragraph\('Source fact', fact\?\.text/);
  assert.doesNotMatch(html + css, /https?:\/\//);
  assert.doesNotMatch(html, /<img|<iframe|<object/);
  assert.match(html + app, /Source fact/);
  assert.match(app, /Possible impact \/ reasoning/);
  assert.match(app, /Unknown/);
});
