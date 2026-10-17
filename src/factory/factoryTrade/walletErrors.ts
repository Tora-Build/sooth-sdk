/**
 * Whether a failed send is the person saying no in the wallet (EIP-1193
 * code 4001). A wallet library wraps the wallet's own error, sometimes more
 * than once, so the causes are looked at too.
 */
export function isWalletRejection(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    const item = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (item.code === 4001 || item.name === 'UserRejectedRequestError') {
      return true;
    }
    current = item.cause;
  }
  return false;
}

/**
 * Whether a failed send is the wallet reusing a transaction number: the
 * node's "nonce too low". Nothing went out. MetaMask did it on 12 Oct 2026
 * for a trade that followed its approval, straight after the browser was
 * opened again: it counted from before the approval. The library reports it
 * as a revert of our contract call, so the texts are looked at, not a type.
 */
export function isNonceAlreadyUsed(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 8; depth += 1) {
    const item = current as {
      name?: unknown;
      message?: unknown;
      details?: unknown;
      shortMessage?: unknown;
      cause?: unknown;
    };
    if (item.name === 'NonceTooLowError') return true;
    for (const text of [item.message, item.details, item.shortMessage]) {
      if (typeof text === 'string' && /nonce (is )?too low/i.test(text)) {
        return true;
      }
    }
    current = item.cause;
  }
  return false;
}
