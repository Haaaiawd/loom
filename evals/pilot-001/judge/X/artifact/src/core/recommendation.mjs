const ROLES = new Set(['producer_designer', 'programmer', 'artist']);

const profiles = {
  save: {
    match: /(?:save.{0,40}corrupt|corrupt.{0,40}save)/i,
    id: 'save-corruption',
    directRoles: ['programmer'],
    title: 'Investigate the reported save corruption after force-close',
    inference: 'If reproducible, this may risk player data loss; the source does not verify that outcome.',
    unknowns: ['The cause and reproduction steps are unknown.', 'The impact and severity are not verified.'],
    roleExplanation: 'Investigation of save behavior is plausibly actionable by the programmer role.',
    risk: true
  },
  camera: {
    match: /camera.{0,40}jitter|jitter.{0,40}camera/i,
    id: 'camera-jitter',
    directRoles: ['programmer'],
    title: 'Repair the boss-arena camera jitter at the north trigger',
    inference: 'The defect description provides a specific interaction to reproduce, but its cause is not established.',
    unknowns: ['The cause, affected builds, and reproduction consistency are unknown.'],
    roleExplanation: 'Camera behavior repair is plausibly actionable by the programmer role.'
  },
  tutorial: {
    match: /decide.{0,80}tutorial|tutorial.{0,80}(?:before|after)/i,
    id: 'tutorial-clarification',
    directRoles: ['producer_designer'],
    title: 'Clarify the intended tutorial order before implementation',
    inference: "The word 'Decide' indicates an unresolved design choice, so implementation details should not be assumed.",
    unknowns: ['The intended teaching order and decision-maker are unknown.'],
    clarify: true
  },
  ambience: {
    match: /ambience/i,
    id: 'archive-ambience',
    directRoles: ['artist'],
    title: 'Replace the flooded archive placeholder ambience',
    inference: 'Replacing a named placeholder is plausibly actionable as an art-content task, but the desired asset specification is absent.',
    unknowns: ['The desired ambience specification and acceptance criteria are unknown.'],
    roleExplanation: 'The item explicitly asks for placeholder ambience replacement and is directly relevant to the artist role.'
  },
  capsule: {
    match: /capsule\s+images?/i,
    id: 'capsule-images',
    directRoles: ['artist'],
    title: 'Prepare three capsule images for the internal playtest build',
    inference: 'Creating capsule images is plausibly actionable by the artist role; no delivery date is stated.',
    unknowns: ['Dimensions, visual brief, approval criteria, and build timing are unknown.'],
    roleExplanation: 'The requested image preparation is directly relevant to the artist role.'
  }
};

function profileFor(item) {
  return Object.values(profiles).find((profile) => profile.match.test(item.text));
}

function genericProfile(item, role) {
  const direct =
    (role === 'programmer' && /\b(?:fix|bug|code|script|camera|save|investigate)\b/i.test(item.text)) ||
    (role === 'artist' && /\b(?:art|image|ambience|lighting|visual|sprite|texture|animation)\b/i.test(item.text)) ||
    (role === 'producer_designer' && /\b(?:decide|tutorial|playtest|design|build)\b/i.test(item.text));
  if (!direct) return null;
  return {
    id: `item-${item.locator.line}`,
    directRoles: [role],
    title: item.text.replace(/[.]$/, ''),
    inference: `This item is plausibly actionable by the ${role.replace('_', '/')} role, but no ownership is stated.`,
    unknowns: ['Ownership, timing, and acceptance criteria are unknown.'],
    roleExplanation: `The wording is directly relevant to the selected ${role.replace('_', '/')} role.`
  };
}

function reason(item, classification, text) {
  return { classification, text, evidenceRefs: [item.id] };
}

function ordering(kind, explanation, item) {
  return { kind, explanation, evidenceRefs: [item.id] };
}

function directCandidate(item, role, profile) {
  const orderingReasons = [ordering('role_actionability', profile.roleExplanation, item)];
  if (profile.risk) {
    orderingReasons.push(
      ordering(
        'explicit_risk_or_blocker',
        'The backlog explicitly reports corruption after a force-close, so it precedes routine repair work.',
        item
      )
    );
  }
  return {
    id: `candidate:${role}-${profile.id}`,
    actionType: 'direct',
    title: profile.title,
    role,
    anchorEvidenceRef: item.id,
    evidenceRefs: [item.id],
    reasons: [reason(item, 'source_fact', item.text), reason(item, 'bounded_inference', profile.inference)],
    unknowns: profile.unknowns,
    orderingReasons
  };
}

