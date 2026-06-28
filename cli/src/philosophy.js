// philosophy.js — 按锚点加载哲学文档的特定章节
// 哲学文档是 MD，锚点格式: "PRODUCT_PHILOSOPHY.md#core-belief"
// 这个库按锚点提取对应章节，不返回整个文件。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractMdSection } from './shared/md-utils.js';

/**
 * 解析锚点字符串。
 * @param {string} anchor — "FILE.md#section" 或 "FILE.md"
 * @returns {{ file: string, section: string|null }}
 */
export function parseAnchor(anchor) {
  const [file, section] = anchor.split('#');
  return { file: file.trim(), section: section ? section.trim() : null };
}

/**
 * 按锚点加载哲学文档内容。
 * @param {string} philosophyDir — 00_PHILOSOPHY/ 目录路径
 * @param {string} anchor — "PRODUCT_PHILOSOPHY.md#core-belief"
 * @returns {string} MD 文本（章节或整个文件）
 */
export function getPhilosophy(philosophyDir, anchor) {
  const { file, section } = parseAnchor(anchor);
  const filePath = join(philosophyDir, file);

  if (!existsSync(filePath)) {
    throw new Error(`哲学文档不存在: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  return extractMdSection(content, section, '哲学');
}

/**
 * 列出哲学目录下所有 .md 文件名。
 */
export function listPhilosophyFiles(philosophyDir) {
  if (!existsSync(philosophyDir)) {
    throw new Error(`哲学目录不存在: ${philosophyDir}`);
  }
  const dir = readdirSync(philosophyDir);
  return dir.filter((f) => f.endsWith('.md'));
}
