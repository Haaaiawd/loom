// diagnostics — LOOM 诊断与追溯工具集
// 提供 doctor / context / trace / reverse-dep / reverse-ref 五个聚合命令。
// 全部是只读的数据聚合，不做决策、不修改文件。

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadIntentMap, getStatus, getNextIntent, getNarrative, getIntent } from './intent-map.js';
import { getPhilosophy, validateInspirationSources, validatePartDecomposition } from './philosophy.js';
import { getVerificationHistory, getPendingVerifications, getVerificationContract } from './verify.js';

function readIntentMapRaw(versionDir) {
  const filePath = join(versionDir, '04_INTENT_MAP.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function summarizeRawIntentMap(data) {
  const intents = data?.intents && typeof data.intents === 'object' ? data.intents : {};
  const ids = { pending: [], in_progress: [], completed: [], blocked: [], needs_review: [] };
  const titles = {};

  for (const [id, intent] of Object.entries(intents)) {
    const status = intent?.status;
    if (ids[status]) ids[status].push(id);
    titles[id] = intent?.title || '';
  }

  return {
    counts: {
      pending: ids.pending.length,
      in_progress: ids.in_progress.length,
      completed: ids.completed.length,
      blocked: ids.blocked.length,
      needs_review: ids.needs_review.length,
      total: Object.keys(intents).length,
    },
    ids,
    titles,
  };
}

function intentMapDiagnostics(versionDir) {
  const issues = [];
  let raw = null;
  let valid = null;
  let validMap = null;

  try {
    raw = readIntentMapRaw(versionDir);
  } catch (e) {
    issues.push({ id: 'intent_map', type: 'intent_map_unreadable', severity: 'fatal', msg: `Intent Map 无法读取或 JSON 损坏: ${e.message}` });
    return { raw, valid, issues, validMap: null };
  }

  if (!raw) {
    issues.push({ id: 'intent_map', type: 'intent_map_missing', severity: 'fatal', msg: '缺少 04_INTENT_MAP.json' });
    return { raw, valid, issues, validMap: null };
  }

  const isTemplate = raw._meta?._template === true;
  if (isTemplate) {
    issues.push({ id: 'intent_map', type: 'intent_map_template', severity: 'high', msg: 'Intent Map 仍是模板，尚未由 Architect 产出真实意图图', is_template: true });
  }

  try {
    validMap = loadIntentMap(versionDir);
    valid = true;
  } catch (e) {
    valid = false;
    // 模板状态下字段缺失是预期的，降级为 high 而非 fatal
    // 非模板状态下字段缺失是真正的损坏，保持 fatal
    issues.push({ id: 'intent_map', type: 'intent_map_invalid', severity: isTemplate ? 'high' : 'fatal', msg: e.message, is_template: isTemplate });
  }

  return { raw, valid, issues, validMap };
}

function getIntentVerificationMethod(intent) {
  return intent.verification_method || intent._optional?.verification_method || null;
}

function normalizeVerificationCommand(command) {
  return String(command || '')
    .replace(/^\s*run\s+/i, '')
    .replace(/^\s*exec\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 包管理器别名——npm test / pnpm test / bun test / yarn test 互相等价
const PM_ALIASES = ['npm', 'pnpm', 'bun', 'yarn'];

/**
 * 把命令里的包管理器名归一化成 token，方便比较。
 * "pnpm test" → "<PM> test"，"npm run build" → "<PM> run build"
 */
function normalizePackageManager(command) {
  let result = command;
  for (const pm of PM_ALIASES) {
    result = result.replace(new RegExp(`\\b${pm}\\b`, 'g'), '<PM>');
  }
  return result;
}

/**
 * 检测项目使用的包管理器。
 * 优先级：锁文件存在性
 * @param {string} projectDir — 项目根目录
 * @returns {string} 'pnpm' | 'bun' | 'yarn' | 'npm'
 */
export function detectPackageManager(projectDir) {
  if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectDir, 'bun.lockb'))) return 'bun';
  if (existsSync(join(projectDir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function commandCoversMethod(actualCommand, expectedMethod) {
  const actual = normalizeVerificationCommand(actualCommand);
  const expected = normalizeVerificationCommand(expectedMethod);
  if (!actual || !expected) return false;

  return expected.split('&&').every((part) => {
    const expectedPart = normalizeVerificationCommand(part);
    if (!expectedPart) return true;
    if (actual.includes(expectedPart)) return true;
    // 包管理器别名归一化：pnpm test = npm test = bun test = yarn test
    const actualNorm = normalizePackageManager(actual);
    const expectedNorm = normalizePackageManager(expectedPart);
    if (actualNorm.includes(expectedNorm)) return true;
    // npm test is an acceptable broader reproduction for node --test based methods.
    if (expectedPart.startsWith('node --test') && actualNorm.includes('<PM> test')) return true;
    return false;
  });
}

// ─── doctor ────────────────────────────────────────────
// 全面健康检查：一致性 + 孤儿引用 + 循环依赖 + 僵尸 Intent

// 每种 issue 类型的修复提示——给 Agent 行动化建议
const FIX_HINTS = {
  intent_map_unreadable: '检查 .loom/v{N}/04_INTENT_MAP.json 是否合法 JSON（jsonlint.com 或 node -e "JSON.parse(require(\'fs\').readFileSync(\'04_INTENT_MAP.json\'))"）',
  intent_map_missing: '运行 loom init 或 loom activate architect 产出 04_INTENT_MAP.json',
  intent_map_template: '运行 loom activate architect，Architect 填充真实 Intent Map 后删除 _meta._template 标记',
  intent_map_invalid: '按报错信息修正 04_INTENT_MAP.json 里对应字段（补 title / 加长 acceptance / 填必填字段）',
  completed_no_record: '在 .loom/v{N}/verifications/ 下补验证记录，或运行 loom verify pass {id} --summary "..."',
  in_progress_no_record: '运行 loom verify pass {id} --summary "..." 写入验证记录，或 loom intent update {id} --status pending 回退',
  orphan_philosophy_ref: '检查 04_INTENT_MAP.json 里 {id} 的 philosophy_anchors，移除或修正不存在的哲学文件引用',
  orphan_dependency: '检查 04_INTENT_MAP.json 里 {id} 的 depends_on，移除或修正不存在的 Intent ID',
  cycle: '打破循环：把循环链中某个 Intent 的 depends_on 里去掉前驱，或拆成更小的 Intent',
  zombie: '检查 {id} 是否还需要——不需要就 loom intent update {id} --status completed 或 blocked',
  completed_depends_blocked: '检查依赖 {dep} 为什么 blocked——解决阻塞或把 {id} 回退到 in_progress',
  test_script_missing: '在 package.json 里加 test 脚本，或修正 verification_method 指向实际存在的测试命令',
  verification_method_unverified: '运行 loom verify pass {id} --summary "..." --reproduction-command "..." 覆盖声明的验证方式',
  verification_method_drift: '验证记录的 reproduction_command 要覆盖 verification_method 声明的命令（支持 npm/pnpm/bun 互相等价）',
  inspiration_source: '在哲学文档的"灵感来源"章节填入至少 3 个源（- **源名** — 理由。来源：URL 或 file:// 或 local:./path）',
  part_decomposition: '在哲学文档加"实现部分清单"章节，按 PART_DECOMPOSITION.md 拆解实现部分（- **部分名** 格式）',
};

/**
 * 给 issue 补 fix_hint——把 {id} {dep} 等占位符替换成实际值。
 */
function addFixHint(issue) {
  const template = FIX_HINTS[issue.type];
  if (!template) return issue;
  let hint = template;
  // 提取 id 里的实际 Intent ID（issue.id 可能是 "INT-001" 或 "INT-002→INT-001" 等）
  const idMatch = String(issue.id).match(/(INT-\d+)/);
  if (idMatch) hint = hint.replace(/\{id\}/g, idMatch[1]);
  // 提取 dep（从 msg 里找 depends_on 后的 Intent ID）
  const depMatch = issue.msg && issue.msg.match(/依赖.*?(INT-\d+)/);
  if (depMatch) hint = hint.replace(/\{dep\}/g, depMatch[1]);
  return { ...issue, fix_hint: hint };
}

/**
 * 项目健康检查。
 * @param {string} versionDir — 当前版本目录
 * @param {string} verificationsDir — 验证记录目录
 * @param {string} philosophyDir — 哲学目录
 * @returns {{ issues: object[], summary: object }}
 */
export function doctor(versionDir, verificationsDir, philosophyDir) {
  const mapState = intentMapDiagnostics(versionDir);
  const issues = [...mapState.issues];

  if (!mapState.validMap) {
    appendPhilosophyDiagnostics(issues, philosophyDir);
    const issuesWithHints = issues.map(addFixHint);
    return { issues: issuesWithHints, summary: summarizeIssues(issuesWithHints) };
  }

  const { intents } = mapState.validMap;

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
  const pm = detectPackageManager(projectDir);
  for (const [id, intent] of Object.entries(intents)) {
    const vm = getIntentVerificationMethod(intent);
    if (!vm) continue;
    // 检测任意包管理器的 test 引用（npm/pnpm/bun/yarn）
    const pmTestRe = new RegExp(`(?:${PM_ALIASES.join('|')})\\s+(?:run\\s+)?test`);
    if (pmTestRe.test(vm)) {
      const pkgPath = join(projectDir, 'package.json');
      if (!existsSync(pkgPath)) {
        issues.push({ id, type: 'test_script_missing', severity: 'medium', msg: `${id} verification_method 要求 test 但项目根没有 package.json` });
      } else {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          const testScript = pkg.scripts && pkg.scripts.test;
          if (!testScript) {
            issues.push({ id, type: 'test_script_missing', severity: 'medium', msg: `${id} verification_method 要求 test 但 package.json 没有 test 脚本` });
          } else {
            // 检查 test 脚本引用的目录/文件是否存在
            const testDirMatch = testScript.match(/(?:--test|test)\s+(\S+)/);
            if (testDirMatch) {
              const testTarget = testDirMatch[1].replace(/['"]/g, '');
              if (!existsSync(join(projectDir, testTarget))) {
                issues.push({ id, type: 'test_script_missing', severity: 'medium', msg: `${id} verification_method 要求 test 但 test 脚本引用的 ${testTarget} 不存在` });
              }
            }
          }
        } catch {
          // package.json 解析失败，不报——不是 doctor 的职责
        }
      }
    }
  }

  // 8. completed Intent 的 verification_method 必须被最新验证记录覆盖，防止契约命令漂移。
  for (const [id, intent] of Object.entries(intents)) {
    if (intent.status !== 'completed') continue;
    const method = getIntentVerificationMethod(intent);
    if (!method) continue;

    const expected = normalizeVerificationCommand(method);
    if (!expected || expected === 'human_review') continue;

    const history = getVerificationHistory(verificationsDir, id);
    const latest = history?.records?.[history.records.length - 1];
    const actual = normalizeVerificationCommand(latest?.reproduction_command);

    if (!latest) {
      issues.push({ id, type: 'verification_method_unverified', severity: 'high', msg: `${id} 声明了 verification_method 但没有验证记录覆盖: ${method}` });
    } else if (!actual) {
      issues.push({ id, type: 'verification_method_unverified', severity: 'high', msg: `${id} 最新验证记录缺少 reproduction_command，无法复现 verification_method: ${method}` });
    } else if (!commandCoversMethod(actual, expected)) {
      issues.push({ id, type: 'verification_method_drift', severity: 'high', msg: `${id} verification_method 未被最新 reproduction_command 覆盖。method="${method}" reproduction_command="${latest.reproduction_command}"` });
    }
  }

  appendPhilosophyDiagnostics(issues, philosophyDir);
  const issuesWithHints = issues.map(addFixHint);
  return { issues: issuesWithHints, summary: summarizeIssues(issuesWithHints) };
}

function appendPhilosophyDiagnostics(issues, philosophyDir) {
  // 哲学灵感来源校验（防止 Weaver 从训练数据"背"几个名字就交差）
  if (!existsSync(philosophyDir)) return;

  const inspirationCheck = validateInspirationSources(philosophyDir);
  for (const issue of inspirationCheck.issues) {
    issues.push({ id: 'philosophy', type: 'inspiration_source', severity: issue.severity, msg: issue.msg });
  }

  // 实现部分拆解校验（防止 Weaver 跳过拆解步骤）
  const decompositionCheck = validatePartDecomposition(philosophyDir);
  for (const issue of decompositionCheck.issues) {
    issues.push({ id: 'philosophy', type: 'part_decomposition', severity: issue.severity, msg: issue.msg });
  }
}

function summarizeIssues(issues) {
  return {
    total_issues: issues.length,
    fatal: issues.filter((i) => i.severity === 'fatal').length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    healthy: issues.length === 0,
  };
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
  const mapState = intentMapDiagnostics(versionDir);
  const status = mapState.valid ? getStatus(versionDir) : summarizeRawIntentMap(mapState.raw);
  const next = mapState.valid ? getNextIntent(versionDir) : null;
  const pending = mapState.valid ? getPendingVerifications(versionDir, verificationsDir) : [];
  const { issues } = doctor(versionDir, verificationsDir, philosophyDir);

  // 区分模板阶段问题（待填充）和真实损坏
  const templateIssues = issues.filter((i) => i.is_template || i.type === 'intent_map_template' || i.type === 'inspiration_source' || i.type === 'part_decomposition');
  const realIssues = issues.filter((i) => !templateIssues.includes(i));

  const risks = [];
  const fatalCount = realIssues.filter((i) => i.severity === 'fatal').length;
  const highCount = realIssues.filter((i) => i.severity === 'high').length;
  if (fatalCount > 0) risks.push(`${fatalCount} 个致命问题（Intent Map 损坏/循环依赖）`);
  if (highCount > 0) risks.push(`${highCount} 个高严重度问题（状态不一致/孤儿引用）`);
  if (templateIssues.length > 0) risks.push(`${templateIssues.length} 个待填充（模板未产出，需 Weaver/Architect 填充）`);
  if (status.counts.blocked > 0) risks.push(`${status.counts.blocked} 个阻塞 Intent`);

  return {
    intent_map_valid: mapState.valid === true,
    progress: {
      completed: status.counts.completed,
      total: status.counts.total,
      rate: `${status.counts.completed}/${status.counts.total}`,
    },
    next_intent: next ? next.id : null,
    pending_verifications: pending,
    inconsistent_states: issues.filter((i) => i.type === 'in_progress_no_record' || i.type === 'completed_no_record').map((i) => i.id),
    risks,
    healthy: realIssues.length === 0,
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
