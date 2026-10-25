/**
 * Transient-error retry for OpenAI-compatible eval HTTP (agent + judges).
 * Domain policy; adapters throw ProviderHttpError or let fetch TypeError bubble.
 */

export const RETRYABLE_HTTP_STATUS = new Set([429, 502, 503, 504]);

export class ProviderHttpError extends Error {
  readonly status: number;

  constructor(kind: 'LLM' | 'Judge', status: number, body: string) {
    const limit = kind === 'LLM' ? 500 : 400;
    super(`${kind === 'LLM' ? 'LLM' : 'Judge'} provider error ${status}: ${body.slice(0, limit)}`);
    this.name = 'ProviderHttpError';
    this.status = status;
  }
}

export function isRetryableProviderFailure(err: unknown): boolean {
  if (err instanceof ProviderHttpError) {
    return RETRYABLE_HTTP_STATUS.has(err.status);
  }
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) {
    return true;
  }
  if (!(err instanceof Error) || err.cause === undefined || typeof err.cause !== 'object' || err.cause === null) {
    return false;
  }
  if (!('code' in err.cause)) return false;
  const code = String(err.cause.code);
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  );
}

export interface ProviderRetryOptions {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

function retryAttempts(): number {
  const raw = Number(process.env.KIT_EVAL_RETRY_ATTEMPTS ?? '3');
  if (!Number.isFinite(raw) || raw < 1) return 3;
  return Math.min(8, Math.floor(raw));
}

export function providerRetryBackoffMs(attemptZeroBased: number): number {
  const base = Number(process.env.KIT_EVAL_RETRY_BACKOFF_MS ?? '500');
  const step = Number.isFinite(base) && base >= 0 ? base : 500;
  return step * 2 ** attemptZeroBased;
}

export async function withProviderRetry<T>(
  op: () => Promise<T>,
  options: ProviderRetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? retryAttempts();
  const sleep =
    options.sleep ??
    (async (ms: number) => {
      if (ms <= 0) return;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
    });

  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (err) {
      last = err;
      if (!isRetryableProviderFailure(err) || i === attempts - 1) {
        throw err;
      }
      await sleep(providerRetryBackoffMs(i));
    }
  }
  throw last;
}
