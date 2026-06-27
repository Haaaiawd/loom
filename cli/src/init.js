// init — 初始化 LOOM 项目目录结构
// 创建 .loom/v1/ 骨架 + 复制模板文件

import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 获取 LOOM 框架根目录（cli/src 的上上级）
 */
function getLoomRoot() {
  // cli/src/init.js -> cli/src -> cli -> LOOM root
  return resolve(__dirname, '..', '..');
}

/**
 * 递归复制目录
 */
function copyDir(src, dst) {
  if (!existsSync(src)) return;
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const dstPath = join(dst, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      copyFileSync(srcPath, dstPath);
    }
  }
}

/**
 * 创建某个版本的目录结构 + 复制模板。
 * 共享给 init（v1）和 version new（v{N+1}）。
 * @param {string} projectDir — 项目根目录
 * @param {string|number} version — 版本号，如 'v1' 或 'v2' 或 1
 * @returns {{ created: string[], skipped: string[] }}
 */
export function createVersionStructure(projectDir, version) {
  const v = typeof version === 'number' ? `v${version}` : version;
  const cwd = projectDir || process.cwd();
  const loomRoot = getLoomRoot();

  const created = [];
  const skipped = [];

  const dirs = [
    '.loom',
    `.loom/${v}`,
    `.loom/${v}/00_PHILOSOPHY`,
    `.loom/${v}/verifications`,
    `.loom/${v}/03_DECISIONS`,
  ];

  for (const d of dirs) {
    const path = join(cwd, d);
    if (existsSync(path)) {
      skipped.push(d);
    } else {
      mkdirSync(path, { recursive: true });
      created.push(d);
    }
  }

  const templates = [
    ['templates/INTENT_MAP_TEMPLATE.json', `.loom/${v}/04_INTENT_MAP.json`],
    ['templates/PHILOSOPHY_TEMPLATE.md', `.loom/${v}/00_PHILOSOPHY/PRODUCT_PHILOSOPHY.md`],
    ['templates/VISION_TEMPLATE.md', `.loom/${v}/01_VISION.md`],
  ];

  for (const [src, dst] of templates) {
    const srcPath = join(loomRoot, src);
    const dstPath = join(cwd, dst);
    if (existsSync(dstPath)) {
      skipped.push(dst);
    } else if (existsSync(srcPath)) {
      copyFileSync(srcPath, dstPath);
      created.push(dst);
    }
  }

  return { created, skipped };
}

/**
 * 初始化项目目录（创建 v1 + 写入 current 指针）。
 * @param {string} projectDir — 项目根目录（默认 cwd）
 * @returns {{ created: string[], skipped: string[] }}
 */
export function initProject(projectDir) {
  const cwd = projectDir || process.cwd();
  const result = createVersionStructure(cwd, 'v1');
  // 写入 current 指针
  const currentPath = join(cwd, '.loom', 'current');
  if (!existsSync(currentPath)) {
    writeFileSync(currentPath, 'v1', 'utf-8');
    result.created.push('.loom/current');
  } else {
    result.skipped.push('.loom/current');
  }
  return result;
}
