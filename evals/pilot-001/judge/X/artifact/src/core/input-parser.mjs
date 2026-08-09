const MAX_FILE_BYTES = 1024 * 1024;
const EXPECTED_NAMES = new Set(['BACKLOG.md', 'GIT_LOG.txt']);

function typedError(code, message, source, line) {
  const error = new Error(message);
  error.code = code;
  if (source) error.source = source;
  if (line) error.line = line;
  return error;
}

async function readInput(file) {
  if (typeof file.content === 'string') return file.content;
  if (typeof file.text === 'function') return file.text();
  throw typedError('unreadable_input', `Cannot read ${file.name ?? 'unnamed input'}.`, file.name);
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function warning(source, line, code, message) {
  return { source, line, code, message };
}

export async function parseProjectFiles(files) {
  if (!files || typeof files[Symbol.iterator] !== 'function') {
    throw typedError('invalid_files', 'Project files must be an iterable selection.');
  }

  const selected = new Map();
  const warnings = [];
  for (const file of files) {
    const name = file?.name;
    if (!EXPECTED_NAMES.has(name)) {
      warnings.push(warning(name || 'unknown', 1, 'ignored_file', 'Only BACKLOG.md and GIT_LOG.txt are read.'));
      continue;
    }
    if (selected.has(name)) {
      throw typedError('duplicate_expected_file', `More than one ${name} was selected.`, name);
    }
    const raw = await readInput(file);
    const size = Number.isFinite(file.size) ? file.size : byteLength(raw);
    if (size > MAX_FILE_BYTES || byteLength(raw) > MAX_FILE_BYTES) {
      throw typedError('file_too_large', `${name} exceeds the 1 MiB prototype limit.`, name);
    }
    selected.set(name, raw);
  }

  if (!selected.has('BACKLOG.md')) {
    throw typedError('missing_backlog', 'The selected folder must contain BACKLOG.md.', 'BACKLOG.md');
  }
  if (!selected.has('GIT_LOG.txt')) {
    throw typedError(
      'missing_git_fixture',
      'The selected folder must contain the prototype GIT_LOG.txt recent-changes fixture.',
      'GIT_LOG.txt'
    );
  }

  const backlog = [];
  selected.get('BACKLOG.md').split(/\r?\n/).forEach((rawText, index) => {
    const line = index + 1;
    const match = rawText.match(/^\s*-\s+(.+?)\s*$/);
    if (match) {
      backlog.push({
        id: `backlog:line:${line}`,
        sourceType: 'backlog',
        locator: { file: 'BACKLOG.md', line },
        rawText,
        kind: 'open_backlog_item',
        text: match[1],
        order: backlog.length
      });
    } else if (rawText.trim() && !/^\s*#{1,6}\s+/.test(rawText)) {
      warnings.push(
        warning('BACKLOG.md', line, 'unsupported_backlog_line', 'Non-list backlog text was ignored.')
      );
    }
  });
  if (backlog.length === 0) {
    warnings.push(warning('BACKLOG.md', 1, 'empty_backlog', 'No open unordered-list items were found.'));
  }

  const recentChanges = [];
  selected.get('GIT_LOG.txt').split(/\r?\n/).forEach((rawText, index) => {
    const line = index + 1;
    if (!rawText.trim()) return;
    const match = rawText.match(/^([0-9a-fA-F]{7,40})\s+(.+)$/);
    if (!match) {
      warnings.push(
        warning('GIT_LOG.txt', line, 'malformed_git_line', 'Expected a 7-40 character hex hash and message.')
      );
      return;
    }
    recentChanges.push({
      id: `git_log:line:${line}`,
      sourceType: 'git_log',
      locator: { file: 'GIT_LOG.txt', line },
      rawText,
      kind: 'commit',
      hash: match[1],
      message: match[2],
      order: recentChanges.length
    });
  });

  return { bundle: { schemaVersion: 1, backlog, recentChanges }, warnings };
}

export { MAX_FILE_BYTES };
