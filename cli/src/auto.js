// auto — AUTO 模式开关
// 存储机制：.loom/auto 文件存在 = on，不存在 = off
// 影响 guide 输出语气和 Agent 行为：on 时直接跑，off 时等确认

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
 * @returns {{ on: boolean, since: string|null }}
 */
export function autoStatus(loomRoot) {
  const path = join(loomRoot, 'auto');
  if (!existsSync(path)) return { on: false, since: null };
  const since = readFileSync(path, 'utf-8').trim();
  return { on: true, since };
}
