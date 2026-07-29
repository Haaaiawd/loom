// verify.js — 验证记录的读写和查询
// 验证记录存放在 .loom/v{N}/verifications/ 下，每个 Intent 一份 JSON + 一份 MD。

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractMdSection, readJsonFile } from './shared/md-utils.js';
import { getIntent, getEffectiveVerificationEpoch, hasLegacyIntentRevision } from './intent-map.js';
import { formatIntentRef, resolveIntentRef } from './shared/intent-ref.js';
import { resolveQualityProofReference } from './shared/proof-reference.js';

/** 合法判定结果 */
const VALID_VERDICTS = ['passed', 'deviated', 'blocked', 'pending_human'];

/** 每个 Intent 都必须覆盖的基础验证维度。 */
const BASE_DIMENSIONS = [
  'intent_fidelity',
  'philosophy_consistency',
  'baseline_compliance',
  'acceptance_achievement',
];

function getRequiredDimensions(intent) {
  const dimensions = [...BASE_DIMENSIONS];
  if (intent?.continuity_required) dimensions.push('preservation_achievement');
  if (intent?.quality_contract) dimensions.push('quality_achievement');
  return dimensions;
}

/**
 * 写入一条验证记录（追加模式——同一 Intent 多次验证保留完整历史）。
 * 文件格式: { intent_id, records: [{ round, verdict, timestamp, ... }] }
 * @param {string} versionDir — 当前 .loom/v{N}/ 目录，用于可信读取 Intent revision
 * @param {string} verificationsDir — verifications/ 目录路径
 * @param {object} record — 验证记录
 * @param {string} record.intent_id — 如 "INT-001"
 * @param {string} record.verdict — passed | deviated | blocked
 * @param {string} record.timestamp — ISO 8601
 * @param {string} record.summary — 验证摘要
 * @param {object} record.dimensions — 基础维度，以及质量契约存在时的 quality_achievement
 * @param {string} [record.reproduction_command] — 复现验证的命令（如 "LLM_API_KEY=mock npm test"）
 * @param {string} [record.deviation_detail] — 偏离说明（deviated 时）
 * @param {boolean} [record.reset_suggested] — 是否建议重置上下文
 * @returns {{ filePath: string, round: number, deviated_count: number, should_escalate: boolean }}
 */
