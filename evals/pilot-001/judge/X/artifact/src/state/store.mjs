import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const roles = new Set(['producer_designer', 'programmer', 'artist']);
const actionTypes = new Set(['direct', 'coordination', 'clarification']);
const rootKeys = new Set(['schemaVersion', 'projectLabel', 'role', 'outcome', 'candidateSnapshot', 'recordedAt']);
const snapshotKeys = new Set(['id', 'title', 'actionType', 'evidenceLocators']);
const locatorKeys = new Set(['file', 'line']);

function exactKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function validateLocalState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, rootKeys)) return false;
  if (value.schemaVersion !== 1 || !roles.has(value.role) || !['accepted', 'skipped'].includes(value.outcome)) return false;
  if (
    typeof value.projectLabel !== 'string' ||
    value.projectLabel.length < 1 ||
    value.projectLabel.length > 100 ||
    /[\\/:*?"<>|]/.test(value.projectLabel)
  ) return false;
  if (typeof value.recordedAt !== 'string' || Number.isNaN(Date.parse(value.recordedAt))) return false;
  if (value.outcome === 'skipped') return !Object.hasOwn(value, 'candidateSnapshot');

  const snapshot = value.candidateSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || !exactKeys(snapshot, snapshotKeys)) return false;
  if (!/^candidate:[a-z0-9-]+$/.test(snapshot.id ?? '')) return false;
  if (typeof snapshot.title !== 'string' || snapshot.title.length < 1 || snapshot.title.length > 240) return false;
  if (!actionTypes.has(snapshot.actionType)) return false;
  if (!Array.isArray(snapshot.evidenceLocators) || snapshot.evidenceLocators.length < 1) return false;
  return snapshot.evidenceLocators.every(
    (locator) =>
      locator &&
      typeof locator === 'object' &&
      !Array.isArray(locator) &&
      exactKeys(locator, locatorKeys) &&
      ['BACKLOG.md', 'GIT_LOG.txt'].includes(locator.file) &&
      Number.isInteger(locator.line) &&
      locator.line >= 1
  );
}

export function resolveDataDirectory(explicitDirectory) {
  if (explicitDirectory) return path.resolve(explicitDirectory);
  if (process.env.INDIE_START_ASSISTANT_DATA_DIR) {
    return path.resolve(process.env.INDIE_START_ASSISTANT_DATA_DIR);
  }
  if (!process.env.LOCALAPPDATA) {
    throw new Error('LOCALAPPDATA is required unless INDIE_START_ASSISTANT_DATA_DIR is explicitly set.');
  }
  return path.join(process.env.LOCALAPPDATA, 'IndieStartAssistant');
}

export function createStateStore({ dataDirectory } = {}) {
  const directory = resolveDataDirectory(dataDirectory);
  const stateFile = path.join(directory, 'state.json');

  return {
    directory,
    stateFile,
    async read() {
      try {
        const parsed = JSON.parse(await readFile(stateFile, 'utf8'));
        if (parsed?.schemaVersion !== 1) {
          return { state: null, warning: { code: 'future_or_unknown_state', message: 'Prior choice used an unsupported state version and was ignored.' } };
        }
        if (!validateLocalState(parsed)) {
          return { state: null, warning: { code: 'invalid_state', message: 'Prior choice was incomplete and was ignored.' } };
        }
        return { state: parsed };
      } catch (error) {
        if (error.code === 'ENOENT') return { state: null };
        return { state: null, warning: { code: 'corrupt_state', message: 'Prior choice could not be restored and was ignored.' } };
      }
    },
    async write(state) {
      if (!validateLocalState(state)) {
        const error = new Error('State does not conform to local-state schemaVersion 1.');
        error.code = 'invalid_state';
        throw error;
      }
      await mkdir(directory, { recursive: true });
      const temporary = path.join(directory, `.state-${process.pid}-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        await rename(temporary, stateFile);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      return state;
    }
  };
}
