/** ERC20 approval amounts use the collateral token's native units. */
export interface TokenApprovalInput {
  allowance: bigint;
  requiredNative: bigint;
  /** Omit for the exact transaction bound. Custom limits must be finite. */
  approvalLimitNative?: bigint;
}

export type TokenApprovalPlan =
  | { ok: true; approveNative: bigint | null }
  | { ok: false; reason: string };

/** A reusable grant never changes the transaction's spending bound. */
export function planTokenApproval({
  allowance,
  requiredNative,
  approvalLimitNative,
}: TokenApprovalInput): TokenApprovalPlan {
  const maxUint256 = (1n << 256n) - 1n;
  if (requiredNative < 0n || requiredNative >= maxUint256 || allowance < 0n)
    return { ok: false, reason: 'Invalid approval amount.' };
  if (
    approvalLimitNative !== undefined &&
    (approvalLimitNative <= 0n || approvalLimitNative >= maxUint256)
  )
    return { ok: false, reason: 'Enter a positive, finite spending limit.' };
  if (approvalLimitNative !== undefined && approvalLimitNative < requiredNative)
    return {
      ok: false,
      reason:
        'The spending limit is below the current required amount. Increase it or use the exact amount.',
    };
  return {
    ok: true,
    approveNative: allowance >= requiredNative ? null : (approvalLimitNative ?? requiredNative),
  };
}
