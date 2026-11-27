import fs from 'node:fs';
import path from 'node:path';

const SETUP_SKILL = `---
name: waykit-setup
description: Set up Waykit by calling wk. Preserves MCP servers Waykit did not write.
---
# Setup

Run \`wk init\` and \`wk mcp default\`.

This install preserves servers Waykit did not write. Do not pass \`--reset\` unless the operator asks to replace the server list.
`;

const RULE = `---
description: Waykit lives in the kit. Call wk.
alwaysApply: true
---
Standards and lifecycle agents live in ~/.agents. Call \`wk\`.
`;

function skillStub(name: string): string {
  return `---
name: ${name}
description: Generated from the kit. Call wk.
---
# ${name}

This skill is generated from the kit. Run \`wk\`. The plugin does not carry CLI behavior, evals, or MCP compose.
`;
}

export function generateCursorPlugin(kitRoot: string, outDir: string): void {
  fs.mkdirSync(path.join(outDir, 'skills', 'setup'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'rules'), { recursive: true });
  fs.mkdirSync(path.join(outDir, '.cursor-plugin'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'skills', 'setup', 'SKILL.md'), SETUP_SKILL, 'utf8');
  fs.writeFileSync(path.join(outDir, 'rules', 'waykit.mdc'), RULE, 'utf8');
  fs.writeFileSync(
    path.join(outDir, '.cursor-plugin', 'plugin.json'),
    JSON.stringify(
      {
        name: 'waykit',
        description: 'Generated from the kit. Call wk.',
        skills: './skills',
        rules: './rules'
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const skillsDir = path.join(kitRoot, 'skills');
  if (!fs.existsSync(skillsDir)) return;
  for (const name of fs.readdirSync(skillsDir)) {
    if (!fs.existsSync(path.join(skillsDir, name, 'SKILL.md'))) continue;
    const dest = path.join(outDir, 'skills', name);
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'SKILL.md'), skillStub(name), 'utf8');
  }
}
