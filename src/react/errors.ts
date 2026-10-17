import { BaseError } from 'viem';
import { isWalletRejection } from '../factory/factoryTrade/walletErrors.js';

/** Product-facing summary; request bodies and transport traces stay out of inline notices. */
export function describeSoothError(error: unknown): string {
  if (isWalletRejection(error)) return 'The request was declined in your wallet.';
  const message =
    error instanceof BaseError
      ? error.shortMessage
      : error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'The request could not be completed.';
  const firstLine =
    message
      .split(/\r?\n/)
      .find((line) => line.trim())
      ?.trim() || 'The request could not be completed.';
  if (/^(?:request body|request arguments|url:|params:|details:)/i.test(firstLine))
    return 'The network request could not be completed. Try again when the connection is available.';
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}…` : firstLine;
}