function clarificationCandidate(item, role, profile) {
  return {
    id: `candidate:${role}-${profile.id}`,
    actionType: 'clarification',
    title: profile.title,
    role,
    anchorEvidenceRef: item.id,
    evidenceRefs: [item.id],
    reasons: [reason(item, 'source_fact', item.text), reason(item, 'bounded_inference', profile.inference)],
    unknowns: profile.unknowns,
    orderingReasons: [
      ordering('action_type', 'A labelled clarification follows the directly actionable items.', item)
    ]
  };
}

function coordinationCandidate(item, role) {
  return {
    id: `candidate:${role}-save-risk-coordination`,
    actionType: 'coordination',
    title: 'Confirm ownership and status of the save-corruption investigation',
    role,
    anchorEvidenceRef: item.id,
    evidenceRefs: [item.id],
    reasons: [
      reason(item, 'source_fact', item.text),
      reason(
        item,
        'bounded_inference',
        'This is not presented as artist-executable work, but the explicit corruption report supports checking that someone is investigating it.'
      )
    ],
    unknowns: ['The owner and current investigation status are unknown.', 'The impact and severity are not verified.'],
    orderingReasons: [
      ordering('action_type', 'A labelled cross-role coordination action follows the direct role candidates.', item),
      ordering(
        'explicit_risk_or_blocker',
        'The backlog explicitly reports corruption, making status confirmation defensible without assigning the specialist work to this role.',
        item
      )
    ]
  };
}

export function generateRecommendations(bundle, role) {
  if (!ROLES.has(role)) {
    const error = new Error('Select producer/designer, programmer, or artist before generating candidates.');
    error.code = 'invalid_role';
    throw error;
  }
  if (!bundle || bundle.schemaVersion !== 1 || !Array.isArray(bundle.backlog) || !Array.isArray(bundle.recentChanges)) {
    const error = new Error('Evidence bundle must conform to schemaVersion 1.');
    error.code = 'invalid_evidence_bundle';
    throw error;
  }

  const classified = bundle.backlog.map((item) => ({ item, profile: profileFor(item) })).map((entry) => ({
    ...entry,
    profile: entry.profile ?? genericProfile(entry.item, role)
  }));
  const direct = classified
    .filter(({ profile }) => profile?.directRoles.includes(role))
    .sort((a, b) => Number(Boolean(b.profile.risk)) - Number(Boolean(a.profile.risk)) || a.item.order - b.item.order)
    .map(({ item, profile }) => directCandidate(item, role, profile));

  const candidates = direct.slice(0, 3);
  const used = new Set(candidates.map((candidate) => candidate.anchorEvidenceRef));

  if (candidates.length < 3) {
    const risk = classified.find(({ item, profile }) => profile?.risk && !used.has(item.id));
    if (risk && role !== 'programmer') {
      candidates.push(coordinationCandidate(risk.item, role));
      used.add(risk.item.id);
    }
  }
  if (candidates.length < 3) {
    const unresolved = classified.find(
      ({ item, profile }) => profile?.clarify && !used.has(item.id)
    );
    if (unresolved) {
      candidates.push(clarificationCandidate(unresolved.item, role, unresolved.profile));
    }
  }

  const output = {
    schemaVersion: 1,
    role,
    recentChanges: bundle.recentChanges.map((change) => ({ evidenceRef: change.id, summary: change.message })),
    candidates
  };
  if (candidates.length < 3) {
    output.shortfall = {
      code: 'insufficient_distinct_evidence',
      missingCount: 3 - candidates.length,
      explanation: `Only ${candidates.length} distinct backlog anchor${candidates.length === 1 ? '' : 's'} support${candidates.length === 1 ? 's' : ''} this role; ${3 - candidates.length} slot${3 - candidates.length === 1 ? '' : 's'} remain empty rather than being padded.`
    };
  }
  return output;
}
