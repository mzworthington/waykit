import fs from 'fs';
import path from 'path';
import { KIT_SKILL_DIR_PREFIX } from './verify_skills_layout.js';
import { printCliOutcome } from '../cli/outcome.js';
import { splitYamlFrontmatter, yamlDashedList, yamlHasKey, yamlScalar } from '../shared/yaml_frontmatter.js';

interface SecurityViolation {
  file: string;
  line: number;
  category: 'PROMPT_INJECTION' | 'EXFILTRATION_RISK' | 'OBFUSCATED_EXEC' | 'HARDCODED_SECRET' | 'SUPPLY_CHAIN_UNPINNED' | 'FRONTMATTER_SCHEMA' | 'SYMLINK';
  rule: string;
  snippet: string;
}

const SCAN_DIRECTORIES: string[] = ['skills', 'kit', 'bin', 'SOPs', 'templates', 'mcps'];
const SKIP_DIRS = new Set(['.git', 'node_modules', '.pnpm-store', '.pnpm', '.husky']);
const SKIP_FILES = new Set(['scan_skill_security.ts']);

function hasPromptInjection(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes('ignore previous instructions') ||
    lower.includes('ignore all previous instructions') ||
    lower.includes('system prompt override') ||
    lower.includes('bypass safety') ||
    lower.includes('bypass all safety') ||
    lower.includes('ignore guardrails') ||
    lower.includes('jailbreak')
  );
}

function hasDotEnvLeak(line: string): boolean {
  let from = 0;
  while (from < line.length) {
    const at = line.indexOf('.env', from);
    if (at < 0) return false;
    const prev = at === 0 ? '' : line[at - 1]!;
    const prevLetter = (prev >= 'A' && prev <= 'Z') || (prev >= 'a' && prev <= 'z');
    const rest = line.slice(at + 4);
    if (rest.startsWith('.example')) {
      from = at + 4;
      continue;
    }
    const next = rest[0];
    const nextWord =
      next !== undefined &&
      ((next >= 'A' && next <= 'Z') ||
        (next >= 'a' && next <= 'z') ||
        (next >= '0' && next <= '9') ||
        next === '_');
    if (!prevLetter && !nextWord) return true;
    from = at + 4;
  }
  return false;
}

function hasExfilRisk(line: string): boolean {
  if (line.includes('~/.ssh') || line.includes('~/.aws') || line.includes('id_rsa')) return true;
  if (line.includes('AWS_SECRET_ACCESS_KEY') || line.includes('SLACK_TOKEN')) return true;
  if (hasDotEnvLeak(line)) return true;
  const lower = line.toLowerCase();
  return (
    (lower.includes('curl -x ') || lower.includes('curl -d ')) &&
    (lower.includes(' post http') || lower.includes(' put http'))
  );
}

function pipedToShell(line: string): boolean {
  const lower = line.toLowerCase();
  let search = 0;
  while (search < lower.length) {
    const pipe = lower.indexOf('|', search);
    if (pipe < 0) return false;
    let i = pipe + 1;
    while (i < lower.length && (lower[i] === ' ' || lower[i] === '\t')) i += 1;
    const rest = lower.slice(i);
    const shell =
      rest.startsWith('bash') || rest.startsWith('zsh') || rest === 'sh' || rest.startsWith('sh ') || rest.startsWith('sh\t');
    if (shell) {
      const left = lower.slice(0, pipe);
      if (left.includes('curl ') || left.includes('wget ')) return true;
    }
    search = pipe + 1;
  }
  return false;
}

function hasObfuscatedExec(line: string): boolean {
  const lower = line.toLowerCase();
  if (lower.includes('base64 -d |') || lower.includes('base64 -d|')) return true;
  if (lower.includes('nc -e')) return true;
  if (lower.includes('eval(') && lower.includes('buffer.from')) return true;
  if (lower.includes('sudo rm -rf')) return true;
  return pipedToShell(line);
}

