import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const conditionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function loadJson(relativePath) {
  return JSON.parse(await readFile(path.join(conditionRoot, relativePath), 'utf8'));
}

const [evidenceSchema, recommendationSchema, programmer, artist, shortfall, backlogRaw, gitRaw] =
  await Promise.all([
    loadJson('prototype/contracts/evidence.schema.json'),
    loadJson('prototype/contracts/recommendation.schema.json'),
    loadJson('prototype/test/fixtures/programmer.expected.json'),
    loadJson('prototype/test/fixtures/artist.expected.json'),
    loadJson('prototype/test/fixtures/insufficient-evidence.expected.json'),
    readFile(path.join(conditionRoot, 'sample-project/BACKLOG.md'), 'utf8'),
    readFile(path.join(conditionRoot, 'sample-project/GIT_LOG.txt'), 'utf8')
  ]);

const roles = new Set(['producer_designer', 'programmer', 'artist']);
const actionTypes = new Set(['direct', 'coordination', 'clarification']);
const reasonClasses = new Set(['source_fact', 'bounded_inference']);
const orderingKinds = new Set([
  'role_actionability',
  'explicit_risk_or_blocker',
  'action_type',
  'recent_context'
]);
const candidateKeys = new Set([
  'id',
  'actionType',
  'title',
  'role',
  'anchorEvidenceRef',
  'evidenceRefs',
  'reasons',
  'unknowns',
  'orderingReasons'
]);

