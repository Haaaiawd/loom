// auto — AUTO 模式开关 + 心跳机制
// 存储机制：.loom/auto 文件存在 = on，不存在 = off
// 心跳：每次 guide 调用时写 .loom/heartbeat.json（时间戳 + stage + next_command）
// AUTO on（默认）：stage 4+（Intent Loop）自动跑，stage 1-3（哲学/愿景/架构）仍需人类 review
// AUTO off：所有阶段都需人类确认，每步拆得更碎

import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 检查 AUTO 模式是否开启。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {boolean}
 */
export function isAutoOn(loomRoot) {
  return existsSync(join(loomRoot, 'auto'));
}

/**
 * 开启 AUTO 模式。
 * @param {string} loomRoot — .loom 目录路径
 */
export function autoOn(loomRoot) {
  writeFileSync(join(loomRoot, 'auto'), new Date().toISOString(), 'utf-8');
}

/**
 * 关闭 AUTO 模式。
 * @param {string} loomRoot — .loom 目录路径
 */
export function autoOff(loomRoot) {
  const path = join(loomRoot, 'auto');
  if (existsSync(path)) unlinkSync(path);
}

/**
 * 获取 AUTO 状态描述。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {{ on: boolean, since: string|null, heartbeat: object|null }}
 */
export function autoStatus(loomRoot) {
  const path = join(loomRoot, 'auto');
  if (!existsSync(path)) return { on: false, since: null, heartbeat: null };
  const since = readFileSync(path, 'utf-8').trim();
  const heartbeat = readHeartbeat(loomRoot);
  return { on: true, since, heartbeat };
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
 * AUTO on 时：stage 1-3（哲学/愿景/架构）需要人类 review，stage 4+ 自动跑
 * AUTO off 时：所有阶段都需要人类 review
 * @param {string} loomRoot — .loom 目录路径
 * @param {number} stageNum — 阶段号
 * @returns {boolean} 是否需要人类 review
 */
export function needsHumanReview(loomRoot, stageNum) {
  const autoOn = isAutoOn(loomRoot);
  if (!autoOn) return true; // AUTO off：所有阶段都需人类 review
  // AUTO on：stage 1-3 需人类 review，stage 4+ 自动
  return stageNum > 0 && stageNum < 4;
}
