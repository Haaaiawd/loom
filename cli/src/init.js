// init — 初始化 LOOM 项目目录结构
// 创建 .loom/v1/ 骨架 + 复制模板文件

import { mkdirSync, existsSync, copyFileSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLoomRoot } from './shared/paths.js';
import { scaffoldChangelog } from './patch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
 * @param {string|null} parentVersion — lineage parent; null for v1
 * @returns {{ created: string[], skipped: string[] }}
 */
export function createVersionStructure(projectDir, version, parentVersion = null) {
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

  // 02_ARCHITECTURE.md 和 05_VERIFICATION.md 没有"填空模板"——
  // 它们由 Architect 自由设计。但 init 时 scaffold 空文件 + LOOM_TEMPLATE 标记，
  // 让 guide 能检测到"还没设计"，且 Agent 知道该往哪写。
  const scaffoldFiles = [
    [`.loom/${v}/02_ARCHITECTURE.md`, [
      '<!-- LOOM_TEMPLATE -->',
      `# 02_ARCHITECTURE.md — 系统边界与责任`,
      '',
      `> 版本: ${v}`,
      '> 产出自: Architect 角色激活',
      '',
      'Architect 设计系统边界后替换本文件。',
      '内容要求：责任边界、公开契约、数据与依赖方向、失败与演进边界；目录只在影响理解时记录。',
      '设计完成后删除顶部的 `<!-- LOOM_TEMPLATE -->` 标记。',
      '',
    ].join('\n')],
    [`.loom/${v}/05_VERIFICATION.md`, [
      '<!-- LOOM_TEMPLATE -->',
      `# 05_VERIFICATION.md — 完成与质量契约`,
      '',
      `> 版本: ${v}`,
      '> 产出自: Architect 角色激活',
      '',
      'Architect 设计成功契约后替换本文件。',
      '内容要求：每个 Intent 的 Reliability Floor（结果、失败边界；若改动既有状态，还要写保留项与旧状态 → 操作 → 新状态的验证序列）；需要高于功能正确性时，再定义 Distinctive Ceiling、基线与证据方式。',
      'Intent Map 的 acceptance 与 quality_contract 可分别引用本文件章节。',
      '设计完成后删除顶部的 `<!-- LOOM_TEMPLATE -->` 标记。',
      '',
    ].join('\n')],
  ];

  for (const [dst, content] of scaffoldFiles) {
    const dstPath = join(cwd, dst);
    if (existsSync(dstPath)) {
      skipped.push(dst);
    } else {
      writeFileSync(dstPath, content, 'utf-8');
      created.push(dst);
    }
  }

  for (const [src, dst] of templates) {
    const srcPath = join(loomRoot, src);
    const dstPath = join(cwd, dst);
    if (existsSync(dstPath)) {
      skipped.push(dst);
    } else if (existsSync(srcPath)) {
      copyFileSync(srcPath, dstPath);
      if (dst.endsWith('04_INTENT_MAP.json')) {
        const map = JSON.parse(readFileSync(dstPath, 'utf-8'));
        map._meta._loom_version = v;
        map._meta._parent_version = parentVersion;
        writeFileSync(dstPath, JSON.stringify(map, null, 2), 'utf-8');
      }
      created.push(dst);
    }
  }

  const changelogFiles = [`.loom/${v}/06_CHANGELOG.json`, `.loom/${v}/06_CHANGELOG.md`];
  const changelogExisted = changelogFiles.map((file) => existsSync(join(cwd, file)));
  scaffoldChangelog(join(cwd, '.loom', v));
  changelogFiles.forEach((file, index) => (changelogExisted[index] ? skipped : created).push(file));

  return { created, skipped };
}

/**
 * 初始化项目目录（创建 v1 + 写入 current 指针）。
 * @param {string} projectDir — 项目根目录（默认 cwd）
 * @returns {{ created: string[], skipped: string[] }}
 */
export function initProject(projectDir) {
  const cwd = projectDir || process.cwd();
  const result = createVersionStructure(cwd, 'v1', null);
  // 写入 current 指针
  const currentPath = join(cwd, '.loom', 'current');
  if (!existsSync(currentPath)) {
    writeFileSync(currentPath, 'v1', 'utf-8');
    result.created.push('.loom/current');
  } else {
    result.skipped.push('.loom/current');
  }
  // 生成极简 AGENTS.md（项目级锚点，让 agent 发现 LOOM）
  const agentsMdPath = join(cwd, 'AGENTS.md');
  if (!existsSync(agentsMdPath)) {
    writeFileSync(agentsMdPath, [
      '# AGENTS.md',
      '',
      '本项目使用 LOOM：按 Doctrine、Intent 与 Contract 对齐方向，再通过',
      'Expertise Compiler、Quality Arena 与 Quality Proof 把任务专业地完成并证明确实成立。',
      '',
      '进入项目后：',
      '1. 运行 `loom guide --dry-run`，确认当前阶段和唯一下一步。',
      '2. 用 `loom activate <role>` 获取当前角色上下文；实现或验证单个 Intent 时必须加 `--intent <id>`。',
      '3. 只在当前角色的权限内行动；发现目标、契约或架构需要改变时，按 LOOM 回流，不要静默扩展范围。',
      '4. 完成前运行当前 Intent 的验证方法与 `loom doctor`；声称质量提升时必须提供基线相对 Quality Proof，以磁盘证据而非会话记忆判断状态。',
      '5. Keeper 验证必须运行在新的 Agent thread 中；同一会话切换角色不构成独立验证。',
      '',
      '常用入口：',
      '- `loom --help`',
      '- `loom help workflow`',
      '- `loom help concepts`',
      '- `loom context`',
      '- `loom doctor`',
      '',
    ].join('\n'), 'utf-8');
    result.created.push('AGENTS.md');
  } else {
    result.skipped.push('AGENTS.md');
  }
  return result;
}
