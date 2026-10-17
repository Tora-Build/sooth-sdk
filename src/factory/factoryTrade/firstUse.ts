/**
 * The first transaction a MetaMask account sends with "Added protection" on.
 *
 * MetaMask sends it as a type-4 (EIP-7702) transaction that also upgrades the
 * account to its smart-account code. The gas limit MetaMask picks does not
 * cover the upgrade, and a gas limit from the site is ignored on a wrapped
 * call, so the action inside runs out of gas and the transaction reverts. The
 * upgrade itself stays, so the same call sent again goes through.
 *
 * A reverted type-4 receipt is the whole signal: later wrapped transactions
 * from an upgraded account are ordinary type-2.
 */
export interface SentReceipt {
  status: 'success' | 'reverted';
  type: string;
}

export function failedAccountSetup(receipt: SentReceipt): boolean {
  return receipt.status === 'reverted' && receipt.type === 'eip7702';
}

/**
 * Send, and send the same call once more when the first try was spent on the
 * account's upgrade. Once only, and never for any other failure.
 *
 * `beforeResend` runs between the two sends and may throw to stop the second
 * one: the caller tells the user why the wallet will prompt again and checks
 * that the call still holds, since the first try is a block or two old.
 */
export async function sendConfirmed<Receipt extends SentReceipt>(input: {
  send: () => Promise<Receipt>;
  beforeResend: (failed: Receipt) => Promise<void> | void;
}): Promise<{ receipt: Receipt; resent: boolean }> {
  const first = await input.send();
  if (!failedAccountSetup(first)) return { receipt: first, resent: false };
  await input.beforeResend(first);
  return { receipt: await input.send(), resent: true };
}
