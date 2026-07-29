// intent-draft.js — current-version Minor Intent drafts and atomic finalization.
// Drafts isolate semantic edits from the official map until their references and DAG validate.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { extractExplicitAnchor, extractMdSection, readJsonFile, slugify } from './shared/md-utils.js';
import { applyImpactReview, computeTopoOrder, dependentClosure, VALID_STATUS, validateImpactPartition, validateIntentMap } from './intent-map.js';
import { getPhilosophy } from './philosophy.js';

const ID_RE = /^INT-(\d{3,})$/;
const REQUIRED_FIELDS = [
  'id',
  'revision',
  'title',
  'narrative_ref',
  'depends_on',
  'acceptance',
  'philosophy_anchors',
  'status',
];
const PLACEHOLDER_RE = /(?:\.{3}|…|\b(?:todo|tbd|placeholder)\b|待填|待写|请填写|在此填写|\[必须\]|replace this)/i;

function assertIntentId(id) {
  if (!ID_RE.test(id || '')) throw new Error(`Intent ID 非法: ${id || '(empty)'}`);
}

function draftDir(versionDir) {
  return join(versionDir, 'drafts');
}

function draftPath(versionDir, id) {
  assertIntentId(id);
  return join(draftDir(versionDir), `${id}.json`);
}

function atomicWrite(filePath, content) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, content, 'utf-8');
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    try { unlinkSync(tempPath); } catch {}
    throw error;
  }
}

function readOfficialMap(versionDir) {
  return readJsonFile(join(versionDir, '04_INTENT_MAP.json'), 'Intent Map');
}

