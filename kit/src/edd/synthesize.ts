import { EvalCaseSchema, type EvalCase } from './schema.js';
import { trimTrailingPunct } from '../shared/text_parse.js';

const PARAPHRASE_TRANSFORMS: Array<(prompt: string) => string> = [
  (p) => `Please ${uncapitalize(p)}`,
  (p) => `I need help with this: ${p}`,
  (p) => `${trimTrailingPunct(p)}. Thanks in advance.`,
  (p) => `Quick question - ${uncapitalize(p)}`,
  (p) => `Could you ${uncapitalize(stripLeadingCouldYou(p))}`
];

function uncapitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function stripLeadingCouldYou(s: string): string {
  return s.replace(/^(could you|can you|please)\s+/iu, '');
}

/**
 * Deterministic paraphrases that preserve expectations and seed tags,
 * adding `synthetic` and `requires-live` so scripted PR gates stay stable.
 */
export function synthesizeParaphrases(seed: EvalCase, count: number): EvalCase[] {
  if (count < 1) return [];
  const transforms = PARAPHRASE_TRANSFORMS;
  const out: EvalCase[] = [];
  for (let i = 0; i < count; i++) {
    const transform = transforms[i % transforms.length]!;
    const prompt = transform(seed.prompt);
    const tags = new Set([...(seed.tags ?? []), 'synthetic', 'requires-live']);
    const row: EvalCase = {
      ...seed,
      id: `${seed.id}-syn-${i + 1}`,
      prompt,
      tags: [...tags]
    };
    const parsed = EvalCaseSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(
        `Synthetic paraphrase failed schema for ${seed.id}: ${parsed.error.issues.map((x) => x.message).join('; ')}`
      );
    }
    out.push(parsed.data);
  }
  return out;
}

export function synthesizeDataset(seeds: EvalCase[], countPerSeed: number): EvalCase[] {
  return seeds.flatMap((seed) => synthesizeParaphrases(seed, countPerSeed));
}
