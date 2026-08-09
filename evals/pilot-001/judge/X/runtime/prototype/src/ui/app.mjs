import { parseProjectFiles } from '/core/input-parser.mjs';
import { generateRecommendations } from '/core/recommendation.mjs';

const token = document.querySelector('meta[name="launch-token"]').content;
const elements = Object.fromEntries(
  ['project-files', 'role', 'read-project', 'status', 'warnings', 'review', 'project-label', 'recent-changes', 'decide', 'candidates', 'shortfall', 'skip', 'outcome', 'outcome-title', 'outcome-copy', 'return-to-results', 'prior-choice']
    .map((id) => [id, document.getElementById(id)])
);
let bundle = null;
let recommendationSet = null;
let projectLabel = '';

function setStatus(state, message) {
  elements.status.dataset.state = state;
  elements.status.classList.toggle('error', state === 'input_error');
  elements.status.textContent = message;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function projectName(files) {
  const relative = files[0]?.webkitRelativePath;
  return relative?.split('/')[0] || 'Selected project';
}

function evidenceLocator(reference) {
  const item = [...bundle.backlog, ...bundle.recentChanges].find(({ id }) => id === reference);
  return item ? { file: item.locator.file, line: item.locator.line } : null;
}

function renderWarnings(warnings) {
  clear(elements.warnings);
  for (const warning of warnings) {
    const item = document.createElement('li');
    item.textContent = `${warning.source}, line ${warning.line}: ${warning.message}`;
    elements.warnings.append(item);
  }
}

function renderRecentChanges(changes) {
  clear(elements['recent-changes']);
  for (const change of changes) {
    const source = bundle.recentChanges.find(({ id }) => id === change.evidenceRef);
    const item = document.createElement('li');
    const locator = document.createElement('code');
    locator.textContent = `${source.hash} · GIT_LOG.txt:${source.locator.line}`;
    const summary = document.createElement('span');
    summary.textContent = change.summary;
    item.append(locator, summary);
    elements['recent-changes'].append(item);
  }
}

function paragraph(labelText, value, className = '') {
  const wrapper = document.createElement('div');
  const label = document.createElement('p');
  label.className = 'label';
  label.textContent = labelText;
  const copy = document.createElement('p');
  copy.className = className;
  copy.textContent = value;
  wrapper.append(label, copy);
  return wrapper;
}

function renderCandidates(set) {
  clear(elements.candidates);
  for (const candidate of set.candidates) {
    const card = document.createElement('article');
    card.className = 'candidate';
    const badge = document.createElement('span');
    badge.className = `badge ${candidate.actionType}`;
    badge.textContent = candidate.actionType === 'coordination' ? 'Coordinate' : candidate.actionType === 'clarification' ? 'Clarify' : 'Direct';
    const title = document.createElement('h3');
    title.textContent = candidate.title;
    const grid = document.createElement('div');
    grid.className = 'candidate-grid';
    const fact = candidate.reasons.find(({ classification }) => classification === 'source_fact');
    const inference = candidate.reasons.find(({ classification }) => classification === 'bounded_inference');
    const locator = evidenceLocator(candidate.anchorEvidenceRef);
    grid.append(
      paragraph('Source fact', fact?.text || 'No source fact available.'),
      paragraph('Possible impact / reasoning', inference?.text || 'No additional inference.'),
      paragraph('Evidence', `${locator.file}:${locator.line}`, 'locator'),
      paragraph('Unknown', candidate.unknowns.join(' '), 'unknown')
    );
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'primary';
    accept.textContent = 'Accept this action';
    accept.addEventListener('click', () => saveOutcome('accepted', candidate));
    card.append(badge, title, grid, accept);
    elements.candidates.append(card);
  }
  if (set.shortfall) {
    elements.shortfall.hidden = false;
    elements.shortfall.textContent = `Not enough distinct evidence for another candidate. ${set.shortfall.explanation}`;
  } else {
    elements.shortfall.hidden = true;
    elements.shortfall.textContent = '';
  }
}

function showReady() {
  recommendationSet = generateRecommendations(bundle, elements.role.value);
  elements.review.hidden = false;
  elements.decide.hidden = false;
  elements.outcome.hidden = true;
  elements['project-label'].textContent = projectLabel;
  renderRecentChanges(recommendationSet.recentChanges);
  renderCandidates(recommendationSet);
  setStatus(recommendationSet.shortfall ? 'shortfall' : 'ready', `${recommendationSet.candidates.length} supported candidate${recommendationSet.candidates.length === 1 ? '' : 's'} for ${elements.role.options[elements.role.selectedIndex].text}.`);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.headers ?? {}), 'X-Launch-Token': token }
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.message), { code: body.code });
  return body;
}

