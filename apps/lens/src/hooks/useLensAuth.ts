import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  PublicClient,
  testnet,
  evmAddress,
  type SessionClient,
} from '@lens-protocol/client';
import { fetchAccountsAvailable } from '@lens-protocol/client/actions';
import { signMessageWith } from '@lens-protocol/client/viem';
import { LENS_APP_ADDRESS } from '../lib/lensConfig';

const SESSION_STORAGE_KEY = 'sooth_lens_session';

const lensClient = PublicClient.create({
  environment: testnet,
  origin: typeof window !== 'undefined' ? window.location.origin : 'https://sooth.market',
});

const appAddress = import.meta.env.VITE_LENS_APP ?? LENS_APP_ADDRESS;

interface StoredSessionMeta {
  owner: string;
  lensAccount: string;
  timestamp: number;
}

let sessionClientSingleton: SessionClient | null = null;

function parseStoredMeta(raw: string | null): StoredSessionMeta | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'owner' in parsed &&
      'lensAccount' in parsed &&
      'timestamp' in parsed &&
      typeof parsed.owner === 'string' &&
      typeof parsed.lensAccount === 'string' &&
      typeof parsed.timestamp === 'number'
    ) {
      return parsed as StoredSessionMeta;
    }
    return null;
  } catch {
    return null;
  }
}

function persistSessionMeta(owner: string, lensAccount: string): void {
  const payload: StoredSessionMeta = {
    owner,
    lensAccount,
    timestamp: Date.now(),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

function clearSessionMeta(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export interface LensAuthState {
  isAuthenticated: boolean;
  sessionClient: SessionClient | null;
  lensAccount: string | null;
  isLoading: boolean;
  error: string | null;
  missingLensAccountMessage: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useLensAuth(): LensAuthState {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [sessionClient, setSessionClient] = useState<SessionClient | null>(sessionClientSingleton);
  const [lensAccount, setLensAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingLensAccountMessage, setMissingLensAccountMessage] = useState<string | null>(null);

  const discoverLensAccount = useCallback(async (owner: string): Promise<string | null> => {
    const available = await fetchAccountsAvailable(lensClient, {
      managedBy: evmAddress(owner),
      pageSize: 'FIFTY',
    });

    if (available.isErr()) {
      throw new Error(available.error.message);
    }

    if (available.value.items.length === 0) {
      return null;
    }

    return available.value.items[0].account.address;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!address) {
        sessionClientSingleton = null;
        setSessionClient(null);
        setLensAccount(null);
        setError(null);
        setMissingLensAccountMessage(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      setMissingLensAccountMessage(null);

      try {
        const discovered = await discoverLensAccount(address);
        if (!cancelled) {
          setLensAccount(discovered);
          if (!discovered) {
            setMissingLensAccountMessage('No Lens account found for this wallet yet.');
          }
        }
      } catch (discoverError) {
        if (!cancelled) {
          const message = discoverError instanceof Error ? discoverError.message : 'Failed to discover Lens account';
          setError(message);
        }
      }

      const stored = parseStoredMeta(localStorage.getItem(SESSION_STORAGE_KEY));
      const resume = await lensClient.resumeSession();

      if (!resume.isErr()) {
        const resumed = resume.value;
        const authUserResult = resumed.getAuthenticatedUser();

        if (!authUserResult.isErr()) {
          const authUser = authUserResult.value;
          const signerMatches = authUser.signer.toLowerCase() === address.toLowerCase();
          const storageMatches = !stored || stored.owner.toLowerCase() === address.toLowerCase();

          if (signerMatches && storageMatches && !cancelled) {
            sessionClientSingleton = resumed;
            setSessionClient(resumed);
            setLensAccount(authUser.address);
            persistSessionMeta(address, authUser.address);
          }
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [address, discoverLensAccount]);

  const login = useCallback(async () => {
    if (!address) {
      setError('Connect your wallet first.');
      return;
    }

    if (!walletClient) {
      setError('Wallet client unavailable. Reconnect your wallet and try again.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMissingLensAccountMessage(null);

    try {
      const resolvedLensAccount = lensAccount ?? (await discoverLensAccount(address));

      if (!resolvedLensAccount) {
        setLensAccount(null);
        setMissingLensAccountMessage('No Lens account found for this wallet yet.');
        return;
      }

      setLensAccount(resolvedLensAccount);

      const loginResult = await lensClient.login({
        accountOwner: {
          account: evmAddress(resolvedLensAccount),
          app: evmAddress(appAddress),
          owner: address,
        },
        signMessage: signMessageWith(walletClient),
      });

      if (loginResult.isErr()) {
        throw new Error(loginResult.error.message);
      }

      sessionClientSingleton = loginResult.value;
      setSessionClient(loginResult.value);
      persistSessionMeta(address, resolvedLensAccount);
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Lens login failed';
      setError(message);
      sessionClientSingleton = null;
      setSessionClient(null);
      clearSessionMeta();
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, lensAccount, discoverLensAccount]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const activeSession = sessionClient ?? sessionClientSingleton;
      if (activeSession) {
        await activeSession.logout();
      }
    } catch (logoutError) {
      const message = logoutError instanceof Error ? logoutError.message : 'Failed to logout';
      setError(message);
    } finally {
      sessionClientSingleton = null;
      setSessionClient(null);
      clearSessionMeta();
      setIsLoading(false);
    }
  }, [sessionClient]);

  const isAuthenticated = useMemo(() => sessionClient !== null, [sessionClient]);

  return {
    isAuthenticated,
    sessionClient,
    lensAccount,
    isLoading,
    error,
    missingLensAccountMessage,
    login,
    logout,
  };
}
