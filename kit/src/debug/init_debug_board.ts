import fs from 'fs';
import path from 'path';
import { slugifyAscii } from '../shared/text_parse.js';

export function slugifyTitle(title: string): string {
  return slugifyAscii(title);
}

export function initBoard(templatePath: string, outPath: string, title: string, project: string, date: string): void {
  let text = fs.readFileSync(path.resolve(templatePath), 'utf8');
  text = text
    .replace(/<short title>/g, title)
    .replace(/<project-name>/g, project)
    .replace(/YYYY-MM-DD/g, date);

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outPath), text, 'utf8');
}

export function initHandover(handoverPath: string, project: string, date: string, boardPath: string): void {
  const content = `# Handover: debug

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | debug |
| **Status** | BLOCKED |
| **Project** | \`${project}\` |
| **Next agent** | \`agent-pre-commit\` |
| **Date** | ${date} |

## Summary

Debug in progress. Board: \`${boardPath}\`.

## Deliverables

- Debug board (intake)

## Open questions / blockers

- Reproduce not yet proven

## Context for next agent

- See debug board for hypotheses and proof gates
`;

  fs.mkdirSync(path.dirname(path.resolve(handoverPath)), { recursive: true });
  fs.writeFileSync(path.resolve(handoverPath), content, 'utf8');
}

export interface InitDebugBoardOptions {
  repoDir: string;
  project: string;
  title: string;
  now?: Date;
}

export interface InitDebugBoardResult {
  boardPath: string;
  handoverPath: string;
  createdHandover: boolean;
}

export function initDebugBoardSession(opts: InitDebugBoardOptions): InitDebugBoardResult {
  const title = opts.title || 'debug session';
  const now = opts.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const template = path.join(opts.repoDir, 'templates', 'debug-board.md');
  if (!fs.existsSync(template)) {
    throw new Error(`missing template at ${template}`);
  }

  const outDir = path.join(opts.repoDir, 'handover', opts.project);
  const boardPath = path.join(outDir, `debug-board-${date}-${slugifyTitle(title)}.md`);
  if (fs.existsSync(boardPath)) {
    throw new Error(`already exists: ${boardPath}`);
  }

  initBoard(template, boardPath, title, opts.project, date);

  const handoverPath = path.join(outDir, 'handover_debug.md');
  let createdHandover = false;
  if (!fs.existsSync(handoverPath)) {
    initHandover(handoverPath, opts.project, date, boardPath);
    createdHandover = true;
  }

  return { boardPath, handoverPath, createdHandover };
}
