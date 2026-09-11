import pc from 'picocolors';
import { formatCliBanner } from './cliBanner.js';
import { CLI_BIN } from './name.js';
import { formatUnknownCommand } from './suggest.js';

export const KIT_HELP_TOPICS = [
  'overview',
  'init',
  'align',
  'doctor',
  'mcp',
  'check',
  'eval',
  'agents',
  'tdd-guard'
] as const;

export type KitHelpTopic = (typeof KIT_HELP_TOPICS)[number];

export function isKitHelpTopic(value: string | undefined): value is KitHelpTopic {
  return value !== undefined && (KIT_HELP_TOPICS as readonly string[]).includes(value);
}

/** Catalog body used by overview help and completion coverage tests. */
export const KIT_HELP = `
Waykit CLI (${CLI_BIN})

Usage: ${CLI_BIN} <command> [options]

  Run with no arguments in a terminal for the guided menu.
  Use ${CLI_BIN} help <command> for one topic (init, mcp, eval, agents, …).

Day-to-day:
  Typo, bug, or failed CI   agent-debug (light XFN if UI/auth/SLO). Not grill → spec.
  Product feature           Full lifecycle in AGENTS.md
  Handshake / hygiene       ${CLI_BIN} align .    /  ${CLI_BIN} doctor
  Merge bar                 ${CLI_BIN} check

Commands:
  init [dir]           Bootstrap AGENTS.md, host rules, MCP configs, and git hooks
  doctor [dir]         Check community files on repos you admin (report only; --write fills gaps; --json)
  align [dir]          Check consumer handshake, host pointers, kit MCP, and commit-msg (report; --write seeds; --mcp composes kit default; --owned --scan fleet; --json)
  version              Print kit version, git describe, and whether ~/.agents is this clone (--check warns if origin is weeks ahead)
  mcp <profile>        Compose a named MCP profile from mcps/profiles/ for Cursor, Claude, Copilot, and Antigravity
  mcp restore          Recompose the previous project profile (or kit default if none)
  audit                Run security & supply chain audit across skills and scripts
  scan                 Alias of audit
  validate             Validate evals structure against JSON schemas
  eval                 Run skill-trigger evals, or EDD subcommands (run|watch|report|ci|shadow|dataset|miss-rate)
  export-rules [dir]   Sync AGENTS.md into Cursor, Claude, Copilot, Gemini/Antigravity, and Windsurf pointers
  metrics              Display telemetry analytics summary for subagent phase handovers
  verify               Verify skills layout, role SKILL.md line budget, subagent allowlist, and thin agent stubs
  agents generate      Write thin Cursor/Claude agent stubs under agents/ from skills/subagents.yaml
  agents install       Copy those stubs into ~/.cursor/agents and ~/.claude/agents (user scope; not the app repo)
  agents status        Print launch vs skills-only, miss-rate freeze, and expand-kill
  agents launch-prompt Print the parent Task prompt for an allowlisted specialist
  subagents status     Alias of agents status
  sync                 Sync official external skills (Cloudflare, Vercel); also refreshes user kit subagent stubs
  measure-context      Report always-on context budget
  debug-board <proj>   Scaffold a hypothesis-driven debug board
  debug-ci             Fetch failed GitHub Actions logs
  check                Run the local quality gate (audit, ontology, evals, EDD CI, context budget; --json)
  ontology generate    Dump derived ontology index to gitignored sync/ and web/public/assets/
  ontology check       Validate live-derived index (skill mcp/depends-on/subagent refs)
  memory lint          List legacy memory entities outside the ontology allowlist
  model resolve        Resolve capability class + host slug (models/catalog.yaml)
  site assemble        Copy web/dist plus public Markdown into site/ (needs web build first; optional --out)
  commit-msg           Check a commit subject or PR title (conventional commits)
  tdd-guard            Host TDD hooks (stdin JSON); install|enable|disable
  completion <shell>   Print a live tab-completion stub (zsh or bash)
  completion install   Write the stub once; verbs stay in sync with this wk
  help                 Display this help menu

Outcomes:
  Report commands print a first line of ok / warn / fail (aligned columns).
  On a TTY, ok is green, warn is orange, fail is red. NO_COLOR (or a pipe) stays plain.
  Exit 1 only on fail. warn is visible and still exit 0 (e.g. miss-rate not-enough).

Examples:
  ${CLI_BIN} init ./my-app --mcp collab --hook
  ${CLI_BIN} doctor --owned --scan ~/Documents/dev
  ${CLI_BIN} doctor . --write --hook
  ${CLI_BIN} align .
  ${CLI_BIN} align . --write
  ${CLI_BIN} align . --write --mcp
  ${CLI_BIN} align . --json
  ${CLI_BIN} align --owned --scan ~/Documents/dev
  ${CLI_BIN} version
  ${CLI_BIN} version --check
  ${CLI_BIN} mcp ops --install
  ${CLI_BIN} mcp default --install --host claude
  ${CLI_BIN} mcp default --project
  ${CLI_BIN} mcp restore --project
  ${CLI_BIN} mcp astro --install
  ${CLI_BIN} mcp cloudflare-ops --install
  ${CLI_BIN} mcp warp --install
  ${CLI_BIN} mcp posthog --install
  ${CLI_BIN} audit
  ${CLI_BIN} eval
  ${CLI_BIN} eval run --suite evals/edd/architecture_routing.yaml --model scripted
  ${CLI_BIN} eval ci --threshold-routing 95 --out out/reports
  ${CLI_BIN} eval miss-rate
  ${CLI_BIN} ontology generate
  ${CLI_BIN} agents generate
  ${CLI_BIN} agents install
  ${CLI_BIN} agents status
  ${CLI_BIN} agents launch-prompt --skill agent-tdd --project demo
  ${CLI_BIN} ontology check
  ${CLI_BIN} memory lint
  ${CLI_BIN} model resolve --skill agent-tdd --spec-complete --host cursor
  ${CLI_BIN} model resolve --skill agent-tdd --spec-complete --host claude
  ${CLI_BIN} site assemble
  ${CLI_BIN} export-rules
  ${CLI_BIN} metrics
  ${CLI_BIN} sync --install
  ${CLI_BIN} debug-board archlens "initial load overlap"
  ${CLI_BIN} completion install
  ${CLI_BIN} check
  ${CLI_BIN} check --json
`;

