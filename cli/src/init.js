// init — 初始化 LOOM 项目目录结构
// 创建 .loom/v1/ 骨架 + 复制模板文件

import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs';
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
 * 初始化项目目录。
 * @param {string} projectDir — 项目根目录（默认 cwd）
 * @returns {{ created: string[], skipped: string[] }}
 */
export function initProject(projectDir) {
  const cwd = projectDir || process.cwd();
  const loomRoot = getLoomRoot();
  const loomDir = join(cwd, '.loom', 'v1');

  const created = [];
  const skipped = [];

  // 创建目录结构
  const dirs = [
    '.loom',
    '.loom/v1',
    '.loom/v1/00_PHILOSOPHY',
    '.loom/v1/verifications',
    '.loom/v1/03_DECISIONS',
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

  // 复制模板文件
  const templates = [
    ['templates/INTENT_MAP_TEMPLATE.json', '.loom/v1/04_INTENT_MAP.json'],
    ['templates/PHILOSOPHY_TEMPLATE.md', '.loom/v1/00_PHILOSOPHY/PRODUCT_PHILOSOPHY.md'],
    ['templates/VISION_TEMPLATE.md', '.loom/v1/01_VISION.md'],
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
