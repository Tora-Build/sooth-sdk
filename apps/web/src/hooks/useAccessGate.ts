import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

const ACCESS_API = 'https://access.sooth.market';

export function useAccessGate() {
  const { address, isConnected } = useAccount();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(isConnected && !!address);

  useEffect(() => {
    if (!isConnected || !address) {
      setAllowed(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`${ACCESS_API}/check?wallet=${address.toLowerCase()}`)
      .then((r) => r.json())
      .then((data) => setAllowed(data.allowed === true))
      .catch(() => setAllowed(false))
      .finally(() => setLoading(false));
  }, [address, isConnected]);

  return { allowed, loading, isConnected, address };
}
