// activate — 输出角色激活提示词
// 把角色文件 + 哲学锚点 + 底线拼成激活上下文，供上层编排器使用。

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLoomRoot } from './shared/paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
 * @param {string} versionDir — .loom/v{N} 目录（可选，weaver 不需要）
 * @returns {string} 激活提示词
 */
export function activateRole(role, versionDir) {
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

  // 2. BASELINE 摘要（不重复全文——全文见 meta/BASELINE.md）
  //    5 条底线压缩成摘要，角色需要知道底线存在 + 一句话内容。
  //    如果角色需要底线细节（如 Weaver 织造哲学时），自行 readFileSync 全文。
  parts.push('\n---\n\n## 强制加载：BASELINE 摘要\n\n');
  parts.push('> 完整底线见 `meta/BASELINE.md`。以下是 5 条底线的摘要——\n');
  parts.push('> 角色激活时必须知道这些底线存在，违反任何一条必须立即停止。\n');
  parts.push('> Philosophy Weaver 织造哲学时必须读取完整 BASELINE.md 作为硬约束输入。\n\n');
  parts.push('| 编号 | 底线 | 一句话 |\n');
  parts.push('|------|------|--------|\n');
  parts.push('| B1 | 必须有结构设计 | 编码前必须有明确的目录结构 + 模块职责边界 + 显式依赖关系 |\n');
  parts.push('| B2 | 禁止硬编码 | 密钥/配置/环境特定值/魔法数字不进代码，用环境变量或集中配置 |\n');
  parts.push('| B3 | 接口契约必须显式 | API/CLI/配置/错误语义/跨系统协议必须有显式定义，变更可追溯 |\n');
  parts.push('| B4 | 决策必须可追溯 | 影响架构/接口/技术栈/依赖的决策必须记录（ADR 或等效格式） |\n');
  parts.push('| B5 | 意图必须可回溯 | 每个实现单元有意图叙事（"为什么存在"），可被 Keeper 引用对照 |\n');
  parts.push('\n> 底线不可被哲学覆盖。如果织造的哲学与底线冲突，底线优先。\n');

  // 3. 项目特定底线（如果有 versionDir）
  if (versionDir) {
    const projectBaseline = join(versionDir, '00_PHILOSOPHY/PROJECT_BASELINE.md');
    if (existsSync(projectBaseline)) {
      parts.push('\n---\n\n## 强制加载：项目特定底线\n\n' + readFileSync(projectBaseline, 'utf-8'));
    }

    // 4. 角色激活协议
    const activationFile = join(loomRoot, 'meta/ROLE_ACTIVATION.md');
    parts.push('\n---\n\n## 角色激活协议\n\n' + readFileSync(activationFile, 'utf-8'));
  }

  return parts.join('\n');
}
