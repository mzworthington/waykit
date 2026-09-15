import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(kitRoot, rel), 'utf8');
}

describe('quality-loops Cloudflare RUM scout', () => {
  const sop = read('SOPs/quality-loops.md');
  const prompt = read('templates/quality-loops.md');
  const skill = read('skills/agent-cloudflare-ops/SKILL.md');
  const rumRow = sop.split('\n').find((line) => line.includes('Cloudflare RUM'));
  const rumPrompt = prompt.split('## File from a Cloudflare RUM break')[1]?.split('## ')[0] ?? '';

  it('files or updates one Bug on the owning-repo project with hostnames only and no PR', () => {
    assert.ok(rumRow, 'SOP must name Cloudflare RUM / beacon break');
    assert.match(rumRow, /Bug/);
    assert.match(rumRow, /owning repo/i);
    assert.match(rumRow, /Hostnames only/i);
    assert.match(rumRow, /never site tokens/i);
    assert.match(rumRow, /No PR/i);
    assert.match(rumPrompt, /Bug ticket on the owning-repo project/);
    assert.match(rumPrompt, /Hostnames only/);
    assert.match(rumPrompt, /never site tokens/);
    assert.match(rumPrompt, /Do not open a PR/);
    assert.match(skill, /owning-repo/);
    assert.match(skill, /no PR/);
    assert.match(skill, /Hostnames only/);
    assert.doesNotMatch(rumPrompt, /siteToken|site_token|cf-beacon token/i);
  });

  it('stops BLOCKED when Cloudflare tools are missing and invents no site tags, tokens, or Linear URLs', () => {
    assert.match(sop, /BLOCKED/);
    assert.match(sop, /site tags/);
    assert.match(sop, /Linear URLs/);
    assert.match(rumPrompt, /If Cloudflare tools are missing, stop BLOCKED/);
    assert.match(rumPrompt, /Do not invent site tags, tokens, or Linear URLs/);
    assert.match(skill, /BLOCKED/);
    assert.match(skill, /site tags/);
    assert.match(skill, /Linear URLs/);
    assert.doesNotMatch(skill, /invent siteToken/i);
  });

  it('comments on an open host-break fingerprint instead of cloning', () => {
    assert.match(sop, /source:<owning-repo>:rum:<hostname>/);
    assert.match(sop, /Comment on an open match/);
    assert.match(sop, /Do not clone/);
    assert.match(rumPrompt, /source:<owning-repo>:rum:<hostname>/);
    assert.match(rumPrompt, /fingerprints this host break/);
    assert.match(rumPrompt, /comment instead of cloning/);
    assert.match(skill, /source:<owning-repo>:rum:<hostname>/);
    assert.match(skill, /Comment on an open match/);
  });
});
