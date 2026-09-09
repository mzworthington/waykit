import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  EDD_CI_SUITES,
  resolveEddCiSuites,
  runKitCheck,
  type KitCheckDeps
} from './quality_gate.js';
import type { ContextBudgetResult } from './measure_context_budget.js';

const okBudget: ContextBudgetResult = {
  ok: true,
  alwaysOnChars: 10,
  targetChars: 8000,
  breakdown: {
    agents: 10,
    handshake: 0,
    cursorRules: 0,
    claude: 0,
    copilot: 0,
    gemini: 0,
    windsurf: 0,
    philosophy: 0,
    skillDescriptions: 0
  }
};

function passingDeps(overrides: KitCheckDeps = {}): KitCheckDeps {
  return {
    scan: () => ({ ok: true, errorCount: 0, warningCount: 0 }),
    validate: () => ({ ok: true, errors: 0, totalSuites: 0, totalTests: 0 }),
    verifyLayout: () => ({ ok: true, invalid: [] }),
    printLayout: () => undefined,
    verifyRoleBudget: () => ({ ok: true, budget: 150, violations: [], allowed: [] }),
    printRoleBudget: () => undefined,
    verifySubagents: () => ({
      ok: true,
      errors: [],
      catalog: null,
      runtimeFor: () => null
    }),
    printSubagents: () => undefined,
    verifyStubs: () => ({ ok: true, errors: [] }),
    printStubs: () => undefined,
    exportRules: () => true,
    evals: () => true,
    edd: async () => 0,
    budget: () => okBudget,
    printBudget: () => undefined,
    ontologyCheck: () => ({
      ok: true,
      missingEndpoints: [],
      unknownSkillMcp: [],
      unknownDependsOn: [],
      unknownSubagentSkill: [],
      messages: []
    }),
    eddSuites: () => [...EDD_CI_SUITES],
    ...overrides
  };
}

describe('EDD_CI_SUITES', () => {
  it('lists default kit suites including optional vendor ones', () => {
    assert.ok(EDD_CI_SUITES.includes('evals/edd/cloudflare_ops.yaml'));
    assert.ok(EDD_CI_SUITES.includes('evals/edd/kit_knowledge.yaml'));
    assert.ok(EDD_CI_SUITES.includes('evals/edd/model_routing.yaml'));
    assert.ok(EDD_CI_SUITES.includes('evals/edd/subagent_routing.yaml'));
    assert.ok(EDD_CI_SUITES.includes('evals/edd/subagent_routing_skills_only.yaml'));
    assert.ok(!EDD_CI_SUITES.some((s) => s.includes('/goldens/')));
  });
});

describe('resolveEddCiSuites', () => {
  it('skips suites missing on disk so forks can drop vendor evals', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-edd-suites-'));
    try {
      fs.mkdirSync(path.join(tmp, 'evals', 'edd'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'evals', 'edd', 'kit_knowledge.yaml'), 'name: x\n');
      fs.writeFileSync(path.join(tmp, 'evals', 'edd', 'safety.yaml'), 'name: y\n');
      const resolved = resolveEddCiSuites(tmp);
      assert.deepEqual(resolved, [
        'evals/edd/kit_knowledge.yaml',
        'evals/edd/safety.yaml'
      ]);
      assert.ok(!resolved.includes('evals/edd/cloudflare_ops.yaml'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('runKitCheck', () => {
  it('returns 0 when every step passes and runs resolved EDD suites', async () => {
    const suites: string[] = [];
    const code = await runKitCheck(
      '/kit',
      passingDeps({
        edd: async (opts) => {
          const suite = opts.args[opts.args.indexOf('--suite') + 1];
          if (suite) suites.push(suite);
          return 0;
        }
      })
    );
    assert.equal(code, 0);
    assert.deepEqual(suites, [...EDD_CI_SUITES]);
  });

  it('skips EDD when no suites resolve', async () => {
    let eddCalls = 0;
    const code = await runKitCheck(
      '/kit',
      passingDeps({
        eddSuites: () => [],
        edd: async () => {
          eddCalls += 1;
          return 0;
        }
      })
    );
    assert.equal(code, 0);
    assert.equal(eddCalls, 0);
  });

  it('stops at the first failing step', async () => {
    assert.equal(
      await runKitCheck('/kit', passingDeps({ scan: () => ({ ok: false, errorCount: 1, warningCount: 0 }) })),
      1
    );
    assert.equal(
      await runKitCheck('/kit', passingDeps({ validate: () => ({ ok: false, errors: 1, totalSuites: 1, totalTests: 0 }) })),
      1
    );
    assert.equal(
      await runKitCheck('/kit', passingDeps({ verifyLayout: () => ({ ok: false, invalid: ['cloudflare'] }) })),
      1
    );
    assert.equal(
      await runKitCheck(
        '/kit',
        passingDeps({
          verifyRoleBudget: () => ({
            ok: false,
            budget: 150,
            violations: [{ skill: 'agent-fat', lines: 200, budget: 150 }],
            allowed: []
          })
        })
      ),
      1
    );
    assert.equal(
      await runKitCheck(
        '/kit',
        passingDeps({
          verifySubagents: () => ({
            ok: false,
            errors: ['bad allowlist'],
            catalog: null,
            runtimeFor: () => null
          })
        })
      ),
      1
    );
    assert.equal(
      await runKitCheck(
        '/kit',
        passingDeps({
          verifyStubs: () => ({ ok: false, errors: ['stale stub'] })
        })
      ),
      1
    );
    assert.equal(
      await runKitCheck(
        '/kit',
        passingDeps({
          ontologyCheck: () => ({
            ok: false,
            missingEndpoints: [],
            unknownSkillMcp: [],
            unknownDependsOn: [],
            unknownSubagentSkill: [],
            messages: ['boom']
          })
        })
      ),
      1
    );
    assert.equal(await runKitCheck('/kit', passingDeps({ exportRules: () => false })), 1);
    assert.equal(await runKitCheck('/kit', passingDeps({ evals: () => false })), 1);
    assert.equal(await runKitCheck('/kit', passingDeps({ edd: async () => 1 })), 1);
    assert.equal(await runKitCheck('/kit', passingDeps({ budget: () => ({ ...okBudget, ok: false }) })), 1);
  });

  it('prints valid JSON and keeps exit 1 when a step fails with json on', async () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (msg?: unknown) => {
      lines.push(String(msg ?? ''));
    };
    try {
      const code = await runKitCheck(
        '/kit',
        passingDeps({
          scan: () => {
            console.log('=== Agent Skill Hardened Security & Supply Chain Audit ===');
            return { ok: false, errorCount: 1, warningCount: 0 };
          }
        }),
        { json: true }
      );
      assert.equal(code, 1);
      assert.equal(lines.length, 1);
      const report = JSON.parse(lines[0] ?? '') as { ok: boolean; command: string; findings: Array<{ id: string; status: string; path: string }> };
      assert.equal(report.ok, false);
      assert.equal(report.command, 'check');
      assert.equal(report.findings[0]?.id, 'audit');
      assert.equal(report.findings[0]?.status, 'fail');
      assert.equal(report.findings[0]?.path, '/kit');
      assert.doesNotMatch(lines[0] ?? '', /kit check/);
    } finally {
      console.log = orig;
    }
  });

  it('keeps the human header when json is omitted', async () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (msg?: unknown) => {
      lines.push(String(msg ?? ''));
    };
    try {
      const code = await runKitCheck('/kit', passingDeps({ eddSuites: () => [] }));
      assert.equal(code, 0);
      assert.match(lines.join('\n'), /wk check/);
    } finally {
      console.log = orig;
    }
  });
});
