// auto — AUTO 模式开关 + 心跳机制
// 存储机制：.loom/auto 文件内容 = 模式名（auto-loop / auto-design），不存在 = manual
// 心跳：每次 guide 调用时写 .loom/heartbeat.json（时间戳 + stage + next_command）
//
// 三种模式：
//   manual      — 每步停，所有阶段需人类 review
//   auto-loop   — 只 Intent Loop（stage 4+）自动，stage 1-3 仍需人类 review（默认）
//   auto-design — 哲学/愿景/架构也自动，全部阶段不需人类 review

import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const VALID_MODES = ['auto-loop', 'auto-design'];

/**
 * 读取 .loom/auto 文件内容，返回模式名。
 * 向后兼容：空文件 / 旧时间戳 / 未知内容 → auto-loop
 * @param {string} loomRoot — .loom 目录路径
 * @returns {string} 'manual' | 'auto-loop' | 'auto-design'
 */
export function getAutoMode(loomRoot) {
  const path = join(loomRoot, 'auto');
  if (!existsSync(path)) return 'manual';
  const content = readFileSync(path, 'utf-8').trim();
  if (VALID_MODES.includes(content)) return content;
  return 'auto-loop'; // 旧格式兼容
}

/**
 * 检查 AUTO 模式是否开启（非 manual）。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {boolean}
 */
export function isAutoOn(loomRoot) {
  return getAutoMode(loomRoot) !== 'manual';
}

/**
 * 开启 AUTO 模式。
 * @param {string} loomRoot — .loom 目录路径
 * @param {string} mode — 'auto-loop' | 'auto-design'
 */
export function autoOn(loomRoot, mode = 'auto-loop') {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`非法 AUTO 模式: "${mode}" (合法: ${VALID_MODES.join(' | ')})`);
  }
  writeFileSync(join(loomRoot, 'auto'), mode, 'utf-8');
}

/**
 * 关闭 AUTO 模式（切换到 manual）。
 * @param {string} loomRoot — .loom 目录路径
 */
export function autoOff(loomRoot) {
  const path = join(loomRoot, 'auto');
  if (existsSync(path)) unlinkSync(path);
}

/**
 * 获取 AUTO 状态描述。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {{ mode: string, heartbeat: object|null }}
 */
export function autoStatus(loomRoot) {
  const mode = getAutoMode(loomRoot);
  const heartbeat = readHeartbeat(loomRoot);
  return { mode, heartbeat };
}

/**
 * 写入心跳——每次 guide 调用时记录当前状态。
 * @param {string} loomRoot — .loom 目录路径
 * @param {{ stage: string, stage_num: number, next_command: string, next_action: string }} info
 */
export function writeHeartbeat(loomRoot, info) {
  const heartbeat = {
    timestamp: new Date().toISOString(),
    stage: info.stage,
    stage_num: info.stage_num,
    next_command: info.next_command,
    next_action: info.next_action,
  };
  writeFileSync(join(loomRoot, 'heartbeat.json'), JSON.stringify(heartbeat, null, 2), 'utf-8');
}

/**
 * 读取心跳。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {object|null}
 */
export function readHeartbeat(loomRoot) {
  const path = join(loomRoot, 'heartbeat.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 判断当前阶段是否需要人类 review。
 * manual：全部需 review
 * auto-loop：stage 1-3 需 review，stage 4+ 自动
 * auto-design：全部自动
 * @param {string} loomRoot — .loom 目录路径
 * @param {number} stageNum — 阶段号
 * @returns {boolean} 是否需要人类 review
 */
export function needsHumanReview(loomRoot, stageNum) {
  const mode = getAutoMode(loomRoot);
  if (mode === 'manual') return true;
  if (mode === 'auto-design') return false;
  // auto-loop：stage 1-3 需 review，stage 4+ 自动
  return stageNum > 0 && stageNum < 4;
}