async function saveOutcome(outcome, candidate) {
  const state = {
    schemaVersion: 1,
    projectLabel,
    role: elements.role.value,
    outcome,
    recordedAt: new Date().toISOString()
  };
  if (candidate) {
    state.candidateSnapshot = {
      id: candidate.id,
      title: candidate.title,
      actionType: candidate.actionType,
      evidenceLocators: candidate.evidenceRefs.map(evidenceLocator).filter(Boolean)
    };
  }
  try {
    await api('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    elements.outcome.hidden = false;
    elements.decide.hidden = true;
    elements['outcome-title'].textContent = outcome === 'accepted' ? candidate.title : 'Skipped for now';
    elements['outcome-copy'].textContent = outcome === 'accepted'
      ? 'Your choice was saved locally as a return cue, not an assignment.'
      : 'No action was selected. This explicit skip was saved locally.';
    setStatus(outcome, outcome === 'accepted' ? 'Accepted choice saved.' : 'Skip saved.');
  } catch (error) {
    setStatus('input_error', `Could not save the choice: ${error.message}`);
  }
}

elements['read-project'].addEventListener('click', async () => {
  const files = [...elements['project-files'].files];
  if (!files.length) {
    setStatus('input_error', 'Choose a folder containing BACKLOG.md and GIT_LOG.txt.');
    return;
  }
  elements['read-project'].disabled = true;
  elements.review.hidden = true;
  elements.decide.hidden = true;
  elements.outcome.hidden = true;
  setStatus('reading', 'Reading local evidence…');
  try {
    projectLabel = projectName(files);
    const parsed = await parseProjectFiles(files);
    bundle = parsed.bundle;
    renderWarnings(parsed.warnings);
    showReady();
  } catch (error) {
    bundle = null;
    renderWarnings([]);
    setStatus('input_error', error.message);
  } finally {
    elements['read-project'].disabled = false;
  }
});

elements.role.addEventListener('change', () => {
  if (bundle) showReady();
});
elements['project-files'].addEventListener('change', () => {
  bundle = null;
  recommendationSet = null;
  elements.review.hidden = true;
  elements.decide.hidden = true;
  elements.outcome.hidden = true;
  renderWarnings([]);
  setStatus('idle', 'Folder changed. Read the project when ready.');
});
elements.skip.addEventListener('click', () => saveOutcome('skipped'));
elements['return-to-results'].addEventListener('click', () => {
  elements.outcome.hidden = true;
  elements.decide.hidden = false;
  setStatus('ready', 'Choose another supported action or skip.');
});

try {
  const { state, warning } = await api('/api/state');
  if (state) {
    elements['prior-choice'].hidden = false;
    elements['prior-choice'].textContent = state.outcome === 'accepted'
      ? `Prior choice: ${state.candidateSnapshot.title} (${state.role.replace('_', '/')}) · ${new Date(state.recordedAt).toLocaleString()}`
      : `Prior choice: skipped for ${state.projectLabel} · ${new Date(state.recordedAt).toLocaleString()}`;
    elements['prior-choice'].dataset.state = 'restored';
  } else if (warning) {
    elements['prior-choice'].hidden = false;
    elements['prior-choice'].textContent = warning.message;
  }
} catch (error) {
  setStatus('input_error', `Local state service unavailable: ${error.message}`);
}
