'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_SOURCE_BYTES = 1024 * 1024;

class ProjectError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ProjectError';
    this.code = code;
    this.status = status;
  }
}

async function assertRegularFileWithin(root, filename) {
  const target = path.join(root, filename);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectError('PATH_OUTSIDE_PROJECT', '读取目标不在所选项目内。');
  }

  let stat;
  try {
    stat = await fs.lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (stat.isSymbolicLink()) {
    throw new ProjectError('REPARSE_POINT_REJECTED', `${filename} 是链接或重解析点，原型不会跟随。`);
  }
  if (!stat.isFile()) {
    throw new ProjectError('NOT_A_FILE', `${filename} 不是普通文件。`);
  }
  if (stat.size > MAX_SOURCE_BYTES) {
    throw new ProjectError('SOURCE_TOO_LARGE', `${filename} 超过 1 MiB 读取上限。`, 413);
  }
  return target;
}

async function readBounded(target) {
  return fs.readFile(target, 'utf8');
}

function parseBacklog(source) {
  const warnings = [];
  const items = [];
  source.split(/\r?\n/).forEach((rawLine, index) => {
    const checkbox = /^\s*[-*]\s+\[[ xX]\]\s+/.test(rawLine);
    const nested = /^\s{2,}[-*]\s+/.test(rawLine);
    if (checkbox || nested) {
      warnings.push(`BACKLOG.md 第 ${index + 1} 行使用了原型暂不解释的${checkbox ? '复选框' : '嵌套列表'}格式。`);
      return;
    }
    const match = /^[-*]\s+(.+?)\s*$/.exec(rawLine);
    if (!match) return;
    const text = match[1];
    items.push({
      id: crypto.createHash('sha256').update(`${index + 1}:${text}`).digest('hex').slice(0, 16),
      text,
      line: index + 1
    });
  });
  return { items, warnings };
}

function parseFixtureLog(source) {
  const commits = [];
  const warnings = [];
  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const match = /^([0-9a-fA-F]{7,40})\s+(.+)$/.exec(line);
    if (!match) {
      warnings.push(`GIT_LOG.txt 第 ${index + 1} 行格式无效，已跳过。`);
      return;
    }
    commits.push({ hash: match[1].slice(0, 12), subject: match[2] });
  });
  return { commits: commits.slice(0, 20), warnings };
}

async function normalizeProjectRoot(inputPath) {
  if (typeof inputPath !== 'string' || !path.isAbsolute(inputPath)) {
    throw new ProjectError('ABSOLUTE_PATH_REQUIRED', '请输入绝对项目路径。');
  }
  const resolved = path.resolve(inputPath);
  let stat;
  try {
    stat = await fs.lstat(resolved);
  } catch (error) {
    if (error.code === 'ENOENT') throw new ProjectError('PROJECT_NOT_FOUND', '所选项目路径不存在。', 404);
    throw error;
  }
  if (!stat.isDirectory()) throw new ProjectError('PROJECT_NOT_DIRECTORY', '所选路径不是文件夹。');
  if (stat.isSymbolicLink()) throw new ProjectError('PROJECT_LINK_REJECTED', '原型不会扫描链接或重解析的项目根目录。');
  return resolved;
}

async function scanProject(inputPath) {
  const root = await normalizeProjectRoot(inputPath);
  const backlogPath = await assertRegularFileWithin(root, 'BACKLOG.md');
  if (!backlogPath) {
    throw new ProjectError('BACKLOG_NOT_FOUND', '未找到根目录中的 BACKLOG.md。', 404);
  }
  const backlogParsed = parseBacklog(await readBounded(backlogPath));
  if (backlogParsed.items.length === 0) {
    throw new ProjectError('BACKLOG_EMPTY', '找到 BACKLOG.md，但没有可识别的普通无序列表事项。', 422);
  }

  const warnings = [...backlogParsed.warnings];
  let commits = [];
  let gitSource = 'missing';
  let gitDirectory = null;
  try {
    gitDirectory = await fs.lstat(path.join(root, '.git'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (gitDirectory) {
    if (gitDirectory.isSymbolicLink()) {
      throw new ProjectError('GIT_LINK_REJECTED', '.git 是链接或重解析点，原型不会跟随。');
    }
    throw new ProjectError(
      'REAL_GIT_NOT_IMPLEMENTED',
      '检测到真实 .git；当前纵向原型尚未实现其只读历史适配器，未把未知伪装成空历史。',
      501
    );
  }

  const fixturePath = await assertRegularFileWithin(root, 'GIT_LOG.txt');
  if (fixturePath) {
    const parsed = parseFixtureLog(await readBounded(fixturePath));
    if (parsed.commits.length === 0) {
      throw new ProjectError('FIXTURE_LOG_INVALID', 'GIT_LOG.txt 没有可识别的提交记录。', 422);
    }
    commits = parsed.commits;
    gitSource = 'fixture-export';
    warnings.push(...parsed.warnings, '提交来源是 GIT_LOG.txt 验收夹具，不是真实仓库历史。');
  } else {
    warnings.push('既未找到 .git，也未找到 GIT_LOG.txt；缺少近期变化证据，候选生成将暂停。');
  }

  const projectId = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 20);
  const fingerprint = crypto.createHash('sha256')
    .update(JSON.stringify({ backlog: backlogParsed.items, commits, gitSource }))
    .digest('hex');

  return {
    snapshotId: fingerprint.slice(0, 24),
    project: { id: projectId, name: path.basename(root), path: root },
    scannedAt: new Date().toISOString(),
    backlog: backlogParsed.items,
    commits,
    gitSource,
    warnings
  };
}

module.exports = { MAX_SOURCE_BYTES, ProjectError, parseBacklog, parseFixtureLog, scanProject };
