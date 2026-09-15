import { resolveEvalRun } from './eval-style.js';
import { ProviderHttpError, withProviderRetry } from './provider-retry.js';
import type { AgentResponse, AgentToolCall, AgentUsage, EvalMock, HistoryTurn } from './schema.js';
import {
  LAUNCH_SPECIALIST_TOOL,
  launchArgsForPrompt,
  skillsOnlyContent
} from './scripted_subagent_routing.js';

export interface ToolContract {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface AgentClientOptions {
  model: string;
  /** OpenAI-compatible base URL (also used for Ollama). */
  baseUrl?: string;
  apiKey?: string;
  systemPrompt?: string;
  /** Max consecutive tool failures before requiring terminal fallback. */
  circuitBreakerThreshold?: number;
}

export type AgentDriver = (input: {
  model: string;
  systemPrompt: string;
  messages: HistoryTurn[];
  tools: ToolContract[];
  mocks: Map<string, EvalMock[]>;
}) => Promise<Omit<AgentResponse, 'consecutiveToolFailures' | 'haltedAutonomousExecution'> & {
  consecutiveToolFailures?: number;
  haltedAutonomousExecution?: boolean;
}>;

function emptyUsage(): AgentUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function normalizeArgs(args: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof args === 'string') {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return { _raw: args };
    }
  }
  return args;
}

function toolNames(tools: ToolContract[]): Set<string> {
  return new Set(tools.map((t) => t.name));
}

function scriptedNoTool(content: string, confidence = 0.92): Omit<
  Awaited<ReturnType<AgentDriver>>,
  never
> {
  return {
    content,
    tool_calls: [],
    usage: { promptTokens: 40, completionTokens: 35, totalTokens: 75 },
    consecutiveToolFailures: 0,
    haltedAutonomousExecution: false,
    routingConfidence: confidence
  };
}

/**
 * Keyword/scripted driver for local + CI harness self-tests without live LLM spend.
 * Real model drivers are selected when model !== "scripted".
 * Cases tagged `requires-live` must not rely on these heuristics.
 */