function isAlnum(ch: string | undefined): boolean {
  if (!ch) return false;
  return (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}

function isAlnumUnderscore(ch: string | undefined): boolean {
  return isAlnum(ch) || ch === '_';
}

function countPrefixed(line: string, prefix: string, pred: (ch: string | undefined) => boolean): number {
  let from = 0;
  let max = 0;
  while (from < line.length) {
    const at = line.indexOf(prefix, from);
    if (at < 0) return max;
    let n = 0;
    let i = at + prefix.length;
    while (pred(line[i])) {
      n += 1;
      i += 1;
    }
    if (n > max) max = n;
    from = at + 1;
  }
  return max;
}

function hasPrivateKeyHeader(line: string): boolean {
  const begin = line.indexOf('-----BEGIN ');
  if (begin < 0) return false;
  return line.includes('PRIVATE KEY-----', begin);
}

function hasHardcodedSecret(line: string): boolean {
  if (countPrefixed(line, 'AKIA', (ch) => Boolean(ch && ((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z')))) === 16) {
    return true;
  }
  if (countPrefixed(line, 'ghp_', isAlnumUnderscore) === 36) return true;
  if (countPrefixed(line, 'github_pat_', isAlnumUnderscore) === 82) return true;
  if (hasPrivateKeyHeader(line)) return true;
  for (const prefix of ['xoxb-', 'xoxa-', 'xoxp-', 'xoxr-', 'xoxs-'] as const) {
    const n = countPrefixed(line, prefix, isAlnum);
    if (n >= 10 && n <= 48) return true;
  }
  return false;
}

const SECURITY_RULES = [
  {
    category: 'PROMPT_INJECTION' as const,
    rule: 'System prompt override or instruction ignore attempt',
    test: hasPromptInjection
  },
  {
    category: 'EXFILTRATION_RISK' as const,
    rule: 'Credential store access or exfiltration request',
    test: hasExfilRisk
  },
  {
    category: 'OBFUSCATED_EXEC' as const,
    rule: 'Hazardous shell execution, pipe to shell, or obfuscation',
    test: hasObfuscatedExec
  },
  {
    category: 'HARDCODED_SECRET' as const,
    rule: 'Hardcoded API key, private key header, or secret token',
    test: hasHardcodedSecret
  }
];

const ALLOWED_LOCK_ORGS = ['cloudflare', 'vercel-labs', 'mzworthington'];
const VALID_KINDS = ['role', 'profile'];
const VALID_PHASES = [
  'orchestration', 'spec', 'tdd', 'xfn', 'impl', 'audit', 'maintenance', 'debug', 'telemetry', 'quality', 'docs', 'release'
];
const SCANNABLE_EXTENSIONS = new Set(['.md', '.sh', '.json', '.ts', '.yml', '.yaml']);
const PIN_PATTERN = /^(latest|v?\d+(\.\d+)*(-[\w.-]+)?|[0-9a-f]{40}|refs\/(tags|heads)\/[\w./-]+)$/i;
const OFFICIAL_INSTALLER =
  /raw\.githubusercontent\.com\/mzworthington\/(?:waykit|agent-lifecycle-kit)\/[^/\s]+\/install\.sh/;

/** Documented `curl | sh` (or bash) for this repo only - still flag every other pipe-to-shell. */
export function isOfficialKitInstallerLine(line: string): boolean {
  return OFFICIAL_INSTALLER.test(line) && /\|\s*(bash|sh)\b/.test(line);
}

export interface ScanSkillSecurityResult {
  ok: boolean;
  errorCount: number;
  warningCount: number;
}

function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies: Record<string, number> = {};
  for (const char of str) {
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(frequencies)) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function scanFrontmatter(violations: SecurityViolation[], relPath: string, content: string): void {
  const split = splitYamlFrontmatter(content);
  if (!split) {
    violations.push({
      file: relPath,
      line: 1,
      category: 'FRONTMATTER_SCHEMA',
      rule: 'SKILL.md missing valid YAML frontmatter delimiters (---)',
      snippet: ''
    });
    return;
  }

  const yamlText = split.yaml;
  const name = yamlScalar(yamlText, 'name');
  const kind = yamlScalar(yamlText, 'kind');
  const phase = yamlScalar(yamlText, 'phase');
  const triggers = yamlDashedList(yamlText, 'triggers');

  if (!name) {
    violations.push({
      file: relPath,
      line: 1,
      category: 'FRONTMATTER_SCHEMA',
      rule: 'Frontmatter missing required field: name',
      snippet: ''
    });
  }

  if (!yamlHasKey(yamlText, 'description')) {
    violations.push({
      file: relPath,
      line: 1,
      category: 'FRONTMATTER_SCHEMA',
      rule: 'Frontmatter missing required field: description',
      snippet: ''
    });
  }

  if (kind) {
    if (!VALID_KINDS.includes(kind)) {
      violations.push({
        file: relPath,
        line: 1,
        category: 'FRONTMATTER_SCHEMA',
        rule: `Invalid frontmatter kind "${kind}". Allowed: [${VALID_KINDS.join(', ')}]`,
        snippet: kind
      });
    }

    if (kind === 'role' && phase) {
      if (!VALID_PHASES.includes(phase)) {
        violations.push({
          file: relPath,
          line: 1,
          category: 'FRONTMATTER_SCHEMA',
          rule: `Invalid role phase "${phase}". Allowed: [${VALID_PHASES.join(', ')}]`,
          snippet: phase
        });
      }
    }
  }

  if (!triggers) {
    violations.push({
      file: relPath,
      line: 1,
      category: 'FRONTMATTER_SCHEMA',
      rule: 'Frontmatter missing required non-empty triggers array',
      snippet: ''
    });
  }
}

function scanFile(violations: SecurityViolation[], filePath: string, relPath: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  if (relPath.endsWith('SKILL.md') && relPath.startsWith('skills/')) {
    scanFrontmatter(violations, relPath, content);
  }

  lines.forEach((line: string, index: number) => {
    SECURITY_RULES.forEach((rule) => {
      if (!rule.test(line)) return;
      if (rule.category === 'OBFUSCATED_EXEC' && isOfficialKitInstallerLine(line)) return;
      violations.push({
        file: relPath,
        line: index + 1,
        category: rule.category,
        rule: rule.rule,
        snippet: line.trim()
      });
    });

    const tokens = line.split(/[\s,;()\[\]{}'\"]+/);
    for (const token of tokens) {
      if (token.length > 32 && !token.startsWith('http://') && !token.startsWith('https://') && !token.includes('file://')) {
        const entropy = calculateEntropy(token);
        if (entropy > 4.95) {
          violations.push({
            file: relPath,
            line: index + 1,
            category: 'HARDCODED_SECRET',
            rule: `High Shannon entropy token detected (${entropy.toFixed(2)} bits/char)`,
            snippet: token.substring(0, 40) + '...'
          });
        }
      }
    }
  });
}

function isSymlink(entryPath: string): boolean {
  try {
    return fs.lstatSync(entryPath).isSymbolicLink();
  } catch {
    return false;
  }
}

function scanDirectory(violations: SecurityViolation[], repoDir: string, dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(repoDir, fullPath);

    if (isSymlink(fullPath)) {
      violations.push({
        file: relPath,
        line: 0,
        category: 'SYMLINK',
        rule: 'Symlink detected - not followed (potential traversal attack)',
        snippet: `-> ${fs.readlinkSync(fullPath)}`
      });
      continue;
    }

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (path.dirname(relPath) === 'skills' && !KIT_SKILL_DIR_PREFIX.test(entry.name)) continue;
      scanDirectory(violations, repoDir, fullPath);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name) || entry.name.endsWith('.test.ts')) continue;
      const ext = path.extname(entry.name);
      if (SCANNABLE_EXTENSIONS.has(ext)) {
        scanFile(violations, fullPath, relPath);
      }
    }
  }
}

function scanExternalLock(violations: SecurityViolation[], lockFilePath: string): void {
  if (!fs.existsSync(lockFilePath)) return;

  try {
    const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
    for (const skill of lockData.skills || []) {
      const repo = skill.repository || '';
      const org = repo.split('/')[0] || '';
      const pin = skill.pin || '';

      if (org && !ALLOWED_LOCK_ORGS.includes(org)) {
        violations.push({
          file: 'skills/external.lock.json',
          line: 1,
          category: 'SUPPLY_CHAIN_UNPINNED',
          rule: `External skill repository "${repo}" is from unapproved organization "${org}"`,
          snippet: JSON.stringify(skill)
        });
      }

      if (!pin) {
        violations.push({
          file: 'skills/external.lock.json',
          line: 1,
          category: 'SUPPLY_CHAIN_UNPINNED',
          rule: `External skill "${repo}" is missing required version pin (tag, latest, or commit SHA)`,
          snippet: JSON.stringify(skill)
        });
      } else if (!PIN_PATTERN.test(pin)) {
        violations.push({
          file: 'skills/external.lock.json',
          line: 1,
          category: 'SUPPLY_CHAIN_UNPINNED',
          rule: `External skill "${repo}" pin "${pin}" is invalid - expected version tag (e.g. v1.0.0), latest, or commit SHA`,
          snippet: JSON.stringify(skill)
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    violations.push({
      file: 'skills/external.lock.json',
      line: 1,
      category: 'SUPPLY_CHAIN_UNPINNED',
      rule: `Invalid external.lock.json syntax: ${message}`,
      snippet: ''
    });
  }
}

export function scanSkillSecurity(repoDir: string): ScanSkillSecurityResult {
  const violations: SecurityViolation[] = [];
  const lockFilePath = path.join(repoDir, 'skills', 'external.lock.json');

  console.log('=== Agent Skill Hardened Security & Supply Chain Audit ===');
  console.log('');

  for (const dir of SCAN_DIRECTORIES) {
    scanDirectory(violations, repoDir, path.join(repoDir, dir));
  }

  scanExternalLock(violations, lockFilePath);

  if (violations.length === 0) {
    printCliOutcome('ok', 'audit', 'no prompt injection, secrets, or unpinned lockfile issues');
    return { ok: true, errorCount: 0, warningCount: 0 };
  }

  const warnings = violations.filter(
    (v) => v.category === 'SUPPLY_CHAIN_UNPINNED' && v.rule.includes('is invalid')
  );
  const errors = violations.filter(
    (v) => !(v.category === 'SUPPLY_CHAIN_UNPINNED' && v.rule.includes('is invalid'))
  );

  if (warnings.length > 0) {
    console.warn(`⚠️  Supply Chain Warnings: ${warnings.length}\n`);
    warnings.forEach((v) => {
      console.warn(`  ⚠️  [${v.category}] ${v.file}:${v.line} - ${v.rule}`);
      if (v.snippet) {
        console.warn(`     Snippet: "${v.snippet.substring(0, 100)}"`);
      }
    });
    console.warn('');
  }

  if (errors.length > 0) {
    console.error(`🚨 Security Violations Found: ${errors.length}\n`);
    errors.forEach((v) => {
      console.error(`  ❌ [${v.category}] ${v.file}:${v.line} - ${v.rule}`);
      if (v.snippet) {
        console.error(`     Snippet: "${v.snippet.substring(0, 100)}"`);
      }
    });
    printCliOutcome('fail', 'audit', `${errors.length} violation(s)`);
    return { ok: false, errorCount: errors.length, warningCount: warnings.length };
  }

  printCliOutcome('warn', 'audit', `${warnings.length} advisory warning(s)`);
  return { ok: true, errorCount: 0, warningCount: warnings.length };
}
