// Updated: Demo mode calculations from actual market data
import { useState } from 'react';
import { useAccount, useWriteContract, useReadContracts, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { GOVERNOR_VAULT_V4_ABI, ERC20_ABI } from '../config/abis';
import { useDeployments } from './useDeployments';
import { useMarketStore } from '../store/useMarketStore';
import { useActivityStore } from '../store/useActivityStore';
import toast from 'react-hot-toast';

export function useVault() {
  const { address } = useAccount();
  const { mode, markets } = useMarketStore();
  const [isPending, setIsPending] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const deployments = useDeployments();
  // LP vault - use SoothGovernorVault in v2, fallback to SoothVault for v1
  const vaultAddress = (deployments.SoothGovernorVault || deployments.SoothVault) as `0x${string}`;
  const tokenAddress = deployments.MockUSDC as `0x${string}`;

  // Read Data
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'totalAssets' },
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'totalSupply' },
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'balanceOf', args: [address || '0x0'] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [address || '0x0', vaultAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [address || '0x0'] },
      { address: vaultAddress, abi: GOVERNOR_VAULT_V4_ABI, functionName: 'asset' },
    ],
    query: {
      enabled: mode === 'real' && !!address,
      refetchInterval: 30000 // Increased to prevent RPC rate limiting
    }
  });

  const [totalAssets, totalSupply, lpBalance, allowance, userUsdcBalance, vaultAsset] = data?.map(r => r.result) || [];

  if (vaultAsset && (vaultAsset as string).toLowerCase() !== tokenAddress.toLowerCase()) {
    console.error('CRITICAL: Vault asset mismatch!', {
      expected: tokenAddress,
      actual: vaultAsset
    });
  }

  // Demo Mode Data - Calculate from actual market data
  const demoMarkets = mode === 'demo' ? markets.filter((m: any) => m.mode === 'demo') : [];
  const demoTotalLiquidity = demoMarkets.reduce((sum: number, m: any) => sum + Number(formatUnits(m.bParam || 0n, 18)), 0);


  // Calculate Demo Locked (Sum of b * 0.693)
  const demoTotalLocked = demoMarkets.reduce((sum: number, m: any) => {
    const b = Number(formatUnits(m.bParam || 0n, 18));
    return sum + (b * 0.693);
  }, 0);
  const demoTotalLockedBig = BigInt(Math.floor(demoTotalLocked * 1e18));

  // Calculate Demo Reserves (Sum of actual market reserves)
  const demoTotalReserves = demoMarkets.reduce((sum: number, m: any) => {
    const reserve = Number(formatUnits(m.reserve || 0n, 18));
    return sum + reserve;
  }, 0);
  const demoTotalReservesBig = BigInt(Math.floor(demoTotalReserves * 1e18));

  // Demo Mode Data
  // Supply = Sum of b (Liquidity Depth)
  const demoTotalSupply = BigInt(Math.floor(demoTotalLiquidity * 1e18));

  // TVL = Supply (Share Price = 1.0)
  const demoTotalAssets = demoTotalSupply;

  const demoLpBalance = 1250n * 10n ** 18n;
  const demoUserUsdc = 10000n * 10n ** 18n;

  // Normalized Data
  const currentTotalAssets = mode === 'demo' ? demoTotalAssets : (totalAssets as bigint || 0n);
  const currentTotalSupply = mode === 'demo' ? demoTotalSupply : (totalSupply as bigint || 0n);
  const currentLpBalance = mode === 'demo' ? demoLpBalance : (lpBalance as bigint || 0n);
  const currentUserUsdc = mode === 'demo' ? demoUserUsdc : (userUsdcBalance as bigint || 0n);
  const currentTotalLocked = mode === 'demo' ? demoTotalLockedBig : 0n; // Real mode needs separate fetching or aggregation

  // Derived Stats
  const sharePrice = mode === 'demo' ? 1.0 : (
    currentTotalSupply > 0n
      ? Number(formatUnits(currentTotalAssets, 18)) / Number(formatUnits(currentTotalSupply, 18))
      : 1.0
  );

  const apy = 12.4; // Mock APY for now

  const deposit = async (amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Deposited ${amount} USDC`);
        useActivityStore.getState().addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description: `Deposited ${amount} USDC`,
          mode: 'demo',
          hash: `0x${Math.random().toString(16).slice(2)}`,
          timestamp: Date.now()
        });
        return;
      }

      const amountBig = parseUnits(amount, 18);

      // 1. Check Fresh Allowance & Max Deposit
      if (!publicClient) throw new Error('Public Client not initialized');

      // Use Promise.all with individual readContract calls instead of multicall
      // This ensures compatibility with chains that don't support multicall3 (like Monad Testnet)
      const allowanceVal = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address || '0x0', vaultAddress]
      }) as bigint;

      // Skip maxDeposit check as it reverts on current contract deployment
      const maxDepositVal = FALLBACK_MAX_DEPOSIT;

      console.log('Deposit Debug:', {
        amount: amountBig.toString(),
        allowance: allowanceVal.toString(),
        maxDeposit: maxDepositVal.toString(),
        needsApproval: allowanceVal < amountBig
      });

      if (maxDepositVal < amountBig) {
        throw new Error(`Deposit amount exceeds vault limit (Max: ${formatUnits(maxDepositVal, 18)})`);
      }

      // 2. Approve if needed
      if (allowanceVal < amountBig) {
        const tx = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress, amountBig],
        });

        const toastId = toast.loading('Approving USDC...');
        console.log('Approval Sent:', tx);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Approval Mined:', receipt.status);

        if (receipt.status !== 'success') {
          throw new Error('Approval transaction failed');
        }
        toast.success('Approved!', { id: toastId });
      }

      // 3. Deposit
      console.log('Sending Deposit...');
      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: GOVERNOR_VAULT_V4_ABI,
        functionName: 'deposit',
        args: [amountBig, address || '0x0'],
      });

      const toastId = toast.loading('Deposit submitted...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Deposit successful!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description: `Deposited ${amount} USDC`,
          hash: hash,
          mode: mode,
          timestamp: Date.now(),
          chainId: publicClient?.chain?.id
        });
        refetch();
      } else {
        throw new Error('Deposit transaction reverted');
      }
    } catch (err: any) {
      console.error('Deposit Error:', err);
      toast.error(err.message?.split('\n')[0] || 'Deposit failed');
    } finally {
      setIsPending(false);
    }
  };

  const withdraw = async (amount: string) => {
    setIsPending(true);
    try {
      if (mode === 'demo') {
        await new Promise(r => setTimeout(r, 1000));
        toast.success(`Demo: Withdrew ${amount} LP Tokens`);
        useActivityStore.getState().addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description: `Withdrew ${amount} LP Tokens`,
          mode: 'demo',
          timestamp: Date.now()
        });
        return;
      }

      if (!publicClient) throw new Error('Public Client not initialized');

      const amountBig = parseUnits(amount, 18);

      const hash = await writeContractAsync({
        address: vaultAddress,
        abi: GOVERNOR_VAULT_V4_ABI,
        functionName: 'withdraw',
        args: [amountBig, address || '0x0', address || '0x0'],
      });

      const toastId = toast.loading('Withdraw submitted...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        toast.success('Withdraw successful!', { id: toastId });
        useActivityStore.getState().addActivity({
          type: 'liquidity',
          market: 'USDC Vault',
          description: `Withdrew ${amount} LP Tokens`,
          hash: hash,
          mode: mode,
          timestamp: Date.now(),
          chainId: publicClient.chain.id
        });
        refetch();
      } else {
        throw new Error('Withdraw transaction reverted');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Withdraw failed');
    } finally {
      setIsPending(false);
    }
  };

  const demoMaxDeposit = 1000000n * 10n ** 18n;
  // If maxDeposit fetch fails (undefined), default to max uint256 to allow attempts. 
  // Only block if explicitly 0n.
  const FALLBACK_MAX_DEPOSIT = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
  // No maxDeposit in contract, default to max
  const currentMaxDeposit = mode === 'demo' ? demoMaxDeposit : FALLBACK_MAX_DEPOSIT;

  // Calculate Total Locked
  // Demo: Sum of b * 0.693 (calculated above as currentTotalLocked)
  // Real: Use totalLockedExposure from contract
  // Real: Use totalLockedExposure from contract (Not available in V4 basic view yet)
  const contractLockedExposure = 0n; // Placeholder until V4 exposes this
  const totalLocked = mode === 'demo' ? currentTotalLocked : contractLockedExposure;

  return {
    deposit,
    withdraw,
    totalAssets: currentTotalAssets,
    totalSupply: currentTotalSupply,
    lpBalance: currentLpBalance,
    userUsdcBalance: currentUserUsdc,
    maxDeposit: currentMaxDeposit,
    totalLocked,
    sharePrice,
    apy,
    isPending,
    isLoading: mode === 'real' && !data,
  };
}
