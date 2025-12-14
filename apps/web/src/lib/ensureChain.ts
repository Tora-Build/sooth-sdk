/**
 * EIP-3085 / EIP-3326 chain switching utilities
 * Handles adding chains to wallets that don't have them configured (e.g., Phantom on Base Sepolia)
 */

import { allowedChains, type AllowedChain } from './chains';

// EIP-3085 AddEthereumChainParameter format
interface AddEthereumChainParameter {
  chainId: string; // Hex string
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
}

/**
 * Convert chain ID to hex string (0x prefixed)
 */
export function chainIdToHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

/**
 * Convert AllowedChain to EIP-3085 AddEthereumChainParameter
 */
export function chainToAddParams(chain: AllowedChain): AddEthereumChainParameter {
  return {
    chainId: chainIdToHex(chain.id as number),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [chain.rpcUrl],
    blockExplorerUrls: [chain.explorerUrl],
  };
}

/**
 * Ensure the wallet is on the specified chain.
 * If the chain isn't added, attempts to add it first via EIP-3085.
 * 
 * @param ethereum - The window.ethereum provider
 * @param chainId - The target chain ID (number)
 * @returns true if switch succeeded, false if user rejected
 * @throws Error if switch fails for non-recoverable reasons
 */
export async function ensureChain(
  ethereum: any,
  chainId: number
): Promise<boolean> {
  if (!ethereum) {
    throw new Error('No Ethereum provider found');
  }

  const targetHex = chainIdToHex(chainId);
  
  // Check current chain
  const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
  if (currentChainHex?.toLowerCase() === targetHex.toLowerCase()) {
    return true; // Already on the right chain
  }

  // Try to switch
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetHex }],
    });
    return true;
  } catch (switchError: any) {
    // 4902 = Chain not added to wallet
    if (switchError?.code === 4902) {
      // Find chain config
      const chain = allowedChains.find(c => c.id === chainId);
      if (!chain) {
        throw new Error(`Chain ${chainId} not found in allowedChains`);
      }

      // Try to add the chain
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainToAddParams(chain)],
        });
        return true;
      } catch (addError: any) {
        // User rejected adding chain
        if (addError?.code === 4001) {
          return false;
        }
        throw addError;
      }
    }
    
    // User rejected switch
    if (switchError?.code === 4001) {
      return false;
    }
    
    throw switchError;
  }
}

/**
 * Get the raw ethereum provider from window
 * Works with MetaMask, Phantom, and other injected wallets
 */
export function getEthereumProvider(): any {
  if (typeof window === 'undefined') return null;
  
  // Phantom EVM uses window.phantom.ethereum
  const phantom = (window as any).phantom?.ethereum;
  if (phantom?.isPhantom) {
    return phantom;
  }
  
  // Standard injected provider
  return (window as any).ethereum;
}
