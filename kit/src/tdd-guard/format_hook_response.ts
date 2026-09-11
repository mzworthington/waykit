import type { HookHost } from './parse_hook_event.js';

export interface HookDecision {
  permission: 'allow' | 'deny';
  agentMessage?: string;
  userMessage?: string;
  additionalContext?: string;
  followupMessage?: string;
}

export function formatHookResponse(host: HookHost, eventName: string, decision: HookDecision): string {
  if (host === 'claude') {
    const claudeName = toClaudeEventName(eventName);
    if (decision.additionalContext && decision.permission === 'allow') {
      return JSON.stringify({
        hookSpecificOutput: {
          hookEventName: claudeName,
          additionalContext: decision.additionalContext
        }
      });
    }
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: claudeName,
        permissionDecision: decision.permission,
        permissionDecisionReason: decision.agentMessage ?? ''
      }
    });
  }
  const body: Record<string, string> = { permission: decision.permission };
  if (decision.agentMessage) body.agent_message = decision.agentMessage;
  if (decision.userMessage) body.user_message = decision.userMessage;
  if (decision.additionalContext) body.additional_context = decision.additionalContext;
  if (decision.followupMessage) body.followup_message = decision.followupMessage;
  return JSON.stringify(body);
}

function toClaudeEventName(eventName: string): string {
  if (eventName.startsWith('pre') || eventName.startsWith('Pre')) return 'PreToolUse';
  if (eventName.includes('Session') || eventName.includes('session')) return 'SessionStart';
  if (eventName.includes('Prompt') || eventName.includes('prompt')) return 'UserPromptSubmit';
  if (eventName === 'stop' || eventName === 'Stop' || eventName === 'subagentStop') return 'Stop';
  return eventName || 'PreToolUse';
}
