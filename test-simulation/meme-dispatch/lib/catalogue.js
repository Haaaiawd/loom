import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(ROOT, 'data');
export const REGISTRY_PATH = join(DATA_DIR, 'registry.json');
export const PACKS_DIR = join(DATA_DIR, 'packs');

export const PROVIDERS = {
  openmoji: {
    hosts: ['openmoji.org', 'raw.githubusercontent.com'],
    licence: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  },
  local_pack: {
    hosts: [],
    licence: { name: 'Project-owned asset', url: 'local-pack' },
  },
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function safeLocalPath(file) {
  if (typeof file !== 'string' || !file.trim()) throw new Error('Local asset needs a file path.');
  const resolved = resolve(PACKS_DIR, file);
  const packRoot = `${resolve(PACKS_DIR)}\\`;
  if (!resolved.startsWith(packRoot) || isAbsolute(file) || normalize(file).startsWith('..')) {
    throw new Error('Local asset must stay inside data/packs.');
  }
  return resolved;
}

function validateRemoteUrl(url, provider) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Remote asset needs a valid URL.'); }
  if (parsed.protocol !== 'https:' || !PROVIDERS[provider].hosts.includes(parsed.hostname) || !/\.(png|jpe?g|webp)$/i.test(parsed.pathname)) {
    throw new Error(`Remote asset must be an HTTPS image from the approved ${provider} provider.`);
  }
  return parsed.toString();
}

export function validateAsset(record) {
  if (!record || typeof record !== 'object') throw new Error('Asset record must be an object.');
  const { id, name, provider, kind, tags, licence } = record;
  if (![id, name, provider, kind].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error('Asset record needs non-empty id, name, provider, and kind.');
  }
  if (!PROVIDERS[provider]) throw new Error(`Unknown media provider: ${provider}.`);
  if (!['remote', 'local'].includes(kind)) throw new Error('Asset kind must be remote or local.');
  if (!licence?.name || !licence?.url) throw new Error('Asset record needs explicit licence metadata.');

  const base = {
    id, name, provider, kind,
    tags: Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [],
    licence: { name: licence.name, url: licence.url, attribution: licence.attribution || null },
  };
  if (kind === 'remote') return { ...base, source_url: validateRemoteUrl(record.source_url, provider) };
  const localPath = safeLocalPath(record.file);
  if (!existsSync(localPath)) throw new Error(`Bundled local asset is missing: ${relative(ROOT, localPath)}.`);
  return { ...base, file: relative(PACKS_DIR, localPath).split('\\').join('/') };
}

export function loadCatalogue({ registryPath = REGISTRY_PATH } = {}) {
  const data = readJson(registryPath);
  if (!data || !Array.isArray(data.assets)) throw new Error(`Invalid media registry: ${registryPath}`);
  return { ...data, assets: data.assets.map(validateAsset) };
}

export function localAssetPath(asset) {
  if (asset.kind !== 'local') throw new Error('Only local assets have a bundled path.');
  return safeLocalPath(asset.file);
}

export function isApprovedRemoteUrl(url, provider) {
  try { return validateRemoteUrl(url, provider); } catch { return null; }
}
