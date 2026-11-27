import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  MCP_PROFILE_STAMP_REL,
  profileToRestore,
  readMcpProfileStamp,
  recordComposedProfile
} from './mcp_profile_stamp.js';

describe('mcp profile stamp', () => {
  it('records previous and current profile names without secrets', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-stamp-'));
    recordComposedProfile(dir, 'default');
    const afterOps = recordComposedProfile(dir, 'cloudflare-ops');
    assert.deepEqual(afterOps, { previous: 'default', current: 'cloudflare-ops' });
    const raw = fs.readFileSync(path.join(dir, MCP_PROFILE_STAMP_REL), 'utf8');
    assert.match(raw, /"previous": "default"/);
    assert.doesNotMatch(raw, /token|secret|KEY|https?:/i);
    assert.equal(MCP_PROFILE_STAMP_REL, '.wk-mcp-profile.stamp');
  });

  it('gitignores the stamp so a commit cannot pick up the sidecar', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-stamp-gi-'));
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n', 'utf8');
    recordComposedProfile(dir, 'cloudflare-ops');
    const ignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    assert.match(ignore, /^\.wk-mcp-profile\.stamp$/m);
    assert.doesNotMatch(ignore, /CLOUDFLARE|token|api[_-]?key/i);
  });

  it('records the server keys Waykit wrote beside the profile names', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-stamp-servers-'));
    const stamp = recordComposedProfile(dir, 'default', ['kit-knowledge', 'linear']);
    assert.deepEqual(stamp.servers, ['kit-knowledge', 'linear']);
    const again = readMcpProfileStamp(dir);
    assert.deepEqual(again?.servers, ['kit-knowledge', 'linear']);
    assert.equal(again?.current, 'default');
  });

  it('restores kit default when nothing was composed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-mcp-stamp-'));
    assert.equal(profileToRestore(dir), 'default');
    assert.equal(readMcpProfileStamp(dir), undefined);
  });
});
