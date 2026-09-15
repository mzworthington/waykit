/** Split leading YAML frontmatter without a backtracking `[\s\S]*?` regex. */
export function splitYamlFrontmatter(content: string): { yaml: string; body: string } | null {
  if (!content.startsWith('---')) return null;
  let i = 3;
  while (i < content.length && (content[i] === ' ' || content[i] === '\t')) i += 1;
  if (content.startsWith('\r\n', i)) i += 2;
  else if (content[i] === '\n') i += 1;
  else return null;
  const close = content.indexOf('\n---', i);
  if (close < 0) return null;
  const yaml = content.slice(i, close);
  let bodyStart = close + 4;
  if (content.startsWith('\r\n', bodyStart)) bodyStart += 2;
  else if (content[bodyStart] === '\n') bodyStart += 1;
  return { yaml, body: content.slice(bodyStart) };
}

export function yamlScalar(yaml: string, key: string): string | null {
  const prefix = `${key}:`;
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(prefix)) continue;
    if (trimmed.length > prefix.length && trimmed[prefix.length] !== ' ' && trimmed[prefix.length] !== '\t') {
      continue;
    }
    return trimmed.slice(prefix.length).trim();
  }
  return null;
}

export function yamlHasKey(yaml: string, key: string): boolean {
  const prefix = `${key}:`;
  return yaml.split('\n').some((line) => {
    const trimmed = line.trim();
    return trimmed === prefix || trimmed.startsWith(`${prefix} `) || trimmed.startsWith(`${prefix}\t`);
  });
}

export function yamlDashedList(yaml: string, key: string): string[] | null {
  const header = `${key}:`;
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return null;
  const items: string[] = [];
  for (let n = start + 1; n < lines.length; n += 1) {
    const line = lines[n] ?? '';
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (!trimmed.startsWith('-')) break;
    let item = trimmed.slice(1).trim();
    if (
      (item.startsWith("'") && item.endsWith("'") && item.length >= 2) ||
      (item.startsWith('"') && item.endsWith('"') && item.length >= 2)
    ) {
      item = item.slice(1, -1);
    }
    if (item) items.push(item);
  }
  return items.length > 0 ? items : null;
}
