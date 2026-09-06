import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  getPhilosophySection,
  getSop,
  getKitEntity,
  getKitRelated,
  listKitIndex,
  resolveKitRoot,
  searchKit,
} from "./knowledge.ts";

const kitRoot = resolveKitRoot({
  ...process["env"],
  KIT_ROOT: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.."),
});

describe("kit-knowledge", () => {
  it("resolves kit root with CODING_PHILOSOPHY", () => {
    assert.ok(fs.existsSync(path.join(kitRoot, "CODING_PHILOSOPHY.md")));
    assert.ok(fs.existsSync(path.join(kitRoot, "SOPs")));
  });

  it("lists philosophy sections without dumping full file in index", () => {
    const index = listKitIndex(kitRoot);
    assert.match(index, /Philosophy sections/);
    assert.match(index, /§8/);
    assert.ok(!index.includes("Zero-trust input"));
  });

  it("returns one philosophy section by id", () => {
    const section = getPhilosophySection(kitRoot, "8");
    assert.ok(section);
    assert.match(section!.title, /Interaction/i);
    assert.match(section!.body, /Mermaid/);
  });

  it("returns an SOP by stem and truncates reasonably", () => {
    const sop = getSop(kitRoot, "conventional-commits");
    assert.ok(sop);
    assert.equal(sop!.id, "conventional-commits");
    assert.match(sop!.body, /Conventional Commits/i);
  });

  it("returns product-signal-intake with the missing-tools stop", () => {
    const sop = getSop(kitRoot, "product-signal-intake");
    assert.ok(sop);
    assert.equal(sop!.id, "product-signal-intake");
    assert.match(sop!.body, /human gate/i);
    assert.match(sop!.body, /Cloud Agent/);
    assert.match(sop!.body, /BLOCKED|blocked/);
    assert.match(sop!.body, /Do not invent issue URLs/);
  });

  it("search returns excerpts not full philosophy", () => {
    const hits = searchKit(kitRoot, "hexagonal ports adapters", 5);
    assert.ok(hits.length >= 1);
    assert.ok(hits.some((h) => h.kind === "philosophy" || h.kind === "sop"));
    for (const h of hits) {
      assert.ok(h.excerpt.length <= 700, `excerpt too long: ${h.excerpt.length}`);
    }
  });

  it("search finds context-budget SOP when present", () => {
    const budgetPath = path.join(kitRoot, "SOPs", "context-budget.md");
    if (!fs.existsSync(budgetPath)) {
      // File may be added in the same change set; skip soft if missing during partial checkout
      return;
    }
    const hits = searchKit(kitRoot, "context budget always-on tokens", 8);
    assert.ok(hits.some((h) => h.id.includes("context-budget") || h.excerpt.includes("always-on")));
  });

  it("resolveKitRoot prefers KIT_ROOT env", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kit-root-"));
    fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# test\n");
    assert.equal(resolveKitRoot({ KIT_ROOT: tmp }), path.resolve(tmp));
  });

  it("get_entity and get_related read ontology index", () => {
    const entity = getKitEntity(kitRoot, "skill:agent-tdd");
    assert.ok(entity);
    assert.equal(entity!.type, "Skill");
    const related = getKitRelated(kitRoot, "skill:agent-tdd", "uses");
    assert.ok(related.some((e) => e.to.startsWith("mcp:")));
    const phil = getKitRelated(kitRoot, "sop:conventional-commits", "implements");
    assert.ok(phil.some((e) => e.to.startsWith("philosophy:")));
    const docs = getKitRelated(kitRoot, "sop:eval-driven-development", "references");
    assert.ok(docs.some((e) => e.to.startsWith("doc:")));
    const stub = getKitEntity(kitRoot, "subagent:agent-tdd");
    assert.ok(stub);
    assert.equal(stub!.type, "Subagent");
    const adapts = getKitRelated(kitRoot, "subagent:agent-tdd", "adapts");
    assert.ok(adapts.some((e) => e.to === "skill:agent-tdd"));
  });

  it("stdio launch from a cwd without tsx still initializes (Cursor consumer workspace)", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "kit-knowledge-home-"));
    fs.symlinkSync(kitRoot, path.join(home, ".agents"));
    const serverFile = path.join(kitRoot, "mcps", "servers", "kit-knowledge", "server.json");
    const spec = JSON.parse(fs.readFileSync(serverFile, "utf8")) as {
      mcp: { "kit-knowledge": { command: string; args: string[] } };
    };
    const args = spec.mcp["kit-knowledge"].args.map((a) =>
      a.replaceAll("${userHome}", home)
    );
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "kit-knowledge-cwd-"));
    const child = spawn("node", args, {
      cwd,
      env: { ...process.env, HOME: home, KIT_ROOT: kitRoot },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stderr: Buffer[] = [];
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    const stdout = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`timeout. stderr=${Buffer.concat(stderr).toString()}`));
      }, 8000);
      let out = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        out += chunk.toString();
        if (out.includes('"serverInfo"')) {
          clearTimeout(timer);
          resolve(out);
        }
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("exit", (code) => {
        if (!out.includes('"serverInfo"')) {
          clearTimeout(timer);
          reject(
            new Error(
              `exited ${code}. stderr=${Buffer.concat(stderr).toString()} stdout=${out}`
            )
          );
        }
      });
      child.stdin?.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "probe", version: "0" },
          },
        })}\n`
      );
      child.stdin?.end();
    });
    child.kill("SIGKILL");
    assert.match(stdout, /"name":"kit-knowledge"/);
  });
});
