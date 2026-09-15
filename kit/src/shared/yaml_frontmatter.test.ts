import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { splitYamlFrontmatter } from './yaml_frontmatter.js';

describe('splitYamlFrontmatter', () => {
  it('returns yaml between leading --- delimiters without a backtracking regex', () => {
    const split = splitYamlFrontmatter('---\nname: agent-tdd\ntriggers:\n  - tdd\n---\n# body\n');
    assert.deepEqual(split, {
      yaml: 'name: agent-tdd\ntriggers:\n  - tdd',
      body: '# body\n'
    });
  });
});
