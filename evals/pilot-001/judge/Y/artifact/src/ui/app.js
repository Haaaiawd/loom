'use strict';

const token = new URLSearchParams(location.search).get('token');
const state = { bootstrap: null, snapshot: null, candidates: [], skippedIds: [] };
const byId = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Session-Token': token, ...(options.headers || {}) }
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error?.message || '本地请求失败。');
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
}

function setStatus(message, error = false) {
  byId('status').textContent = message;
  byId('status').classList.toggle('error', error);
}

function selectedRole() {
  return document.querySelector('input[name="role"]:checked').value;
}

function renderDecision(lastDecision, persisted = true) {
  const strip = byId('last-decision');
  if (!lastDecision) {
    strip.classList.add('hidden');
    return;
  }
  const time = new Date(lastDecision.selectedAt).toLocaleString('zh-CN', { hour12: false });
  strip.innerHTML = '';
  const copy = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `最近一次决定：${lastDecision.candidateSnapshot.title}`;
  const small = document.createElement('small');
  small.textContent = `${time} · ${persisted ? '只保存在本机，不会修改项目' : '仅本次进程记住，关闭后消失'}`;
  copy.append(strong, document.createElement('br'), small);
  const clear = document.createElement('button');
  clear.className = 'secondary';
  clear.type = 'button';
  clear.textContent = '清除选择';
  clear.addEventListener('click', async () => {
    const result = await api('/api/decision', { method: 'DELETE' });
    renderDecision(result.state.lastDecision);
  });
  strip.append(copy, clear);
  strip.classList.remove('hidden');
}

function renderSnapshot(snapshot) {
  byId('workspace').classList.remove('hidden');
  byId('commit-count').textContent = `${snapshot.commits.length} 条`;
  byId('backlog-count').textContent = `${snapshot.backlog.length} 项`;
  byId('source-note').textContent = snapshot.gitSource === 'fixture-export'
    ? '来源：GIT_LOG.txt 验收夹具（不是实时 Git 仓库）'
    : `来源：${snapshot.gitSource}`;
  const commits = byId('commits');
  commits.innerHTML = '';
  snapshot.commits.forEach((commit) => {
    const li = document.createElement('li');
    const hash = document.createElement('strong');
    hash.textContent = commit.hash;
    const subject = document.createElement('span');
    subject.textContent = commit.subject;
    li.append(hash, subject);
    commits.append(li);
  });
  const backlog = byId('backlog');
  backlog.innerHTML = '';
  snapshot.backlog.forEach((item) => {
    const li = document.createElement('li');
    const line = document.createElement('small');
    line.textContent = `L${item.line}`;
    const text = document.createElement('span');
    text.textContent = item.text;
    li.append(line, text);
    backlog.append(li);
  });
}

function lensLabel(lens) {
  return ({ 'risk-blocker': '风险 / 阻塞视角', 'recent-continuity': '近期连续性视角', 'role-goal': '角色 / 今日目标视角', fallback: '稳定补位候选' })[lens];
}

function evidenceLabel(ref) {
  return ref.kind === 'backlog'
    ? `${ref.file} 第 ${ref.line} 行：${ref.raw}`
    : `${ref.hash} ${ref.subject}（${ref.source === 'fixture-export' ? '验收夹具' : '仓库'}）`;
}

function renderCandidates(payload) {
  state.candidates = payload.candidates;
  const host = byId('candidates');
  host.innerHTML = '';
  payload.candidates.forEach((candidate, index) => {
    const card = document.createElement('article');
    card.className = 'candidate';
    card.dataset.lens = candidate.lens;
    const kicker = document.createElement('p');
    kicker.className = 'candidate-kicker';
    kicker.textContent = `候选 ${index + 1} · ${lensLabel(candidate.lens)}`;
    const title = document.createElement('h3');
    title.textContent = candidate.title;
    const dl = document.createElement('dl');
    const whyTerm = document.createElement('dt'); whyTerm.textContent = '为什么现在';
    const why = document.createElement('dd'); why.textContent = candidate.rationale;
    dl.append(whyTerm, why);
    if (candidate.riskOrBlocker) {
      const riskTerm = document.createElement('dt'); riskTerm.textContent = '风险或阻塞';
      const risk = document.createElement('dd'); risk.className = 'risk'; risk.textContent = candidate.riskOrBlocker;
      dl.append(riskTerm, risk);
    }
    const caveatTerm = document.createElement('dt'); caveatTerm.textContent = '限制';
    const caveat = document.createElement('dd'); caveat.className = 'caveat'; caveat.textContent = candidate.caveat;
    dl.append(caveatTerm, caveat);
    const details = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = `查看 ${candidate.evidence.length} 条原始证据`;
    const evidence = document.createElement('ul'); evidence.className = 'evidence';
    candidate.evidence.forEach((ref) => {
      const li = document.createElement('li'); li.textContent = evidenceLabel(ref); evidence.append(li);
    });
    details.append(summary, evidence);
    const actions = document.createElement('div'); actions.className = 'candidate-actions';
    const choose = document.createElement('button'); choose.className = 'primary'; choose.type = 'button'; choose.textContent = '就从这里开始';
    choose.addEventListener('click', () => chooseCandidate(candidate));
    const skip = document.createElement('button'); skip.className = 'secondary'; skip.type = 'button'; skip.textContent = '今天跳过';
    skip.addEventListener('click', async () => {
      state.skippedIds.push(candidate.backlogItemId);
      byId('reset-skips').classList.remove('hidden');
      await updateCandidates();
    });
    actions.append(choose, skip);
    card.append(kicker, title, dl, details, actions);
    host.append(card);
  });
  if (payload.notice) {
    const notice = document.createElement('p'); notice.className = 'status'; notice.textContent = payload.notice; host.append(notice);
  }
}

