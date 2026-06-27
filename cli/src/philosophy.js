// philosophy.js — 按锚点加载哲学文档的特定章节
// 哲学文档是 MD，锚点格式: "PRODUCT_PHILOSOPHY.md#core-belief"
// 这个库按锚点提取对应章节，不返回整个文件。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
 * 从 heading 文本中提取显式锚点。
 * 支持 Pandoc/MDX 风格语法: "## 核心信念 {#core-belief}"
 * @returns {string|null} 显式锚点 slug，或 null（无显式锚点时）
 */
function extractExplicitAnchor(headingText) {
  const match = headingText.match(/\{#([\w-]+)\}\s*$/);
  return match ? match[1] : null;
}

/**
 * 从 heading 文本生成 slug（fallback，无显式锚点时用）。
 * 规则：小写、去除 \r、空格转连字符、去除非 [a-z0-9_-] 字符。
 * 注意：\w 不匹配中文，所以中文标题的 slug 会是空的——
 * 这就是为什么哲学文档应该用显式锚点 {#anchor} 标注中文标题。
 */
function slugify(text) {
  return text
    .replace(/\r/g, '')           // strip CRLF 的 \r
    .replace(/\{#[\w-]+\}\s*$/, '') // 去掉显式锚点标记
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')     // \w = [a-zA-Z0-9_]
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

/**
 * 从 MD 内容中提取指定 section 的内容（到下一个同级或更高级 heading 为止）。
 * 如果 section 为 null，返回整个文件。
 * 支持显式锚点 {#slug} 和自动 slugify 两种方式匹配。
 */
function extractSection(content, sectionSlug) {
  if (!sectionSlug) return content;

  const lines = content.split('\n');
  let capturing = false;
  let targetLevel = 0;
  const captured = [];

  for (const line of lines) {
    // strip \r 以兼容 Windows CRLF
    const cleanLine = line.replace(/\r$/, '');
    const headingMatch = cleanLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      // 优先用显式锚点，没有再 fallback 到 slugify
      const slug = extractExplicitAnchor(headingText) || slugify(headingText);

      if (capturing && level <= targetLevel) {
        break;
      }
      if (slug === sectionSlug) {
        capturing = true;
        targetLevel = level;
        captured.push(cleanLine);
        continue;
      }
    }
    if (capturing) {
      captured.push(cleanLine);
    }
  }

  if (captured.length === 0) {
    throw new Error(`章节未找到: #${sectionSlug}`);
  }
  return captured.join('\n').trim();
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
  return extractSection(content, section);
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
