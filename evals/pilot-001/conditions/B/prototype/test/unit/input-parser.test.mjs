import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MAX_FILE_BYTES, parseProjectFiles } from '../../src/core/input-parser.mjs';

const conditionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sampleRoot = path.join(conditionRoot, 'sample-project');

function input(name, content, size) {
  return { name, content, ...(size === undefined ? {} : { size }) };
}

async function sampleInputs() {
  return [
    input('BACKLOG.md', await readFile(path.join(sampleRoot, 'BACKLOG.md'), 'utf8')),
    input('GIT_LOG.txt', await readFile(path.join(sampleRoot, 'GIT_LOG.txt'), 'utf8'))
  ];
}

test('parses the supplied CRLF/LF-compatible inputs with stable provenance', async () => {
  const { bundle, warnings } = await parseProjectFiles(await sampleInputs());
  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.backlog.length, 5);
  assert.equal(bundle.recentChanges.length, 4);
  assert.equal(bundle.backlog[0].id, 'backlog:line:3');
  assert.deepEqual(bundle.backlog[0].locator, { file: 'BACKLOG.md', line: 3 });
  assert.equal(bundle.recentChanges[0].hash, '9d7a4c1');
  assert.deepEqual(warnings, []);

  const crlf = (await sampleInputs()).map((file) => ({ ...file, content: file.content.replace(/\n/g, '\r\n') }));
  const reparsed = await parseProjectFiles(crlf);
  assert.deepEqual(
    reparsed.bundle.backlog.map(({ id, text }) => ({ id, text })),
    bundle.backlog.map(({ id, text }) => ({ id, text }))
  );
});

test('reports malformed lines while preserving hostile text as inert evidence', async () => {
  const hostile = await readFile(
    path.join(conditionRoot, 'prototype/test/fixtures/negative/hostile-backlog.md'),
    'utf8'
  );
  const malformed = await readFile(
    path.join(conditionRoot, 'prototype/test/fixtures/negative/malformed-git.txt'),
    'utf8'
  );
  const { bundle, warnings } = await parseProjectFiles([
    input('BACKLOG.md', hostile),
    input('GIT_LOG.txt', malformed)
  ]);
  assert.equal(bundle.backlog.length, 1);
  assert.match(bundle.backlog[0].text, /fetch\('https:\/\/example\.invalid'\)/);
  assert.match(bundle.backlog[0].text, /\$\(calc\.exe\)/);
  assert.equal(bundle.recentChanges.length, 1);
  assert.deepEqual(
    warnings.map(({ code }) => code).sort(),
    ['malformed_git_line', 'unsupported_backlog_line']
  );
});

test('changed copied content changes parsed evidence without touching the sample', async () => {
  const files = await sampleInputs();
  const original = files[0].content;
  const mutated = original.replace('north trigger', 'south trigger');
  const before = await parseProjectFiles(files);
  const after = await parseProjectFiles([input('BACKLOG.md', mutated), files[1]]);
  assert.notEqual(after.bundle.backlog[0].rawText, before.bundle.backlog[0].rawText);
  assert.match(after.bundle.backlog[0].text, /south trigger/);
  assert.equal(await readFile(path.join(sampleRoot, 'BACKLOG.md'), 'utf8'), original);
});

test('returns an honest empty-backlog signal and rejects unsafe selections', async () => {
  const empty = await parseProjectFiles([
    input('BACKLOG.md', '# Nothing open\n'),
    input('GIT_LOG.txt', '')
  ]);
  assert.deepEqual(empty.bundle.backlog, []);
  assert.ok(empty.warnings.some(({ code }) => code === 'empty_backlog'));

  await assert.rejects(
    () => parseProjectFiles([input('GIT_LOG.txt', '')]),
    (error) => error.code === 'missing_backlog'
  );
  await assert.rejects(
    () => parseProjectFiles([input('BACKLOG.md', '- Safe')]),
    (error) => error.code === 'missing_git_fixture'
  );
  await assert.rejects(
    () => parseProjectFiles([input('BACKLOG.md', '- A'), input('BACKLOG.md', '- B'), input('GIT_LOG.txt', '')]),
    (error) => error.code === 'duplicate_expected_file'
  );
  await assert.rejects(
    () => parseProjectFiles([input('BACKLOG.md', '- A', MAX_FILE_BYTES + 1), input('GIT_LOG.txt', '')]),
    (error) => error.code === 'file_too_large'
  );
});