async function updateCandidates() {
  if (!state.snapshot) return;
  try {
    const payload = await api('/api/candidates', {
      method: 'POST',
      body: JSON.stringify({ snapshotId: state.snapshot.snapshotId, role: selectedRole(), goal: byId('today-goal').value.trim(), skippedIds: state.skippedIds })
    });
    renderCandidates(payload);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function chooseCandidate(candidate) {
  let consentToSave = Boolean(state.bootstrap.state.consentedAt);
  if (!consentToSave) {
    const dialog = byId('consent-dialog');
    dialog.showModal();
    const choice = await new Promise((resolve) => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
    consentToSave = choice === 'persist';
  }
  const result = await api('/api/decision', {
    method: 'POST',
    body: JSON.stringify({
      snapshotId: state.snapshot.snapshotId,
      candidateId: candidate.id,
      role: selectedRole(),
      goal: byId('today-goal').value.trim(),
      skippedIds: state.skippedIds,
      consentToSave
    })
  });
  state.bootstrap.state = result.state;
  renderDecision(result.state.lastDecision, result.persisted);
  byId('last-decision').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function scan() {
  const projectPath = byId('project-path').value.trim();
  if (!projectPath) return setStatus('请先选择或粘贴项目绝对路径。', true);
  setStatus('正在只读扫描 BACKLOG.md 与历史来源…');
  try {
    const snapshot = await api('/api/projects/scan', { method: 'POST', body: JSON.stringify({ path: projectPath }) });
    state.snapshot = snapshot;
    state.skippedIds = [];
    renderSnapshot(snapshot);
    setStatus(`扫描完成：${snapshot.backlog.length} 个未决事项，${snapshot.commits.length} 条近期记录。`);
    await updateCandidates();
  } catch (error) {
    setStatus(error.message, true);
  }
}

byId('privacy-toggle').addEventListener('click', () => byId('privacy-copy').classList.toggle('hidden'));
byId('clear-local-state').addEventListener('click', async () => {
  const result = await api('/api/local-state', { method: 'DELETE' });
  state.bootstrap.state = result.state;
  byId('project-path').value = '';
  byId('today-goal').value = '';
  renderDecision(null);
  setStatus('工具自己的本地记录已清除；项目文件没有变化。');
});
byId('scan-project').addEventListener('click', scan);
byId('project-path').addEventListener('keydown', (event) => { if (event.key === 'Enter') scan(); });
byId('choose-folder').addEventListener('click', async () => {
  try {
    const result = await api('/api/folder-dialog', { method: 'POST', body: '{}' });
    if (result.path) { byId('project-path').value = result.path; await scan(); }
  } catch (error) { setStatus(`${error.message}；你仍可粘贴绝对路径。`, true); }
});
byId('update-candidates').addEventListener('click', updateCandidates);
byId('reset-skips').addEventListener('click', async () => {
  state.skippedIds = [];
  byId('reset-skips').classList.add('hidden');
  await updateCandidates();
});
byId('none-fit').addEventListener('click', () => {
  byId('today-goal').focus();
  setStatus('这些切入口不贴合今天。告诉我你想推进什么，再更新候选。');
});

(async () => {
  if (!token) return setStatus('启动链接缺少会话令牌，请从 start.cmd 重新打开。', true);
  try {
    state.bootstrap = await api('/api/bootstrap');
    byId('privacy-text').textContent = `只有你同意后，工具才会把项目路径、角色、今日目标与上次选择写入 ${state.bootstrap.dataDirectory}。`;
    byId('consent-location').textContent = `保存位置：${state.bootstrap.dataDirectory}`;
    const restored = state.bootstrap.state;
    renderDecision(restored.lastDecision, true);
    if (restored.lastProjectPath) byId('project-path').value = restored.lastProjectPath;
    if (restored.role) {
      const radio = document.querySelector(`input[name="role"][value="${restored.role}"]`);
      if (radio) radio.checked = true;
    }
    byId('today-goal').value = restored.todayGoal || '';
    if (state.bootstrap.stateWarning) setStatus(state.bootstrap.stateWarning, true);
  } catch (error) {
    setStatus(error.message, true);
  }
})();
