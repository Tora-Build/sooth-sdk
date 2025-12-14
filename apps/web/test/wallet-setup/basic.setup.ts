import 'dotenv/config';

import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';

function getEnvOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var ${name}. ` +
        `For MetaMask E2E, set ${name} (and keep it out of git).`,
    );
  }
  return v.trim();
}

const WALLET_PASSWORD = getEnvOrThrow('WALLET_PASSWORD');
const SECRET_WORDS_RAW = getEnvOrThrow('SECRET_WORDS');

// Synpress docs allow comma-separated or space-separated.
const SECRET_WORDS = SECRET_WORDS_RAW.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

export default defineWalletSetup(WALLET_PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, WALLET_PASSWORD);
  await metamask.importWallet(SECRET_WORDS);
});

