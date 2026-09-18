import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyCiLog } from './classify_ci_log.js';

describe('classifyCiLog', () => {
  it('treats ERR_PNPM_BROKEN_LOCKFILE duplicate keys as config-drift, not a registry flake', () => {
    const log = `
Run pnpm install --frozen-lockfile
[ERR_PNPM_BROKEN_LOCKFILE] The lockfile at "/home/runner/work/waykit/waykit/pnpm-lock.yaml" is broken: duplicated mapping key (3175:3)
##[error]Process completed with exit code 1
`;
    const result = classifyCiLog(log);
    assert.equal(result.class, 'config-drift');
    assert.match(result.reason, /duplicate mapping keys|Dependabot/i);
    assert.match(result.next, /Regenerate|lockfile/i);
    assert.doesNotMatch(result.next, /Retry the pnpm binary/i);
  });

  it('treats ERR_PNPM_NO_PKG_MANIFEST as config-drift even when a retry wrapper is present', () => {
    const log = `
Running pnpm install --no-runtime...
[ERR_PNPM_NO_PKG_MANIFEST] No package.json found in /home/runner/work/steerco/steerco
##[error]pnpm install exited with status 1
Wait before pnpm setup retry
sleep 8
`;
    const result = classifyCiLog(log);
    assert.equal(result.class, 'config-drift');
    assert.match(result.reason, /working-directory|nested|package\.json/i);
    assert.match(result.next, /Do not wrap this in a 504 retry/i);
  });

  it('classifies npm 504 on the pnpm binary download as flake', () => {
    const log = `
Downloading pnpm 11.20.0 from the npm registry
Could not download https://registry.npmjs.org/@pnpm/linux-x64/11.20.0: 504 Gateway Timeout
`;
    assert.equal(classifyCiLog(log).class, 'flake');
  });

  it('classifies missing CLI tools as tool-missing', () => {
    const log = 'ffmpeg: command not found';
    assert.equal(classifyCiLog(log).class, 'tool-missing');
  });

  it('classifies auth denials as auth', () => {
    const log = 'Error: Resource not accessible by integration (403)';
    assert.equal(classifyCiLog(log).class, 'auth');
  });

  it('classifies assertion failures as product-bug', () => {
    const log = `FAIL  src/pages/OrganisationPage.test.tsx
AssertionError: expected 'team_platform' to be 'team_storefront'`;
    assert.equal(classifyCiLog(log).class, 'product-bug');
  });

  it('classifies a stale Promote changelog push as config-drift', () => {
    const log = `
[main 0bc8421] chore(changelog): regenerate from conventional commits
 1 file changed, 1 insertion(+), 4 deletions(-)
To https://github.com/mzworthington/waykit
 ! [rejected]        HEAD -> main (non-fast-forward)
error: failed to push some refs to 'https://github.com/mzworthington/waykit'
hint: Updates were rejected because the tip of your current branch is behind
`;
    const result = classifyCiLog(log);
    assert.equal(result.class, 'config-drift');
    assert.match(result.reason, /changelog|Promote|main/i);
    assert.match(result.next, /retry once|Do not .*--force/i);
  });

  it('returns unknown when the log has no signal', () => {
    assert.equal(classifyCiLog('Process completed with exit code 1').class, 'unknown');
  });
});
