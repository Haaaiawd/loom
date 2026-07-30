import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DATA_DIR, PROVIDERS, isApprovedRemoteUrl, localAssetPath } from './catalogue.js';

export const CACHE_DIR = join(DATA_DIR, 'cache');
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_DIMENSION = 4096;
const MIME_BY_KIND = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fail(message) { throw new Error(`Media validation failed: ${message}`); }

function mediaKind(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 16 && bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'webp';
  fail('unrecognized image signature');
}

function dimensions(bytes, kind) {
  if (kind === 'png') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (kind === 'webp') {
    const variant = bytes.subarray(12, 16).toString('ascii');
    if (variant === 'VP8X') return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (variant === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    fail('unsupported WEBP variant');
  }
  for (let offset = 2; offset < bytes.length - 9; offset += 1) {
    if (bytes[offset] !== 0xff || bytes[offset + 1] === 0x00 || bytes[offset + 1] === 0xff) continue;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > bytes.length) break;
    if (marker >= 0xc0 && marker <= 0xc3) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    offset += length + 1;
  }
  fail('JPEG dimensions unavailable');
}

export function inspectMedia(bytes, { declaredMime = null } = {}) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (!bytes.length || bytes.length > MAX_BYTES) fail(`byte length must be 1-${MAX_BYTES}`);
  const kind = mediaKind(bytes);
  const mime = MIME_BY_KIND[kind];
  if (declaredMime && declaredMime.split(';')[0].trim().toLowerCase() !== mime) fail(`MIME ${declaredMime} does not match ${mime}`);
  const { width, height } = dimensions(bytes, kind);
  if (![width, height].every(Number.isFinite) || width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION) fail(`dimensions must be 1-${MAX_DIMENSION}`);
  return { mime, bytes: bytes.length, width, height, sha256: sha256(bytes) };
}

async function readWithLimit(body) {
  if (!body) fail('response body missing');
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); fail(`download exceeds ${MAX_BYTES} bytes`); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function fetchApproved(sourceUrl, provider, fetchImpl) {
  let url = sourceUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!isApprovedRemoteUrl(url, provider)) fail('redirect left the approved provider boundary');
    const response = await fetchImpl(url, { redirect: 'manual', headers: { accept: 'image/png,image/jpeg,image/webp' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers?.get?.('location');
      if (!location || redirects === 3) fail('too many or invalid redirects');
      url = new URL(location, url).toString();
      continue;
    }
    if (!response?.ok) fail(`source responded ${response?.status ?? 'without status'}`);
    const length = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(length) && length > MAX_BYTES) fail(`declared content length exceeds ${MAX_BYTES}`);
    return { url, declaredMime: response.headers?.get?.('content-type') || null, bytes: await readWithLimit(response.body) };
  }
  fail('redirect loop');
}

function cachePaths(asset, cacheDir) {
  const key = sha256(Buffer.from(`${asset.id}\n${asset.source_url}`));
  return { key, media: (ext) => join(cacheDir, `${key}.${ext}`), meta: join(cacheDir, `${key}.json`) };
}

function writeAtomically(path, contents) {
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, contents);
  renameSync(temp, path);
}

export async function materializeAsset(asset, { fetchImpl = globalThis.fetch, cacheDir = CACHE_DIR } = {}) {
  if (asset.kind === 'local') {
    const path = resolve(localAssetPath(asset));
    const inspection = inspectMedia(readFileSync(path));
    return { asset, path, origin: 'bundled-local', inspection };
  }
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required for remote assets.');
  mkdirSync(cacheDir, { recursive: true });
  const paths = cachePaths(asset, cacheDir);
  if (existsSync(paths.meta)) {
    try {
      const metadata = JSON.parse(readFileSync(paths.meta, 'utf8'));
      const path = paths.media(EXT_BY_MIME[metadata.mime]);
      if (existsSync(path)) {
        const inspection = inspectMedia(readFileSync(path));
        if (inspection.sha256 === metadata.sha256 && inspection.mime === metadata.mime) return { asset, path: resolve(path), origin: 'cache', inspection };
      }
    } catch { /* Ignore a corrupt cache entry and refresh it safely. */ }
  }
  const { url, declaredMime, bytes } = await fetchApproved(asset.source_url, asset.provider, fetchImpl);
  const inspection = inspectMedia(bytes, { declaredMime });
  const path = paths.media(EXT_BY_MIME[inspection.mime]);
  writeAtomically(path, bytes);
  writeAtomically(paths.meta, `${JSON.stringify({ asset_id: asset.id, provider: asset.provider, source_url: url, licence: asset.licence, ...inspection }, null, 2)}\n`);
  return { asset, path: resolve(path), origin: 'downloaded', inspection };
}

export async function dispatchReaction(assets, rankedAssets, options = {}) {
  const failures = [];
  for (const asset of rankedAssets) {
    try { return { ...await materializeAsset(asset, options), failures }; }
    catch (error) { failures.push({ id: asset.id, reason: error.message }); }
  }
  throw new Error(`No reaction asset could be materialized: ${failures.map((failure) => failure.id).join(', ')}.`);
}
