// shared/paths.js — LOOM 路径解析的公共工具
// 统一 getLoomRoot / findLoomRoot / findVersionDir 的命名和实现。

import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { argv, cwd } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 获取 LOOM 框架根目录（cli/src/shared 的上上上级）。
 * cli/src/shared/paths.js -> cli/src/shared -> cli/src -> cli -> LOOM root
 * @returns {string} LOOM 框架根目录绝对路径
 */
export function getLoomRoot() {
  return resolve(__dirname, '..', '..', '..');
}

/**
 * 从命令行参数或 cwd 推断 .loom 目录路径。
 * 优先级：--loom-dir 参数（指向版本目录，反推 .loom root）> cwd/.loom
 * @returns {string} .loom 目录绝对路径
 */
export function findLoomRoot() {
  const flagIdx = argv.indexOf('--loom-dir');
  if (flagIdx !== -1 && argv[flagIdx + 1]) {
    // --loom-dir 直接指向版本目录，反推 .loom root
    const dir = resolve(argv[flagIdx + 1]);
    return resolve(dir, '..');
  }
  return join(cwd(), '.loom');
}

/**
 * 从命令行参数或 .loom/current 指针推断当前版本目录。
 * @returns {string} .loom/v{N} 目录绝对路径
 * @throws {Error} .loom 不存在或没有版本目录时抛错
 */
export function findVersionDir() {
  const flagIdx = argv.indexOf('--loom-dir');
  if (flagIdx !== -1 && argv[flagIdx + 1]) {
    return resolve(argv[flagIdx + 1]);
  }
  const loomRoot = join(cwd(), '.loom');
  if (!existsSync(loomRoot)) {
    throw new Error(`找不到 .loom 目录: ${loomRoot}`);
  }
  const current = readCurrentPointer(loomRoot);
  if (!current) {
    throw new Error(`.loom 下没有版本目录 (v1, v2, ...)`);
  }
  return join(loomRoot, current);
}

/**
 * 读取当前版本指针。
 * 优先读 .loom/current 文件；不存在则回退到自动探测最新版本。
 * @param {string} loomRoot — .loom 目录路径
 * @returns {string|null} 版本号如 'v1'，或 null
 */
export function readCurrentPointer(loomRoot) {
  const pointerPath = join(loomRoot, 'current');
  if (existsSync(pointerPath)) {
    const v = readFileSync(pointerPath, 'utf-8').trim();
    if (/^v\d+$/.test(v) && existsSync(join(loomRoot, v))) return v;
  }
  if (!existsSync(loomRoot)) return null;
  const versions = readdirSync(loomRoot)
    .filter((d) => /^v\d+$/.test(d) && statSync(join(loomRoot, d)).isDirectory())
    .sort((a, b) => parseInt(b.slice(1)) - parseInt(a.slice(1)));
  return versions[0] ?? null;
}
