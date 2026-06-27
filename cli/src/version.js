// version — LOOM 版本管理
// 提供 list / current / new / use / diff 五个原子操作。
// CLI 只做数据操作，演进决策（Minor/Major）由 Agent + 用户对话完成。

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createVersionStructure } from './init.js';

/**
 * 列出所有版本目录。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {{ versions: string[], current: string|null }}
 */
export function listVersions(loomRoot) {
  if (!existsSync(loomRoot)) {
    throw new Error(`找不到 .loom 目录: ${loomRoot}`);
  }
  const versions = readdirSync(loomRoot)
    .filter((d) => /^v\d+$/.test(d) && statSync(join(loomRoot, d)).isDirectory())
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
  const current = readCurrentPointer(loomRoot);
  return { versions, current };
}

/**
 * 读取当前版本指针。
 * 优先读 .loom/current 文件；不存在则回退到自动探测最新版本。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {string|null} 版本号如 'v1'，或 null（无版本）
 */
export function readCurrentPointer(loomRoot) {
  const pointerPath = join(loomRoot, 'current');
  if (existsSync(pointerPath)) {
    const v = readFileSync(pointerPath, 'utf-8').trim();
    if (/^v\d+$/.test(v) && existsSync(join(loomRoot, v))) return v;
  }
  // 回退：自动探测最新版本
  if (!existsSync(loomRoot)) return null;
  const versions = readdirSync(loomRoot)
    .filter((d) => /^v\d+$/.test(d) && statSync(join(loomRoot, d)).isDirectory())
    .sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)));
  return versions[0] ?? null;
}

/**
 * 创建新版本 v{N+1}，自动切换为当前版本。
 * 不复制旧版本内容——空目录 + 模板强制 Agent 重新思考。
 * @param {string} projectDir — 项目根目录
 * @returns {{ version: string, created: string[], skipped: string[] }}
 */
export function newVersion(projectDir) {
  const loomRoot = join(projectDir, '.loom');
  const { versions } = listVersions(loomRoot);
  const nextNum = versions.length === 0
    ? 1
    : parseInt(versions[versions.length - 1].slice(1)) + 1;
  const nextV = `v${nextNum}`;
  const result = createVersionStructure(projectDir, nextV);
  // 自动切换为当前版本
  writeFileSync(join(loomRoot, 'current'), nextV, 'utf-8');
  result.created.push('.loom/current');
  return { version: nextV, created: result.created, skipped: result.skipped };
}

/**
 * 切换当前版本指针。
 * @param {string} loomRoot — .loom 目录路径
 * @param {string} version — 目标版本号如 'v1'
 */
export function useVersion(loomRoot, version) {
  const v = version.startsWith('v') ? version : `v${version}`;
  if (!existsSync(join(loomRoot, v))) {
    throw new Error(`版本不存在: ${v}`);
  }
  writeFileSync(join(loomRoot, 'current'), v, 'utf-8');
  return v;
}

/**
 * 对比两个版本的文件差异。
 * 只对比文件存在性和大小，不做内容 diff（内容 diff 用 Git）。
 * @param {string} loomRoot — .loom 目录路径
 * @param {string} v1 — 版本 A
 * @param {string} v2 — 版本 B
 * @returns {{ only_in_a: string[], only_in_b: string[], different_size: string[], same: string[] }}
 */
export function diffVersions(loomRoot, v1, v2) {
  const a = v1.startsWith('v') ? v1 : `v${v1}`;
  const b = v2.startsWith('v') ? v2 : `v${v2}`;
  const dirA = join(loomRoot, a);
  const dirB = join(loomRoot, b);
  if (!existsSync(dirA)) throw new Error(`版本不存在: ${a}`);
  if (!existsSync(dirB)) throw new Error(`版本不存在: ${b}`);

  const filesA = listFilesRelative(dirA);
  const filesB = listFilesRelative(dirB);
  const setA = new Set(filesA);
  const setB = new Set(filesB);

  const onlyInA = filesA.filter((f) => !setB.has(f));
  const onlyInB = filesB.filter((f) => !setA.has(f));
  const common = filesA.filter((f) => setB.has(f));
  const differentSize = common.filter((f) => {
    const sa = statSync(join(dirA, f)).size;
    const sb = statSync(join(dirB, f)).size;
    return sa !== sb;
  });
  const same = common.filter((f) => {
    const sa = statSync(join(dirA, f)).size;
    const sb = statSync(join(dirB, f)).size;
    return sa === sb;
  });

  return { only_in_a: onlyInA, only_in_b: onlyInB, different_size: differentSize, same };
}

/**
 * 递归列出目录下所有文件的相对路径。
 */
function listFilesRelative(dir, base = '') {
  const result = [];
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      result.push(...listFilesRelative(full, rel));
    } else {
      result.push(rel);
    }
  }
  return result.sort();
}
