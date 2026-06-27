// preview — 收集项目数据 + 输出 AI 生成提示词
// CLI 不生成固定模板 HTML，而是收集数据 + 输出提示词，让 AI 生成定制化 HTML。
// 这样 AI 可以利用 HTML 的优势：SVG 依赖图、tabs、交互、颜色编码。
// 参考：https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readCurrentPointer } from './version.js';
import { loadIntentMap, getStatus } from './intent-map.js';

const PROMPT_PATH = new URL('./preview-prompt.md', import.meta.url);

/**
 * 收集项目数据用于 preview。
 * @param {string} projectDir — 项目根目录
 * @returns {{ data: object, prompt: string }}
 */
export function collectPreviewData(projectDir) {
  const cwd = projectDir || process.cwd();
  const loomRoot = join(cwd, '.loom');
  if (!existsSync(loomRoot)) {
    throw new Error('项目未初始化。运行 loom init。');
  }
  const current = readCurrentPointer(loomRoot);
  if (!current) {
    throw new Error('没有版本目录。运行 loom init。');
  }
  const versionDir = join(loomRoot, current);
  const philosophyDir = join(versionDir, '00_PHILOSOPHY');

  // 收集哲学文档
  const philosophy = {};
  if (existsSync(philosophyDir)) {
    for (const f of readdirSync(philosophyDir)) {
      if (f.endsWith('.md')) {
        philosophy[f] = readFileSync(join(philosophyDir, f), 'utf-8');
      }
    }
  }

  // 收集愿景/架构
  const vision = readFileIfExists(join(versionDir, '01_VISION.md'));
  const architecture = readFileIfExists(join(versionDir, '02_ARCHITECTURE.md'));

  // 收集 Intent Map + 状态
  const status = getStatus(versionDir);
  let intents = null;
  let topoOrder = null;
  try {
    const map = loadIntentMap(versionDir);
    intents = map.intents;
    topoOrder = map.topo_order;
  } catch { /* 模板或损坏 */ }

  // 收集验证记录
  const verificationsDir = join(versionDir, 'verifications');
  const verifications = {};
  if (existsSync(verificationsDir)) {
    for (const f of readdirSync(verificationsDir)) {
      if (f.endsWith('.json')) {
        const id = f.replace('.json', '');
        verifications[id] = JSON.parse(readFileSync(join(verificationsDir, f), 'utf-8'));
      }
    }
  }

  const data = {
    version: current,
    status: status.counts,
    philosophy,
    vision,
    architecture,
    intents,
    topo_order: topoOrder,
    verifications,
  };

  return data;
}

/**
 * 输出 preview 提示词（带数据注入）。
 * @param {string} projectDir — 项目根目录
 * @returns {{ prompt: string, data: object }}
 */
export function generatePreviewPrompt(projectDir) {
  const data = collectPreviewData(projectDir);
  const promptTemplate = readFileSync(PROMPT_PATH, 'utf-8');
  const prompt = promptTemplate.replace('{{LOOM_DATA}}', JSON.stringify(data, null, 2));
  return { prompt, data };
}

function readFileIfExists(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}
