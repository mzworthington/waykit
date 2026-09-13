import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { yamlMappingErrors } from './pnpm_lock.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('yamlMappingErrors', () => {
  it('reports duplicated mapping keys that break pnpm install', () => {
    const yaml = `packages:
  foo@1.0.0:
    resolution: {integrity: sha512-aaa}
  foo@1.0.0:
    resolution: {integrity: sha512-bbb}
`;
    const errors = yamlMappingErrors(yaml);
    assert.ok(errors.length > 0);
    assert.match(errors.join('\n'), /unique/i);
  });

  it('accepts unique keys', () => {
    const yaml = `packages:
  foo@1.0.0:
    resolution: {integrity: sha512-aaa}
  bar@1.0.0:
    resolution: {integrity: sha512-bbb}
`;
    assert.deepEqual(yamlMappingErrors(yaml), []);
  });

  it('rejects duplicate keys in the committed pnpm-lock.yaml', () => {
    const text = fs.readFileSync(path.join(kitRoot, 'pnpm-lock.yaml'), 'utf8');
    assert.deepEqual(yamlMappingErrors(text), []);
  });
});

describe('web react pins', () => {
  it('keeps react and react-dom on the same version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(kitRoot, 'web', 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    assert.equal(pkg.dependencies.react, pkg.dependencies['react-dom']);
  });
});
