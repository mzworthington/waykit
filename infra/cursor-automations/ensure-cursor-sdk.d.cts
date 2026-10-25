export function ensureCursorSdk(options?: {
  root?: string;
  pulumiBin?: string;
  env?: NodeJS.ProcessEnv;
  installPulumi?: () => string;
}): { generated: boolean };

export function preResolution(): void;
