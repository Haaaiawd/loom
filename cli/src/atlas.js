// atlas — deterministic decision-document model and H5 delivery contract.
// Atlas deliberately excludes live progress, verification history and patch ledgers:
// it explains the current version's architecture and decision structure.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadIntentMap } from './intent-map.js';
import { getCapabilityCoverage, loadCapabilityGraph } from './capability-graph.js';

const ATLAS_DIR = '11_DECISION_ATLAS';
const MODEL_FILE = 'atlas-model.json';
const ATLAS_FILE = 'loom-atlas.html';
const ATLAS_TEMPLATE_PATH = new URL('../../templates/ATLAS_TEMPLATE.html', import.meta.url);
const REQUIRED_SECTIONS = ['atlas-origin', 'atlas-structure', 'atlas-capabilities', 'atlas-decisions', 'atlas-review'];
const REQUIRED_EXPERIENCE_HOOKS = [
  ['data-atlas-experience', 'deck-map-v1', 'loom-atlas.html 缺少 deck-map 体验标记'],
  ['data-atlas-view', 'deck', 'loom-atlas.html 缺少“放映”读法入口'],
  ['data-atlas-view', 'map', 'loom-atlas.html 缺少“审查地图”读法入口'],
  ['data-atlas-control', 'previous', 'loom-atlas.html 缺少上一章操作'],
  ['data-atlas-control', 'next', 'loom-atlas.html 缺少下一章操作'],
  ['id', 'atlas-audit-map', 'loom-atlas.html 缺少可审查的关系地图'],
];
const ROOT_DOCUMENTS = ['01_VISION.md', '02_ARCHITECTURE.md', '05_VERIFICATION.md'];
const DOCUMENT_DIRECTORIES = ['00_PHILOSOPHY', '03_DECISIONS', '07_CAPABILITY_BRIEFS'];

export function getAtlasModelPath(versionDir) {
  return join(versionDir, ATLAS_DIR, MODEL_FILE);
}

export function getAtlasHtmlPath(projectDir) {
  return join(projectDir, ATLAS_FILE);
}

