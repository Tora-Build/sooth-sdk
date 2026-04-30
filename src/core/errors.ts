function hexToString(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) break;
    str += String.fromCharCode(code);
  }
  return str;
}

export const ERROR_SELECTORS: Record<string, string> = {
  '0x427be97e': 'RPC_ERROR: Returned contract address (gas estimation failed?)',
  '0x7e42f86b': 'RPC_ERROR: Returned contract address (Monad orderbook manager)',
  '0xedd7c146': 'DuplicateMarket()',
  '0xcd4e6167': 'FeeTooHigh()',
  '0x39996567': 'InsufficientShares()',
  '0xc74a206d': 'InvalidOutcome()',
  '0x064847d0': 'InvalidTickRange()',
  '0xb03425ae': 'LiquidityOverflow()',
  '0xb521771a': 'MarketNotActive()',
  '0x3f22bf08': 'MarketNotLive()',
  '0xc301e07e': 'NoLiquidity()',
  '0x30cd7471': 'NotOwner()',
  '0x1d4ecc5b': 'OrderNotActive()',
  '0x8199f5f3': 'SlippageExceeded()',
  '0x35c3f177': 'SpotRangeTooWide()',
  '0x90797915': 'SpotSellNotActive()',
  '0xc7e13a01': 'TickOutOfRange()',
  '0x1e4fbdf7': 'OwnableInvalidOwner(address)',
  '0x118cdaa7': 'OwnableUnauthorizedAccount(address)',
  '0x3ee5aeb5': 'ReentrancyGuardReentrantCall()',
  '0x5274afe7': 'SafeERC20FailedOperation(address)',
  '0xe450d38c': 'ERC20InsufficientBalance(address,uint256,uint256)',
  '0xfb8f41b2': 'ERC20InsufficientAllowance(address,uint256,uint256)',
  '0x1425ea42': 'AddressEmptyCode(address)',
  '0x4e487b71': 'Panic(uint256)',
};

export const PANIC_CODES: Record<number, string> = {
  0x00: 'Generic compiler panic',
  0x01: 'Assert failed',
  0x11: 'Arithmetic overflow/underflow',
  0x12: 'Division by zero',
  0x21: 'Invalid enum value',
  0x22: 'Storage encoding error',
  0x31: 'Pop from empty array',
  0x32: 'Array out of bounds',
  0x41: 'Too much memory allocated',
  0x51: 'Zero-initialized function pointer',
};

export function decodeErrorHex(hex: string): string {
  if (!hex || !hex.startsWith('0x')) {
    return hex || 'Unknown error';
  }

  if (hex.length < 10) {
    return `Unknown error: ${hex}`;
  }

  if (hex.length === 42) {
    return `RPC error (returned address): ${hex.slice(0, 10)}...`;
  }

  const selector = hex.slice(0, 10).toLowerCase();
  const data = hex.slice(10);

  const knownError = ERROR_SELECTORS[selector];
  if (knownError) {
    if (knownError === 'Panic(uint256)' && data.length >= 64) {
      const panicCode = parseInt(data.slice(0, 64), 16);
      const meaning = PANIC_CODES[panicCode] || `Unknown panic code 0x${panicCode.toString(16)}`;
      return `Panic(0x${panicCode.toString(16)}): ${meaning}`;
    }

    if (knownError.includes('(') && !knownError.endsWith('()') && data.length > 0) {
      return `${knownError} [data: 0x${data.slice(0, 40)}${data.length > 40 ? '...' : ''}]`;
    }

    return knownError;
  }

  if (selector === '0x08c379a0' && data.length >= 128) {
    try {
      const stringLength = parseInt(data.slice(64, 128), 16);
      const stringData = data.slice(128, 128 + stringLength * 2);
      const decoded = hexToString(stringData);
      return `Error: "${decoded}"`;
    } catch {}
  }

  return `Unknown error [${selector}]: 0x${data.slice(0, 40)}${data.length > 40 ? '...' : ''}`;
}

export function decodeError(errorData: string | Error): string {
  if (errorData instanceof Error) {
    const msg = errorData.message;

    const hexMatch = msg.match(/0x[a-fA-F0-9]+/);
    if (hexMatch) {
      const decoded = decodeErrorHex(hexMatch[0]);
      if (decoded !== hexMatch[0]) {
        return decoded;
      }
    }

    const revertMatch =
      msg.match(/reverted with.*?["']([^"']+)["']/i) ||
      msg.match(/reason:\s*([^\n]+)/i) ||
      msg.match(/Error:\s*([^\n]+)/i);
    if (revertMatch) {
      return revertMatch[1].slice(0, 100);
    }

    return msg.slice(0, 100);
  }

  return decodeErrorHex(errorData);
}

export function isUnknownSelectorError(error: Error): boolean {
  const msg = error.message;
  const hexMatch = msg.match(/0x[a-fA-F0-9]{10,}/);
  if (!hexMatch) return false;
  const selector = hexMatch[0].slice(0, 10).toLowerCase();
  return !ERROR_SELECTORS[selector];
}

export function isTransientError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('nonce') ||
    msg.includes('already known') ||
    msg.includes('replacement transaction') ||
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('socket') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('returned no data ("0x")') ||
    isUnknownSelectorError(error)
  );
}

export function isContractError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('revert') ||
    msg.includes('overflow') ||
    msg.includes('underflow') ||
    msg.includes('insufficient') ||
    msg.includes('panic') ||
    msg.includes('execution reverted')
  );
}

export function isNoDataError(error: Error): boolean {
  return error.message.toLowerCase().includes('returned no data ("0x")');
}
