import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(kitRoot, rel), 'utf8');
}

describe('SigNoz local compose secrets', () => {
  const compose = read('pours/deployment/compose.yaml');
  const example = read('pours/deployment/.env.example');
  const gitignore = read('.gitignore');

  it('does not hardcode the metastore password in compose.yaml', () => {
    assert.match(compose, /POSTGRES_PASSWORD=\$\{SIGNOZ_POSTGRES_PASSWORD/);
    assert.match(
      compose,
      /SIGNOZ_SQLSTORE_POSTGRES_DSN=postgres:\/\/signoz:\$\{SIGNOZ_POSTGRES_PASSWORD\}@/
    );
    assert.doesNotMatch(compose, /POSTGRES_PASSWORD=signoz\b/);
    assert.doesNotMatch(compose, /postgres:\/\/signoz:signoz@/);
    assert.doesNotMatch(compose, /POSTGRES_PASSWORD=[^$\n#]/);
  });

  it('documents a local-only password in .env.example and keeps the file committable', () => {
    assert.match(example, /^SIGNOZ_POSTGRES_PASSWORD=$/m);
    assert.match(example, /openssl rand -hex 24/);
    assert.match(example, /local-only/i);
    assert.match(gitignore, /^\.env$/m);
    assert.match(gitignore, /^\.env\.\*$/m);
    assert.match(gitignore, /^!pours\/deployment\/\.env\.example$/m);
  });
});
