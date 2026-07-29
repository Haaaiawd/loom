// preview — 输出提示词，让 AI 读 .loom/ 文件并生成 HTML，并检查投影新鲜度。
// CLI 不生成 HTML。AI 自己读文件、重组信息、生成 HTML。

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readCurrentPointer } from './shared/paths.js';

const PROMPT_PATH = new URL('./preview-prompt.md', import.meta.url);
const SOURCE_FILE_NAMES = new Set([
  '01_VISION.md',
  '02_ARCHITECTURE.md',
  '04_INTENT_MAP.json',
  '05_VERIFICATION.md',
  '06_CHANGELOG.json',
  '06_CHANGELOG.md',
]);

/**
 * 输出 preview 提示词。
 * @returns {string}
 */
export function generatePreviewPrompt() {
  return readFileSync(PROMPT_PATH, 'utf-8');
}

function shouldIncludeSource(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop();
  if (SOURCE_FILE_NAMES.has(fileName)) return true;
  return normalized.includes('/00_PHILOSOPHY/')
    || normalized.includes('/03_DECISIONS/')
    || normalized.includes('/verifications/');
}

function collectSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, files);
    } else if (shouldIncludeSource(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function getPreviewStatus(projectDir) {
  const previewPath = join(projectDir, 'loom-preview.html');
  const loomRoot = join(projectDir, '.loom');
  const current = readCurrentPointer(loomRoot);
  const versionDir = current ? join(loomRoot, current) : null;
  const sourceFiles = versionDir ? collectSourceFiles(versionDir) : [];
  const latestSource = sourceFiles
    .map((filePath) => ({ filePath, mtimeMs: statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;

  const exists = existsSync(previewPath);
  const previewMtimeMs = exists ? statSync(previewPath).mtimeMs : null;
  const sourceLatestMtimeMs = latestSource?.mtimeMs ?? null;
  const fresh = exists && sourceLatestMtimeMs !== null && previewMtimeMs >= sourceLatestMtimeMs;

  return {
    exists,
    fresh,
    version: current,
    preview_path: previewPath,
    preview_mtime: previewMtimeMs ? new Date(previewMtimeMs).toISOString() : null,
    source_latest_mtime: sourceLatestMtimeMs ? new Date(sourceLatestMtimeMs).toISOString() : null,
    latest_source_file: latestSource ? relative(projectDir, latestSource.filePath).replace(/\\/g, '/') : null,
    next_command: fresh ? 'loom preview' : 'loom preview --regen',
  };
}
