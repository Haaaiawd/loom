// philosophy.js — 按锚点加载哲学文档的特定章节
// 哲学文档是 MD，锚点格式: "PRODUCT_PHILOSOPHY.md#core-belief"
// 这个库按锚点提取对应章节，不返回整个文件。
// 另含灵感来源校验——防止 Weaver 从训练数据"背"几个名字就交差。

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { extractMdSection, readJsonFile } from './shared/md-utils.js';
import { applyImpactReview, dependentClosure, validateImpactPartition, validateIntentMap } from './intent-map.js';

/**
 * 解析锚点字符串。
 * @param {string} anchor — "FILE.md#section" 或 "FILE.md"
 * @returns {{ file: string, section: string|null }}
 */
export function parseAnchor(anchor) {
  const [file, section] = anchor.split('#');
  const normalizedFile = file.trim();
  if (!normalizedFile || basename(normalizedFile) !== normalizedFile || !normalizedFile.endsWith('.md')) {
    throw new Error(`哲学锚点文件名非法: ${normalizedFile || '(empty)'}`);
  }
  return { file: normalizedFile, section: section ? section.trim() : null };
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

const REVISION_CLASSIFICATIONS = ['clarification', 'minor', 'major'];

function normalizeAnchor(anchor) {
  if (typeof anchor !== 'string' || anchor.trim() === '') throw new Error('哲学锚点必须是非空文本');
  const parts = anchor.trim().split('#');
  if (parts.length > 2 || !parts[0].trim()) throw new Error(`哲学锚点格式非法: ${anchor}`);
  const { file, section } = parseAnchor(anchor.trim());
  return section ? `${file}#${section}` : file;
}

function impactEntry(intent) {
  return {
    id: intent.id,
    title: intent.title || '',
    status: intent.status,
    revision: intent.revision ?? 1,
    acceptance: intent.acceptance,
  };
}

/** Resolve an anchor and report direct references plus their dependent closure without mutation. */
export function assessPhilosophyImpact(versionDir, anchor) {
  const resolvedAnchor = normalizeAnchor(anchor);
  getPhilosophy(join(versionDir, '00_PHILOSOPHY'), resolvedAnchor);
  const data = readJsonFile(join(versionDir, '04_INTENT_MAP.json'), 'Intent Map');
  validateIntentMap(data);
  const directIds = Object.values(data.intents)
    .filter((intent) => (intent.philosophy_anchors || []).some((item) => normalizeAnchor(item) === resolvedAnchor))
    .map((intent) => intent.id);
  const directSet = new Set(directIds);
  const impacted = new Set(directIds);
  for (const id of directIds) {
    for (const dependent of dependentClosure(data.intents, id).all) impacted.add(dependent);
  }
  const ordered = (data.topo_order || Object.keys(data.intents)).filter((id) => impacted.has(id));
  const transitiveIds = ordered.filter((id) => !directSet.has(id));
  const describe = (ids) => ids.map((id) => impactEntry(data.intents[id]));
  return {
    anchor: resolvedAnchor,
    direct: describe(directIds),
    transitive: describe(transitiveIds),
    impacted: describe(ordered),
    impacted_ids: ordered,
  };
}

function nextRevisionAdr(decisionsDir) {
  if (!existsSync(decisionsDir)) return 'PHIL-REV-001.md';
  const numbers = readdirSync(decisionsDir)
    .map((name) => name.match(/^PHIL-REV-(\d{3,})\.md$/)?.[1])
    .filter(Boolean)
    .map(Number);
  return `PHIL-REV-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}.md`;
}

function revisionGuidance(anchor, classification, reason, impactedIds) {
  const escapedReason = reason.replace(/"/g, '\\"');
  const base = `loom philosophy revise ${anchor} --classification ${classification} --reason "${escapedReason}" --confirm`;
  if (classification === 'clarification') {
    return impactedIds.length ? `${base} --unaffected ${impactedIds.join(',')}` : base;
  }
  if (!impactedIds.length) return base;
  return `${base} --review <review IDs from ${impactedIds.join(',')}> --unaffected <remaining IDs from ${impactedIds.join(',')}>`;
}

/** Assess or confirm a philosophy revision while leaving philosophy prose to Weaver/the user. */
export function revisePhilosophy(versionDir, anchor, options) {
  if (!REVISION_CLASSIFICATIONS.includes(options.classification)) {
    throw new Error(`--classification 非法: ${options.classification || '(missing)'}（合法: ${REVISION_CLASSIFICATIONS.join('|')}）`);
  }
  if (typeof options.reason !== 'string' || options.reason.trim() === '') throw new Error('--reason 必须是非空文本');
  const reason = options.reason.trim();
  const impact = assessPhilosophyImpact(versionDir, anchor);

  if (options.classification === 'major') {
    return {
      mode: 'assessment',
      mutated: false,
      classification: 'major',
      reason,
      ...impact,
      follow_up: { command: 'loom version new', guidance: 'Major philosophy revisions never mutate the current version. Create a new version, then have Weaver weave its philosophy.' },
    };
  }
  if (!options.confirm) {
    return {
      mode: 'assessment',
      mutated: false,
      classification: options.classification,
      reason,
      ...impact,
      required_partition: impact.impacted_ids,
      follow_up: {
        command: revisionGuidance(impact.anchor, options.classification, reason, impact.impacted_ids),
        guidance: options.classification === 'clarification'
          ? 'Clarification requires an empty --review set; classify every impacted Intent as --unaffected because all acceptance remains valid.'
          : 'Classify every impacted Intent exactly once between --review and --unaffected; omit an empty group.',
      },
    };
  }

  const review = options.review || [];
  const unaffected = options.unaffected || [];
  if (options.classification === 'clarification' && review.length) throw new Error('clarification 的 --review 必须为空；所有 acceptance 必须仍然有效');
  validateImpactPartition(impact.impacted_ids, review, unaffected);
  const reviewSet = new Set(review);
  const unaffectedSet = new Set(unaffected);
  const orderedReview = impact.impacted_ids.filter((id) => reviewSet.has(id));
  const orderedUnaffected = impact.impacted_ids.filter((id) => unaffectedSet.has(id));

  const mapPath = join(versionDir, '04_INTENT_MAP.json');
  const data = readJsonFile(mapPath, 'Intent Map');
  validateIntentMap(data);
  const { reviewed } = applyImpactReview(data, orderedReview, { incrementPassOnce: options.classification === 'minor' });
  const unchanged = orderedUnaffected.map((id) => ({ id, status_before: data.intents[id].status, status_after: data.intents[id].status }));
  validateIntentMap(data);

  const decisionsDir = join(versionDir, '03_DECISIONS');
  mkdirSync(decisionsDir, { recursive: true });
  const adrName = nextRevisionAdr(decisionsDir);
  const adrPath = join(decisionsDir, adrName);
  const timestamp = new Date().toISOString();
  const list = (ids) => ids.length ? ids.map((id) => `- ${id}`).join('\n') : '- None';
  const adr = `# Philosophy Revision ${adrName.slice(9, -3)}\n\n` +
    `- Timestamp: ${timestamp}\n- Anchor: ${impact.anchor}\n- Classification: ${options.classification}\n- Reason: ${reason}\n\n` +
    `## Reviewed\n\n${list(orderedReview)}\n\n## Unaffected\n\n${list(orderedUnaffected)}\n\n` +
    '## Prose Ownership\n\nPhilosophy prose is edited by Weaver/user separately. This ADR is an impact audit record, not a second philosophy truth source.\n';
  const token = `${process.pid}-${Date.now()}`;
  const mapTemp = `${mapPath}.tmp-${token}`;
  const adrTemp = `${adrPath}.tmp-${token}`;
  writeFileSync(mapTemp, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  writeFileSync(adrTemp, adr, 'utf-8');
  try {
    renameSync(adrTemp, adrPath);
    try {
      renameSync(mapTemp, mapPath);
    } catch (error) {
      try { unlinkSync(adrPath); } catch {}
      throw error;
    }
  } catch (error) {
    try { unlinkSync(mapTemp); } catch {}
    try { unlinkSync(adrTemp); } catch {}
    throw error;
  }
  return { mode: 'confirmed', mutated: true, classification: options.classification, reason, ...impact, reviewed, unaffected: unchanged, audit_adr: `03_DECISIONS/${adrName}`, timestamp };
}

// ─── 灵感来源校验 ───────────────────────────────────────
// 防止 Weaver 从训练数据"背"几个名字就交差。
// 校验原则：只检查证据能否追溯，以及为何影响了项目判断。
// 来源数量与类型不设固定配额；一个直接证据可以胜过十个装饰性链接。
const REASON_KEYWORDS = ['萃取', '理由', '为什么', '因为', '启发', '借鉴', '参考理由', '选取理由', '转译'];

/**
 * 从哲学文档内容中提取"灵感来源"章节的条目。
 * @param {string} content — MD 全文
 * @returns {Array<{ raw: string, name: string, urls: string[], hasReason: boolean }>}
 *   如果返回空数组，调用方需区分"没有章节"和"有章节但没条目"——
 *   用 hasInspirationSection() 单独判断。
 */
function parseInspirationSources(content) {
  // 匹配 "## 灵感来源" 或 "## Inspiration Sources" 等章节
  // 支持 {#anchor} 后缀和多种标题变体
  const sectionMatch = content.match(/^##\s+(?:灵感来源|Inspiration|参考来源|References?|参考文献|参考资料|Sources|Bibliography)/m);
  if (!sectionMatch) return [];

  const startIdx = sectionMatch.index + sectionMatch[0].length;
  // 找到下一个 ## 或文件末尾
  const nextSection = content.slice(startIdx).match(/\n##\s/m);
  const sectionText = nextSection
    ? content.slice(startIdx, startIdx + nextSection.index)
    : content.slice(startIdx);

  // 解析每个 list item（- / * / 1. / 2. 等开头的无序或有序列表）
  const items = [];
  const lines = sectionText.split('\n');
  let currentItem = null;

  // 匹配 - xxx / * xxx / 1. xxx / 2. xxx 等
  const ITEM_RE = /^\s*(?:[-*]|\d+\.)\s+/;
  // URL 匹配：https:// / file:// / local:./path / local:/abs/path
  const URL_RE = /(?:https?:|file:)[\/]+[^\s）)]+|local:[^\s）)]+/g;

  for (const line of lines) {
    if (ITEM_RE.test(line)) {
      // 新条目
      if (currentItem) items.push(currentItem);
      const raw = line.replace(ITEM_RE, '').trim();
      const urls = [...raw.matchAll(URL_RE)].map((m) => m[0]);
      const name = raw.replace(/\*\*/g, '').split(/[（(——]/)[0].trim();
      const hasReason = REASON_KEYWORDS.some((kw) => raw.includes(kw));
      currentItem = { raw, name, urls, hasReason };
    } else if (currentItem && line.trim()) {
      // 多行条目的续行
      currentItem.raw += ' ' + line.trim();
      const newUrls = [...line.matchAll(URL_RE)].map((m) => m[0]);
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
 * 检查哲学文档是否有"灵感来源"章节（不管有没有条目）。
 * 用来区分"没有章节"和"有章节但没条目"两种情况。
 */
function hasInspirationSection(content) {
  return /^##\s+(?:证据地图|Evidence Map|灵感来源|Inspiration|参考来源|References?|参考文献|参考资料|Sources|Bibliography)/m.test(content);
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

  // 如果没有任何文件提取到灵感来源条目
  if (allSources.length === 0) {
    // 区分两种情况：完全没有章节 vs 有章节但没条目
    const filesWithSection = [];
    for (const file of files) {
      const content = readFileSync(join(philosophyDir, file), 'utf-8');
      if (hasInspirationSection(content)) filesWithSection.push(file);
    }

    if (filesWithSection.length > 0) {
      issues.push({
        severity: 'high',
        msg: `${filesWithSection.join(', ')} 有证据章节但没有可识别的条目。请只填入实际改变了原则或取舍的来源，并写明选择理由与可追溯位置。`,
      });
    } else {
      issues.push({
        severity: 'high',
        msg: '所有哲学文档都没有证据地图或灵感来源。Doctrine 必须说明哪些项目事实或外部资料实际改变了原则与取舍，并提供理由和可追溯位置。',
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    sources: allSources,
  };
}
