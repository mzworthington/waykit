/** Public CLI binary. */
export const CLI_BIN = 'wk';

export function cliUsage(rest: string): string {
  return `Usage: ${CLI_BIN} ${rest}`;
}
