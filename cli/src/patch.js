// patch — authoritative Patch ledger and deterministic Markdown projection.
// Validation is structural only: verification commands are recorded, never executed.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { loadIntentMap } from './intent-map.js';

const JSON_FILE = '06_CHANGELOG.json';
const MARKDOWN_FILE = '06_CHANGELOG.md';
const PATCH_ID = /^PATCH-(\d{3,})$/;
const VERIFICATION_RESULTS = new Set(['passed', 'failed', 'skipped']);

export function createEmptyChangelog() {
  return {
    _meta: { schema_version: '1.0', source: JSON_FILE },
    patches: [],
  };
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Patch ${field} 必须是非空字符串`);
  }
}

function validateSafeFile(file, index) {
  requireText(file, `files[${index}]`);
  const normalized = file.replace(/\\/g, '/');
  if (isAbsolute(file) || /^[A-Za-z]:/.test(normalized) || normalized === '.' || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Patch files[${index}] 必须是安全的项目相对路径: ${file}`);
  }
}

function validateRecord(record, intents, { stored = false } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Patch 记录必须是 JSON object');
  }
  requireText(record.summary, 'summary');
  requireText(record.reason, 'reason');

  if (!Array.isArray(record.files) || record.files.length === 0) {
    throw new Error('Patch files 必须是非空数组');
  }
  record.files.forEach(validateSafeFile);

  if (record.affects !== undefined) {
    if (!Array.isArray(record.affects)) throw new Error('Patch affects 必须是 Intent ID 数组');
    for (const id of record.affects) {
      requireText(id, 'affects[]');
      if (!intents.has(id)) throw new Error(`Patch affects 引用了不存在的 Intent: ${id}`);
    }
  }

  if (!Array.isArray(record.verification) || record.verification.length === 0) {
    throw new Error('Patch verification 必须是非空数组');
  }
  let hasPassed = false;
  record.verification.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Patch verification[${index}] 必须是 object`);
    }
    if (item.command === undefined && item.method === undefined) {
      throw new Error(`Patch verification[${index}] 必须提供 command 或 method`);
    }
    if (item.command !== undefined) requireText(item.command, `verification[${index}].command`);
    if (item.method !== undefined) requireText(item.method, `verification[${index}].method`);
    if (item.evidence !== undefined) requireText(item.evidence, `verification[${index}].evidence`);
    if (!VERIFICATION_RESULTS.has(item.result)) {
      throw new Error(`Patch verification[${index}].result 必须是 passed | failed | skipped`);
    }
    if (item.result === 'passed') hasPassed = true;
  });
  if (!hasPassed) throw new Error('Patch verification 至少需要一个 passed 结果');

  if (stored) {
    if (!PATCH_ID.test(record.id)) throw new Error(`Patch id 格式无效: ${record.id ?? '(missing)'}`);
    if (typeof record.timestamp !== 'string' || Number.isNaN(Date.parse(record.timestamp))) {
      throw new Error(`Patch timestamp 无效: ${record.timestamp ?? '(missing)'}`);
    }
  } else if (record.id !== undefined || record.timestamp !== undefined) {
    throw new Error('Patch id 和 timestamp 由 CLI 分配，请勿在输入中提供');
  }
}

function loadIntents(versionDir) {
  return loadIntentMap(versionDir).intents;
}

function loadIntentIds(versionDir) {
  return new Set(Object.keys(loadIntents(versionDir)));
}

export function renderChangelogMarkdown(changelog) {
  const lines = [
    '<!-- GENERATED FILE. DO NOT EDIT. Source: 06_CHANGELOG.json -->',
    '# Patch Changelog',
    '',
    '> Generated deterministically from `06_CHANGELOG.json`. Edit the JSON through `loom patch record`.',
    '',
  ];
  if (changelog.patches.length === 0) {
    lines.push('_No patches recorded._', '');
    return lines.join('\n');
  }
  for (const patch of changelog.patches) {
    lines.push(`## ${patch.id} - ${patch.summary}`, '', `- Timestamp: ${patch.timestamp}`, `- Reason: ${patch.reason}`);
    lines.push(`- Affects: ${(patch.affects || []).map((id) => `\`${id}\``).join(', ') || 'none'}`);
    lines.push('- Files:', ...patch.files.map((file) => `  - \`${file}\``), '- Verification:');
    for (const item of patch.verification) {
      const verification = item.command ? `\`${item.command}\`` : item.method;
      lines.push(`  - ${item.result}: ${verification}`);
      if (item.evidence) lines.push(`    - Evidence: ${item.evidence}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function loadChangelog(versionDir) {
  const path = join(versionDir, JSON_FILE);
  if (!existsSync(path)) throw new Error(`Patch changelog 不存在: ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    throw new Error(`Patch changelog JSON 解析失败: ${path}\n原因: ${error.message}`);
  }
}