function getSection(versionDir, ref, expectedFile, label) {
  if (typeof ref !== 'string') throw new Error(`${label}引用必须是字符串`);
  const match = ref.trim().match(/^(?:see\s+)?([^#]+)#([\w-]+)$/i);
  if (!match || basename(match[1]) !== match[1] || match[1] !== expectedFile) {
    throw new Error(`${label}引用必须是 ${expectedFile}#<section>`);
  }
  const filePath = join(versionDir, expectedFile);
  if (!existsSync(filePath)) throw new Error(`${label}文件不存在: ${filePath}`);
  return extractMdSection(readFileSync(filePath, 'utf-8'), match[2], label);
}

function meaningfulBody(section) {
  return section
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:#|<!--|-->|>\s*DRAFT)/i.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateProse(section, label, minimumLength) {
  const body = meaningfulBody(section);
  if (body.length < minimumLength || PLACEHOLDER_RE.test(body)) {
    throw new Error(`${label}必须包含真实、非占位内容（当前有效内容 ${body.length} 字符）`);
  }
  return section;
}

function resolveAcceptance(versionDir, acceptance) {
  const isReference = typeof acceptance === 'string' && /^(?:see\s+)?[^#]+#[\w-]+$/i.test(acceptance.trim());
  return isReference
    ? getSection(versionDir, acceptance, '05_VERIFICATION.md', '验证契约')
    : String(acceptance || '');
}

function hasSection(content, sectionId) {
  return content.split(/\r?\n/).some((line) => {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (!match) return false;
    return (extractExplicitAnchor(match[1]) || slugify(match[1])) === sectionId;
  });
}

function appendDraftSection(filePath, id, title, kind) {
  const anchor = id.toLowerCase();
  const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
  if (hasSection(existing, anchor)) throw new Error(`${basename(filePath)} 已存在 ${id} 章节，拒绝重复追加`);

  const prompt = kind === 'narrative'
    ? '[TODO: replace this with the intent narrative: why this capability must exist and what user outcome it protects.]'
    : '[TODO: replace this with concrete, observable acceptance criteria: result, failure and boundary behavior; if existing user or system state is changed, also name what must be preserved and one old-state → operation → new-state verification sequence.]';
  const heading = kind === 'narrative' ? `${id}: ${title}` : `${id}: Acceptance`;
  const section = `\n\n## [DRAFT] ${heading} {#${anchor}}\n\n<!-- LOOM INTENT DRAFT: ${id} -->\n${prompt}\n`;
  atomicWrite(filePath, existing.replace(/\s*$/, '') + section);
}

function allocateId(map, versionDir) {
  const numbers = Object.keys(map.intents).map((id) => Number(id.match(ID_RE)?.[1] || 0));
  if (existsSync(draftDir(versionDir))) {
    // Draft IDs are discovered without trusting arbitrary filenames as paths.
    for (const file of readdirSync(draftDir(versionDir))) {
      const match = file.match(/^INT-(\d{3,})\.json$/);
      if (match) numbers.push(Number(match[1]));
    }
  }
  return `INT-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
}

export function addIntentDraft(versionDir, title, dependencies = []) {
  if (!title || typeof title !== 'string' || PLACEHOLDER_RE.test(title) || title.trim().length < 2) {
    throw new Error('--title 必须是非占位标题');
  }
  const map = readOfficialMap(versionDir);
  validateIntentMap(map);
  const dependsOn = [...new Set(dependencies.filter(Boolean))];
  for (const dependency of dependsOn) {
    assertIntentId(dependency);
    if (!(dependency in map.intents)) throw new Error(`依赖不存在于官方 Intent Map: ${dependency}`);
  }

  const id = allocateId(map, versionDir);
  const path = draftPath(versionDir, id);
  if (existsSync(path) || id in map.intents) throw new Error(`Intent 已存在: ${id}`);
  mkdirSync(draftDir(versionDir), { recursive: true });

  const draft = {
    _draft: { operation: 'add', created_at: new Date().toISOString() },
    id,
    revision: 1,
    title: title.trim(),
    narrative_ref: `01_VISION.md#${id.toLowerCase()}`,
    depends_on: dependsOn,
    acceptance: `see 05_VERIFICATION.md#${id.toLowerCase()}`,
    philosophy_anchors: [],
    status: 'pending',
  };

  // Check both documents before touching either, then append deterministic draft sections.
  for (const file of ['01_VISION.md', '05_VERIFICATION.md']) {
    const content = existsSync(join(versionDir, file)) ? readFileSync(join(versionDir, file), 'utf-8') : '';
    if (hasSection(content, id.toLowerCase())) {
      throw new Error(`${file} 已存在 ${id} 章节，拒绝重复追加`);
    }
  }
  appendDraftSection(join(versionDir, '01_VISION.md'), id, draft.title, 'narrative');
  appendDraftSection(join(versionDir, '05_VERIFICATION.md'), id, draft.title, 'acceptance');
  atomicWrite(path, `${JSON.stringify(draft, null, 2)}\n`);
  return draft;
}

export function getIntentDraft(versionDir, id) {
  const path = draftPath(versionDir, id);
  if (!existsSync(path)) throw new Error(`Intent draft 不存在: ${id}`);
  return readJsonFile(path, 'Intent draft');
}

export function reviseIntentDraft(versionDir, id, reason) {
  assertIntentId(id);
  if (!reason || typeof reason !== 'string' || PLACEHOLDER_RE.test(reason) || reason.trim().length < 3) {
    throw new Error('--reason 必须说明修订原因');
  }
  const path = draftPath(versionDir, id);
  if (existsSync(path)) throw new Error(`${id} 已存在 draft；先完成或删除现有 draft`);
  const map = readOfficialMap(versionDir);
  validateIntentMap(map);
  const current = map.intents[id];
  if (!current) throw new Error(`Intent 不存在: ${id}`);

  const draft = {
    ...current,
    _draft: { operation: 'revise', created_at: new Date().toISOString() },
    revision: (current.revision ?? 1) + 1,
    revision_reason: reason.trim(),
  };
  mkdirSync(draftDir(versionDir), { recursive: true });
  atomicWrite(path, `${JSON.stringify(draft, null, 2)}\n`);

  const direct = Object.values(map.intents)
    .filter((intent) => intent.depends_on.includes(id))
    .map((intent) => intent.id);
  const seen = new Set();
  const queue = [...direct];
  while (queue.length) {
    const dependency = queue.shift();
    if (seen.has(dependency)) continue;
    seen.add(dependency);
    for (const intent of Object.values(map.intents)) {
      if (intent.depends_on.includes(dependency)) queue.push(intent.id);
    }
  }
  return { draft, reverse_dependencies: { direct, transitive: [...seen] } };
}

function validateDraft(versionDir, draft, map) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in draft)) throw new Error(`Intent draft 缺少必填字段: ${field}`);
  }
  assertIntentId(draft.id);
  if (!draft._draft || !['add', 'revise'].includes(draft._draft.operation)) throw new Error('Intent draft 缺少合法 _draft.operation');
  if (!Number.isInteger(draft.revision) || draft.revision < 1) throw new Error('Intent draft revision 必须是正整数');
  if (!VALID_STATUS.includes(draft.status)) throw new Error(`Intent draft status 非法: ${draft.status}`);
  if (typeof draft.title !== 'string' || draft.title.trim().length < 2 || PLACEHOLDER_RE.test(draft.title)) throw new Error('Intent draft title 非法');
  if (!Array.isArray(draft.depends_on) || new Set(draft.depends_on).size !== draft.depends_on.length) throw new Error('Intent draft depends_on 必须是不重复数组');
  if (!Array.isArray(draft.philosophy_anchors) || draft.philosophy_anchors.length === 0) throw new Error('Intent draft philosophy_anchors 必须非空');
  if (draft.depends_on.includes(draft.id)) throw new Error(`${draft.id} 不能依赖自身`);
  for (const dependency of draft.depends_on) {
    assertIntentId(dependency);
    if (!(dependency in map.intents)) throw new Error(`依赖不存在于官方 Intent Map: ${dependency}`);
  }

  validateProse(getSection(versionDir, draft.narrative_ref, '01_VISION.md', '意图叙事'), '意图叙事', 30);
  validateProse(resolveAcceptance(versionDir, draft.acceptance), '验证契约', 30);
  for (const anchor of draft.philosophy_anchors) {
    if (typeof anchor !== 'string' || basename(anchor.split('#')[0]) !== anchor.split('#')[0]) throw new Error(`哲学锚点非法: ${anchor}`);
    validateProse(getPhilosophy(join(versionDir, '00_PHILOSOPHY'), anchor), `哲学锚点 ${anchor}`, 10);
  }

  const current = map.intents[draft.id];
  if (draft._draft.operation === 'add') {
    if (current) throw new Error(`官方 Intent 已存在，不能 add: ${draft.id}`);
    if (draft.revision !== 1 || draft.status !== 'pending') throw new Error('新增 Intent 必须 revision=1 且 status=pending');
  } else {
    if (!current) throw new Error(`待修订的官方 Intent 不存在: ${draft.id}`);
    if (draft.revision !== (current.revision ?? 1) + 1) throw new Error('修订 revision 必须恰好递增 1');
    if (!draft.revision_reason || PLACEHOLDER_RE.test(draft.revision_reason)) throw new Error('修订 draft 必须有真实 revision_reason');
  }
}

