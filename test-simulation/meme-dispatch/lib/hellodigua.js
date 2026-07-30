import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './catalogue.js';

const INDEX_URL = 'https://raw.githubusercontent.com/hellodigua/emoji/main/emoji.json';
const ASSET_BASE = 'https://hellodigua.github.io/emoji/';
export const HELLODIGUA_CACHE = join(DATA_DIR, 'providers', 'hellodigua.json');

function atomicWrite(path, value) {
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temp, path);
}

function normalizeIndex(payload) {
  if (!Array.isArray(payload)) throw new Error('HelloDigua index must be an array.');
  const assets = [];
  for (const group of payload) {
    if (!group || typeof group.platform !== 'string' || !Array.isArray(group.emojis)) continue;
    for (const emoji of group.emojis) {
      if (!emoji || typeof emoji.url !== 'string' || typeof emoji.name !== 'string') continue;
      const sourceUrl = new URL(emoji.url, ASSET_BASE);
      if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'hellodigua.github.io' || !sourceUrl.pathname.endsWith('.avif')) continue;
      assets.push({
        id: `hellodigua-${group.platform}-${emoji.url.split('/').pop().replace(/\.avif$/i, '')}`,
        name: emoji.name,
        platform: group.platform,
        source_url: sourceUrl.toString(),
        tags: [...(Array.isArray(emoji.tags) ? emoji.tags : []), ...(Array.isArray(emoji.keywords) ? emoji.keywords : [])],
        source: 'hellodigua/emoji',
        dispatch_status: 'discovery_only',
        reason: 'Upstream repository does not publish an explicit redistribution licence; use as a search index, then approve or replace individual assets before dispatch.',
      });
    }
  }
  return { schema: 'meme-dispatch/hellodigua-discovery/v1', fetched_at: new Date().toISOString(), source: INDEX_URL, assets };
}

export async function refreshHelloDigua({ fetchImpl = globalThis.fetch, cachePath = HELLODIGUA_CACHE } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const response = await fetchImpl(INDEX_URL, { headers: { accept: 'application/json' } });
  if (!response?.ok) throw new Error(`HelloDigua index responded ${response?.status ?? 'without status'}.`);
  const index = normalizeIndex(await response.json());
  mkdirSync(join(DATA_DIR, 'providers'), { recursive: true });
  atomicWrite(cachePath, index);
  return index;
}

export function loadHelloDiguaDiscovery({ cachePath = HELLODIGUA_CACHE } = {}) {
  const payload = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (!Array.isArray(payload.assets)) throw new Error('HelloDigua discovery cache is invalid.');
  return payload;
}