export function writeVerification(versionDir, verificationsDir, record) {
  const errors = [];
  if (!record.intent_id) errors.push('缺少 intent_id');
  if (!record.verdict || !VALID_VERDICTS.includes(record.verdict)) {
    errors.push(`verdict 非法: "${record.verdict}" (合法: ${VALID_VERDICTS.join('|')})`);
  }
  if (!record.timestamp) errors.push('缺少 timestamp');
  if (!record.dimensions) errors.push('缺少 dimensions（适用验证维度结果）');
  const intent = record.intent_id ? getIntent(versionDir, record.intent_id) : null;
  if (intent && !['in_progress', 'needs_review'].includes(intent.status)) {
    errors.push(`Intent ${record.intent_id} 当前状态为 ${intent.status}；只能为 in_progress 或 needs_review 的 Intent 写入验证记录`);
  }
  const requiredDimensions = getRequiredDimensions(intent);
  // dimensions 结构校验：每个维度必须是 { verdict, evidence } 对象
  if (record.dimensions) {
    for (const dim of requiredDimensions) {
      const v = record.dimensions[dim];
      if (v === undefined) {
        errors.push(`dimensions.${dim} 缺失（当前 Intent 的适用维度必须全覆盖）`);
      } else if (typeof v === 'string') {
        errors.push(`dimensions.${dim} 是旧格式（枚举值），必须改成 { verdict, evidence } 对象`);
      } else if (typeof v !== 'object' || v === null) {
        errors.push(`dimensions.${dim} 必须是 { verdict, evidence } 对象`);
      } else {
        if (!VALID_VERDICTS.includes(v.verdict)) {
          errors.push(`dimensions.${dim}.verdict 非法: "${v.verdict}" (合法: ${VALID_VERDICTS.join('|')})`);
        }
        if (record.verdict === 'passed' && v.verdict !== 'passed') {
          errors.push(`整体 verdict 为 passed 时，dimensions.${dim}.verdict 也必须是 passed`);
        }
        if (!v.evidence || typeof v.evidence !== 'string' || v.evidence.trim() === '') {
          errors.push(`dimensions.${dim}.evidence 缺失——必须给出具体证据，不能只写"合规"`);
        } else {
          // evidence 质量校验：长度 + 废话检测
          const ev = v.evidence.trim();
          if (ev.length < 10) {
            errors.push(`dimensions.${dim}.evidence 太短（${ev.length}字符 < 10）——必须给出具体证据，不能只写"合规"`);
          }
          const NONSENSE = ['合规', '通过', 'OK', 'ok', '没问题', '符合要求', '已检查', 'pass', 'passed', 'done'];
          if (NONSENSE.includes(ev)) {
            errors.push(`dimensions.${dim}.evidence "${ev}" 是通用评价而非具体证据——必须写"对照了什么 + 在代码哪里看到/没看到"`);
          }
        }
      }
    }
  }
  const qualityProofRef = record.dimensions?.quality_achievement?.quality_proof_ref;
  if (intent?.quality_contract && record.verdict === 'passed' && !qualityProofRef) {
    errors.push('声明 quality_contract 的 Intent 通过时必须提供 dimensions.quality_achievement.quality_proof_ref');
  }
  if (qualityProofRef !== undefined
    && (typeof qualityProofRef !== 'string' || qualityProofRef.trim() === '')) {
    errors.push('dimensions.quality_achievement.quality_proof_ref 必须是非空字符串');
  } else if (qualityProofRef !== undefined) {
    try {
      resolveQualityProofReference(versionDir, qualityProofRef);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length > 0) {
    throw new Error(`验证记录校验失败:\n  - ${errors.join('\n  - ')}`);
  }

  const intentRevision = getEffectiveIntentRevision(intent);

  const filePath = join(verificationsDir, `${record.intent_id}.json`);

  // 读取已有记录（如果有）
  let data;
  if (existsSync(filePath)) {
    data = readJsonFile(filePath, '验证记录');
    // 结构校验：已有文件必须是 { intent_id, records: [] } 格式
    if (!data || typeof data !== 'object' || !Array.isArray(data.records)) {
      throw new Error(
        `已有验证记录格式错误: ${filePath}\n` +
        `期望格式: { intent_id, records: [...] }\n` +
        `实际格式: ${JSON.stringify(data).slice(0, 200)}\n` +
        `修复: 删除或修正该文件后重试。`
      );
    }
  } else {
    data = { intent_id: record.intent_id, records: [] };
  }

  // 计算轮次和连续 deviated 计数。规范要求中间出现 passed/blocked 后重置。
  const round = data.records.length + 1;
  const recordsWithCurrent = [...data.records, record];
  let deviatedCount = 0;
  for (let i = recordsWithCurrent.length - 1; i >= 0; i--) {
    if (recordsWithCurrent[i].verdict !== 'deviated') break;
    deviatedCount++;
  }

  // 追加新记录
  data.records.push({
    round,
    intent_revision: intentRevision,
    verification_epoch: getEffectiveVerificationEpoch(intent),
    verdict: record.verdict,
    timestamp: record.timestamp,
    summary: record.summary,
    dimensions: record.dimensions,
    reproduction_command: record.reproduction_command,
    deviation_detail: record.deviation_detail,
    reset_suggested: record.reset_suggested,
  });

  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

  // 检查是否应该升级 blocked（连续 3 轮 deviated，默认值）
  const DEVIATED_LIMIT = 3;
  const shouldEscalate = record.verdict === 'deviated' && deviatedCount >= DEVIATED_LIMIT;

  return { filePath, round, deviated_count: deviatedCount, should_escalate: shouldEscalate };
}

/**
 * 读取某 Intent 的验证历史。
 * @returns {{ intent_id: string, records: array } | null}
 */
export function getVerificationHistory(verificationsDir, intentId) {
  const filePath = join(verificationsDir, `${intentId}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return readJsonFile(filePath, '验证记录');
}

/** Read each owning version's local records along the explicit predecessor graph. */
export function getAcrossVersionVerificationHistory(currentVersionDir, inputRef) {
  const root = resolveIntentRef(currentVersionDir, inputRef);
  const histories = [];
  const visited = new Set();
  const active = new Set();

  function walk(resolved) {
    if (active.has(resolved.ref)) throw new Error(`Intent lineage 存在循环: ${[...active, resolved.ref].join(' -> ')}`);
    if (visited.has(resolved.ref)) return;
    active.add(resolved.ref);
    const intent = getIntent(resolved.versionDir, resolved.intentId);
    const local = getVerificationHistory(join(resolved.versionDir, 'verifications'), resolved.intentId);
    histories.push({
      ref: resolved.ref,
      source_version: resolved.version,
      source_intent: resolved.intentId,
      source_intent_id: resolved.intentId,
      records: (local?.records || []).map((record) => ({
        ...record,
        source_version: resolved.version,
        source_intent: resolved.intentId,
        source_intent_id: resolved.intentId,
      })),
    });
    for (const predecessor of intent.lineage?.predecessors || []) {
      walk(resolveIntentRef(currentVersionDir, formatIntentRef(predecessor.version, predecessor.intent_id)));
    }
    active.delete(resolved.ref);
    visited.add(resolved.ref);
  }

  walk(root);
  return { intent_ref: root.ref, across_versions: true, histories };
}

/**
 * 快捷创建验证记录——Agent 不用手动构造完整 JSON。
 * 内部用 summary 填充适用维度的 evidence，生成标准记录格式。
 * @param {string} versionDir — 当前 .loom/v{N}/ 目录
 * @param {string} verificationsDir — verifications/ 目录路径
 * @param {string} intentId — 如 "INT-001"
 * @param {string} verdict — 'passed' | 'deviated' | 'blocked'
 * @param {string} summary — 验证摘要（也会作为所有适用维度的 evidence）
 * @param {object} [extras]
 * @param {string} [extras.reproduction_command] — 复现命令
 * @param {string} [extras.quality_proof_ref] — Quality Proof 证据引用
 * @param {string} [extras.preservation_evidence] — 对既有状态守恒的独立证据
 * @param {string} [extras.deviation_detail] — 偏离说明（deviated 时）
 * @returns {{ filePath: string, round: number, deviated_count: number, should_escalate: boolean }}
 */
export function createQuickVerification(versionDir, verificationsDir, intentId, verdict, summary, extras = {}) {
  const timestamp = new Date().toISOString();
  const intent = getIntent(versionDir, intentId);
  // 用 summary 填充适用维度的 evidence——快捷命令不要求 Agent 逐维度写
  const dimensions = {};
  for (const dim of getRequiredDimensions(intent)) {
    dimensions[dim] = {
      verdict,
      evidence: dim === 'preservation_achievement'
        ? (extras.preservation_evidence || summary)
        : summary,
    };
  }
  if (extras.quality_proof_ref && dimensions.quality_achievement) {
    dimensions.quality_achievement.quality_proof_ref = extras.quality_proof_ref;
  }
  return writeVerification(versionDir, verificationsDir, {
    intent_id: intentId,
    verdict,
    timestamp,
    summary,
    dimensions,
    reproduction_command: extras.reproduction_command || null,
    deviation_detail: extras.deviation_detail || null,
  });
}

/**
 * 返回所有待验证的 Intent（有实现产物但还没验证记录的）。
 * 需要传入 Intent Map 来判断哪些 Intent 是 in_progress。
 */
export function getPendingVerifications(versionDir, verificationsDir) {
  const intentMap = readJsonFile(join(versionDir, '04_INTENT_MAP.json'), 'Intent Map');
  const pending = [];
  for (const [id, intent] of Object.entries(intentMap.intents)) {
    if (intent.status === 'in_progress' || intent.status === 'needs_review') {
      const history = getVerificationHistory(verificationsDir, id);
      if (!hasCurrentPassedVerification(intent, history)) pending.push(id);
    }
  }
  return pending;
}

/** Missing Intent revisions are revision 1 without mutating the map. */
export function getEffectiveIntentRevision(intent) {
  return intent.revision ?? 1;
}

/**
 * Legacy records count as revision 1 only while the Intent itself is legacy.
 * Once revision is explicit, an untagged record cannot prove freshness.
 */
export function getVerificationIntentRevision(intent, record) {
  if (Number.isInteger(record?.intent_revision) && record.intent_revision >= 1) {
    return record.intent_revision;
  }
  return hasLegacyIntentRevision(intent) ? 1 : null;
}

export function isVerificationCurrent(intent, record) {
  return getVerificationIntentRevision(intent, record) === getEffectiveIntentRevision(intent)
    && getVerificationEpoch(intent, record) === getEffectiveVerificationEpoch(intent);
}

export function getVerificationEpoch(intent, record) {
  if (Number.isInteger(record?.verification_epoch) && record.verification_epoch >= 1) {
    return record.verification_epoch;
  }
  return intent?.verification_epoch === undefined ? 1 : null;
}

export function getLatestPassedVerification(history) {
  if (!Array.isArray(history?.records)) return null;
  return [...history.records].reverse().find((record) => record.verdict === 'passed') ?? null;
}

export function hasCurrentPassedVerification(intent, history) {
  const latest = history?.records?.[history.records.length - 1];
  return latest?.verdict === 'passed' && isVerificationCurrent(intent, latest);
}

/**
 * 列出所有验证记录文件。
 * 只列出正式验证记录——文件名匹配 INT-XXX 格式且内容含 records 字段。
 * 过滤掉用户写入的临时输入文件（如 INT-001.verify.json、_tmp_*.json）。
 */
export function listVerifications(verificationsDir) {
  if (!existsSync(verificationsDir)) return [];
  return readdirSync(verificationsDir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => /^INT-\d+\.json$/.test(f))
    .map((f) => f.replace('.json', ''));
}

/**
 * 获取某 Intent 的验证契约（acceptance 字段的解析结果）。
 * 如果 acceptance 是内联定义，直接返回。
 * 如果是引用（如 "see 05_VERIFICATION.md#int-001"），解析引用并返回对应章节内容。
 * @param {string} versionDir — .loom/v{N}/ 目录
 * @param {string} intentId — Intent ID
 * @returns {string} 验收契约内容
 */
export function getVerificationContract(versionDir, intentId) {
  const intentMap = readJsonFile(join(versionDir, '04_INTENT_MAP.json'), 'Intent Map');
  if (!(intentId in intentMap.intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }
  const acceptance = intentMap.intents[intentId].acceptance;

  // 检测是否是引用格式: "see 05_VERIFICATION.md#section" 或 "05_VERIFICATION.md#section"
  const refMatch = acceptance.match(/(?:see\s+)?(\w+\.md)#([\w-]+)/i);
  if (refMatch) {
    const [, file, section] = refMatch;
    const filePath = join(versionDir, file);
    if (!existsSync(filePath)) {
      throw new Error(`验证契约引用的文件不存在: ${filePath}`);
    }
    const content = readFileSync(filePath, 'utf-8');
    return extractMdSection(content, section, '验证契约');
  }

  // 内联定义，直接返回
  return acceptance;
}
