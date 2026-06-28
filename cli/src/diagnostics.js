// diagnostics — LOOM 诊断与追溯工具集
// 提供 doctor / context / trace / reverse-dep / reverse-ref 五个聚合命令。
// 全部是只读的数据聚合，不做决策、不修改文件。

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadIntentMap, getStatus, getNextIntent, getNarrative, getIntent } from './intent-map.js';
import { getPhilosophy } from './philosophy.js';
import { getVerificationHistory, getPendingVerifications, getVerificationContract } from './verify.js';

// ─── doctor ────────────────────────────────────────────
// 全面健康检查：一致性 + 孤儿引用 + 循环依赖 + 僵尸 Intent

/**
 * 项目健康检查。
 * @param {string} versionDir — 当前版本目录
 * @param {string} verificationsDir — 验证记录目录
 * @param {string} philosophyDir — 哲学目录
 * @returns {{ issues: object[], summary: object }}
 */
export function doctor(versionDir, verificationsDir, philosophyDir) {
  const { intents, topo_order } = loadIntentMap(versionDir);
  const issues = [];

  // 1. 状态一致性：in_progress/completed 但无验证记录
  for (const [id, intent] of Object.entries(intents)) {
    const hasRecord = existsSync(join(verificationsDir, `${id}.json`));
    if (intent.status === 'completed' && !hasRecord) {
      issues.push({ id, type: 'completed_no_record', severity: 'high', msg: `${id} 状态为 completed 但无验证记录` });
    }
    if (intent.status === 'in_progress' && !hasRecord) {
      issues.push({ id, type: 'in_progress_no_record', severity: 'medium', msg: `${id} 状态为 in_progress 但无验证记录（可能上次中断）` });
    }
  }

  // 2. 孤儿引用：哲学锚点指向不存在的文件
  for (const [id, intent] of Object.entries(intents)) {
    if (!intent.philosophy_anchors) continue;
    for (const anchor of intent.philosophy_anchors) {
      const [file] = anchor.split('#');
      const filePath = join(philosophyDir, file);
      if (!existsSync(filePath)) {
        issues.push({ id, type: 'orphan_philosophy_ref', severity: 'high', msg: `${id} 引用不存在的哲学文件: ${file}` });
      }
    }
  }

  // 3. 孤儿引用：depends_on 指向不存在的 Intent
  for (const [id, intent] of Object.entries(intents)) {
    if (!intent.depends_on) continue;
    for (const dep of intent.depends_on) {
      if (!(dep in intents)) {
        issues.push({ id, type: 'orphan_dependency', severity: 'high', msg: `${id} 依赖不存在的 Intent: ${dep}` });
      }
    }
  }

  // 4. 循环依赖检测（DFS）
  const cycles = detectCycles(intents);
  for (const cycle of cycles) {
    issues.push({ id: cycle.join('→'), type: 'cycle', severity: 'fatal', msg: `循环依赖: ${cycle.join(' → ')}` });
  }

  // 5. 僵尸 Intent：in_progress/blocked 超过 N 天无活动（按验证记录最后修改时间）
  const ZOMBIE_DAYS = 7;
  const now = Date.now();
  for (const [id, intent] of Object.entries(intents)) {
    if (intent.status !== 'in_progress' && intent.status !== 'blocked') continue;
    const recordPath = join(verificationsDir, `${id}.json`);
    let lastActivity = existsSync(join(versionDir, '04_INTENT_MAP.json'))
      ? statSync(join(versionDir, '04_INTENT_MAP.json')).mtimeMs
      : now;
    if (existsSync(recordPath)) {
      lastActivity = Math.max(lastActivity, statSync(recordPath).mtimeMs);
    }
    const daysIdle = (now - lastActivity) / (1000 * 60 * 60 * 24);
    if (daysIdle > ZOMBIE_DAYS) {
      issues.push({ id, type: 'zombie', severity: 'medium', msg: `${id} 状态为 ${intent.status} 已 ${Math.floor(daysIdle)} 天无活动` });
    }
  }

  // 6. 依赖状态一致性：completed 不能依赖 blocked
  for (const [id, intent] of Object.entries(intents)) {
    if (intent.status !== 'completed' || !intent.depends_on) continue;
    for (const dep of intent.depends_on) {
      const depIntent = intents[dep];
      if (depIntent && depIntent.status === 'blocked') {
        issues.push({ id, type: 'completed_depends_blocked', severity: 'high', msg: `${id} 状态为 completed 但依赖 blocked 的 ${dep}` });
      }
    }
  }

  // 7. 验证脚本可执行性：检查 verification_method 引用的脚本/目录是否存在
  const projectDir = join(versionDir, '..', '..');
  for (const [id, intent] of Object.entries(intents)) {
    if (!intent.verification_method) continue;
    const vm = intent.verification_method;
    // 检测 npm test 引用
    if (vm.includes('npm test') || vm.includes('npm run test')) {
      const pkgPath = join(projectDir, 'package.json');
      if (!existsSync(pkgPath)) {
        issues.push({ id, type: 'test_script_missing', severity: 'medium', msg: `${id} verification_method 要求 npm test 但项目根没有 package.json` });
      } else {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          const testScript = pkg.scripts && pkg.scripts.test;
          if (!testScript) {
            issues.push({ id, type: 'test_script_missing', severity: 'medium', msg: `${id} verification_method 要求 npm test 但 package.json 没有 test 脚本` });
          } else {
            // 检查 test 脚本引用的目录/文件是否存在
            // 常见模式: "node --test test/" / "mocha test/" / "jest" 等
            const testDirMatch = testScript.match(/(?:--test|test)\s+(\S+)/);
            if (testDirMatch) {
              const testTarget = testDirMatch[1].replace(/['"]/g, '');
              if (!existsSync(join(projectDir, testTarget))) {
                issues.push({ id, type: 'test_script_missing', severity: 'medium', msg: `${id} verification_method 要求 npm test 但 test 脚本引用的 ${testTarget} 不存在` });
              }
            }
          }
        } catch {
          // package.json 解析失败，不报——不是 doctor 的职责
        }
      }
    }
  }

  const summary = {
    total_issues: issues.length,
    fatal: issues.filter((i) => i.severity === 'fatal').length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    healthy: issues.length === 0,
  };

  return { issues, summary };
}

/**
 * DFS 检测循环依赖。
 * 返回循环路径数组，每个是 [A, B, C, A] 形式。
 */
function detectCycles(intents) {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();
  const path = [];

  function dfs(id) {
    if (stack.has(id)) {
      // 找到环
      const cycleStart = path.indexOf(id);
      cycles.push([...path.slice(cycleStart), id]);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    path.push(id);
    const intent = intents[id];
    if (intent?.depends_on) {
      for (const dep of intent.depends_on) {
        if (dep in intents) dfs(dep);
      }
    }
    path.pop();
    stack.delete(id);
  }

  for (const id of Object.keys(intents)) {
    if (!visited.has(id)) dfs(id);
  }
  return cycles;
}

// ─── context ───────────────────────────────────────────
// 一条命令拿到：进度 + 下一个 Intent + 待验证 + 不一致项 + 风险

/**
 * 项目上下文摘要——Agent 重启后一条命令获取"我在哪"。
 * @param {string} versionDir
 * @param {string} verificationsDir
 * @param {string} philosophyDir
 * @returns {object}
 */
export function contextSummary(versionDir, verificationsDir, philosophyDir) {
  const status = getStatus(versionDir);
  const next = getNextIntent(versionDir);
  const pending = getPendingVerifications(versionDir, verificationsDir);
  const { issues } = doctor(versionDir, verificationsDir, philosophyDir);

  const risks = [];
  const fatalCount = issues.filter((i) => i.severity === 'fatal').length;
  const highCount = issues.filter((i) => i.severity === 'high').length;
  if (fatalCount > 0) risks.push(`${fatalCount} 个致命问题（循环依赖）`);
  if (highCount > 0) risks.push(`${highCount} 个高严重度问题（状态不一致/孤儿引用）`);
  if (status.counts.blocked > 0) risks.push(`${status.counts.blocked} 个阻塞 Intent`);

  return {
    progress: {
      completed: status.counts.completed,
      total: status.counts.total,
      rate: `${status.counts.completed}/${status.counts.total}`,
    },
    next_intent: next ? next.id : null,
    pending_verifications: pending,
    inconsistent_states: issues.filter((i) => i.type === 'in_progress_no_record' || i.type === 'completed_no_record').map((i) => i.id),
    risks,
    healthy: issues.length === 0,
  };
}

// ─── trace ─────────────────────────────────────────────
// Intent 完整追溯链：依赖链 + 验证历史 + 哲学锚点内容 + 意图叙事

/**
 * 返回某个 Intent 的完整追溯链。
 * @param {string} versionDir
 * @param {string} verificationsDir
 * @param {string} philosophyDir
 * @param {string} intentId
 * @returns {object}
 */
export function traceIntent(versionDir, verificationsDir, philosophyDir, intentId) {
  const intent = getIntent(versionDir, intentId);
  if (!intent) throw new Error(`Intent 不存在: ${intentId}`);

  // 意图叙事
  let narrative = null;
  let narrativeError = null;
  try { narrative = getNarrative(versionDir, intentId); }
  catch (e) { narrativeError = e.message; /* narrative_ref 可能缺失或解析失败 */ }

  // 验收契约
  let acceptance = null;
  let acceptanceError = null;
  try { acceptance = getVerificationContract(versionDir, intentId); }
  catch (e) { acceptanceError = e.message; /* 引用可能缺失或解析失败 */ }

  // 验证历史
  const verificationHistory = getVerificationHistory(verificationsDir, intentId);

  // 哲学锚点内容
  const philosophyContent = {};
  if (intent.philosophy_anchors) {
    for (const anchor of intent.philosophy_anchors) {
      try {
        philosophyContent[anchor] = getPhilosophy(philosophyDir, anchor);
      } catch (e) {
        philosophyContent[anchor] = null;
      }
    }
  }

  // 依赖链（递归向上）
  const { intents } = loadIntentMap(versionDir);
  const dependencyChain = [];
  function walkDeps(id, depth) {
    const node = intents[id];
    if (!node?.depends_on || node.depends_on.length === 0) return;
    for (const dep of node.depends_on) {
      dependencyChain.push({ id: dep, depth, status: intents[dep]?.status });
      walkDeps(dep, depth + 1);
    }
  }
  walkDeps(intentId, 0);

  return {
    intent,
    narrative,
    narrative_error: narrativeError,
    acceptance,
    acceptance_error: acceptanceError,
    verification_history: verificationHistory,
    philosophy_anchors_content: philosophyContent,
    dependency_chain: dependencyChain,
  };
}

// ─── reverse-dep ───────────────────────────────────────
// 反向依赖：哪些 Intent 依赖这个 Intent

/**
 * 返回依赖指定 Intent 的所有 Intent。
 * @param {string} versionDir
 * @param {string} intentId
 * @returns {string[]}
 */
export function reverseDep(versionDir, intentId) {
  const { intents } = loadIntentMap(versionDir);
  const result = [];
  for (const [id, intent] of Object.entries(intents)) {
    if (intent.depends_on?.includes(intentId)) {
      result.push(id);
    }
  }
  return result;
}

// ─── reverse-ref ───────────────────────────────────────
// 反向哲学引用：哪些 Intent 引用了这个哲学锚点

/**
 * 返回引用指定哲学锚点的所有 Intent。
 * @param {string} versionDir
 * @param {string} anchor — 如 "PRODUCT_PHILOSOPHY.md#core-belief"
 * @returns {string[]}
 */
export function reverseRef(versionDir, anchor) {
  const { intents } = loadIntentMap(versionDir);
  const result = [];
  for (const [id, intent] of Object.entries(intents)) {
    if (intent.philosophy_anchors?.includes(anchor)) {
      result.push(id);
    }
  }
  return result;
}
