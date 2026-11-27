export interface ReviewFinding {
  claim: string;
  command?: string;
  output?: string;
}

export interface ReviewOverlay {
  review: string;
  reviewSecond?: string;
}

export interface ReviewClose {
  kept: ReviewFinding[];
  dropped: number;
  summary: string;
  models: string;
}

export function closeReview(findings: readonly ReviewFinding[], overlay: ReviewOverlay): ReviewClose {
  const kept = findings.filter((finding) => finding.command !== undefined && finding.output !== undefined);
  const dropped = findings.length - kept.length;
  const models = overlay.reviewSecond
    ? `second pass ${overlay.reviewSecond}`
    : `one model ${overlay.review}; a second model is not configured`;
  return {
    kept: [...kept],
    dropped,
    summary: `dropped ${dropped}`,
    models
  };
}
