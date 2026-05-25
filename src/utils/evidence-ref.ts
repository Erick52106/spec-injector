const WEAK_EVIDENCE_REFS = new Set([
  '',
  'n/a',
  'na',
  'none',
  'missing',
  'unknown',
  'pending',
  'fail',
  'failed',
  'done',
  'ok',
  'small',
  'trivial',
]);

export function isDurableEvidenceRef(value: unknown): boolean {
  const ref = String(value ?? '').trim();
  const normalized = ref.toLowerCase();
  if (WEAK_EVIDENCE_REFS.has(normalized)) return false;
  return /^https?:\/\//i.test(ref) || /^workflow-check:/i.test(ref) || /#issuecomment-\d+/i.test(ref);
}
