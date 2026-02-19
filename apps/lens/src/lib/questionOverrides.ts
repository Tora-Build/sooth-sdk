/**
 * Local overrides for on-chain question strings that were stored incorrectly.
 * Key: lowercase market address → corrected display string.
 *
 * Monad Mainnet deployment — clean questions from the start. No overrides needed.
 */
export const QUESTION_OVERRIDES: Record<string, string> = {
  // No overrides — all questions are correct on-chain
};

export function getDisplayQuestion(address: string, onchainQuestion: string): string {
  return QUESTION_OVERRIDES[address.toLowerCase()] ?? onchainQuestion;
}
