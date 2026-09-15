export type VendorSource = 'dependabot' | 'codeql';

export type VendorSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'informational'
  | 'unknown';

export type VendorLoopInput =
  | { kind: 'dependabot-pr' }
  | {
      kind: 'alert';
      source: VendorSource;
      repo: string;
      alertNumber: number;
      severity: VendorSeverity;
      file?: string;
      line?: number;
      inScope?: boolean;
      noisy?: boolean;
      needsProductDecision?: boolean;
      existingVendorPr?: number;
    };

export type VendorLoopDecision =
  | { action: 'hygiene'; rewriteLockfile: false; autoMerge: false }
  | { action: 'update-pr'; pr: number; fingerprint: string; autoMerge: false }
  | { action: 'open-draft-pr'; fingerprint: string; autoMerge: false }
  | {
      action: 'comment';
      reason:
        | 'noisy'
        | 'informational'
        | 'product-decision'
        | 'unclear-location'
        | 'out-of-scope';
      churnCode: false;
    };

const FIX_SEVERITIES = new Set<VendorSeverity>(['critical', 'high']);

export function vendorAlertFingerprint(
  source: VendorSource,
  repo: string,
  alertNumber: number
): string {
  if (!Number.isInteger(alertNumber) || alertNumber <= 0) {
    throw new Error('alert number must be a positive integer');
  }
  return `${source}:${repo}:${alertNumber}`;
}

export function decideVendorLoop(input: VendorLoopInput): VendorLoopDecision {
  if (input.kind === 'dependabot-pr') {
    return { action: 'hygiene', rewriteLockfile: false, autoMerge: false };
  }

  const fingerprint = vendorAlertFingerprint(input.source, input.repo, input.alertNumber);

  if (input.noisy) {
    return { action: 'comment', reason: 'noisy', churnCode: false };
  }
  if (input.needsProductDecision) {
    return { action: 'comment', reason: 'product-decision', churnCode: false };
  }
  if (input.severity === 'informational' || !FIX_SEVERITIES.has(input.severity)) {
    return { action: 'comment', reason: 'informational', churnCode: false };
  }

  const hasLocation = Boolean(input.file) && typeof input.line === 'number' && input.line > 0;
  if (!hasLocation) {
    return { action: 'comment', reason: 'unclear-location', churnCode: false };
  }
  if (input.inScope === false) {
    return { action: 'comment', reason: 'out-of-scope', churnCode: false };
  }

  if (input.existingVendorPr) {
    return { action: 'update-pr', pr: input.existingVendorPr, fingerprint, autoMerge: false };
  }
  return { action: 'open-draft-pr', fingerprint, autoMerge: false };
}
