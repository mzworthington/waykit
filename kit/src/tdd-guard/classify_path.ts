export type PathKind = 'test' | 'production' | 'exempt';

const TEST_DIR = /(?:^|\/)(?:__tests__|tests?)\//i;
const TEST_FILE = /(?:\.test|\.spec|_test)(?:\.[^.]+)?$/i;
const PY_TEST_FILE = /(?:^|\/)test_[^/]+$/i;
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|cs|php|rb|swift)$/i;
const EXEMPT_DIR = /(?:^|\/)(?:docs|SOPs|skills|templates|handover|lessons|evals|ontology|mcps|agents)\//i;
const EXEMPT_FILE = /\.(md|mdx|css|scss|html|svg|json|ya?ml|toml|lock|txt)$/i;

export function classifyPath(filePath: string): PathKind {
  const normalized = filePath.replaceAll('\\', '/');
  if (TEST_DIR.test(normalized) || TEST_FILE.test(normalized) || PY_TEST_FILE.test(normalized)) {
    return 'test';
  }
  if (EXEMPT_DIR.test(normalized) || EXEMPT_FILE.test(normalized)) return 'exempt';
  if (SOURCE_EXT.test(normalized)) return 'production';
  return 'exempt';
}

const CASE_RE =
  /\b(?:it|test|specify)\s*\(|\bdef\s+test_[A-Za-z0-9_]+\s*\(|\bfunc\s+Test[A-Za-z0-9_]+\s*\(/g;

export function countTestCases(source: string): number {
  return source.match(CASE_RE)?.length ?? 0;
}
