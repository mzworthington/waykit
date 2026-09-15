export function compareLocale(a: string, b: string): number {
  return a.localeCompare(b);
}

export function sortedLocale(items: readonly string[]): string[] {
  return [...items].sort(compareLocale);
}

export function sortLocaleInPlace(items: string[]): string[] {
  return items.sort(compareLocale);
}
