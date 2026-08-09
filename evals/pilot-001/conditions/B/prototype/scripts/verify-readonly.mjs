import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseProjectFiles } from '../src/core/input-parser.mjs';
import { generateRecommendations } from '../src/core/recommendation.mjs';

async function hashTree(root) {
  const hash = createHash('sha256');
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        hash.update(relative);
        hash.update(await readFile(absolute));
      }
    }
  }
  await visit(root);
  return hash.digest('hex');
}

const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: node prototype/scripts/verify-readonly.mjs <project-directory>');
const projectRoot = path.resolve(inputPath);
if (!(await stat(projectRoot)).isDirectory()) throw new Error('Project input must be a directory.');
const before = await hashTree(projectRoot);
const [backlog, git] = await Promise.all([
  readFile(path.join(projectRoot, 'BACKLOG.md'), 'utf8'),
  readFile(path.join(projectRoot, 'GIT_LOG.txt'), 'utf8')
]);
const { bundle } = await parseProjectFiles([
  { name: 'BACKLOG.md', content: backlog },
  { name: 'GIT_LOG.txt', content: git }
]);
const programmer = generateRecommendations(bundle, 'programmer');
const artist = generateRecommendations(bundle, 'artist');
const after = await hashTree(projectRoot);
if (before !== after) throw new Error(`READONLY_FAIL before=${before} after=${after}`);
console.log(`READONLY_OK before=${before} after=${after}`);
console.log(`ANALYSIS_OK programmer=${programmer.candidates.length} artist=${artist.candidates.length}`);
