// verify.js — 验证记录的读写和查询
// 验证记录存放在 .loom/v{N}/verifications/ 下，每个 Intent 一份 JSON + 一份 MD。

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extractMdSection, readJsonFile } from './shared/md-utils.js';

/** 合法判定结果 */
const VALID_VERDICTS = ['passed', 'deviated', 'blocked', 'pending_human'];

/** 四个必须覆盖的验证维度 */
const REQUIRED_DIMENSIONS = [
  'intent_fidelity',
  'philosophy_consistency',
  'baseline_compliance',
  'acceptance_achievement',
];

/**
 * 写入一条验证记录（追加模式——同一 Intent 多次验证保留完整历史）。
 * 文件格式: { intent_id, records: [{ round, verdict, timestamp, ... }] }
 * @param {string} verificationsDir — verifications/ 目录路径
 * @param {object} record — 验证记录
 * @param {string} record.intent_id — 如 "INT-001"
 * @param {string} record.verdict — passed | deviated | blocked
 * @param {string} record.timestamp — ISO 8601
 * @param {string} record.summary — 验证摘要
 * @param {object} record.dimensions — 四个维度的验证结果
 * @param {string} [record.reproduction_command] — 复现验证的命令（如 "LLM_API_KEY=mock npm test"）
 * @param {string} [record.deviation_detail] — 偏离说明（deviated 时）
 * @param {boolean} [record.reset_suggested] — 是否建议重置上下文
 * @returns {{ filePath: string, round: number, deviated_count: number, should_escalate: boolean }}
 */
export function writeVerification(verificationsDir, record) {
  const errors = [];
  if (!record.intent_id) errors.push('缺少 intent_id');
  if (!record.verdict || !VALID_VERDICTS.includes(record.verdict)) {
    errors.push(`verdict 非法: "${record.verdict}" (合法: ${VALID_VERDICTS.join('|')})`);
  }
  if (!record.timestamp) errors.push('缺少 timestamp');
  if (!record.dimensions) errors.push('缺少 dimensions（四个维度结果）');
  // dimensions 结构校验：每个维度必须是 { verdict, evidence } 对象
  if (record.dimensions) {
    for (const dim of REQUIRED_DIMENSIONS) {
      const v = record.dimensions[dim];
      if (v === undefined) {
        errors.push(`dimensions.${dim} 缺失（四个维度必须全覆盖）`);
      } else if (typeof v === 'string') {
        errors.push(`dimensions.${dim} 是旧格式（枚举值），必须改成 { verdict, evidence } 对象`);
      } else if (typeof v !== 'object' || v === null) {
        errors.push(`dimensions.${dim} 必须是 { verdict, evidence } 对象`);
      } else {
        if (!VALID_VERDICTS.includes(v.verdict)) {
          errors.push(`dimensions.${dim}.verdict 非法: "${v.verdict}" (合法: ${VALID_VERDICTS.join('|')})`);
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
  if (errors.length > 0) {
    throw new Error(`验证记录校验失败:\n  - ${errors.join('\n  - ')}`);
  }

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

  // 计算轮次和 deviated 计数
  const round = data.records.length + 1;
  const deviatedCount = data.records.filter(r => r.verdict === 'deviated').length
    + (record.verdict === 'deviated' ? 1 : 0);

  // 追加新记录
  data.records.push({
    round,
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

/**
 * 返回所有待验证的 Intent（有实现产物但还没验证记录的）。
 * 需要传入 Intent Map 来判断哪些 Intent 是 in_progress。
 */
export function getPendingVerifications(loomDir, verificationsDir) {
  const intentMap = readJsonFile(join(loomDir, '04_INTENT_MAP.json'), 'Intent Map');
  const pending = [];
  for (const [id, intent] of Object.entries(intentMap.intents)) {
    if (intent.status === 'in_progress') {
      const hasRecord = existsSync(join(verificationsDir, `${id}.json`));
      if (!hasRecord) pending.push(id);
    }
  }
  return pending;
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
 * @param {string} loomDir — .loom/v{N}/ 目录
 * @param {string} intentId — Intent ID
 * @returns {string} 验收契约内容
 */
export function getVerificationContract(loomDir, intentId) {
  const intentMap = readJsonFile(join(loomDir, '04_INTENT_MAP.json'), 'Intent Map');
  if (!(intentId in intentMap.intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }
  const acceptance = intentMap.intents[intentId].acceptance;

  // 检测是否是引用格式: "see 05_VERIFICATION.md#section" 或 "05_VERIFICATION.md#section"
  const refMatch = acceptance.match(/(?:see\s+)?(\w+\.md)#([\w-]+)/i);
  if (refMatch) {
    const [, file, section] = refMatch;
    const filePath = join(loomDir, file);
    if (!existsSync(filePath)) {
      throw new Error(`验证契约引用的文件不存在: ${filePath}`);
    }
    const content = readFileSync(filePath, 'utf-8');
    return extractMdSection(content, section, '验证契约');
  }

  // 内联定义，直接返回
  return acceptance;
}
