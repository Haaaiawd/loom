// verify.js — 验证记录的读写和查询
// 验证记录存放在 .loom/v{N}/verifications/ 下，每个 Intent 一份 JSON + 一份 MD。

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 合法判定结果 */
const VALID_VERDICTS = ['passed', 'deviated', 'blocked', 'pending_human'];

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
  if (errors.length > 0) {
    throw new Error(`验证记录校验失败:\n  - ${errors.join('\n  - ')}`);
  }

  const filePath = join(verificationsDir, `${record.intent_id}.json`);

  // 读取已有记录（如果有）
  let data;
  if (existsSync(filePath)) {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
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
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * 返回所有待验证的 Intent（有实现产物但还没验证记录的）。
 * 需要传入 Intent Map 来判断哪些 Intent 是 in_progress。
 */
export function getPendingVerifications(loomDir, verificationsDir) {
  const intentMap = JSON.parse(
    readFileSync(join(loomDir, '04_INTENT_MAP.json'), 'utf-8')
  );
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
 */
export function listVerifications(verificationsDir) {
  if (!existsSync(verificationsDir)) return [];
  return readdirSync(verificationsDir)
    .filter((f) => f.endsWith('.json'))
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
  const intentMap = JSON.parse(readFileSync(join(loomDir, '04_INTENT_MAP.json'), 'utf-8'));
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
    return extractMdSection(content, section);
  }

  // 内联定义，直接返回
  return acceptance;
}

/**
 * 从 heading 文本中提取显式锚点。
 * 支持 Pandoc/MDX 风格语法: "## INT-003 {#int-003}"
 */
function extractExplicitAnchor(headingText) {
  const match = headingText.match(/\{#([\w-]+)\}\s*$/);
  return match ? match[1] : null;
}

/**
 * slugify — 和 philosophy.js 保持一致的逻辑。
 */
function slugify(text) {
  return text
    .replace(/\r/g, '')
    .replace(/\{#[\w-]+\}\s*$/, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

/**
 * 从 MD 内容中按 heading slug 提取章节。
 * 支持显式锚点 {#slug} 和自动 slugify。
 */
function extractMdSection(content, sectionSlug) {
  const lines = content.split('\n');
  let capturing = false;
  let targetLevel = 0;
  const captured = [];

  for (const line of lines) {
    const cleanLine = line.replace(/\r$/, '');
    const headingMatch = cleanLine.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const slug = extractExplicitAnchor(headingText) || slugify(headingText);
      if (capturing && level <= targetLevel) break;
      if (slug === sectionSlug) {
        capturing = true;
        targetLevel = level;
        captured.push(cleanLine);
        continue;
      }
    }
    if (capturing) captured.push(cleanLine);
  }

  if (captured.length === 0) {
    throw new Error(`验证契约章节未找到: #${sectionSlug}`);
  }
  return captured.join('\n').trim();
}