const backlogByRef = new Map(
  backlogRaw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    return match ? [[`backlog:line:${index + 1}`, match[1]]] : [];
  })
);
const gitByRef = new Map(
  gitRaw.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^([0-9a-fA-F]{7,40})\s+(.+)$/);
    return match ? [[`git_log:line:${index + 1}`, { hash: match[1], message: match[2] }]] : [];
  })
);

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must contain distinct values`);
}

function assertExactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    assert.ok(allowed.has(key), `${label} contains unsupported field '${key}'`);
  }
  for (const key of allowed) {
    assert.ok(Object.hasOwn(value, key), `${label} is missing '${key}'`);
  }
}

function assertNoInventedMetadata(value) {
  const forbiddenKeys = new Set([
    'owner',
    'assignee',
    'deadline',
    'dueDate',
    'verifiedSeverity',
    'severity',
    'dependency',
    'dependencies',
    'dailyGoal',
    'freeTextGoal'
  ]);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const [key, child] of Object.entries(node)) {
      assert.ok(!forbiddenKeys.has(key), `fixture invents unsupported metadata field '${key}'`);
      visit(child);
    }
  };
  visit(value);
}

function assertCandidateSet(value) {
  assert.equal(value.schemaVersion, 1);
  assert.ok(roles.has(value.role), 'role must be fixed and supported');
  assert.ok(Array.isArray(value.recentChanges));
  assert.ok(Array.isArray(value.candidates));
  assert.ok(value.candidates.length <= 3, 'candidate count must not exceed three');

  for (const change of value.recentChanges) {
    assert.deepEqual(Object.keys(change).sort(), ['evidenceRef', 'summary']);
    const source = gitByRef.get(change.evidenceRef);
    assert.ok(source, `recent change ${change.evidenceRef} must come from GIT_LOG.txt`);
    assert.equal(change.summary, source.message, 'recent-change summary must preserve the commit message');
  }

  const anchors = [];
  const ids = [];
  for (const candidate of value.candidates) {
    assertExactKeys(candidate, candidateKeys, candidate.id ?? 'candidate');
    assert.match(candidate.id, /^candidate:[a-z0-9-]+$/);
    assert.ok(actionTypes.has(candidate.actionType));
    assert.equal(candidate.role, value.role, 'candidate role must match the selected role');
    assert.ok(backlogByRef.has(candidate.anchorEvidenceRef), 'a candidate must anchor an open backlog item');
    assert.ok(candidate.evidenceRefs.includes(candidate.anchorEvidenceRef));
    assertUnique(candidate.evidenceRefs, `${candidate.id} evidenceRefs`);
    assert.ok(candidate.evidenceRefs.every((ref) => backlogByRef.has(ref) || gitByRef.has(ref)));
    assert.ok(Array.isArray(candidate.reasons) && candidate.reasons.length > 0);
    assert.ok(Array.isArray(candidate.unknowns));
    assertUnique(candidate.unknowns, `${candidate.id} unknowns`);
    assert.ok(Array.isArray(candidate.orderingReasons) && candidate.orderingReasons.length > 0);

    for (const reason of candidate.reasons) {
      assert.deepEqual(Object.keys(reason).sort(), ['classification', 'evidenceRefs', 'text']);
      assert.ok(reasonClasses.has(reason.classification));
      assert.ok(reason.text.length > 0);
      assert.ok(reason.evidenceRefs.length > 0);
      assertUnique(reason.evidenceRefs, `${candidate.id} reason evidenceRefs`);
      assert.ok(reason.evidenceRefs.every((ref) => candidate.evidenceRefs.includes(ref)));
    }
    const anchorText = backlogByRef.get(candidate.anchorEvidenceRef);
    assert.ok(
      candidate.reasons.some(
        (reason) =>
          reason.classification === 'source_fact' &&
          reason.evidenceRefs.includes(candidate.anchorEvidenceRef) &&
          reason.text.includes(anchorText)
      ),
      `${candidate.id} must quote its anchor as source_fact`
    );

    for (const reason of candidate.orderingReasons) {
      assert.ok(orderingKinds.has(reason.kind));
      assert.ok(typeof reason.explanation === 'string' && reason.explanation.length > 0);
      if (reason.evidenceRefs) {
        assert.ok(reason.evidenceRefs.every((ref) => candidate.evidenceRefs.includes(ref)));
      }
    }
    anchors.push(candidate.anchorEvidenceRef);
    ids.push(candidate.id);
  }
  assertUnique(anchors, 'candidate anchors');
  assertUnique(ids, 'candidate ids');

  if (value.candidates.length < 3) {
    assert.deepEqual(Object.keys(value.shortfall).sort(), ['code', 'explanation', 'missingCount']);
    assert.equal(value.shortfall.code, 'insufficient_distinct_evidence');
    assert.equal(value.shortfall.missingCount, 3 - value.candidates.length);
  } else {
    assert.ok(!Object.hasOwn(value, 'shortfall'), 'a full set must not report a shortfall');
  }
  assertNoInventedMetadata(value);
}

test('versioned JSON Schemas express provenance and recommendation vocabulary', () => {
  assert.equal(evidenceSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(evidenceSchema.properties.schemaVersion.const, 1);
  assert.equal(evidenceSchema.additionalProperties, false);
  assert.deepEqual(evidenceSchema.$defs.backlogEvidence.required, [
    'id', 'sourceType', 'locator', 'rawText', 'kind', 'text', 'order'
  ]);
  assert.equal(evidenceSchema.$defs.backlogEvidence.properties.sourceType.const, 'backlog');
  assert.equal(evidenceSchema.$defs.gitEvidence.properties.sourceType.const, 'git_log');
  assert.equal(evidenceSchema.$defs.backlogLocator.properties.file.const, 'BACKLOG.md');
  assert.equal(evidenceSchema.$defs.gitLocator.properties.file.const, 'GIT_LOG.txt');

  assert.equal(recommendationSchema.properties.schemaVersion.const, 1);
  assert.equal(recommendationSchema.properties.candidates.maxItems, 3);
  assert.deepEqual(
    recommendationSchema.$defs.candidate.properties.actionType.enum,
    ['direct', 'coordination', 'clarification']
  );
  assert.deepEqual(
    recommendationSchema.$defs.reason.properties.classification.enum,
    ['source_fact', 'bounded_inference']
  );
  assert.equal(
    recommendationSchema.$defs.shortfall.properties.code.const,
    'insufficient_distinct_evidence'
  );
  assert.ok(recommendationSchema.then.required.includes('shortfall'));
});

test('programmer fixture ranks bounded save-corruption investigation first', () => {
  assertCandidateSet(programmer);
  assert.equal(programmer.candidates[0].anchorEvidenceRef, 'backlog:line:6');
  assert.equal(programmer.candidates[0].actionType, 'direct');
  assert.ok(
    programmer.candidates[0].reasons.some(
      (reason) => reason.classification === 'bounded_inference' && /may risk player data loss/i.test(reason.text)
    )
  );
  assert.equal(programmer.candidates[1].anchorEvidenceRef, 'backlog:line:3');
  assert.equal(programmer.candidates[2].actionType, 'clarification');
});

test('artist fixture has two direct art items and one labelled cross-role coordination', () => {
  assertCandidateSet(artist);
  assert.deepEqual(
    artist.candidates.map(({ anchorEvidenceRef, actionType }) => [anchorEvidenceRef, actionType]),
    [
      ['backlog:line:5', 'direct'],
      ['backlog:line:7', 'direct'],
      ['backlog:line:6', 'coordination']
    ]
  );
  assert.match(artist.candidates[2].title, /confirm ownership and status/i);
});

test('insufficient evidence returns fewer candidates and an exact shortfall', () => {
  assertCandidateSet(shortfall);
  assert.equal(shortfall.candidates.length, 1);
  assert.equal(shortfall.shortfall.missingCount, 2);
  assert.match(shortfall.shortfall.explanation, /rather than being padded/i);
});

test('the executable oracle rejects duplicate anchors and missing shortfall', () => {
  const duplicate = JSON.parse(JSON.stringify(programmer));
  duplicate.candidates[1] = JSON.parse(JSON.stringify(duplicate.candidates[0]));
  duplicate.candidates[1].id = 'candidate:programmer-duplicate-save-anchor';
  assert.throws(() => assertCandidateSet(duplicate), /candidate anchors must contain distinct values/);

  const unlabelledShortfall = JSON.parse(JSON.stringify(shortfall));
  delete unlabelledShortfall.shortfall;
  assert.throws(() => assertCandidateSet(unlabelledShortfall));
});
