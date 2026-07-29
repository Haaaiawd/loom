export function getIntentVerificationMethod(intent) {
  return intent?.verification_method || intent?._optional?.verification_method || null;
}

function normalize(command) {
  return String(command || '')
    .replace(/^\s*(?:run|exec)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePackageManager(command) {
  return ['npm', 'pnpm', 'bun', 'yarn'].reduce(
    (result, manager) => result.replace(new RegExp(`\\b${manager}\\b`, 'g'), '<PM>'),
    command,
  );
}

/** Whether a recorded reproduction command covers the Architect-declared method. */
export function commandCoversVerificationMethod(actualCommand, expectedMethod) {
  const actual = normalize(actualCommand);
  const expected = normalize(expectedMethod);
  if (!actual || !expected) return false;
  return expected.split('&&').every((part) => {
    const expectedPart = normalize(part);
    if (!expectedPart || actual.includes(expectedPart)) return true;
    const actualNorm = normalizePackageManager(actual);
    const expectedNorm = normalizePackageManager(expectedPart);
    if (actualNorm.includes(expectedNorm)) return true;
    return expectedPart.startsWith('node --test') && actualNorm.includes('<PM> test');
  });
}