function topicHelp(topic: KitHelpTopic): string {
  switch (topic) {
    case 'init':
      return `
${CLI_BIN} init [dir]

  Write the thin handshake, host pointers, MCP profile, and optional git hooks.

  --mcp <profile>   Profile from mcps/profiles/ (default: default)
  --host <ids>      cursor, claude, copilot, antigravity, or all
  --hook            Install pre-commit and commit-msg on repos you admin
  --skip-mcp        Skip MCP compose
  --skip-ide        Skip host pointer files

  TTY with no args: ${CLI_BIN} opens a menu. This command stays scriptable.
`;
    case 'align':
      return `
${CLI_BIN} align [dir]

  Report consumer handshake, host pointers, kit MCP, and commit-msg.

  --write           Seed missing files (never overwrite)
  --mcp             Compose kit default into project MCP files
  --owned --scan    Fleet mode over worktrees you admin
  --json            Machine-readable findings
`;
    case 'doctor':
      return `
${CLI_BIN} doctor [dir]

  Community files on GitHub sources you admin. Report only unless --write.

  --write --hook    Fill gaps; install hooks on owned repos only
  --owned --scan    Match local worktrees to gh repo list --source
  --class           kit | product | dns | site | template
  --json            Machine-readable findings
`;
    case 'mcp':
      return `
${CLI_BIN} mcp [profile|restore]

  One MCP profile per session. Do not stack collab + ops globally.

  --install         Write user-scope host files
  --project         Write this checkout's host files
  --host            cursor, claude, copilot, antigravity, or all
  -o <file>         Print composed JSON to a file

  ${CLI_BIN} mcp restore --project
`;
    case 'check':
      return `
${CLI_BIN} check

  Local merge bar: audit, ontology, evals, EDD CI, context budget.

  --json            Findings on stdout
`;
    case 'eval':
      return `
${CLI_BIN} eval [run|watch|report|ci|shadow|dataset|miss-rate]

  Skill-trigger evals, or EDD subcommands (alpha).

  ${CLI_BIN} eval
  ${CLI_BIN} eval run --suite evals/edd/architecture_routing.yaml --model scripted
  ${CLI_BIN} eval ci --threshold-routing 95 --out out/reports
`;
    case 'agents':
      return `
${CLI_BIN} agents generate|install|status|launch-prompt

  Thin host stubs and launch vs skills-only.

  ${CLI_BIN} agents status
  ${CLI_BIN} agents launch-prompt --skill agent-tdd --project demo
  ${CLI_BIN} subagents status   (alias)
`;
    case 'tdd-guard':
      return `
${CLI_BIN} tdd-guard [hook|install|enable|disable] [dir]

  Mechanical red-before-green gate for Cursor and Claude Code, inspired by TDD Guard.

  (no args / hook)  Read hook JSON on stdin and allow or deny the tool
  install           Write .cursor/hooks.json and .claude/settings.json
  disable|enable    Session toggle (also WAYKIT_TDD_GUARD=0)

  Claude users may still install the upstream plugin for LLM validation:
  https://github.com/nizos/tdd-guard
`;
    default:
      return KIT_HELP;
  }
}

export function printKitHelp(
  log: (msg: string) => void = console.log,
  topic: KitHelpTopic = 'overview'
): void {
  if (topic === 'overview') {
    log(formatCliBanner());
    log(
      `${pc.cyan('  ◇')}  ${pc.dim('TTY:')} ${pc.white(CLI_BIN)} ${pc.dim('opens the menu · scripts keep the same verbs')}`
    );
    log(KIT_HELP);
    return;
  }
  log('');
  log(`${pc.bold(pc.cyan('◆'))} ${pc.bold('WAYKIT')} ${pc.dim('-')} ${pc.dim(topic)}`);
  log(topicHelp(topic));
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function stackMessage(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}

export { formatUnknownCommand };
