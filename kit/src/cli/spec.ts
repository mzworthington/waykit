export type CompletionValueKind = 'mcp-profiles' | 'mcp-hosts' | 'repo-classes';

export interface KitFlagSpec {
  name: string;
  value?: CompletionValueKind;
}

export interface KitCommandNode {
  flags?: readonly KitFlagSpec[];
  subs?: Readonly<Record<string, KitCommandNode>>;
  positional?: CompletionValueKind;
}

const EVAL_AGENT_FLAGS: readonly KitFlagSpec[] = [
  { name: '--suite' },
  { name: '--model' },
  { name: '--tags' },
  { name: '--out' },
  { name: '--format' },
  { name: '--style' },
  { name: '--cli' },
  { name: '--cli-stdout' },
  { name: '--base-url' },
  { name: '--api-key' },
  { name: '--target' },
  { name: '--threshold-routing' },
  { name: '--from' },
  { name: '--github-summary' }
];

const HOST_FLAG: KitFlagSpec = { name: '--host', value: 'mcp-hosts' };

/** Verb tree for parse coverage tests and live tab-completion. */
export const KIT_COMMAND_TREE: Readonly<Record<string, KitCommandNode>> = {
  init: {
    flags: [
      { name: '--mcp', value: 'mcp-profiles' },
      HOST_FLAG,
      { name: '--hook' },
      { name: '--with-hook' },
      { name: '--skip-mcp' },
      { name: '--skip-ide' },
      { name: '--target' }
    ]
  },
  align: {
    flags: [
      { name: '--write' },
      { name: '--mcp' },
      { name: '--owned' },
      { name: '--scan' },
      { name: '--login' },
      { name: '--json' }
    ]
  },
  version: { flags: [{ name: '--check' }] },
  doctor: {
    flags: [
      { name: '--write' },
      { name: '--owned' },
      { name: '--scan' },
      { name: '--class', value: 'repo-classes' },
      { name: '--hook' },
      { name: '--login' },
      { name: '--json' }
    ]
  },
  mcp: {
    positional: 'mcp-profiles',
    flags: [{ name: '--install' }, { name: '--project' }, HOST_FLAG, { name: '-o' }],
    subs: {
      restore: {
        flags: [{ name: '--install' }, { name: '--project' }, HOST_FLAG, { name: '-o' }]
      }
    }
  },
  audit: {},
  scan: {},
  validate: {},
  eval: {
    subs: {
      run: { flags: EVAL_AGENT_FLAGS },
      watch: { flags: EVAL_AGENT_FLAGS },
      report: { flags: EVAL_AGENT_FLAGS },
      ci: { flags: EVAL_AGENT_FLAGS },
      shadow: {
        flags: [{ name: '--infile' }, { name: '--sample' }, { name: '--out' }, { name: '--seed' }]
      },
      dataset: {
        subs: {
          lint: { flags: [{ name: '--dataset' }] },
          dedupe: { flags: [{ name: '--dataset' }, { name: '--out' }] },
          synthesize: { flags: [{ name: '--dataset' }, { name: '--count' }, { name: '--out' }] },
          'from-trace': { flags: [{ name: '--trace' }, { name: '--out' }] }
        }
      },
      'miss-rate': {}
    }
  },
  'export-rules': { flags: [{ name: '--check' }] },
  metrics: {},
  verify: {},
  agents: {
    subs: {
      generate: {},
      install: {},
      status: { flags: [{ name: '--json' }] },
      'launch-prompt': {
        flags: [
          { name: '--skill' },
          { name: '--project' },
          { name: '--linear' },
          { name: '--handover' },
          { name: '--next' },
          { name: '--dod' }
        ]
      }
    }
  },
  subagents: { subs: { status: { flags: [{ name: '--json' }] } } },
  sync: {
    flags: [{ name: '--install' }, { name: '--update' }, { name: '--dry-run' }, { name: '--force' }]
  },
  'measure-context': {},
  'debug-board': {},
  'debug-ci': {},
  check: { flags: [{ name: '--json' }] },
  ontology: { subs: { generate: {}, check: {} } },
  memory: { subs: { lint: {} } },
  model: {
    subs: {
      resolve: {
        flags: [
          { name: '--skill' },
          { name: '--phase' },
          HOST_FLAG,
          { name: '--spec-complete' },
          { name: '--blocked' }
        ]
      }
    }
  },
  site: { subs: { assemble: { flags: [{ name: '--out' }] } } },
  'commit-msg': { flags: [{ name: '--message' }] },
  'tdd-guard': {
    subs: {
      hook: {},
      install: {},
      enable: {},
      disable: {}
    }
  },
  completion: {
    subs: {
      zsh: {},
      bash: {},
      install: { subs: { zsh: {}, bash: {} } }
    }
  },
  help: {}
};

export const KIT_TOP_LEVEL_COMMANDS = Object.keys(KIT_COMMAND_TREE);

export const KIT_NESTED_COMMANDS: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(KIT_COMMAND_TREE)
    .filter((entry): entry is [string, KitCommandNode & { subs: Readonly<Record<string, KitCommandNode>> }] =>
      entry[1].subs !== undefined
    )
    .map(([name, node]) => [name, Object.keys(node.subs)])
);
