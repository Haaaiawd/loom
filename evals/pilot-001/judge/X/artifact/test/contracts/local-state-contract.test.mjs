import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateLocalState } from '../../src/state/store.mjs';

const conditionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const schema = JSON.parse(
  await readFile(path.join(conditionRoot, 'prototype/contracts/local-state.schema.json'), 'utf8')
);
const accepted = {
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

test('local state schema is strict, versioned, and data-minimal', () => {
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.outcome.enum, ['accepted', 'skipped']);
  assert.equal(schema.$defs.candidateSnapshot.additionalProperties, false);
  assert.ok(!JSON.stringify(schema).includes('absolutePath'));
  assert.ok(!JSON.stringify(schema).includes('rawText'));
});

test('runtime validation accepts accepted/skipped state and rejects unsafe expansion', () => {
  assert.equal(validateLocalState(accepted), true);
  assert.equal(validateLocalState({
    schemaVersion: 1,
    projectLabel: 'Moonwake',
    role: 'artist',
    outcome: 'skipped',
    recordedAt: '2026-08-09T12:00:00.000Z'
  }), true);
  assert.equal(validateLocalState({ ...accepted, projectLabel: 'D:\\secret\\Moonwake' }), false);
  assert.equal(validateLocalState({ ...accepted, rawBacklog: '- secret' }), false);
  assert.equal(validateLocalState({ ...accepted, schemaVersion: 2 }), false);
  assert.equal(validateLocalState({ ...accepted, outcome: 'skipped' }), false);
});
