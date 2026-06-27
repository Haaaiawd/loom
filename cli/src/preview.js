// preview — 生成 HTML 可视化
// 把 .loom/v{N}/ 下的哲学/愿景/架构/Intent Map/进度投影成一个 HTML 文件。
// HTML 是投影，不是真相源。改东西改 md，HTML 随时重新生成。

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readCurrentPointer } from './version.js';
import { loadIntentMap, getStatus } from './intent-map.js';

/**
 * 生成项目 HTML 预览。
 * @param {string} projectDir — 项目根目录
 * @returns {{ filePath: string, version: string }}
 */
export function generatePreview(projectDir) {
  const cwd = projectDir || process.cwd();
  const loomRoot = join(cwd, '.loom');
  if (!existsSync(loomRoot)) {
    throw new Error('项目未初始化。运行 loom init。');
  }
  const current = readCurrentPointer(loomRoot);
  if (!current) {
    throw new Error('没有版本目录。运行 loom init。');
  }
  const versionDir = join(loomRoot, current);
  const philosophyDir = join(versionDir, '00_PHILOSOPHY');

  // 收集数据
  const philosophy = collectPhilosophy(philosophyDir);
  const vision = readFileIfExists(join(versionDir, '01_VISION.md'));
  const architecture = readFileIfExists(join(versionDir, '02_ARCHITECTURE.md'));
  const status = getStatus(versionDir);
  let intentMap = null;
  try { intentMap = loadIntentMap(versionDir); } catch { /* 可能还是模板 */ }

  // 生成 HTML
  const html = buildHTML({
    version: current,
    philosophy,
    vision,
    architecture,
    status,
    intentMap,
  });

  const filePath = join(cwd, 'loom-preview.html');
  writeFileSync(filePath, html, 'utf-8');
  return { filePath, version: current };
}

function collectPhilosophy(philosophyDir) {
  if (!existsSync(philosophyDir)) return [];
  const files = readdirSync(philosophyDir).filter((f) => f.endsWith('.md'));
  return files.map((f) => ({
    name: f,
    content: readFileSync(join(philosophyDir, f), 'utf-8'),
  }));
}

