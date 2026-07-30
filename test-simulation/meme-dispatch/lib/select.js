const EMOTION_TERMS = {
  celebrate: ['celebrate', 'cheers', 'success', 'launch', 'win', 'yay', 'congrats', '庆祝', '成功', '上线', '搞定', '太好了', '稳了', '开香槟'],
  surprise: ['surprise', 'surprised', 'shock', 'unexpected', 'wow', 'reveal', '震惊', '没想到', '居然', '什么', '啊这'],
  sad: ['sad', 'waiting', 'lonely', 'disappointed', 'loss', '难过', '失望', '等', '裂开', '寄'],
  agreement: ['agreement', 'collaboration', 'partnership', 'deal', 'together', '同意', '可以', '收到', '合作', '好耶'],
  choice: ['choice', 'decision', 'confused', 'dilemma', 'preference', '选择', '纠结', '怎么办'],
};

export function validateCue(input) {
  if (typeof input !== 'string') throw new Error('Cue must be text.');
  const cue = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cue || cue.length > 120) throw new Error('Cue must be between 1 and 120 characters.');
  if (!/^[\p{L}\p{N}\s,!?'-]+$/u.test(cue)) throw new Error('Cue contains unsupported characters.');
  return cue;
}

function tokens(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function expandTerms(cue, emotion) {
  const result = new Set(tokens(cue));
  const emotionKey = emotion ? validateCue(emotion) : null;
  for (const [key, terms] of Object.entries(EMOTION_TERMS)) {
    if (emotionKey === key || result.has(key) || terms.some((term) => result.has(term))) {
      result.add(key);
      terms.forEach((term) => result.add(term));
    }
  }
  return result;
}

export function rankAssets(assets, cue, { emotion } = {}) {
  if (!Array.isArray(assets) || !assets.length) throw new Error('No reaction assets are available.');
  const terms = expandTerms(validateCue(cue), emotion);
  return assets.map((asset, index) => {
    const haystack = new Set([...tokens(asset.name), ...(asset.tags || []).flatMap(tokens)]);
    let score = 0;
    for (const term of terms) if (haystack.has(term)) score += asset.tags?.includes(term) ? 3 : 2;
    return { asset, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(({ asset }) => asset);
}

export function toLocalMarkdown(asset, absolutePath) {
  const alt = String(asset.name).replace(/[\[\]]/g, '').trim() || 'reaction image';
  if (typeof absolutePath !== 'string' || !absolutePath) throw new Error('A local absolute path is required for Markdown handoff.');
  return `![Meme: ${alt}](${absolutePath.split('\\').join('/')})`;
}
