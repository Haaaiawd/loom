// shared/md-utils.js — MD 章节解析的公共工具
// 提取自 philosophy.js / intent-map.js / verify.js 三处重复实现。
// 统一 slugify + extractMdSection + 显式锚点逻辑，修中文标题 bug。

import { readFileSync, existsSync } from 'node:fs';

/**
 * 从 heading 文本中提取显式锚点。
 * 支持 Pandoc/MDX 风格语法: "## 核心信念 {#core-belief}"
 * @param {string} headingText — heading 文本（不含 # 前缀）
 * @returns {string|null} 显式锚点 slug，或 null（无显式锚点时）
 */
export function extractExplicitAnchor(headingText) {
  const match = headingText.match(/\{#([\w-]+)\}\s*$/);
  return match ? match[1] : null;
}

/**
 * 从 heading 文本生成 slug（fallback，无显式锚点时用）。
 * 规则：小写、去除 \r、空格转连字符、去除非 [a-z0-9_-] 字符。
 *
 * 中文标题处理：\w 不匹配中文，所以纯中文标题 slugify 后是空字符串。
 * 这是设计约束——中文标题必须用显式锚点 {#anchor} 标注。
 * slugify 返回空字符串时，调用方应给出明确错误提示。
 *
 * @param {string} text — heading 文本
 * @returns {string} slug（可能为空字符串——纯中文标题无显式锚点时）
 */
export function slugify(text) {
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
 * 如果 sectionSlug 为 null/空，返回整个文件。
 * 支持显式锚点 {#slug} 和自动 slugify 两种方式匹配。
 *
 * @param {string} content — MD 文件内容
 * @param {string} sectionSlug — 目标 section 的 slug
 * @param {string} contextLabel — 错误信息里的上下文标签（如 "意图叙事"、"验证契约"）
 * @returns {string} 提取的章节内容
 * @throws {Error} 章节未找到时抛错，错误信息包含 contextLabel 和 slug
 */
export function extractMdSection(content, sectionSlug, contextLabel = '章节') {
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
    throw new Error(
      `${contextLabel}章节未找到: #${sectionSlug}\n` +
      `可能原因：\n` +
      `  1. 章节标题用了中文但没加显式锚点 {#anchor}\n` +
      `  2. 锚点 slug 拼写错误\n` +
      `  3. 引用的文件不存在该章节`
    );
  }
  return captured.join('\n').trim();
}

/**
 * 安全读取并解析 JSON 文件。
 * 统一错误处理——文件不存在、JSON 解析失败时给出明确错误信息。
 *
 * @param {string} filePath — JSON 文件绝对路径
 * @param {string} contextLabel — 错误信息里的上下文标签（如 "Intent Map"、"验证记录"）
 * @returns {object} 解析后的 JSON 对象
 * @throws {Error} 文件不存在或 JSON 解析失败时抛错，错误信息包含文件路径和原因
 */
export function readJsonFile(filePath, contextLabel = 'JSON 文件') {
  if (!existsSync(filePath)) {
    throw new Error(`${contextLabel}文件不存在: ${filePath}`);
  }
  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (e) {
    throw new Error(`${contextLabel}文件读取失败: ${filePath}\n原因: ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `${contextLabel}文件 JSON 解析失败: ${filePath}\n` +
      `原因: ${e.message}\n` +
      `请检查文件内容是否为合法 JSON（多余逗号、缺少引号等）。`
    );
  }
}