function normalizePath(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function listFiles(root, result = []) {
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) listFiles(path, result);
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

function collectAtlasSourceFiles(versionDir) {
  const files = ROOT_DOCUMENTS
    .map((file) => join(versionDir, file))
    .filter(existsSync);
  for (const directory of DOCUMENT_DIRECTORIES) listFiles(join(versionDir, directory), files);
  const graph = join(versionDir, '07_CAPABILITY_GRAPH.json');
  if (existsSync(graph)) files.push(graph);
  return [...new Set(files)].sort((a, b) => normalizePath(versionDir, a).localeCompare(normalizePath(versionDir, b)));
}

function atlasRelevantBytes(path) {
  if (path.endsWith('04_INTENT_MAP.json')) {
    const map = JSON.parse(readFileSync(path, 'utf-8'));
    for (const intent of Object.values(map.intents || {})) delete intent.status;
    return Buffer.from(JSON.stringify(map));
  }
  return readFileSync(path);
}

function sourceManifest(versionDir) {
  return collectAtlasSourceFiles(versionDir).map((path) => ({
    path: normalizePath(versionDir, path),
    sha256: digest(atlasRelevantBytes(path)),
  }));
}

function readText(versionDir, reference) {
  const path = join(versionDir, reference);
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
}

function readDirectoryDocuments(versionDir, directory) {
  return listFiles(join(versionDir, directory))
    .map((path) => ({ path: normalizePath(versionDir, path), content: readFileSync(path, 'utf-8') }));
}

function projectIntentStructure(versionDir) {
  const map = loadIntentMap(versionDir);
  return Object.values(map.intents).map((intent) => ({
    id: intent.id,
    revision: intent.revision ?? 1,
    title: intent.title,
    narrative_ref: intent.narrative_ref,
    depends_on: intent.depends_on,
    acceptance: intent.acceptance,
    quality_contract: intent.quality_contract || null,
    semantic_guard: intent.semantic_guard || null,
    philosophy_anchors: intent.philosophy_anchors,
    capability_needs: intent.capability_needs || [],
    continuity_required: intent.continuity_required === true,
    creative_scope: intent.creative_scope || null,
  }));
}

function buildStructuralReview(versionDir) {
  const missing_documents = ROOT_DOCUMENTS
    .filter((file) => !existsSync(join(versionDir, file)))
    .map((file) => ({ kind: 'missing_document', source_refs: [file] }));
  try {
    const coverage = getCapabilityCoverage(versionDir);
    return {
      missing_documents,
      capability_graph: {
        high_unrouted: coverage.high_unrouted,
        capabilities_without_plan: coverage.capabilities_without_plan,
        routing_gaps: coverage.routing_gaps,
        outcomes_without_concern: coverage.outcomes_without_concern,
        high_outcomes_without_observable_evidence: coverage.high_outcomes_without_observable_evidence,
        lens_contract_gaps: coverage.lens_contract_gaps || [],
        capability_domain_gaps: coverage.capability_domain_gaps || [],
        unmapped_intents: coverage.unmapped_intents,
      },
    };
  } catch (error) {
    return { missing_documents, capability_graph_error: error.message };
  }
}

export function buildAtlasModel(versionDir) {
  const sources = sourceManifest(versionDir);
  const sourceDigest = digest(JSON.stringify(sources));
  let graph = null;
  try { graph = loadCapabilityGraph(versionDir); } catch { graph = null; }
  return {
    _meta: {
      schema_version: '1.0',
      kind: 'loom-decision-atlas',
      version: normalizePath(join(versionDir, '..'), versionDir),
      source_digest: sourceDigest,
      source_count: sources.length,
      scope: 'architecture_and_decision_structure_only',
      digest_scope: 'source files projected without live intent status',
      excluded: ['intent status', 'progress metrics', 'verification history', 'patch history'],
    },
    sources,
    origin: readDirectoryDocuments(versionDir, '00_PHILOSOPHY'),
    vision: readText(versionDir, '01_VISION.md'),
    architecture: readText(versionDir, '02_ARCHITECTURE.md'),
    capability_graph: graph,
    capability_briefs: readDirectoryDocuments(versionDir, '07_CAPABILITY_BRIEFS'),
    intent_structure: projectIntentStructure(versionDir),
    verification_design: readText(versionDir, '05_VERIFICATION.md'),
    decision_records: readDirectoryDocuments(versionDir, '03_DECISIONS'),
    structural_review: buildStructuralReview(versionDir),
  };
}

export function writeAtlasModel(versionDir) {
  const model = buildAtlasModel(versionDir);
  const path = getAtlasModelPath(versionDir);
  mkdirSync(join(versionDir, ATLAS_DIR), { recursive: true });
  writeFileSync(path, `${JSON.stringify(model, null, 2)}\n`, 'utf-8');
  return { path, source_digest: model._meta.source_digest, source_count: model.sources.length };
}

function readAtlasModel(versionDir) {
  const path = getAtlasModelPath(versionDir);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function readAtlasMeta(html) {
  const match = html.match(/<meta\s+name=["']loom-atlas-source-digest["']\s+content=["']([^"']+)["']\s*\/?>/i);
  return match?.[1] || null;
}

function hasAttributeValue(html, attribute, value) {
  return new RegExp(`${attribute}=["']${value}["']`, 'i').test(html);
}

export function getAtlasStatus(projectDir, versionDir) {
  const model = readAtlasModel(versionDir);
  const current = buildAtlasModel(versionDir);
  const atlasPath = getAtlasHtmlPath(projectDir);
  const html = existsSync(atlasPath) ? readFileSync(atlasPath, 'utf-8') : null;
  const htmlDigest = html ? readAtlasMeta(html) : null;
  const modelFresh = model?._meta?.source_digest === current._meta.source_digest;
  const htmlFresh = Boolean(html && htmlDigest === current._meta.source_digest);
  return {
    exists: Boolean(html),
    model_exists: Boolean(model),
    fresh: modelFresh && htmlFresh,
    model_fresh: modelFresh,
    html_fresh: htmlFresh,
    atlas_path: atlasPath,
    model_path: getAtlasModelPath(versionDir),
    source_digest: current._meta.source_digest,
    source_count: current.sources.length,
  };
}

export function validateAtlas(projectDir, versionDir) {
  const status = getAtlasStatus(projectDir, versionDir);
  const errors = [];
  if (!status.model_exists) errors.push('缺少 Atlas model；先运行 loom atlas build');
  else if (!status.model_fresh) errors.push('Atlas model 已过期；先运行 loom atlas build');
  if (!status.exists) errors.push('缺少 loom-atlas.html；运行 loom atlas --regen 获取 Composer Pack 后生成');
  else {
    const html = readFileSync(status.atlas_path, 'utf-8');
    if (!status.html_fresh) errors.push('loom-atlas.html 未绑定当前 Atlas source digest；重新运行 loom atlas --regen 并基于新模型生成');
    for (const id of REQUIRED_SECTIONS) {
      if (!new RegExp(`id=["']${id}["']`, 'i').test(html)) errors.push(`loom-atlas.html 缺少必需章节 #${id}`);
    }
    for (const [attribute, value, error] of REQUIRED_EXPERIENCE_HOOKS) {
      if (!hasAttributeValue(html, attribute, value)) errors.push(error);
    }
  }
  return { valid: errors.length === 0, errors, ...status };
}

export function generateAtlasComposerPack(versionDir) {
  const model = buildAtlasModel(versionDir);
  const shell = readFileSync(ATLAS_TEMPLATE_PATH, 'utf-8').replace('{{SOURCE_DIGEST}}', model._meta.source_digest);
  return [
    '# LOOM Atlas Composer Pack',
    '',
    '你正在生成当前版本的必交付“决策图谱”。它解释文档架构与设计结构，不是进度仪表盘。',
    '只使用下面 Atlas Model 的事实；不得编造决策、证据、完成状态、用户反馈或来源。',
    '',
    '## Fixed Content Contract',
    '',
    '- 必须有五个可定位章节：#atlas-origin、#atlas-structure、#atlas-capabilities、#atlas-decisions、#atlas-review。',
    '- #atlas-origin：为什么存在、原则与非目标；#atlas-structure：愿景、架构与 Intent 结构；#atlas-capabilities：Outcome/Concern/Capability、Lens Contract 与 Capability Domains；#atlas-decisions：关键取舍和 ADR；#atlas-review：结构性缺口、未决问题与每项的 source_refs。',
    '- 不展示 Intent 状态、完成百分比、看板、燃尽图、验证轮次或 Patch 时间线。',
    '- 页面必须有“放映 / 审查地图”两种读法：放映用章节叙事，地图用目标→能力→领域→Intent→验证设计的可点击关系图。',
    '- 每个可点击决策都显示来源路径；事实、推断、待确认项使用可见标签区分。',
    '- 放映是五张横向章节幻灯片，不是纵向长文：桌面支持左右箭头和键盘 ←/→，移动端支持明确的前后按钮与横向滑动；切换只服务于章节理解，不做自动轮播。',
    '- 审查地图不是缩略目录：用可点击的 SVG / CSS 关系图呈现关键链路。选中节点后，在同屏的“检查台”展示它的简短解释、相连对象与 source_refs；不得把原始 JSON 或长段文字直接堆上去。',
    '- 每章至少有一个由 Atlas Model 派生的视觉结构：原则的取舍构图、架构层/Intent 依赖、能力链、决策分叉、结构缺口或待确认项。图形的每个标签必须来自 Model；SVG 必须带 title/desc，颜色不能是唯一编码。',
    '- 保留这些可验证的语义钩子：body data-atlas-experience="deck-map-v1"；data-atlas-view="deck" 与 "map"；data-atlas-control="previous" 与 "next"；#atlas-audit-map。',
    '',
    '## Visual Freedom',
    '',
    '你可独立选择品牌气质、排版、色彩、图形和细腻的章节转场。默认把它读成一份可翻阅的“决策日报”，而不是 SaaS 仪表盘：暖米色纸张、墨黑文字、砖红作为唯一强调色，标题采用报纸式层级，细线分栏，图表与边注共同承载信息。不要复刻任何真实报纸的报头、标识或报道内容。除非 Atlas Model 提供品牌依据，不要改成深色荧光控制台、紫色渐变或玻璃拟态。',
    '',
    '## SVG Composition Playbook',
    '',
    '- 把 SVG 当作“可审查的论证图”，不是图标拼贴或背景花纹。每一张图只回答一个问题，并让节点、边、标签、选中态都来自 Atlas Model。没有对应事实时，留空并明确它是待确认项，不要画假数据。',
    '- 用少量有结构的原语构图：圆/环表示范围或关注点，线/箭头表示依赖、影响或证据路径，分叉表示取舍，断线表示结构缺口，层叠矩形表示架构边界。避免装饰性 3D、无意义粒子和难读的“科技网格”。',
    '- 推荐每章一个不同的图形语法：起点可用“原则-北极星-非目标”的张力图；结构可用架构分层叠图和 Intent DAG；能力可用 Outcome→Concern→Capability→Domain→Evidence 链；决策可用 ADR 的双路分叉；审查可用断线、孤点和回到 source_refs 的追溯链。不要五章都画成同一种卡片或同一种圆点网络。',
    '- 关系图中的可点击节点必须可键盘访问，并在同屏检查台更新：节点名称、它解决的具体问题、连接对象和 source_refs。hover 只能是额外提示，不能是唯一入口。',
    '- 每个 SVG 必须有 viewBox、title、desc 或等价可读描述；文字标签直接写出实体名称；线条样式、形状与文字共同表达意义，不能只靠颜色。响应式缩放时保留标签空间，减少动态效果时取消路径动画但保留全部关系。',
    '- 只为“关系出现、章节切换、节点选中”做 transform/opacity/path 的有限动效，不自动轮播、不做持续闪烁。复杂图先让静态首帧完整可读，再增加交互。',
    '',
    '## Visual Quality Loop',
    '',
    '- 先从 Model 中选定一个能服务“普通人审查复杂决策”的视觉母题，并用一句内部设计判断约束全页。随后直接做成一个方向，不要交付三个半成品版本，也不要套用通用 SaaS dashboard、五张相同卡片或紫色发光渐变。',
    '- 放映的五章必须各有不同的信息构图：开篇建立张力，结构解释边界，能力展示网络，决策展示分叉，审查暴露缺口。它们可共享报纸栏网、纸张底色和砖红强调，但不能只是把标题、段落和圆角容器重复五次。',
    '- 将 Atlas 做成“可翻阅的图文决策日报”，不是稀疏展览海报：每页至少同时呈现一个关键结论、三到五条从 Model 提炼的事实/取舍、一个有标签的主图、两条以内的读图/边注和来源入口。桌面优先采用主报道区 + 侧栏图表/边注的非对称编排；窄屏按“标题 → 事实栏 → 图表 → 读图注 → 来源”重排，页面本身可纵向阅读，前后切章控件始终可达。信息密度来自结构化事实与图形，不来自缩小字体或塞入长段文字。',
    '- 文案采用“短句 + 图形 + 可展开来源”的节奏。首屏让人立刻明白这个版本试图守住什么；每页只留足够支持图形理解的文字。长内容进入点击后的检查台或来源回链，绝不把 Model JSON、完整 Markdown 或十几条项目符号直接铺在页面上。',
    '- 交付前实际检查 390px 触屏宽度和 1440px 桌面宽度：前后切章、横向滑动、←/→ 键、章节定位、放映/地图切换、地图节点选择、来源显示与 prefers-reduced-motion 都必须可用且不遮挡文字。若运行环境无法做视觉检查，应诚实说明未验证项，不能把“理论上响应式”写成已验证。',
    '- 将明显问题当作返工信号：首屏没有信息图形；只有一个标题和一个孤立图形而没有可读事实；一屏超过约 60 个汉字的连续正文；五章同构；图形只有装饰没有事实；只能 hover 才能读到关键内容；手机上需要双指缩放；对比度不足；或动效让审查者错过关系。修复后再交付。',
    '',
    '## Delivery Contract',
    '',
    `写单文件 ${ATLAS_FILE} 到项目根目录。零外部依赖、内联 CSS/JS、响应式。head 中必须包含：`,
    `<meta name="loom-atlas-source-digest" content="${model._meta.source_digest}">`,
    '- 以下模板是固定结构基线。可重写视觉语言和内部构图，但保留 digest 与五个 section id。',
    '',
    '```html',
    shell,
    '```',
    '',
    '## Atlas Model (command-assembled)',
    '',
    '```json',
    JSON.stringify(model, null, 2),
    '```',
  ].join('\n');
}
