// guide — 状态感知动态引导
// 检测项目当前在哪个阶段，输出"你在阶段 X，下一步做 Y"。
// 面向 Agent（主）和人类（辅）。比 help workflow（静态）智能。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readCurrentPointer } from './version.js';
import { loadIntentMap } from './intent-map.js';
import { getCapabilityCoverage } from './capability-graph.js';
import { listCapabilityProposals } from './capability-proposals.js';
import { isAutoOn, getAutoMode, writeHeartbeat, needsHumanReview } from './auto.js';
import { doctor } from './diagnostics.js';
import { getExpertisePackState } from './expertise-pack.js';

/**
 * 检测文件是否还是模板（未填充真实内容）。
 * MD 文件检查 <!-- LOOM_TEMPLATE --> 标记——但如果文件已经超过模板大小（>2KB），
 * 认为用户已经填充了真实内容只是忘了删标记，忽略标记。
 * JSON 文件检查 _meta._template 字段。
 */
function isTemplate(filePath) {
  if (!existsSync(filePath)) return true;
  const content = readFileSync(filePath, 'utf-8');
  if (filePath.endsWith('.json')) {
    try {
      const data = JSON.parse(content);
      return data._meta?._template === true;
    } catch {
      return false; // 损坏文件不算模板
    }
  }
  // MD 文件：有 LOOM_TEMPLATE 标记 且 文件较小（<2KB）才算模板。
  // 如果文件已经 >2KB，说明用户填充了内容只是忘了删标记——忽略标记。
  if (content.includes('<!-- LOOM_TEMPLATE -->')) {
    return content.length < 2048;
  }
  return false;
}

/**
 * 诊断项目当前阶段。
 * @param {string} projectDir — 项目根目录
 * @returns {{ stage: string, stage_num: number, details: object, auto: boolean, next_action: string, next_command: string, message: string, needs_human_review: boolean }}
 */
