// philosophy.js — 按锚点加载哲学文档的特定章节
// 哲学文档是 MD，锚点格式: "PRODUCT_PHILOSOPHY.md#core-belief"
// 这个库按锚点提取对应章节，不返回整个文件。
// 另含灵感来源校验——防止 Weaver 从训练数据"背"几个名字就交差。

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

// ─── 灵感来源校验 ───────────────────────────────────────
// 防止 Weaver 从训练数据"背"几个名字就交差。
// 校验规则：
//   1. 至少 3 个独立源
//   2. 至少 2 个非 Wikipedia 链接（Wikipedia 是常识入口，不是深度源）
//   3. 每个源必须有"为什么选它"的理由（萃取/理由/为什么 等关键词）
//   4. 源不能全是同一类型（如全是 Wikipedia、全是博客）

const MIN_SOURCES = 3;
const MIN_NON_WIKI = 2;
const REASON_KEYWORDS = ['萃取', '理由', '为什么', '因为', '启发', '借鉴', '参考理由', '选取理由', '转译'];

/**
 * 从哲学文档内容中提取"灵感来源"章节的条目。
 * @param {string} content — MD 全文
 * @returns {Array<{ raw: string, name: string, urls: string[], hasReason: boolean }>}
 */
function parseInspirationSources(content) {
  // 匹配 "## 灵感来源" 或 "## Inspiration" 章节
  const sectionMatch = content.match(/^##\s+(?:灵感来源|Inspiration|参考来源|References)/m);
  if (!sectionMatch) return [];

  const startIdx = sectionMatch.index + sectionMatch[0].length;
  // 找到下一个 ## 或文件末尾
  const nextSection = content.slice(startIdx).match(/\n##\s/m);
  const sectionText = nextSection
    ? content.slice(startIdx, startIdx + nextSection.index)
    : content.slice(startIdx);

  // 解析每个 list item（- 或 * 开头）
  const items = [];
  const lines = sectionText.split('\n');
  let currentItem = null;

  for (const line of lines) {
    if (/^\s*[-*]\s/.test(line)) {
      // 新条目
      if (currentItem) items.push(currentItem);
      const raw = line.replace(/^\s*[-*]\s/, '').trim();
      const urls = [...raw.matchAll(/https?:\/\/[^\s）)]+/g)].map((m) => m[0]);
      const name = raw.replace(/\*\*/g, '').split(/[（(——]/)[0].trim();
      const hasReason = REASON_KEYWORDS.some((kw) => raw.includes(kw));
      currentItem = { raw, name, urls, hasReason };
    } else if (currentItem && line.trim()) {
      // 多行条目的续行
      currentItem.raw += ' ' + line.trim();
      const newUrls = [...line.matchAll(/https?:\/\/[^\s）)]+/g)].map((m) => m[0]);
      currentItem.urls.push(...newUrls);
      if (REASON_KEYWORDS.some((kw) => line.includes(kw))) {
        currentItem.hasReason = true;
      }
    }
  }
  if (currentItem) items.push(currentItem);
  return items;
}

/**
 * 判断 URL 是否为 Wikipedia 链接。
 */
function isWikipediaUrl(url) {
  return /wikipedia\.org/i.test(url);
}

/**
 * 校验哲学文档的灵感来源质量。
 * @param {string} philosophyDir — 00_PHILOSOPHY/ 目录路径
 * @returns {{ passed: boolean, issues: Array<{severity: string, msg: string}>, sources: Array }}
 */
export function validateInspirationSources(philosophyDir) {
  const issues = [];
  const allSources = [];

  // 扫描目录下所有 .md 文件，找"灵感来源"章节
  const files = listPhilosophyFiles(philosophyDir);

  for (const file of files) {
    const content = readFileSync(join(philosophyDir, file), 'utf-8');
    const sources = parseInspirationSources(content);
    if (sources.length === 0) continue;

    allSources.push({ file, sources });

    // 校验每个文件的灵感来源
    if (sources.length < MIN_SOURCES) {
      issues.push({
        severity: 'high',
        msg: `${file}: 灵感来源仅 ${sources.length} 条，要求至少 ${MIN_SOURCES} 条。可能从训练数据"背"了几个名字就交差。`,
      });
    }

    const nonWikiUrls = sources.filter((s) => s.urls.length > 0 && !s.urls.every(isWikipediaUrl));
    if (nonWikiUrls.length < MIN_NON_WIKI) {
      issues.push({
        severity: 'high',
        msg: `${file}: 非 Wikipedia 链接仅 ${nonWikiUrls.length} 个，要求至少 ${MIN_NON_WIKI} 个。Wikipedia 是常识入口，不是深度源——需要原著、论文、工程博客、标准文档等。`,
      });
    }

    for (const src of sources) {
      if (!src.hasReason) {
        issues.push({
          severity: 'medium',
          msg: `${file}: 灵感来源 "${src.name}" 缺乏选取理由。必须说明"为什么选这个源"——萃取/转译/启发关系。`,
        });
      }
      if (src.urls.length === 0) {
        issues.push({
          severity: 'medium',
          msg: `${file}: 灵感来源 "${src.name}" 没有 URL。必须附可验证的来源链接。`,
        });
      }
    }
  }

  // 全局校验：所有文件的灵感来源加起来，源类型不能单一
  const totalUrls = allSources.flatMap((s) => s.sources).flatMap((s) => s.urls);
  if (totalUrls.length > 0) {
    const wikiCount = totalUrls.filter(isWikipediaUrl).length;
    if (wikiCount / totalUrls.length > 0.7) {
      issues.push({
        severity: 'medium',
        msg: `全部灵感来源中 Wikipedia 占比 ${Math.round((wikiCount / totalUrls.length) * 100)}%——源类型过于单一。需要原著、论文、标准文档、工程博客等多元源。`,
      });
    }
  }

  // 如果没有任何文件包含灵感来源章节
  if (allSources.length === 0) {
    issues.push({
      severity: 'high',
      msg: '所有哲学文档都没有"灵感来源"章节。PHILOSOPHY_WEAVER.md 要求哲学文档必须包含灵感来源（参考了哪些机构、人物、流派——附 URL 和理由）。',
    });
  }

  return {
    passed: issues.length === 0,
    issues,
    sources: allSources,
  };
}
