#!/usr/bin/env node
import { loadCatalogue } from '../lib/catalogue.js';
import { dispatchReaction } from '../lib/media-cache.js';
import { rankAssets, toLocalMarkdown } from '../lib/select.js';
import { loadHelloDiguaDiscovery, refreshHelloDigua } from '../lib/hellodigua.js';

const args = process.argv.slice(2);
const usage = `Usage:\n  meme-dispatch refresh hellodigua\n  meme-dispatch discover <cue...>\n  meme-dispatch inspect <cue...>\n  meme-dispatch <cue...> [--emotion <name>]\n\nThe default command materializes an approved or bundled asset and writes exactly one Markdown image line with a local absolute path. Discoveries never dispatch until their rights are approved.`;
function fail(message) { process.stderr.write(`${message}\n`); process.exitCode = 1; }

async function main() {
  if (!args.length || args.includes('--help') || args.includes('-h')) return fail(usage);
  if (args[0] === 'refresh') {
    if (args[1] !== 'hellodigua' || args.length !== 2) return fail('Only `refresh hellodigua` is supported.');
    const index = await refreshHelloDigua();
    return process.stdout.write(`${JSON.stringify({ provider: 'hellodigua', assets: index.assets.length, status: 'discovery_only' })}\n`);
  }
  if (args[0] === 'discover') {
    const cue = args.slice(1).join(' ');
    const index = loadHelloDiguaDiscovery();
    const candidates = rankAssets(index.assets.map((asset) => ({ ...asset, provider: 'hellodigua', kind: 'discovery', licence: { name: 'Unverified upstream licence', url: index.source } })), cue);
    const visible = candidates.slice(0, 12).map(({ id, name, platform, source_url, dispatch_status }) => ({ id, name, platform, source_url, dispatch_status }));
    return process.stdout.write(`${JSON.stringify(visible, null, 2)}\n`);
  }
  const inspect = args[0] === 'inspect';
  const input = inspect ? args.slice(1) : [...args];
  const emotionAt = input.indexOf('--emotion');
  let emotion;
  if (emotionAt !== -1) {
    emotion = input[emotionAt + 1];
    if (!emotion || emotionAt + 2 !== input.length) return fail('--emotion needs one final value.');
    input.splice(emotionAt, 2);
  }
  const catalogue = loadCatalogue();
  const ranked = rankAssets(catalogue.assets, input.join(' '), { emotion });
  if (inspect) return process.stdout.write(`${JSON.stringify(ranked.map(({ id, name, provider, kind, licence }) => ({ id, name, provider, kind, licence })), null, 2)}\n`);
  const delivered = await dispatchReaction(catalogue.assets, ranked);
  process.stdout.write(`${toLocalMarkdown(delivered.asset, delivered.path)}\n`);
  process.stderr.write(`origin=${delivered.origin} sha256=${delivered.inspection.sha256} ${delivered.inspection.width}x${delivered.inspection.height} licence=${delivered.asset.licence.name}\n`);
}

main().catch((error) => fail(error.message));