export function guideProject(projectDir, options = {}) {
  const cwd = projectDir || process.cwd();
  const loomRoot = join(cwd, '.loom');
  const autoMode = getAutoMode(loomRoot);
  const auto = autoMode !== 'manual'; // 向后兼容 boolean
  const result = diagnoseStage(cwd, loomRoot, auto);
  result.auto_mode = autoMode;

  // 按 stage 补充可执行信息：要读什么、要产出什么、完成后跑什么校验
  const current = result.details.version || 'v1';
  const stageMeta = {
    not_initialized: {
      inputs: [],
      outputs: ['.loom/v1/'],
      verify_command: 'loom guide',
    },
    no_version: {
      inputs: [],
      outputs: ['.loom/v1/'],
      verify_command: 'loom guide',
    },
    need_philosophy: {
      inputs: ['meta/PHILOSOPHY_WEAVER.md', 'meta/BASELINE.md', 'dimensions/SEARCH_METHODOLOGY.md'],
      outputs: [`.loom/${current}/00_PHILOSOPHY/PRODUCT_PHILOSOPHY.md`, `.loom/${current}/00_PHILOSOPHY/ENGINEERING_CREED.md`, `.loom/${current}/00_PHILOSOPHY/DECISION_RUBRIC.md`],
      verify_command: 'loom philosophy check',
    },
    need_vision: {
      inputs: ['roles/visionary.md', `.loom/${current}/00_PHILOSOPHY/`],
      outputs: [`.loom/${current}/01_VISION.md`],
      verify_command: 'loom guide',
    },
    need_architecture: {
      inputs: ['roles/architect.md', `.loom/${current}/01_VISION.md`],
      outputs: [`.loom/${current}/02_ARCHITECTURE.md`, `.loom/${current}/04_INTENT_MAP.json`],
      verify_command: 'loom doctor',
    },
    need_capability_graph: {
      inputs: ['roles/architect.md', `.loom/${current}/01_VISION.md`],
      outputs: [`.loom/${current}/07_CAPABILITY_GRAPH.json`, `.loom/${current}/07_CAPABILITY_BRIEFS/`],
      verify_command: 'loom capability coverage',
    },
    capability_graph_incomplete: {
      inputs: ['roles/architect.md', `.loom/${current}/07_CAPABILITY_GRAPH.json`, `.loom/${current}/04_INTENT_MAP.json`],
      outputs: [`.loom/${current}/07_CAPABILITY_GRAPH.json`, `.loom/${current}/07_CAPABILITY_BRIEFS/`],
      verify_command: 'loom capability coverage',
    },
    capability_graph_proposals_pending: {
      inputs: ['roles/architect.md', `.loom/${current}/07_GRAPH_PROPOSALS/`, `.loom/${current}/07_CAPABILITY_GRAPH.json`],
      outputs: [`.loom/${current}/07_GRAPH_PROPOSALS/`, `.loom/${current}/07_CAPABILITY_GRAPH.json`, `.loom/${current}/04_INTENT_MAP.json`],
      verify_command: 'loom capability proposal list',
    },
    intent_map_broken: {
      inputs: [`.loom/${current}/04_INTENT_MAP.json`],
      outputs: [`.loom/${current}/04_INTENT_MAP.json`],
      verify_command: 'loom intent validate',
    },
    in_loop: {
      inputs: ['roles/forge.md', 'roles/keeper.md', `.loom/${current}/04_INTENT_MAP.json`],
      outputs: ['代码文件', `.loom/${current}/verifications/INT-*.json`],
      verify_command: 'loom verify pending',
    },
    ready_for_loop: {
      inputs: ['roles/forge.md', 'roles/keeper.md', `.loom/${current}/04_INTENT_MAP.json`],
      outputs: ['代码文件', `.loom/${current}/verifications/INT-*.json`],
      verify_command: 'loom verify pending',
    },
    done: {
      inputs: [`.loom/${current}/04_INTENT_MAP.json`, `.loom/${current}/verifications/`],
      outputs: [`.loom/${current}/06_CHANGELOG.json`, `.loom/${current}/06_CHANGELOG.md`],
      verify_command: 'loom doctor',
    },
    unknown: {
      inputs: [],
      outputs: [],
      verify_command: 'loom doctor',
    },
  };
  const meta = stageMeta[result.stage] || {};
  result.inputs = meta.inputs || [];
  result.outputs = meta.outputs || [];
  result.verify_command = meta.verify_command || null;
  // 统一后处理：写心跳 + 加 AUTO 提示词 + 判断是否需要人类 review
  if (existsSync(loomRoot) && !options.dryRun) {
    try {
      writeHeartbeat(loomRoot, {
        stage: result.stage,
        stage_num: result.stage_num,
        next_command: result.next_command,
        next_action: result.next_action,
      });
    } catch { /* 心跳写入失败不阻塞 guide */ }
  }
  result.needs_human_review = needsHumanReview(loomRoot, result.stage_num);
  // 在 message 末尾加 AUTO 提示
  if (result.stage_num > 0 && result.stage_num < 4) {
    if (autoMode === 'auto-design') {
      result.message += '\n\n> AUTO 模式 auto-design——设计阶段也自动执行，无需人类确认。';
    } else if (autoMode === 'auto-loop') {
      result.message += '\n\n> ⚠ 这是设计阶段（哲学/愿景/架构），auto-loop 模式下需要人类 review 后再继续。';
    } else {
      result.message += '\n\n> ⚠ AUTO 模式 manual——每步都需要人类确认后再继续。';
    }
  } else if (result.stage_num >= 4) {
    if (auto) {
      result.message += '\n\n> AUTO 模式开启——直接执行 next_command，无需人类确认。';
    } else {
      result.message += '\n\n> ⚠ AUTO 模式关闭——执行 next_command 后等人类确认再继续。';
    }
  }
  return result;
}

/**
 * 内部函数：诊断阶段（不含心跳和 AUTO 提示词）。
 */
