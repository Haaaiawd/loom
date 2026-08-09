import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseProjectFiles } from '../../src/core/input-parser.mjs';
import { generateRecommendations } from '../../src/core/recommendation.mjs';

const conditionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(conditionRoot, relativePath), 'utf8'));
}

async function sampleBundle(backlogMutation = (value) => value) {
  const backlog = backlogMutation(await readFile(path.join(conditionRoot, 'sample-project/BACKLOG.md'), 'utf8'));
  const git = await readFile(path.join(conditionRoot, 'sample-project/GIT_LOG.txt'), 'utf8');
  return (await parseProjectFiles([
    { name: 'BACKLOG.md', content: backlog },
    { name: 'GIT_LOG.txt', content: git }
  ])).bundle;
}

function fixtureProjection(value) {
  return {
    role: value.role,
    recentChanges: value.recentChanges,
    candidates: value.candidates.map((candidate) => ({
      id: candidate.id,
      actionType: candidate.actionType,
      title: candidate.title,
      anchorEvidenceRef: candidate.anchorEvidenceRef,
      sourceFact: candidate.reasons.find(({ classification }) => classification === 'source_fact')?.text
    }))
  };
}

test('sample programmer and artist outputs implement the contract fixtures', async () => {
  const bundle = await sampleBundle();
  for (const [role, fixturePath] of [
    ['programmer', 'prototype/test/fixtures/programmer.expected.json'],
    ['artist', 'prototype/test/fixtures/artist.expected.json']
  ]) {
    const actual = generateRecommendations(bundle, role);
    const expected = await json(fixturePath);
    assert.deepEqual(fixtureProjection(actual), fixtureProjection(expected));
  }
});

test('risk and role policy stay visible without turning Git recency into work', async () => {
  const bundle = await sampleBundle();
  const programmer = generateRecommendations(bundle, 'programmer');
  const artist = generateRecommendations(bundle, 'artist');
  assert.equal(programmer.candidates[0].anchorEvidenceRef, 'backlog:line:6');
  assert.ok(programmer.candidates[0].reasons.some(({ classification }) => classification === 'bounded_inference'));
  assert.deepEqual(artist.candidates.map(({ actionType }) => actionType), ['direct', 'direct', 'coordination']);
  assert.ok(
    [...programmer.candidates, ...artist.candidates].every(({ anchorEvidenceRef }) =>
      anchorEvidenceRef.startsWith('backlog:')
    )
  );
});

test('mutated input changes recommendation provenance and facts', async () => {
  const original = generateRecommendations(await sampleBundle(), 'programmer');
  const mutated = generateRecommendations(
    await sampleBundle((text) => text.replace('north trigger', 'south trigger')),
    'programmer'
  );
  const originalFact = original.candidates.find(({ anchorEvidenceRef }) => anchorEvidenceRef === 'backlog:line:3').reasons[0].text;
  const mutatedFact = mutated.candidates.find(({ anchorEvidenceRef }) => anchorEvidenceRef === 'backlog:line:3').reasons[0].text;
  assert.match(originalFact, /north trigger/);
  assert.match(mutatedFact, /south trigger/);
  assert.notEqual(mutatedFact, originalFact);
});

test('insufficient evidence is not padded and invalid roles fail closed', async () => {
  const bundle = (await parseProjectFiles([
    { name: 'BACKLOG.md', content: '- Replace placeholder ambience in the flooded archive.\n' },
    { name: 'GIT_LOG.txt', content: '' }
  ])).bundle;
  const result = generateRecommendations(bundle, 'artist');
  assert.equal(result.candidates.length, 1);
  assert.equal(result.shortfall.code, 'insufficient_distinct_evidence');
  assert.equal(result.shortfall.missingCount, 2);
  assert.throws(
    () => generateRecommendations(bundle, 'wizard'),
    (error) => error.code === 'invalid_role'
  );
});