function validateChangelog(versionDir, changelog) {
  if (!changelog || typeof changelog !== 'object' || Array.isArray(changelog)) {
    throw new Error('Patch changelog 必须是 JSON object');
  }
  if (changelog._meta?.schema_version !== '1.0' || changelog._meta?.source !== JSON_FILE) {
    throw new Error('Patch changelog _meta 无效：schema_version 必须为 1.0，source 必须为 06_CHANGELOG.json');
  }
  if (!Array.isArray(changelog.patches)) throw new Error('Patch changelog patches 必须是数组');
  const intents = loadIntentIds(versionDir);
  const ids = new Set();
  changelog.patches.forEach((record, index) => {
    validateRecord(record, intents, { stored: true });
    const expected = `PATCH-${String(index + 1).padStart(3, '0')}`;
    if (record.id !== expected) throw new Error(`Patch id 序列无效: 期望 ${expected}，实际 ${record.id}`);
    if (ids.has(record.id)) throw new Error(`Patch id 重复: ${record.id}`);
    ids.add(record.id);
  });
}

function writeChangelog(versionDir, changelog) {
  writeFileSync(join(versionDir, JSON_FILE), `${JSON.stringify(changelog, null, 2)}\n`, 'utf-8');
  writeFileSync(join(versionDir, MARKDOWN_FILE), renderChangelogMarkdown(changelog), 'utf-8');
}

export function scaffoldChangelog(versionDir) {
  const jsonPath = join(versionDir, JSON_FILE);
  const markdownPath = join(versionDir, MARKDOWN_FILE);
  if (!existsSync(jsonPath) && existsSync(markdownPath)) {
    const legacyMarkdown = readFileSync(markdownPath, 'utf-8');
    if (!legacyMarkdown.startsWith('<!-- GENERATED FILE. DO NOT EDIT. Source: 06_CHANGELOG.json -->')) {
      throw new Error(
        `检测到手工维护的旧版 ${MARKDOWN_FILE}，拒绝用空 Patch ledger 覆盖。\n` +
        `请先把历史条目迁移到 ${JSON_FILE}，或备份并删除旧 Markdown 后重试。`
      );
    }
  }
  const changelog = existsSync(jsonPath) ? loadChangelog(versionDir) : createEmptyChangelog();
  if (!existsSync(jsonPath)) writeFileSync(jsonPath, `${JSON.stringify(changelog, null, 2)}\n`, 'utf-8');
  writeFileSync(markdownPath, renderChangelogMarkdown(changelog), 'utf-8');
}

export function recordPatch(versionDir, input, now = new Date()) {
  const changelog = loadChangelog(versionDir);
  validateChangelog(versionDir, changelog);
  const intents = loadIntents(versionDir);
  const unfinished = Object.values(intents).filter((intent) => intent.status !== 'completed');
  if (unfinished.length > 0) {
    throw new Error(`Patch 只能在全部 Intent 完成后记录；尚未完成: ${unfinished.map((intent) => intent.id).join(', ')}`);
  }
  validateRecord(input, new Set(Object.keys(intents)));
  const record = {
    id: `PATCH-${String(changelog.patches.length + 1).padStart(3, '0')}`,
    timestamp: now.toISOString(),
    summary: input.summary.trim(),
    reason: input.reason.trim(),
    affects: input.affects || [],
    files: input.files.map((file) => file.replace(/\\/g, '/')),
    verification: input.verification,
  };
  changelog.patches.push(record);
  writeChangelog(versionDir, changelog);
  return record;
}

export function listPatches(versionDir) {
  const changelog = loadChangelog(versionDir);
  validateChangelog(versionDir, changelog);
  return changelog.patches;
}

export function getPatch(versionDir, id) {
  const patch = listPatches(versionDir).find((record) => record.id === id);
  if (!patch) throw new Error(`Patch 不存在: ${id}`);
  return patch;
}

export function validatePatches(versionDir) {
  const changelog = loadChangelog(versionDir);
  validateChangelog(versionDir, changelog);
  const markdownPath = join(versionDir, MARKDOWN_FILE);
  if (!existsSync(markdownPath)) throw new Error(`Patch Markdown 投影不存在: ${markdownPath}`);
  if (readFileSync(markdownPath, 'utf-8') !== renderChangelogMarkdown(changelog)) {
    throw new Error('06_CHANGELOG.md 不是 06_CHANGELOG.json 的最新确定性投影');
  }
  return { valid: true, patches: changelog.patches.length };
}