function diagnoseStage(cwd, loomRoot, auto) {

  // 状态 0: 没有 .loom/
  if (!existsSync(loomRoot)) {
    return {
      stage: 'not_initialized',
      stage_num: 0,
      details: {},
      auto,
      next_action: '初始化 LOOM 项目',
      next_command: 'loom init',
      message: '项目尚未初始化。运行 loom init 创建 .loom/v1/ 骨架。',
    };
  }

  const current = readCurrentPointer(loomRoot);
  if (!current) {
    return {
      stage: 'no_version',
      stage_num: 0,
      details: {},
      auto,
      next_action: '初始化第一个版本',
      next_command: 'loom init',
      message: '.loom/ 存在但没有版本目录。运行 loom init 创建 v1。',
    };
  }

  const versionDir = join(loomRoot, current);
  const philosophyDir = join(versionDir, '00_PHILOSOPHY');
  const visionPath = join(versionDir, '01_VISION.md');
  const intentMapPath = join(versionDir, '04_INTENT_MAP.json');
  const capabilityGraphPath = join(versionDir, '07_CAPABILITY_GRAPH.json');

  // 状态 1: 哲学未织造
  const philosophyFile = join(philosophyDir, 'PRODUCT_PHILOSOPHY.md');
  if (isTemplate(philosophyFile)) {
    return {
      stage: 'need_philosophy',
      stage_num: 1,
      details: { version: current },
      auto,
      next_action: '织造产品哲学',
      next_command: 'loom activate weaver',
      message: `当前版本 ${current}：哲学还是模板，需要 Weaver 织造。`,
    };
  }

  // 状态 2: 哲学已织造，愿景未定义
  if (isTemplate(visionPath)) {
    return {
      stage: 'need_vision',
      stage_num: 2,
      details: { version: current },
      auto,
      next_action: '定义产品愿景',
      next_command: 'loom activate visionary',
      message: `当前版本 ${current}：哲学已织造，愿景还是模板，需要 Visionary 定义。`,
    };
  }

  // 状态 3: 愿景已定义，先展开项目问题面与能力缺口，再承诺 Intent。
  if (existsSync(capabilityGraphPath) && isTemplate(capabilityGraphPath)) {
    return {
      stage: 'need_capability_graph',
      stage_num: 3,
      details: { version: current },
      auto,
      next_action: '展开 Capability Graph，路由高影响问题与能力缺口',
      next_command: 'loom activate architect',
      message: `当前版本 ${current}：愿景已定义，但 Capability Graph 还是模板。Architect 必须先判断哪些体验、系统、资产、风险与能力适用，再创建正式 Intent。`,
    };
  }

  // 图谱一旦存在，就不能把不完整路由悄悄跨过去。旧项目缺少该文件仍保留兼容路径。
  if (existsSync(capabilityGraphPath)) {
    try {
      const pendingProposals = listCapabilityProposals(versionDir, { unresolvedOnly: true });
      if (pendingProposals.length) {
        return {
          stage: 'capability_graph_proposals_pending',
          stage_num: 3,
          details: { version: current, proposals: pendingProposals.map((proposal) => proposal.id) },
          auto,
          next_action: '审计新信息对 Capability Graph、Intent 和契约的影响',
          next_command: 'loom capability proposal list',
          message: `当前版本 ${current} 有 ${pendingProposals.length} 个未闭合的 Capability Graph proposal。它们是新要求、研究或实现发现，不得由 Forge 静默变成当前 Intent 范围。`,
        };
      }
    } catch (error) {
      return {
        stage: 'capability_graph_proposals_pending', stage_num: 3, details: { version: current, error: error.message }, auto,
        next_action: '修复 Capability Graph proposal', next_command: 'loom capability proposal list',
        message: `Capability Graph proposal 无法审计: ${error.message}`,
      };
    }
    try {
      const coverage = getCapabilityCoverage(versionDir);
      if (!coverage.summary.ready) {
        return {
          stage: 'capability_graph_incomplete',
          stage_num: 3.1,
          details: { version: current, coverage: coverage.summary },
          auto,
          next_action: '补齐 Capability Graph 的路由、可观察验证入口与 Intent 回链',
          next_command: 'loom capability coverage',
          message: `当前版本 ${current}：Capability Graph 尚未闭合（高影响前沿 ${coverage.summary.high_unrouted}、路由缺口 ${coverage.summary.routing_gaps}、不可观察 outcome ${coverage.summary.high_outcomes_without_observable_evidence}、未映射 Intent ${coverage.summary.unmapped_intents}）。先由 Architect 补图谱，再继续设计 Intent。`,
        };
      }
    } catch (error) {
      return {
        stage: 'capability_graph_incomplete',
        stage_num: 3.1,
        details: { version: current, error: error.message },
        auto,
        next_action: '修复 Capability Graph',
        next_command: 'loom capability coverage',
        message: `Capability Graph 无法通过校验: ${error.message}`,
      };
    }
  }

  // 状态 3.5: 图谱已建立，Intent Map 未设计。
  if (isTemplate(intentMapPath)) {
    return {
      stage: 'need_architecture',
      stage_num: 3.5,
      details: { version: current },
      auto,
      next_action: '从 Capability Graph 编译系统架构 + Intent Map',
      next_command: 'loom activate architect',
      message: `当前版本 ${current}：Capability Graph 已建立，Intent Map 还是模板。Architect 需要将已路由的问题面编译为系统架构与可闭合 Intent。`,
    };
  }

  // 状态 4-7: Intent Map 已设计，根据 Intent 状态判断
  let intentMap;
  let intents;
  try {
    intentMap = loadIntentMap(versionDir);
    intents = intentMap.intents;
  } catch (e) {
    return {
      stage: 'intent_map_broken',
      stage_num: 3,
      details: { version: current, error: e.message },
      auto,
      next_action: '修复 Intent Map',
      next_command: 'loom intent validate',
      message: `Intent Map 格式错误: ${e.message}`,
    };
  }

  const allIntents = Object.values(intents);
  const counts = {
    pending: allIntents.filter((i) => i.status === 'pending').length,
    in_progress: allIntents.filter((i) => i.status === 'in_progress').length,
    completed: allIntents.filter((i) => i.status === 'completed').length,
    blocked: allIntents.filter((i) => i.status === 'blocked').length,
    needs_review: allIntents.filter((i) => i.status === 'needs_review').length,
  };
  const total = allIntents.length;

  // 状态 7: 有 blocked（优先报告）
  if (counts.blocked > 0) {
    const blockedIds = allIntents.filter((i) => i.status === 'blocked').map((i) => i.id);
    const msg = auto
      ? `有 ${counts.blocked} 个 Intent 阻塞: ${blockedIds.join(', ')}。AUTO 模式下这是唯一允许停下的情况——需要人工介入解决阻塞后才能继续。`
      : `有 ${counts.blocked} 个 Intent 阻塞: ${blockedIds.join(', ')}。需要人工介入。`;
    return {
      stage: 'blocked',
      stage_num: 7,
      details: { version: current, counts, blocked_ids: blockedIds },
      auto,
      next_action: '人工介入解决阻塞',
      next_command: 'loom intent get ' + blockedIds[0],
      message: msg,
    };
  }

  // 状态 6: 全部 completed
  if (counts.completed === total && total > 0) {
    const health = doctor(versionDir, join(versionDir, 'verifications'), philosophyDir);
    const blocking = health.issues.filter((issue) => issue.severity === 'fatal' || issue.severity === 'high');
    if (blocking.length) {
      return {
        stage: 'needs_review',
        stage_num: 5.5,
        details: { version: current, counts, blocking_issues: blocking.map((issue) => issue.type) },
        auto,
        next_action: '修复完成门或验证证据后重新运行 doctor',
        next_command: 'loom doctor',
        message: `当前版本 ${current} 的 Intent 均标为 completed，但健康检查仍有 ${blocking.length} 个高风险问题；不能宣告阶段完成。先运行 loom doctor。`,
      };
    }
    const doneMessage = [
      `当前版本 ${current}：全部 ${total} 个 Intent 已完成。`,
      '',
      '如果有新需求，先判断变更档位：',
      '- Patch：不触及 Intent，只修 bug / 样式 / 实现细节；跑验证并记录 changelog。',
      '- Minor：新增或修改 Intent，但不改变哲学前提、愿景北极星、架构边界；在当前版本内变更并重验受影响 Intent。',
      '- Major：哲学前提、愿景北极星或架构边界变化；运行 loom version new。',
    ].join('\n');
    return {
      stage: 'done',
      stage_num: 6,
      details: { version: current, counts, total },
      auto,
      next_action: '项目阶段完成，按 Patch / Minor / Major 判断下一步',
      next_command: 'loom help version',
      message: doneMessage,
    };
  }

  // 状态 5: 有 in_progress
  if (counts.in_progress > 0) {
    const inProgressIds = allIntents.filter((i) => i.status === 'in_progress').map((i) => i.id);
    const expertiseOpen = allIntents
      .filter((intent) => intent.status === 'in_progress')
      .map((intent) => ({ intent, state: getExpertisePackState(versionDir, intent.id) }))
      .find(({ state }) => state.required && !state.ready);
    if (expertiseOpen) {
      const missing = expertiseOpen.state.reason === 'missing';
      const blocked = expertiseOpen.state.reason?.startsWith('blocked:');
      return {
        stage: 'in_loop',
        stage_num: 5,
        details: {
          version: current,
          counts,
          in_progress_ids: inProgressIds,
          expertise_intent: expertiseOpen.intent.id,
          expertise_reason: expertiseOpen.state.reason,
        },
        auto,
        next_action: missing
          ? '创建搜索计划并执行外部能力获取'
          : blocked
            ? '解决 Expertise Pack 记录的外部获取阻塞'
            : '补齐来源化 Expertise Pack',
        next_command: missing
          ? `loom expertise init ${expertiseOpen.intent.id}`
          : blocked
            ? `loom expertise get ${expertiseOpen.intent.id}`
            : `loom expertise validate ${expertiseOpen.intent.id}`,
        message: blocked
          ? `${expertiseOpen.intent.id} 的外部能力获取已明确 blocked：${expertiseOpen.state.reason.slice('blocked: '.length)}。满足 Pack 中的 recovery_condition 后再继续；不能让模型补齐空白。`
          : `${expertiseOpen.intent.id} 需要外部能力获取。先由任务信号派生搜索词，实际使用 find skill、网络搜索、官方文档或研究资料，再把可回查来源编译为 Capability Capsules；模型临时生成内容不能代替来源。`,
      };
    }
    const atelierWithoutRecord = allIntents.find((intent) => intent.status === 'in_progress'
      && intent.quality_strategy === 'atelier'
      && !existsSync(join(versionDir, '09_ATELIER', `${intent.id}.json`)));
    if (atelierWithoutRecord) {
      return {
        stage: 'in_loop',
        stage_num: 5,
        details: { version: current, counts, in_progress_ids: inProgressIds, atelier_intent: atelierWithoutRecord.id },
        auto,
        next_action: '创建 Atelier Record 并冻结基线',
        next_command: `loom atelier init ${atelierWithoutRecord.id}`,
        message: `${atelierWithoutRecord.id} 已进入 Atelier Path，但还没有唯一创作记录。先创建 Record，再按 Forge Context Pack 形成 Authorial Stance。`,
      };
    }
    return {
      stage: 'in_loop',
      stage_num: 5,
      details: { version: current, counts, in_progress_ids: inProgressIds },
      auto,
      next_action: '继续 Intent Loop',
      next_command: 'loom context',
      message: `当前版本 ${current}：Intent Loop 进行中（${inProgressIds.join(', ')}）。运行 loom context 查看状态。`,
    };
  }

  // 状态 5.5: 有 needs_review（收敛趟）——已完成但需要重新验证的 Intent
  if (counts.needs_review > 0) {
    const reviewIds = allIntents.filter((i) => i.status === 'needs_review').map((i) => i.id);
    // 读 _meta.pass_count 收敛趟计数（最大 3 趟）
    const passCount = intentMap._meta?.pass_count || 1;
    const MAX_PASSES = 3;
    const isOverLimit = passCount > MAX_PASSES;
    const passMsg = ` [Pass ${passCount}/${MAX_PASSES}]`;
    if (isOverLimit) {
      return {
        stage: 'cannot_converge',
        stage_num: 7,
        details: { version: current, counts, needs_review_ids: reviewIds, pass_count: passCount },
        auto,
        next_action: '收敛失败——超过最大趟数，需 Architect 介入',
        next_command: 'loom intent update ' + reviewIds[0] + ' --status blocked',
        message: `当前版本 ${current}：收敛失败，已超过最大 ${MAX_PASSES} 趟限制（当前 Pass ${passCount}）。${counts.needs_review} 个 Intent 仍需重新验证（${reviewIds.join(', ')}）。这是系统性问题——需 Architect 介入重新设计。`,
      };
    }
    return {
      stage: 'converging',
      stage_num: 5.5,
      details: { version: current, counts, needs_review_ids: reviewIds, pass_count: passCount },
      auto,
      next_action: `进入收敛趟 Pass ${passCount}——重验 needs_review 的 Intent`,
      next_command: 'loom intent update ' + reviewIds[0] + ' --status in_progress',
      message: `当前版本 ${current}${passMsg}：${counts.needs_review} 个 Intent 需要重新验证（${reviewIds.join(', ')}）。这是不动点收敛的第 ${passCount} 趟——重验这些 Intent，通过则 completed，偏离则修正。一趟无新 needs_review 即收敛达成。最大 ${MAX_PASSES} 趟，超过判定为系统性问题。`,
    };
  }

  // 状态 4: 有 pending，进入 Intent Loop
  if (counts.pending > 0) {
    return {
      stage: 'ready_for_loop',
      stage_num: 4,
      details: { version: current, counts, total },
      auto,
      next_action: '进入 Intent Loop',
      next_command: 'loom intent next',
      message: `当前版本 ${current}：${counts.pending} 个 Intent 待执行。运行 loom intent next 开始。`,
    };
  }

  // 兜底
  return {
    stage: 'unknown',
    stage_num: -1,
    details: { version: current, counts },
    auto,
    next_action: '运行健康检查',
    next_command: 'loom doctor',
    message: '项目状态不明确，运行 loom doctor 诊断。',
  };
}
