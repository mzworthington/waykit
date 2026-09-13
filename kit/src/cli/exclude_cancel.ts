export function excludeCancel<T>(
  value: T,
  isCancel: (value: unknown) => boolean
): Exclude<T, symbol> | null {
  if (isCancel(value)) return null;
  return value as Exclude<T, symbol>;
}
