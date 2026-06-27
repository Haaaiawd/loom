// activate — 输出角色激活提示词
// 把角色文件 + 哲学锚点 + 底线拼成激活上下文，供上层编排器使用。

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getLoomRoot() {
  return resolve(__dirname, '..', '..');
}

/** 合法角色名 */
const VALID_ROLES = ['weaver', 'visionary', 'architect', 'forge', 'keeper'];

/** 角色文件映射 */
const ROLE_FILES = {
  weaver: 'meta/PHILOSOPHY_WEAVER.md',
  visionary: 'roles/visionary.md',
  architect: 'roles/architect.md',
  forge: 'roles/forge.md',
  keeper: 'roles/keeper.md',
};

/**
 * 输出角色激活提示词。
 * @param {string} role — 角色名
 * @param {string} loomDir — .loom/v{N} 目录（可选，weaver 不需要）
 * @returns {string} 激活提示词
 */
export function activateRole(role, loomDir) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`未知角色: ${role}\n合法角色: ${VALID_ROLES.join(', ')}`);
  }

  const loomRoot = getLoomRoot();
  const parts = [];

  // 1. 角色文件
  const roleFile = join(loomRoot, ROLE_FILES[role]);
  if (!existsSync(roleFile)) {
    throw new Error(`角色文件不存在: ${roleFile}`);
  }
  parts.push(readFileSync(roleFile, 'utf-8'));

  // 2. BASELINE（所有角色都需要）
  const baselineFile = join(loomRoot, 'meta/BASELINE.md');
  parts.push('\n---\n\n## 强制加载：BASELINE\n\n' + readFileSync(baselineFile, 'utf-8'));

  // 3. 项目特定底线（如果有 loomDir）
  if (loomDir) {
    const projectBaseline = join(loomDir, '00_PHILOSOPHY/PROJECT_BASELINE.md');
    if (existsSync(projectBaseline)) {
      parts.push('\n---\n\n## 强制加载：项目特定底线\n\n' + readFileSync(projectBaseline, 'utf-8'));
    }

    // 4. 角色激活协议
    const activationFile = join(loomRoot, 'meta/ROLE_ACTIVATION.md');
    parts.push('\n---\n\n## 角色激活协议\n\n' + readFileSync(activationFile, 'utf-8'));
  }

  return parts.join('\n');
}
