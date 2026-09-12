import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../afterthought.html', import.meta.url), 'utf8');
const forbidden = [/https?:\/\//i, /\bfetch\s*\(/i, /XMLHttpRequest/i, /<script\s+src=/i, /<link[^>]+href=/i];
const hits = forbidden.filter((re) => re.test(html));
if (hits.length) throw new Error(`external/network dependency found: ${hits}`);
for (const text of ['localStorage', 'Clear local note', 'Reflection tool, not medical care.', 'Arrive', 'Name', 'Sort', 'Next']) {
  if (!html.includes(text)) throw new Error(`missing required surface: ${text}`);
}
console.log(JSON.stringify({static:'pass', bytes:html.length, network_patterns:0, required_surfaces:7}));
