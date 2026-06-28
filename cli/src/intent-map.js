// intent-map.js — Intent Map 的加载、校验、查询
// 真相源是磁盘上的 04_INTENT_MAP.json，这个库负责按需查询，不返回整个文件。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

/**
 * 从 heading 文本中提取显式锚点（和 philosophy.js 一致的逻辑）。
 */
function extractExplicitAnchor(headingText) {
  const match = headingText.match(/\{#([\w-]+)\}\s*$/);
  return match ? match[1] : null;
}

/**
 * slugify — strip \r、支持显式锚点、ASCII fallback。
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
 * 从 MD 内容中提取指定 section（和 philosophy.js 一致的逻辑）。
 */
function extractMdSection(content, sectionSlug) {
  if (!sectionSlug) return content;
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
    throw new Error(`意图叙事章节未找到: #${sectionSlug}`);
  }
  return captured.join('\n').trim();
}

/** 必填字段（INTENT_LOOP.md 底线） */
const REQUIRED_FIELDS = ['id', 'title', 'narrative_ref', 'depends_on', 'acceptance', 'philosophy_anchors', 'status'];

/** 合法 status 值 */
const VALID_STATUS = ['pending', 'in_progress', 'completed', 'blocked', 'needs_review'];

/**
 * 加载 Intent Map 文件。
 * @param {string} loomDir — .loom/v{N}/ 目录的绝对路径
 * @returns {{ _meta: object, intents: Record<string, object>, topo_order: string[] }}
 */
export function loadIntentMap(loomDir) {
  const filePath = join(loomDir, '04_INTENT_MAP.json');
  if (!existsSync(filePath)) {
    throw new Error(`Intent Map 不存在: ${filePath}`);
  }
  const raw = readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Intent Map JSON 解析失败: ${e.message}`);
  }
  validateIntentMap(data);
  return data;
}

/**
 * 校验 Intent Map 结构合规性（INTENT_LOOP.md I-1, I-2 底线）。
 * 抛出错误列表，不静默修复。
 */
export function validateIntentMap(data) {
  const errors = [];

  if (!data.intents || typeof data.intents !== 'object') {
    errors.push('缺少 intents 对象');
    throw new Error(`Intent Map 校验失败:\n  - ${errors.join('\n  - ')}`);
  }

  if (!Array.isArray(data.topo_order)) {
    errors.push('缺少 topo_order 数组');
  }

  for (const [id, intent] of Object.entries(data.intents)) {
    if (intent.id !== id) {
      errors.push(`intents["${id}"].id 与 key 不一致 (实际: "${intent.id}")`);
    }
    for (const field of REQUIRED_FIELDS) {
      if (!(field in intent)) {
        errors.push(`intents["${id}"] 缺少必填字段: ${field}`);
      }
    }
    if (intent.status && !VALID_STATUS.includes(intent.status)) {
      errors.push(`intents["${id}"].status 非法: "${intent.status}" (合法: ${VALID_STATUS.join('|')})`);
    }
    if (intent.depends_on) {
      for (const dep of intent.depends_on) {
        if (!(dep in data.intents)) {
          errors.push(`intents["${id}"].depends_on 引用了不存在的 Intent: ${dep}`);
        }
        // 依赖状态一致性：completed 的 Intent 不能依赖 blocked 的 Intent
        const depIntent = data.intents[dep];
        if (depIntent && intent.status === 'completed' && depIntent.status === 'blocked') {
          errors.push(`intents["${id}"] 状态为 completed 但依赖 blocked 的 ${dep}`);
        }
      }
    }
  }

  // topo_order 必须覆盖所有 Intent
  if (Array.isArray(data.topo_order)) {
    const topoSet = new Set(data.topo_order);
    for (const id of Object.keys(data.intents)) {
      if (!topoSet.has(id)) {
        errors.push(`topo_order 缺少 Intent: ${id}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Intent Map 校验失败:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * 返回下一个可执行 Intent：
 * status=pending 且 depends_on 全部 completed，按 topo_order 取第一个。
 * @returns {object|null} Intent 对象，或 null（没有可执行的）
 */
export function getNextIntent(loomDir) {
  const { intents, topo_order } = loadIntentMap(loomDir);
  for (const id of topo_order) {
    const intent = intents[id];
    if (intent.status !== 'pending') continue;
    const depsReady = intent.depends_on.every(
      (dep) => intents[dep]?.status === 'completed'
    );
    if (depsReady) return intent;
  }
  return null;
}

/**
 * 返回进度概览：各状态的 Intent 数量 + ID 列表。
 */
export function getStatus(loomDir) {
  const { intents } = loadIntentMap(loomDir);
  const summary = { pending: [], in_progress: [], completed: [], blocked: [] };
  const titles = {};
  for (const [id, intent] of Object.entries(intents)) {
    const s = intent.status;
    if (summary[s]) summary[s].push(id);
    titles[id] = intent.title || '';
  }
  return {
    counts: {
      pending: summary.pending.length,
      in_progress: summary.in_progress.length,
      completed: summary.completed.length,
      blocked: summary.blocked.length,
      total: Object.keys(intents).length,
    },
    ids: summary,
    titles,
  };
}

/**
 * 输出 Mermaid 依赖图。
 */
export function getDependencyGraph(loomDir) {
  const { intents, topo_order } = loadIntentMap(loomDir);
  const lines = ['```mermaid', 'graph TD'];
  for (const id of topo_order) {
    const intent = intents[id];
    const shape = intent.status === 'completed' ? ':::done'
      : intent.status === 'blocked' ? ':::blocked'
      : intent.status === 'in_progress' ? ':::active'
      : '';
    lines.push(`  ${id}${shape}`);
    if (intent.depends_on && intent.depends_on.length > 0) {
      for (const dep of intent.depends_on) {
        lines.push(`  ${dep} --> ${id}`);
      }
    }
  }
  lines.push('```');
  return lines.join('\n');
}

/**
 * 按 ID 返回单个 Intent 的完整信息。
 */
export function getIntent(loomDir, intentId) {
  const { intents } = loadIntentMap(loomDir);
  if (!(intentId in intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }
  return intents[intentId];
}

/**
 * 更新 Intent 的运行时 status。
 * 只允许合法的状态转换，防止跳变（如 completed→pending）。
 * @param {string} loomDir — .loom/v{N}/ 目录
 * @param {string} intentId — Intent ID
 * @param {string} newStatus — pending | in_progress | completed | blocked
 * @returns {object} 更新后的 Intent
 */
export function updateIntentStatus(loomDir, intentId, newStatus) {
  if (!VALID_STATUS.includes(newStatus)) {
    throw new Error(`非法 status: "${newStatus}" (合法: ${VALID_STATUS.join('|')})`);
  }

  const filePath = join(loomDir, '04_INTENT_MAP.json');
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));

  if (!(intentId in data.intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }

  const oldStatus = data.intents[intentId].status;
  const validTransitions = {
    pending: ['in_progress', 'blocked'],
    in_progress: ['completed', 'blocked'],
    completed: ['needs_review'],  // 变更回流时可标记需重新验证
    blocked: ['pending'],  // 阻塞解除后回到 pending
    needs_review: ['pending', 'completed'],  // 重新验证后回到 pending 或直接 completed
  };

  if (!validTransitions[oldStatus]?.includes(newStatus)) {
    throw new Error(
      `非法状态转换: ${oldStatus} → ${newStatus}` +
      `\n合法转换: ${oldStatus} → [${validTransitions[oldStatus]?.join(', ') || '无（终态）'}]`
    );
  }

  data.intents[intentId].status = newStatus;
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return data.intents[intentId];
}

/**
 * 获取某 Intent 的意图叙事（解析 narrative_ref，读愿景文档对应章节）。
 * narrative_ref 格式: "01_VISION.md#int-001" 或 "01_VISION.md#int-001"
 * @returns {string} 意图叙事内容
 */
export function getNarrative(loomDir, intentId) {
  const { intents } = loadIntentMap(loomDir);
  if (!(intentId in intents)) {
    throw new Error(`Intent 不存在: ${intentId}`);
  }
  const ref = intents[intentId].narrative_ref;
  if (!ref) {
    throw new Error(`Intent ${intentId} 没有 narrative_ref`);
  }

  // 解析 "FILE.md#section" 格式
  const [file, section] = ref.split('#');
  const filePath = join(loomDir, file.trim());
  if (!existsSync(filePath)) {
    throw new Error(`愿景文档不存在: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf-8');
  return extractMdSection(content, section ? section.trim() : null);
}
