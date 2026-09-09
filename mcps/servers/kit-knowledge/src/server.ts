#!/usr/bin/env node
/**
 * kit-knowledge MCP - on-demand chunks from the agent lifecycle kit.
 * Stdio JSON-RPC (newline-delimited), no extra runtime deps beyond Node.
 */

import { createInterface } from "node:readline";
import {
  getHandover,
  getKitEntity,
  getKitRelated,
  getPhilosophySection,
  getSop,
  listKitIndex,
  resolveKitRoot,
  searchKit,
} from "./knowledge.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "kit-knowledge", version: "1.0.0" };

const TOOLS = [
  {
    name: "list_kit_index",
    description:
      "List philosophy section ids, SOP names, and skill names without loading full bodies. Prefer this before search.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "search_kit",
    description:
      "Search kit philosophy, SOPs, skill heads, and docs. Returns short excerpts - not full files.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keywords" },
        limit: {
          type: "number",
          description: "Max hits (default 8, max 20)",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_philosophy_section",
    description:
      "Return one CODING_PHILOSOPHY.md section by number (e.g. \"8\") or title substring.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: 'Section id or title, e.g. "8" or "Interaction Mandate"',
        },
      },
      required: ["section"],
      additionalProperties: false,
    },
  },
  {
    name: "get_sop",
    description:
      "Return one SOP by stem name (e.g. \"conventional-commits\", \"context-budget\"). Truncated if very long.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "SOP file stem without .md" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_handover",
    description:
      "Return a phase handover from ~/.agents/handover/<project>/ (latest, or named phase).",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project directory name" },
        phase: {
          type: "string",
          description: 'Optional phase, e.g. "spec" or "xfn"',
        },
      },
      required: ["project"],
      additionalProperties: false,
    },
  },
  {
    name: "get_entity",
    description:
      "Return one ontology entity by id (e.g. skill:agent-tdd, subagent:agent-tdd, sop:conventional-commits, philosophy:8, doc:edd).",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Ontology id with prefix, e.g. skill:agent-tdd",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_related",
    description:
      "Return ontology edges from an entity (optional relation filter: loads, uses, depends-on, implements, references, …).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Source ontology id" },
        relation: {
          type: "string",
          description: "Optional relation name filter",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
] as const;

function ok(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function fail(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function textContent(text: string) {
  return { content: [{ type: "text", text }] };
}

function callTool(
  name: string,
  args: Record<string, unknown>,
  kitRoot: string
): { content: { type: string; text: string }[]; isError?: boolean } {
  try {
    switch (name) {
      case "list_kit_index":
        return textContent(listKitIndex(kitRoot));
      case "search_kit": {
        const query = String(args.query ?? "");
        const limit = typeof args.limit === "number" ? args.limit : 8;
        const hits = searchKit(kitRoot, query, limit);
        if (hits.length === 0) {
          return textContent(`No hits for ${JSON.stringify(query)}. Try list_kit_index.`);
        }
        const body = hits
          .map(
            (h) =>
              `### ${h.kind}:${h.id} (score ${h.score})\npath: ${h.path}\n${h.excerpt}`
          )
          .join("\n\n");
        return textContent(body);
      }
      case "get_philosophy_section": {
        const section = String(args.section ?? "");
        const found = getPhilosophySection(kitRoot, section);
        if (!found) {
          return {
            ...textContent(
              `Section not found: ${section}. Use list_kit_index for ids.`
            ),
            isError: true,
          };
        }
        return textContent(found.body);
      }
      case "get_sop": {
        const sopName = String(args.name ?? "");
        const found = getSop(kitRoot, sopName);
        if (!found) {
          return {
            ...textContent(`SOP not found: ${sopName}`),
            isError: true,
          };
        }
        return textContent(`# ${found.id}\n\n${found.body}`);
      }
      case "get_handover": {
        const project = String(args.project ?? "");
        const phase =
          typeof args.phase === "string" ? args.phase : undefined;
        const found = getHandover(kitRoot, project, phase);
        if (!found) {
          return {
            ...textContent(
              `Handover not found for project=${project} phase=${phase ?? "latest"}`
            ),
            isError: true,
          };
        }
        return textContent(`path: ${found.path}\n\n${found.body}`);
      }
      case "get_entity": {
        const id = String(args.id ?? "");
        const found = getKitEntity(kitRoot, id);
        if (!found) {
          return {
            ...textContent(
              `Entity not found: ${id}. Run wk ontology generate if index is missing.`
            ),
            isError: true,
          };
        }
        return textContent(JSON.stringify(found, null, 2));
      }
      case "get_related": {
        const id = String(args.id ?? "");
        const relation =
          typeof args.relation === "string" ? args.relation : undefined;
        const related = getKitRelated(kitRoot, id, relation);
        if (related.length === 0) {
          return textContent(
            `No related entities for ${id}${relation ? ` via ${relation}` : ""}.`
          );
        }
        return textContent(JSON.stringify(related, null, 2));
      }
      default:
        return { ...textContent(`Unknown tool: ${name}`), isError: true };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...textContent(`Tool error: ${message}`), isError: true };
  }
}

function handle(
  msg: Record<string, unknown>,
  kitRoot: string
): Record<string, unknown> | null {
  const method = msg.method as string | undefined;
  const id = msg.id;
  const params = (msg.params ?? {}) as Record<string, unknown>;

  // Notifications have no id - acknowledge by silence
  if (id === undefined && method?.startsWith("notifications/")) {
    return null;
  }

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      return ok(id, callTool(name, args, kitRoot));
    }
    default:
      if (id === undefined) return null;
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

async function main() {
  const kitRoot = resolveKitRoot();
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      process.stderr.write("kit-knowledge: invalid JSON line\n");
      continue;
    }
    const response = handle(msg, kitRoot);
    if (response) {
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  }
}

main().catch((err) => {
  process.stderr.write(`wk -knowledge fatal: ${err}\n`);
  process.exit(1);
});