function readFileIfExists(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

function buildHTML({ version, philosophy, vision, architecture, status, intentMap }) {
  const counts = status.counts;
  const total = counts.total || 0;
  const completed = counts.completed || 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const philosophyHTML = philosophy.map((p) => `
    <section class="card">
      <h2>${escapeHTML(p.name)}</h2>
      <div class="content">${mdToHTML(p.content)}</div>
    </section>
  `).join('');

  const visionHTML = vision ? `
    <section class="card">
      <h2>愿景 (01_VISION.md)</h2>
      <div class="content">${mdToHTML(vision)}</div>
    </section>
  ` : '';

  const archHTML = architecture ? `
    <section class="card">
      <h2>架构 (02_ARCHITECTURE.md)</h2>
      <div class="content">${mdToHTML(architecture)}</div>
    </section>
  ` : '';

  const intentTableHTML = intentMap ? buildIntentTable(intentMap) : `
    <section class="card">
      <h2>Intent Map</h2>
      <p class="muted">Intent Map 还是模板，等待 Architect 设计。</p>
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LOOM 项目预览 — ${escapeHTML(version)}</title>
<style>
  :root {
    --bg: #0d1117;
    --card-bg: #161b22;
    --border: #30363d;
    --text: #c9d1d9;
    --text-dim: #8b949e;
    --accent: #58a6ff;
    --green: #3fb950;
    --yellow: #d29922;
    --red: #f85149;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    padding: 2rem;
    max-width: 900px;
    margin: 0 auto;
  }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.3rem; margin-bottom: 1rem; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
  h3 { font-size: 1.1rem; margin: 1rem 0 0.5rem; }
  .header { margin-bottom: 2rem; }
  .version-badge {
    display: inline-block; background: var(--accent); color: var(--bg);
    padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 600;
  }
  .progress-bar {
    background: var(--border); border-radius: 8px; height: 24px; margin: 1rem 0;
    overflow: hidden; position: relative;
  }
  .progress-fill {
    background: var(--green); height: 100%; transition: width 0.3s;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem; color: var(--bg); font-weight: 600;
  }
  .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .stat { background: var(--card-bg); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem 1rem; }
  .stat-label { font-size: 0.75rem; color: var(--text-dim); }
  .stat-value { font-size: 1.2rem; font-weight: 600; }
  .card {
    background: var(--card-bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;
  }
  .content { white-space: pre-wrap; word-wrap: break-word; }
  .content h1, .content h2, .content h3 { color: var(--text); border: none; }
  .content h2 { font-size: 1.15rem; }
  .content code { background: var(--bg); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  .content blockquote { border-left: 3px solid var(--accent); padding-left: 1rem; color: var(--text-dim); margin: 0.5rem 0; }
  .content ul, .content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
  .muted { color: var(--text-dim); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--text-dim); font-size: 0.85rem; }
  .status-badge { padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
  .status-pending { background: var(--border); color: var(--text-dim); }
  .status-in_progress { background: var(--yellow); color: var(--bg); }
  .status-completed { background: var(--green); color: var(--bg); }
  .status-blocked { background: var(--red); color: var(--bg); }
  .status-needs_review { background: var(--accent); color: var(--bg); }
  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 0.85rem; }
</style>
</head>
<body>

<div class="header">
  <h1>LOOM 项目预览</h1>
  <span class="version-badge">${escapeHTML(version)}</span>
</div>

<div class="card">
  <h2>进度概览</h2>
  <div class="progress-bar">
    <div class="progress-fill" style="width: ${progressPct}%">${completed}/${total} (${progressPct}%)</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-label">总数</div><div class="stat-value">${total}</div></div>
    <div class="stat"><div class="stat-label">已完成</div><div class="stat-value" style="color:var(--green)">${completed}</div></div>
    <div class="stat"><div class="stat-label">进行中</div><div class="stat-value" style="color:var(--yellow)">${counts.in_progress || 0}</div></div>
    <div class="stat"><div class="stat-label">待执行</div><div class="stat-value">${counts.pending || 0}</div></div>
    <div class="stat"><div class="stat-label">阻塞</div><div class="stat-value" style="color:var(--red)">${counts.blocked || 0}</div></div>
  </div>
</div>

${intentTableHTML}

${philosophyHTML}

${visionHTML}

${archHTML}

<div class="footer">
  由 LOOM CLI 生成 — loom preview<br>
  这是只读投影，修改请编辑 .loom/${escapeHTML(version)}/ 下的源文件后重新生成。
</div>

</body>
</html>`;
}

function buildIntentTable(intentMap) {
  const intents = Object.entries(intentMap.intents || {});
  if (intents.length === 0) {
    return `<section class="card"><h2>Intent Map</h2><p class="muted">没有 Intent。</p></section>`;
  }
  const rows = intents.map(([id, intent]) => `
    <tr>
      <td><strong>${escapeHTML(id)}</strong></td>
      <td>${escapeHTML(intent.narrative_ref || '-')}</td>
      <td>${(intent.depends_on || []).map(escapeHTML).join(', ') || '-'}</td>
      <td><span class="status-badge status-${intent.status}">${escapeHTML(intent.status)}</span></td>
      <td>${escapeHTML(intent.acceptance || '-').slice(0, 60)}${intent.acceptance && intent.acceptance.length > 60 ? '...' : ''}</td>
    </tr>
  `).join('');
  return `
    <section class="card">
      <h2>Intent Map</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>叙事引用</th><th>依赖</th><th>状态</th><th>验收契约</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 极简 md → HTML 转换（不引入依赖）
function mdToHTML(md) {
  if (!md) return '';
  let html = escapeHTML(md);
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 引用
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  // 分隔线
  html = html.replace(/^---$/gm, '<hr>');
  // 段落
  html = html.split(/\n\n+/).map((block) => {
    if (block.match(/^<(h[123]|ul|blockquote|hr)/)) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return html;
}
