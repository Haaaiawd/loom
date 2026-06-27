// preview — 输出提示词，让 AI 读 .loom/ 文件并生成 HTML
// CLI 不收集数据、不生成 HTML。AI 自己读文件、重组信息、生成 HTML。
// 因为都是同一个 Agent 负责的，它就在项目目录里，能直接读文件。

import { readFileSync } from 'node:fs';

const PROMPT_PATH = new URL('./preview-prompt.md', import.meta.url);

/**
 * 输出 preview 提示词。
 * @returns {string}
 */
export function generatePreviewPrompt() {
  return readFileSync(PROMPT_PATH, 'utf-8');
}
