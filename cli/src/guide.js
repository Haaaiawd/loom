// guide — 状态感知动态引导
// 检测项目当前在哪个阶段，输出"你在阶段 X，下一步做 Y"。
// 面向 Agent（主）和人类（辅）。比 help workflow（静态）智能。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readCurrentPointer } from './version.js';
import { loadIntentMap } from './intent-map.js';
import { isAutoOn } from './auto.js';

/**
 * 检测文件是否还是模板（未填充真实内容）。
 * MD 文件检查 <!-- LOOM_TEMPLATE --> 标记。
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
  return content.includes('<!-- LOOM_TEMPLATE -->');
}

/**
 * 诊断项目当前阶段。
 * @param {string} projectDir — 项目根目录
 * @returns {{ stage: string, stage_num: number, details: object, auto: boolean, next_action: string, next_command: string, message: string }}
 */
export function guideProject(projectDir) {
  const cwd = projectDir || process.cwd();
  const loomRoot = join(cwd, '.loom');
  const auto = isAutoOn(loomRoot);

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

  // 状态 3: 愿景已定义，Intent Map 未设计
  if (isTemplate(intentMapPath)) {
    return {
      stage: 'need_architecture',
      stage_num: 3,
      details: { version: current },
      auto,
      next_action: '设计系统架构 + Intent Map',
      next_command: 'loom activate architect',
      message: `当前版本 ${current}：愿景已定义，Intent Map 还是模板，需要 Architect 设计。`,
    };
  }

  // 状态 4-7: Intent Map 已设计，根据 Intent 状态判断
  let intents;
  try {
    intents = loadIntentMap(versionDir).intents;
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
    return {
      stage: 'blocked',
      stage_num: 7,
      details: { version: current, counts, blocked_ids: blockedIds },
      auto,
      next_action: '人工介入解决阻塞',
      next_command: 'loom intent get ' + blockedIds[0],
      message: `有 ${counts.blocked} 个 Intent 阻塞: ${blockedIds.join(', ')}。需要人工介入。`,
    };
  }

  // 状态 6: 全部 completed
  if (counts.completed === total && total > 0) {
    return {
      stage: 'done',
      stage_num: 6,
      details: { version: current, counts, total },
      auto,
      next_action: '项目阶段完成，考虑版本演进',
      next_command: 'loom version new',
      message: `当前版本 ${current}：全部 ${total} 个 Intent 已完成。可考虑 loom version new 开始新版本。`,
    };
  }

  // 状态 5: 有 in_progress
  if (counts.in_progress > 0) {
    const inProgressIds = allIntents.filter((i) => i.status === 'in_progress').map((i) => i.id);
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
