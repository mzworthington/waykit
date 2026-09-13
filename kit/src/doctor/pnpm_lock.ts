import { parseDocument } from 'yaml';

export function yamlMappingErrors(text: string): string[] {
  const doc = parseDocument(text, { uniqueKeys: true, prettyErrors: false });
  return doc.errors.map((error) => error.message);
}