export function finalizeIntentDraft(versionDir, id, options = {}) {
  const path = draftPath(versionDir, id);
  const draft = getIntentDraft(versionDir, id);
  const map = readOfficialMap(versionDir);
  validateIntentMap(map);
  validateDraft(versionDir, draft, map);

  const operation = draft._draft.operation;
  const current = map.intents[id];
  const review = options.review || [];
  const unaffected = options.unaffected || [];
  const dependents = operation === 'revise' ? dependentClosure(map.intents, id) : { all: [] };
  if (operation === 'revise') validateImpactPartition(dependents.all, review, unaffected);
  if (operation === 'add' && (review.length || unaffected.length)) {
    throw new Error('新增 Intent 没有既有下游依赖，不接受 --review 或 --unaffected');
  }
  const { _draft, ...intent } = draft;
  if (operation === 'add') {
    intent.status = 'pending';
  } else {
    intent.status = current.status;
  }
  map.intents[id] = intent;
  let reviewed = [];
  if (operation === 'revise') {
    const targets = current.status === 'completed' ? [id, ...review] : review;
    const result = applyImpactReview(map, targets, { incrementPassOnce: true });
    reviewed = result.reviewed;
    intent.status = map.intents[id].status;
  }
  map.topo_order = computeTopoOrder(map.intents, map.topo_order);
  validateIntentMap(map);

  if (operation === 'add') {
    for (const file of ['01_VISION.md', '05_VERIFICATION.md']) {
      const content = readFileSync(join(versionDir, file), 'utf-8');
      if (!new RegExp(`^#{1,6}\\s+\\[DRAFT\\]\\s+${id}(?::|\\s)`, 'mi').test(content)) {
        throw new Error(`${file} 缺少 ${id} 的 draft 标记，拒绝 finalize`);
      }
    }
  }

  atomicWrite(join(versionDir, '04_INTENT_MAP.json'), `${JSON.stringify(map, null, 2)}\n`);
  if (operation === 'add') {
    for (const file of ['01_VISION.md', '05_VERIFICATION.md']) {
      const filePath = join(versionDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const promoted = content
        .replace(new RegExp(`^(#{1,6})\\s+\\[DRAFT\\]\\s+(${id}(?::|\\s))`, 'mi'), '$1 $2')
        .replace(new RegExp(`^<!-- LOOM INTENT DRAFT: ${id} -->\\r?\\n?`, 'mi'), '');
      if (promoted === content) throw new Error(`${file} 未找到可提升的 ${id} draft 标记；官方 Map 已安全写入，draft 保留以便人工恢复`);
      atomicWrite(filePath, promoted);
    }
  }
  unlinkSync(path);
  return { operation, intent, topo_order: map.topo_order, reviewed, unaffected };
}
