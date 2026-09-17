import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = path.join(kitRoot, '.github/workflows/align-consumer.yml');
const alignDocs = path.join(kitRoot, 'docs/align.md');

describe('reusable consumer align workflow', () => {
  it('is a workflow_call job that installs the kit and runs report-only align', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /workflow_call/);
    assert.match(yml, /kit_ref/);
    assert.match(yml, /INSTALL_MCP:\s*['"]?0['"]?/);
    assert.match(yml, /wk align/);
    assert.doesNotMatch(yml, /wk align[^\n]*--write/);
    assert.doesNotMatch(yml, /wk align[^\n]*--mcp/);
    assert.doesNotMatch(yml, /wk doctor/);
    assert.doesNotMatch(yml, /wk check/);
    assert.doesNotMatch(yml, /KIT_EVAL_API_KEY/);
  });

  it('installs the kit outside the caller workspace so wk survives checkout cleanup', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /\$\{HOME\}\/\.local\/share\/waykit/);
    assert.doesNotMatch(yml, /rm -rf \$\{GITHUB_WORKSPACE\}\/\.waykit-src/);
  });

  it('documents the reusable workflow for product CI', () => {
    const docs = fs.readFileSync(alignDocs, 'utf8');
    assert.match(docs, /align-consumer\.yml/);
    assert.match(docs, /workflow_call|reusable/i);
    assert.match(docs, /gpio-build-monitor/);
    assert.match(docs, /archlens/);
    assert.match(docs, /steerco/);
    assert.match(docs, /react-cloudflare-template/);
    assert.match(docs, /edge-dns/);
  });
});
