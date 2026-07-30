import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReadableStream } from 'node:stream/web';
import test from 'node:test';
import { loadCatalogue, validateAsset } from '../lib/catalogue.js';
import { MAX_BYTES, dispatchReaction, inspectMedia, materializeAsset } from '../lib/media-cache.js';
import { rankAssets, toLocalMarkdown, validateCue } from '../lib/select.js';
import { loadHelloDiguaDiscovery, refreshHelloDigua } from '../lib/hellodigua.js';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const remoteAsset = {
  id: 'remote-celebrate', name: 'Licensed Party Popper', provider: 'openmoji', kind: 'remote',
  source_url: 'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/72x72/1F389.png',
  licence: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  tags: ['celebrate', '庆祝', '成功'],
};

function response({ status = 200, body = pixel, mime = 'image/png', location = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => ({ 'content-type': mime, 'content-length': String(body.length), location }[name.toLowerCase()] || null) },
    body: new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } }),
  };
}

test('ranks bilingual reaction cues and emits only local absolute-path Markdown', () => {
  const assets = loadCatalogue().assets;
  const asset = rankAssets(assets, '项目终于上线了', { emotion: 'celebrate' })[0];
  assert.equal(asset.id, 'openmoji-party-popper');
  const markdown = toLocalMarkdown(asset, 'D:\\cache\\party.png');
  assert.equal(markdown, '![Meme: Party Popper](D:/cache/party.png)');
  assert.ok(!markdown.includes('https://') && !markdown.includes('base64'));
});

test('bundled project-owned asset is a validated offline fallback', async () => {
  const local = loadCatalogue().assets.find((asset) => asset.kind === 'local');
  const delivered = await materializeAsset(local);
  assert.equal(delivered.origin, 'bundled-local');
  assert.ok(existsSync(delivered.path));
  assert.equal(delivered.inspection.mime, 'image/png');
  assert.match(delivered.path, /data[\\/]packs[\\/]vela[\\/]celebrate-robot\.png$/);
});

test('downloads an approved image into a hash-verified local cache and reuses it offline', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'meme-dispatch-cache-'));
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(); };
  const first = await materializeAsset(validateAsset(remoteAsset), { cacheDir: folder, fetchImpl });
  assert.equal(first.origin, 'downloaded');
  assert.equal(first.inspection.width, 1);
  assert.ok(existsSync(first.path));
  assert.ok(existsSync(first.path.replace(/\.png$/, '.json')));
  const second = await materializeAsset(validateAsset(remoteAsset), { cacheDir: folder, fetchImpl: async () => { throw new Error('network must not be used'); } });
  assert.equal(second.origin, 'cache');
  assert.equal(second.inspection.sha256, first.inspection.sha256);
  assert.equal(calls, 1);
});

test('rejects unsafe redirects, mismatched MIME, oversized media, and malformed cues', async () => {
  const asset = validateAsset(remoteAsset);
  await assert.rejects(materializeAsset(asset, { cacheDir: mkdtempSync(join(tmpdir(), 'meme-dispatch-cache-')), fetchImpl: async () => response({ status: 302, location: 'https://example.com/image.png' }) }), /approved provider boundary/);
  assert.throws(() => inspectMedia(pixel, { declaredMime: 'image/jpeg' }), /does not match/);
  assert.throws(() => inspectMedia(Buffer.alloc(MAX_BYTES + 1)), /byte length/);
  assert.throws(() => validateAsset({ ...remoteAsset, source_url: 'http://openmoji.org/image.png' }), /HTTPS/);
  assert.throws(() => validateCue('x'.repeat(121)), /120/);
  assert.throws(() => validateCue('<script>'), /unsupported/);
});

test('network failure falls through to a rendered, project-owned local fallback', async () => {
  const assets = loadCatalogue().assets;
  const delivered = await dispatchReaction(assets, rankAssets(assets, '庆祝上线', { emotion: 'celebrate' }), {
    cacheDir: mkdtempSync(join(tmpdir(), 'meme-dispatch-cache-')),
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(delivered.origin, 'bundled-local');
  assert.equal(delivered.asset.id, 'vela-celebrate-robot');
  assert.ok(delivered.failures.some((failure) => failure.id === 'openmoji-party-popper'));
});

test('HelloDigua refresh caches Chinese community metadata as discovery-only candidates', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'meme-dispatch-provider-'));
  const cachePath = join(folder, 'hellodigua.json');
  const payload = [{ platform: 'tieba', emojis: [{ url: 'output/tieba/tb_19.avif', name: '滑稽', tags: ['humorous'], keywords: ['手动狗头', '你懂的'] }] }];
  const index = await refreshHelloDigua({ cachePath, fetchImpl: async () => ({ ok: true, json: async () => payload }) });
  assert.equal(index.assets[0].dispatch_status, 'discovery_only');
  assert.equal(index.assets[0].source_url, 'https://hellodigua.github.io/emoji/output/tieba/tb_19.avif');
  assert.equal(loadHelloDiguaDiscovery({ cachePath }).assets.length, 1);
  const found = rankAssets(index.assets, '手动狗头');
  assert.equal(found[0].name, '滑稽');
});
