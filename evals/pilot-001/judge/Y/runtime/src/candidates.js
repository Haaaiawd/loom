'use strict';

const ROLE_TERMS = {
  'producer-design': ['tutorial', 'teach', 'enemy', 'playtest', 'decide', 'build'],
  programming: ['camera', 'jitter', 'save', 'corruption', 'scene', 'transition', 'crash', 'force-closing', 'enemy'],
  art: ['ambience', 'archive', 'lighting', 'images', 'capsule', 'art'],
  unrestricted: []
};

const CONCEPTS = [
  ['save', 'corruption', 'checkpoint', 'reload', 'inventory'],
  ['tutorial', 'teach', 'ranged', 'enemy', 'sentinel'],
  ['flooded', 'archive', 'ambience', 'lighting'],
  ['capsule', 'images', 'playtest', 'build'],
  ['camera', 'jitter']
];

const STOPWORDS = new Set([
  'a', 'an', 'and', 'after', 'art', 'before', 'chore', 'during', 'feat', 'first',
  'fix', 'for', 'from', 'in', 'internal', 'next', 'of', 'or', 'reported', 'the',
  'this', 'three', 'to', 'update', 'when', 'with'
]);

function tokens(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]+/g) || []);
}

function expanded(text) {
  const found = tokens(text);
  for (const stopword of STOPWORDS) found.delete(stopword);
  for (const group of CONCEPTS) {
    if (group.some((term) => found.has(term))) group.forEach((term) => found.add(term));
  }
  return found;
}

function overlapScore(a, b) {
  const left = expanded(a);
  const right = expanded(b);
  let score = 0;
  for (const token of left) if (right.has(token)) score += 1;
  return score;
}

function analyzeItem(item, commits, role, goal) {
  const text = item.text.toLowerCase();
  let risk = 0;
  if (/corruption|data loss/.test(text)) risk += 8;
  if (/force-closing|crash/.test(text)) risk += 5;
  if (/investigate|decide/.test(text)) risk += 2;

  const roleTerms = ROLE_TERMS[role] || [];
  const roleScore = roleTerms.filter((term) => text.includes(term)).length;
  const goalScore = goal ? overlapScore(item.text, goal) * 3 : 0;
  let bestCommit = null;
  let continuity = 0;
  for (const commit of commits) {
    const score = overlapScore(item.text, commit.subject);
    if (score > continuity) {
      continuity = score;
      bestCommit = commit;
    }
  }
  return { item, risk, roleScore, goalScore, continuity, bestCommit };
}

function stableBest(pool, scorer) {
  let selected = null;
  let best = -Infinity;
  for (const entry of pool) {
    const score = scorer(entry);
    if (score > best) {
      best = score;
      selected = entry;
    }
  }
  return selected;
}

function evidenceFor(entry, snapshot) {
  const evidence = [{ kind: 'backlog', file: 'BACKLOG.md', line: entry.item.line, raw: entry.item.text }];
  if (entry.bestCommit && entry.continuity > 0) {
    evidence.push({
      kind: 'commit',
      hash: entry.bestCommit.hash,
      subject: entry.bestCommit.subject,
      source: snapshot.gitSource
    });
  }
  return evidence;
}

function candidateFrom(entry, lens, snapshot, role, goal) {
  let rationale;
  let riskOrBlocker = null;
  if (lens === 'risk-blocker') {
    const lowered = entry.item.text.toLowerCase();
    if (/corruption|save|data loss/.test(lowered)) {
      rationale = '这是一项风险导向候选：强退与存档损坏可能带来玩家数据损失，适合先确认影响和复现条件。';
      riskOrBlocker = '根因与影响范围仍未知；不处理可能继续暴露玩家数据风险。';
    } else if (/investigate/.test(lowered)) {
      rationale = '这项调查仍有关键未知，先缩小根因范围可能解锁后续工作。';
      riskOrBlocker = '当前未知尚未解决，工具不能判断真实影响范围。';
    } else {
      rationale = '这项未决决定可能阻塞后续工作，适合作为由你确认的切入口。';
      riskOrBlocker = '工具不知道团队依赖，只能提示可能存在决策阻塞。';
    }
  } else if (lens === 'recent-continuity') {
    rationale = entry.bestCommit
      ? `它与近期提交“${entry.bestCommit.subject}”存在受控关键词关联，可延续最近上下文。`
      : '近期变化证据较弱，这是剩余事项中的稳定补位候选。';
  } else if (goal && entry.goalScore > 0) {
    rationale = `它与今天目标“${goal}”存在关键词关联，适合作为由你确认的切入口。`;
  } else if (role !== 'unrestricted' && entry.roleScore > 0) {
    rationale = '它与当前角色更容易直接开始，但角色只影响相关性，不会隐藏其他事项。';
  } else {
    rationale = '现有证据不足以形成更强判断，这是按 backlog 原始顺序提供的可选切入口。';
  }

  return {
    id: `${snapshot.snapshotId}:${entry.item.id}:${lens}`,
    backlogItemId: entry.item.id,
    title: entry.item.text,
    rationale,
    lens,
    evidence: evidenceFor(entry, snapshot),
    riskOrBlocker,
    caveat: entry.bestCommit && entry.continuity > 0
      ? '基于关键词与受控词表关联，可能相关，不代表该提交导致此事项。'
      : '这是候选而非团队优先级裁决，最终由你确认。'
  };
}

function generateCandidates(snapshot, role = 'unrestricted', goal = '', skippedIds = []) {
  if (!snapshot || !Array.isArray(snapshot.backlog) || !Array.isArray(snapshot.commits)) {
    throw new Error('候选输入缺少有效 snapshot。');
  }
  if (!ROLE_TERMS[role]) throw new Error('未知角色。');
  if (snapshot.gitSource === 'missing') {
    const error = new Error('缺少近期变化证据，当前原型暂停候选生成。');
    error.code = 'RECENT_EVIDENCE_MISSING';
    throw error;
  }

  const skipped = new Set(skippedIds);
  const pool = snapshot.backlog
    .filter((item) => !skipped.has(item.id))
    .map((item) => analyzeItem(item, snapshot.commits, role, goal));
  const chosen = [];
  const choose = (lens, scorer, minimum = 0) => {
    const remaining = pool.filter((entry) => !chosen.includes(entry));
    const best = stableBest(remaining, scorer);
    if (best && scorer(best) > minimum) chosen.push(best);
    return best && scorer(best) > minimum ? { entry: best, lens } : null;
  };

  const slots = [];
  const risk = choose('risk-blocker', (entry) => entry.risk, 0);
  if (risk) slots.push(risk);
  const continuity = choose(
    'recent-continuity',
    (entry) => entry.continuity * 4 + (role === 'art' ? entry.roleScore * 3 : role === 'programming' ? Math.min(entry.roleScore, 1) : 0),
    0
  );
  if (continuity) slots.push(continuity);
  const roleGoal = choose('role-goal', (entry) => entry.goalScore * 5 + entry.roleScore * 2, 0);
  if (roleGoal) slots.push(roleGoal);

  while (slots.length < Math.min(3, pool.length)) {
    const remaining = pool.filter((entry) => !chosen.includes(entry));
    const fallback = remaining[0];
    chosen.push(fallback);
    slots.push({ entry: fallback, lens: 'fallback' });
  }

  return {
    rulesVersion: 1,
    candidates: slots.map(({ entry, lens }) => candidateFrom(entry, lens, snapshot, role, goal)),
    notice: pool.length < 3 ? `仅有 ${pool.length} 个未跳过事项，没有伪造候选。` : null
  };
}

module.exports = { generateCandidates, overlapScore };
