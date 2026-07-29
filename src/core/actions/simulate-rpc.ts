import { sleep } from '../utils.js';
import type { ActionReporter } from './types.js';

const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
const ROBINHOOD_SIMULATION_PACING_MS = 1_500;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 3;

interface RetryOptions {
  delayMs?: number;
  maxRetries?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

function errorText(error: unknown, depth = 0): string {
  if (depth > 5 || error == null) return '';
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return String(error);

  const value = error as Record<string, unknown>;
  const ownText = ['message', 'shortMessage', 'details', 'body']
    .map((key) => value[key])
    .filter((part): part is string => typeof part === 'string')
    .join('\n');
  const causeText = errorText(value.cause, depth + 1);
  return `${ownText}\n${causeText}`;
}

export function isRpcRateLimitError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth <= 5 && current && typeof current === 'object'; depth++) {
    const value = current as Record<string, unknown>;
    if (value.status === 429 || value.statusCode === 429) return true;
    current = value.cause;
  }

  return /(?:status(?: code)?\s*:?\s*429|http\s*429|too many requests|rate[- ]limit)/i.test(
    errorText(error),
  );
}

export function getSimulationPacingDelayMs(chainId: number, useRealtime: boolean): number {
  if (chainId === ROBINHOOD_TESTNET_CHAIN_ID && !useRealtime) {
    return ROBINHOOD_SIMULATION_PACING_MS;
  }
  return 0;
}

/**
 * Retry one RPC operation at a time so a throttled receipt poll never causes
 * the already-submitted transaction to be sent a second time.
 */
export async function withRpcRateLimitRetry<T>(
  operation: () => Promise<T>,
  report: ActionReporter,
  label: string,
  options: RetryOptions = {},
): Promise<T> {
  const delayMs = options.delayMs ?? RATE_LIMIT_RETRY_DELAY_MS;
  const maxRetries = options.maxRetries ?? MAX_RATE_LIMIT_RETRIES;
  const sleepFn = options.sleepFn ?? sleep;

  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRpcRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      const retryNumber = attempt + 1;
      report({
        type: 'warn',
        message: `RPC rate limited during ${label}; retrying in ${Math.ceil(delayMs / 1_000)}s (${retryNumber}/${maxRetries})`,
        data: {
          rateLimited: true,
          label,
          retryNumber,
          maxRetries,
          delayMs,
        },
      });
      await sleepFn(delayMs);
    }
  }
}