export const scriptedDriver: AgentDriver = async ({ messages, mocks, tools, systemPrompt }) => {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = (lastUser?.content ?? '').toLowerCase();
  const names = toolNames(tools);
  const hasKit =
    names.has('search_kit') ||
    names.has('get_sop') ||
    names.has('get_philosophy_section') ||
    names.has('get_handover') ||
    names.has('list_kit_index') ||
    names.has('get_entity') ||
    names.has('get_related');
  const hasArch = names.has('read_architecture_yaml');
  const hasLaunchSpecialist = names.has('launch_specialist');
  const hasModelClass = names.has('select_model_class');
  const hasMemoryOnly = names.has('create_entities') && !hasKit && !hasArch && !hasModelClass && !hasLaunchSpecialist;
  const skillsOnly = /skills-only mode/i.test(systemPrompt ?? '');

  if (hasLaunchSpecialist && !hasArch) {
    const launch = launchArgsForPrompt(prompt);
    if (skillsOnly) {
      return scriptedNoTool(skillsOnlyContent(launch?.specialist ?? null));
    }
    if (!launch) {
      if (prompt.includes('weather') || prompt.includes('brew coffee') || prompt.includes('make tea')) {
        return scriptedNoTool(
          'That is outside subagent routing. I can launch an allowlisted specialist if you describe the job.'
        );
      }
      if (prompt.includes('typo')) {
        return scriptedNoTool('Staying in the parent for a tiny typo.');
      }
      return scriptedNoTool('Stay in the parent unless the job matches the host-subagent allowlist.', 0.4);
    }
    return {
      content: `Launching ${launch.specialist} via the launch_specialist eval adapter (host Task in production).`,
      tool_calls: [{ name: LAUNCH_SPECIALIST_TOOL, arguments: { ...launch } }],
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      consecutiveToolFailures: 0,
      haltedAutonomousExecution: false,
      routingConfidence: 0.92
    };
  }

  if (hasModelClass && !hasArch) {
    if (
      prompt.includes('weather') ||
      prompt.includes('brew coffee') ||
      prompt.includes('make tea')
    ) {
      return scriptedNoTool('That is outside model routing. I can pick a capability class if you describe the job.');
    }
    if (prompt.includes('blocked') || prompt.includes('architectural fork')) {
      return {
        content: 'Escalating to plan after a blocked architectural fork.',
        tool_calls: [{ name: 'select_model_class', arguments: { class: 'plan' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.92
      };
    }
    if (
      prompt.includes('pre-commit') ||
      prompt.includes('prettier') ||
      prompt.includes('knip')
    ) {
      return {
        content: 'Selecting cheap for mechanical hook/format work.',
        tool_calls: [{ name: 'select_model_class', arguments: { class: 'cheap' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('owasp') ||
      prompt.includes('security audit') ||
      prompt.includes('arch-drift') ||
      prompt.includes('architecture drift') ||
      prompt.includes('pr review') ||
      prompt.includes('review the pr')
    ) {
      return {
        content: 'Selecting review for an adversarial audit.',
        tool_calls: [{ name: 'select_model_class', arguments: { class: 'review' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      (prompt.includes('spec handover is complete') || prompt.includes('spec is complete')) &&
      (prompt.includes('tdd') || prompt.includes('short loop'))
    ) {
      return {
        content: 'Selecting implement after a complete spec.',
        tool_calls: [{ name: 'select_model_class', arguments: { class: 'implement' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('grill') ||
      prompt.includes('decision frontier') ||
      prompt.includes('write the spec') ||
      prompt.includes('bounded context') ||
      prompt.includes('new feature')
    ) {
      return {
        content: 'Selecting plan for ambiguous or spec-stage work.',
        tool_calls: [{ name: 'select_model_class', arguments: { class: 'plan' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    return scriptedNoTool('I am not sure which model class to use. Describe planning, review, implementation, or mechanical work.', 0.4);
  }

  if (hasMemoryOnly) {
    if (
      prompt.includes('weather') ||
      prompt.includes('brew coffee') ||
      prompt.includes('make tea')
    ) {
      return scriptedNoTool('That is outside memory. I can store glossary terms or SLOs if you ask.');
    }
    if (prompt.includes('alientype') || prompt.includes('alien')) {
      return {
        content: 'Attempting to store the requested entity (server may reject unknown types).',
        tool_calls: [
          {
            name: 'create_entities',
            arguments: {
              entities: [
                { name: 'rogue', entityType: 'AlienType', observations: ['hello'] }
              ]
            }
          }
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    if (prompt.includes('glossary') || prompt.includes('edd') || prompt.includes('remember')) {
      return {
        content: 'Storing the glossary term via create_entities.',
        tool_calls: [
          {
            name: 'create_entities',
            arguments: {
              entities: [
                {
                  name: 'EDD',
                  entityType: 'GlossaryTerm',
                  observations: ['Eval-Driven Development']
                }
              ]
            }
          }
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    return scriptedNoTool('I am not sure what to store. Name a GlossaryTerm, Slo, Preference, or ProjectFact.', 0.4);
  }

  if (hasKit && !hasArch) {
    if (
      prompt.includes('weather') ||
      prompt.includes('brew coffee') ||
      prompt.includes('make tea') ||
      prompt.includes('sonnet')
    ) {
      return scriptedNoTool('That is outside the kit. I can search SOPs or philosophy if you ask about those.');
    }
    if (prompt.includes('subagent:agent-tdd') && (prompt.includes('adapt') || prompt.includes('adapts'))) {
      return {
        content: 'Looking up ontology adapts edges for subagent:agent-tdd.',
        tool_calls: [
          { name: 'get_related', arguments: { id: 'subagent:agent-tdd', relation: 'adapts' } }
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (prompt.includes('subagent:agent-tdd') && prompt.includes('look up')) {
      return {
        content: 'Fetching ontology entity subagent:agent-tdd.',
        tool_calls: [{ name: 'get_entity', arguments: { id: 'subagent:agent-tdd' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (prompt.includes('ontology entity') || (prompt.includes('skill:agent-tdd') && prompt.includes('look up'))) {
      return {
        content: 'Fetching ontology entity skill:agent-tdd.',
        tool_calls: [{ name: 'get_entity', arguments: { id: 'skill:agent-tdd' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('skill:agent-tdd') &&
      (prompt.includes('use') || prompt.includes('mcp'))
    ) {
      return {
        content: 'Looking up ontology uses edges for skill:agent-tdd.',
        tool_calls: [
          { name: 'get_related', arguments: { id: 'skill:agent-tdd', relation: 'uses' } }
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('sop:conventional-commits') &&
      prompt.includes('implement')
    ) {
      return {
        content: 'Looking up ontology implements edges for conventional-commits.',
        tool_calls: [
          {
            name: 'get_related',
            arguments: { id: 'sop:conventional-commits', relation: 'implements' }
          }
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('sop:eval-driven-development') &&
      prompt.includes('reference')
    ) {
      return {
        content: 'Looking up ontology references edges for the EDD SOP.',
        tool_calls: [
          {
            name: 'get_related',
            arguments: { id: 'sop:eval-driven-development', relation: 'references' }
          }
        ],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('quality-loops') ||
      prompt.includes('quality loop') ||
      prompt.includes('work picker') ||
      prompt.includes('scheduled scout')
    ) {
      return {
        content: 'Opening the quality-loops SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'quality-loops' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('sonarqube') ||
      prompt.includes('sonarcloud') ||
      prompt.includes('sonar finding')
    ) {
      return {
        content: 'Opening the sonarqube-findings SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'sonarqube-findings' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('hypothesis-driven debug') ||
      prompt.includes('hypothesis driven debug') ||
      prompt.includes('failed job') ||
      prompt.includes('github actions') ||
      prompt.includes('err_pnpm_no_pkg_manifest')
    ) {
      return {
        content: 'Opening the hypothesis-driven-debug SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'hypothesis-driven-debug' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('hypothesis-driven development') ||
      prompt.includes('hypothesis driven development')
    ) {
      return {
        content: 'Opening the hypothesis-driven-development SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'hypothesis-driven-development' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('linear ticket') ||
      prompt.includes('claiming a linear') ||
      prompt.includes('uncommitted on main')
    ) {
      return {
        content: 'Opening the linear-ticket-workflow SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'linear-ticket-workflow' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (prompt.includes('host subagent') || prompt.includes('launching a host')) {
      return {
        content: 'Opening the subagent-launch SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'subagent-launch' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (prompt.includes('conventional-commit') || prompt.includes('conventional commit')) {
      return {
        content: 'Opening the conventional-commits SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'conventional-commits' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (prompt.includes('philosophy') && (prompt.includes('diagram') || prompt.includes('mermaid') || prompt.includes('section'))) {
      return {
        content: 'Fetching the diagrams / Interaction Mandate philosophy section.',
        tool_calls: [{ name: 'get_philosophy_section', arguments: { section: '8' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    if (prompt.includes('hexagonal') || prompt.includes('search the kit') || prompt.includes('search kit')) {
      return {
        content: 'Searching the kit for hexagonal architecture.',
        tool_calls: [{ name: 'search_kit', arguments: { query: 'hexagonal architecture' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    if (prompt.includes('list') && (prompt.includes('sop') || prompt.includes('index') || prompt.includes('philosophy'))) {
      return {
        content: 'Listing kit index entries.',
        tool_calls: [{ name: 'list_kit_index', arguments: {} }],
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 70 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.88
      };
    }
    if (names.has('get_handover') && prompt.includes('handover')) {
      const phase = prompt.includes('xfn') ? 'xfn' : prompt.includes('spec') ? 'spec' : undefined;
      const arguments_: Record<string, unknown> = { project: 'canvas' };
      if (phase) arguments_.phase = phase;
      return {
        content: 'Opening the requested phase handover.',
        tool_calls: [{ name: 'get_handover', arguments: arguments_ }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    if (prompt.includes('model routing') || prompt.includes('model-routing')) {
      return {
        content: 'Opening the model-routing SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'model-routing' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (prompt.includes('cloudflare analytics') || prompt.includes('cloudflare-analytics')) {
      return {
        content: 'Opening the cloudflare-analytics-ops SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'cloudflare-analytics-ops' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    if (
      prompt.includes('product-signal-intake') ||
      prompt.includes('product signal intake') ||
      (prompt.includes('posthog') && prompt.includes('two-session'))
    ) {
      return {
        content: 'Opening the product-signal-intake SOP.',
        tool_calls: [{ name: 'get_sop', arguments: { name: 'product-signal-intake' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 85 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.91
      };
    }
    return scriptedNoTool('I am not sure which kit tool to use. Could you name an SOP or topic?', 0.4);
  }

  const hasCf =
    names.has('execute') ||
    names.has('query_worker_observability') ||
    (names.has('search') && names.has('execute'));

  if (hasCf && !hasArch) {
    const rumListCode =
      'async () => cloudflare.request({ method: "GET", path: `/accounts/${accountId}/rum/site_info/list` })';
    if (
      prompt.includes('weather') ||
      prompt.includes('brew coffee') ||
      prompt.includes('make tea')
    ) {
      return scriptedNoTool('That is outside Cloudflare ops. I can list RUM sites or Worker logs if you ask.');
    }
    if (
      names.has('search') &&
      (prompt.includes('endpoint') || prompt.includes('find the cloudflare api'))
    ) {
      return {
        content: 'Searching the Cloudflare API spec for RUM site_info.',
        tool_calls: [{ name: 'search', arguments: { code: 'rum site_info list' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    if (
      names.has('query_worker_observability') &&
      (prompt.includes('worker log') ||
        prompt.includes('observability') ||
        prompt.includes('insights beacon'))
    ) {
      return {
        content: 'Querying Workers Observability for the insights beacon worker.',
        tool_calls: [{ name: 'query_worker_observability', arguments: { view: 'events' } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    if (
      names.has('execute') &&
      (prompt.includes('rum') || prompt.includes('web analytics') || prompt.includes('site_info'))
    ) {
      return {
        content: 'Listing live Cloudflare Web Analytics / RUM sites.',
        tool_calls: [{ name: 'execute', arguments: { code: rumListCode } }],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false,
        routingConfidence: 0.9
      };
    }
    return scriptedNoTool('I am not sure which Cloudflare tool to use. Ask for RUM sites, the site_info endpoint, or Worker logs.', 0.4);
  }

  const priorToolError = [...messages]
    .reverse()
    .find((m) => m.role === 'tool' && (m.content ?? '').toLowerCase().includes('notfound'));

  if (
    prompt.includes('what does c4 stand for') ||
    prompt.includes('explain c4') ||
    (prompt.startsWith('what is') && !prompt.includes('architecture') && !prompt.includes('payment'))
  ) {
    return {
      content:
        'C4 is a model for describing software architecture (Context, Containers, Components, Code). I can pull a diagram if you name a service.',
      tool_calls: [],
      usage: { promptTokens: 40, completionTokens: 35, totalTokens: 75 },
      consecutiveToolFailures: 0,
      haltedAutonomousExecution: false,
      routingConfidence: 0.92
    };
  }

  if (priorToolError || prompt.includes('try that again') || prompt.includes('try again')) {
    const toolName = 'read_architecture_yaml';
    const call: AgentToolCall = {
      name: toolName,
      arguments: { componentId: 'payment-api' }
    };
    return {
      content: 'Retrying with componentId payment-api based on the NotFound hint.',
      tool_calls: [call],
      usage: { promptTokens: 80, completionTokens: 40, totalTokens: 120 },
      consecutiveToolFailures: 0,
      haltedAutonomousExecution: false,
      routingConfidence: 0.88
    };
  }

  const timeoutCount = messages.filter(
    (m) => m.role === 'tool' && /timeout|timed out|network/i.test(m.content ?? '')
  ).length;
  if (timeoutCount >= 2 || prompt.includes('keep retrying') || prompt.includes('circuit')) {
    return {
      content:
        'I hit repeated network timeouts calling the architecture tool and am stopping autonomous retries. Please check connectivity or try again later.',
      tool_calls: [],
      usage: { promptTokens: 60, completionTokens: 50, totalTokens: 110 },
      consecutiveToolFailures: timeoutCount || 2,
      haltedAutonomousExecution: true,
      routingConfidence: 0.95
    };
  }

  if (
    prompt.includes('architecture') ||
    prompt.includes('c4') ||
    prompt.includes('payment') ||
    prompt.includes('connects to') ||
    prompt.includes('pull up') ||
    prompt.includes('database for') ||
    prompt.includes('auth service')
  ) {
    const toolName = 'read_architecture_yaml';
    const mocksForTool = mocks.get(toolName) ?? [];
    const mock = mocksForTool[0];
    // One component per call - prefer auth-service when both are mentioned (schema-03)
    const componentId = prompt.includes('auth') ? 'auth-service' : 'payment-api';
    const args = { componentId };
    return {
      content: mock
        ? `Architecture for ${componentId} loaded successfully.`
        : 'Fetching architecture…',
      tool_calls: [{ name: toolName, arguments: args }],
      usage: { promptTokens: 55, completionTokens: 45, totalTokens: 100 },
      consecutiveToolFailures: 0,
      haltedAutonomousExecution: false,
      routingConfidence: 0.9
    };
  }

  return {
    content: 'I am not sure which tool to use. Could you clarify?',
    tool_calls: [],
    usage: emptyUsage(),
    consecutiveToolFailures: 0,
    haltedAutonomousExecution: false,
    routingConfidence: 0.4
  };
};

export async function openAICompatibleDriver(
  opts: Required<Pick<AgentClientOptions, 'model' | 'baseUrl' | 'apiKey'>> & {
    systemPrompt: string;
    messages: HistoryTurn[];
    tools: ToolContract[];
  }
): Promise<Omit<AgentResponse, 'consecutiveToolFailures' | 'haltedAutonomousExecution'>> {
  const tools = opts.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description ?? t.name,
      parameters: t.inputSchema ?? { type: 'object', properties: {} }
    }
  }));

  const messages = [
    { role: 'system', content: opts.systemPrompt },
    ...opts.messages.map((m) => {
      if (m.role === 'assistant' && m.tool_calls?.length) {
        return {
          role: 'assistant',
          content: m.content ?? null,
          tool_calls: m.tool_calls.map((tc, i) => ({
            id: `call_${i}`,
            type: 'function',
            function: {
              name: tc.name,
              arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments)
            }
          }))
        };
      }
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content ?? '', tool_call_id: 'call_0', name: m.name };
      }
      return { role: m.role, content: m.content ?? '' };
    })
  ];

  const data = (await withProviderRetry(async () => {
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        tools: tools.length ? tools : undefined,
        temperature: 0
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new ProviderHttpError('LLM', res.status, body);
    }

    return (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
  }));

  const message = data.choices?.[0]?.message;
  const tool_calls: AgentToolCall[] = (message?.tool_calls ?? [])
    .map((tc) => ({
      name: tc.function?.name ?? '',
      arguments: tc.function?.arguments ?? '{}'
    }))
    .filter((tc) => tc.name);

  const usage: AgentUsage = {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0
  };

  return {
    content: message?.content ?? '',
    tool_calls,
    usage,
    routingConfidence: tool_calls.length ? 0.7 : 0.5
  };
}

function defaultAgentDriver(input: { model: string; apiKey: string; baseUrl: string }): AgentDriver {
  if (resolveEvalRun({ model: input.model, apiKey: input.apiKey, baseUrl: input.baseUrl }).style === 'local') {
    return scriptedDriver;
  }
  return async (call) =>
    openAICompatibleDriver({
      model: call.model,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      systemPrompt: call.systemPrompt,
      messages: call.messages,
      tools: call.tools
    });
}

export class AgentClient {
  private model: string;
  private baseUrl: string;
  private apiKey: string;
  private systemPrompt: string;
  private circuitBreakerThreshold: number;
  private driver: AgentDriver;

  private messages: HistoryTurn[] = [];
  private mocks = new Map<string, EvalMock[]>();
  private tools = new Map<string, ToolContract>();
  private callCounts = new Map<string, number>();

  constructor(options: AgentClientOptions & { driver?: AgentDriver }) {
    this.model = options.model;
    this.baseUrl =
      options.baseUrl ??
      process.env.KIT_EVAL_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      'https://api.openai.com/v1';
    this.apiKey =
      options.apiKey ??
      process.env.KIT_EVAL_API_KEY ??
      process.env.OPENAI_API_KEY ??
      process.env.ANTHROPIC_API_KEY ??
      '';
    this.systemPrompt =
      options.systemPrompt ??
      'You are a kit agent. Prefer registered tools for architecture lookups. On repeated tool failures, stop retrying and report the constraint to the user.';
    this.circuitBreakerThreshold = options.circuitBreakerThreshold ?? 2;
    this.driver = options.driver ?? defaultAgentDriver({
      model: this.model,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl
    });
  }

  resetContext(): void {
    this.messages = [];
    this.mocks.clear();
    this.callCounts.clear();
  }

  registerTool(contract: ToolContract): void {
    this.tools.set(contract.name, contract);
  }

  registerMockTool(tool: string, response: unknown, extra?: Partial<EvalMock>): void {
    const list = this.mocks.get(tool) ?? [];
    list.push({ tool, response, ...extra });
    this.mocks.set(tool, list);
  }

  seedHistory(history: HistoryTurn[]): void {
    this.messages.push(...history);
  }

  getMockPayload(tool: string): unknown | undefined {
    const count = this.callCounts.get(tool) ?? 0;
    const list = this.mocks.get(tool) ?? [];
    const mock = list.find((m) => (m.after_calls ?? 0) <= count) ?? list[0];
    if (!mock) return undefined;
    if (mock.error) {
      return mock.error.body ?? { error: 'error', status: mock.error.status };
    }
    return mock.response;
  }

  async executePrompt(prompt: string): Promise<AgentResponse> {
    this.messages.push({ role: 'user', content: prompt });

    const raw = await this.driver({
      model: this.model,
      systemPrompt: this.systemPrompt,
      messages: this.messages,
      tools: [...this.tools.values()],
      mocks: this.mocks
    });

    // Apply mocked tool side-effects / failure counting for circuit-breaker metrics
    let consecutiveToolFailures = raw.consecutiveToolFailures ?? 0;
    let haltedAutonomousExecution = raw.haltedAutonomousExecution ?? false;

    if (raw.tool_calls.length) {
      for (const call of raw.tool_calls) {
        const n = (this.callCounts.get(call.name) ?? 0) + 1;
        this.callCounts.set(call.name, n);
        const mockList = this.mocks.get(call.name) ?? [];
        const mock = mockList.find((m) => (m.after_calls ?? 0) < n) ?? mockList[0];
        if (mock?.error) {
          consecutiveToolFailures += 1;
          this.messages.push({
            role: 'assistant',
            content: raw.content,
            tool_calls: [call]
          });
          this.messages.push({
            role: 'tool',
            name: call.name,
            content: JSON.stringify(mock.error.body ?? { error: 'error', status: mock.error.status })
          });
        } else if (mock) {
          consecutiveToolFailures = 0;
          this.messages.push({
            role: 'assistant',
            content: raw.content,
            tool_calls: [call]
          });
          this.messages.push({
            role: 'tool',
            name: call.name,
            content: JSON.stringify(mock.response)
          });
        }
      }
    } else {
      this.messages.push({ role: 'assistant', content: raw.content });
    }

    if (consecutiveToolFailures >= this.circuitBreakerThreshold && !raw.tool_calls.length) {
      haltedAutonomousExecution = true;
    }

    // Normalize argument strings for downstream schema_match
    const tool_calls = raw.tool_calls.map((tc) => ({
      name: tc.name,
      arguments:
        typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(normalizeArgs(tc.arguments))
    }));

    return {
      content: raw.content,
      tool_calls,
      usage: raw.usage,
      consecutiveToolFailures,
      haltedAutonomousExecution,
      routingConfidence: raw.routingConfidence
    };
  }
}
