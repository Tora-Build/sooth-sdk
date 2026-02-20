/**
 * Sooth SDK - Browser-compatible SDK for Sooth Protocol
 */

import type { PublicClient, WalletClient, Address } from 'viem';
import type { SDKConfig, SDKContext, CommandResult, OutputLine } from './types';
import deployments from '../../config/deployments.json';
import { plain, error as errorLine, success as successLine, bold, dim, info } from './utils';
import { SOOTHBOOK_ABI } from '../../config/abis';

import { walletCommands } from './commands/wallet';
import { marketCommands } from './commands/market';
import { soothbookCommands } from './commands/soothbook';

export * from './types';
export * from './utils';
export * from './commands';

type NetworkKey = keyof typeof deployments.networks;

const STORAGE_KEY_MARKET = 'sooth_selected_market';
// NOTE: These are bonding-stage market keys (pre-graduation).
// SoothBook.markets(key) returns all zeros for these — they are NOT registered in SoothBook yet.
// `sbsetmarket 0/1/2` will always fail until these markets graduate.
const SOOTHBOOK_TEST_MARKETS: readonly `0x${string}`[] = [
  '0x28a722c5a9f901c47dda06574bb57ede6fc256dfbb821a7f17cae915b511fb3b',  // BTC $150k 2026
  '0x1b7e3a5e85ec8aaa17e7e7918496fd0b4637cf54a87cf3d031ebe50b8576f515',  // ETH flip BTC 2027
  '0x8881374938b0170c9fefd869f43721a62c145c48e3686f0494c51e5b44cdcf35',  // SOL ETF 2026
];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class SoothSDK {
  private config: SDKConfig;
  private address?: Address;
  private marketKey?: `0x${string}`;
  private marketAddress?: Address;

  constructor(
    chainId: number,
    publicClient: PublicClient,
    walletClient?: WalletClient,
    address?: Address
  ) {
    const networkKey = this.findNetworkKey(chainId);
    if (!networkKey) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const network = deployments.networks[networkKey];
    
    this.config = {
      chainId,
      publicClient,
      walletClient,
      contracts: {
        MockUSDC: network.contracts.MockUSDC as Address,
        LaunchpadEngine: network.contracts.LaunchpadEngine as Address,
        Collateralizer: network.contracts.Collateralizer as Address,
        AMMEngine: network.contracts.AMMEngine as Address,
        SoothBook: ('SoothBook' in network.contracts ? network.contracts.SoothBook : undefined) as Address | undefined,
      },
    };
    
    this.address = address;
    
    // Restore market selection from localStorage
    this.restoreMarketSelection();
  }
  
  private restoreMarketSelection() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MARKET);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      // Only restore if same chain
      if (data.chainId === this.config.chainId) {
        this.marketAddress = data.marketAddress as Address;
        this.marketKey = data.marketKey as `0x${string}` | undefined;
      }
    } catch {
      // Invalid stored data, ignore
    }
  }
  
  private persistMarketSelection() {
    if (typeof window === 'undefined') return;
    
    if (this.marketAddress || this.marketKey) {
      localStorage.setItem(STORAGE_KEY_MARKET, JSON.stringify({
        chainId: this.config.chainId,
        marketAddress: this.marketAddress,
        marketKey: this.marketKey,
      }));
    } else {
      localStorage.removeItem(STORAGE_KEY_MARKET);
    }
  }

  private findNetworkKey(chainId: number): NetworkKey | undefined {
    for (const [key, network] of Object.entries(deployments.networks)) {
      if (network.chainId === chainId) {
        return key as NetworkKey;
      }
    }
    return undefined;
  }

  private getContext(): SDKContext {
    return {
      config: this.config,
      address: this.address,
      marketKey: this.marketKey,
      marketAddress: this.marketAddress,
    };
  }

  setAddress(address: Address) {
    this.address = address;
  }

  setWalletClient(walletClient: WalletClient) {
    this.config.walletClient = walletClient;
  }

  async setMarket(keyOrIndex: string): Promise<{ result: CommandResult; output: OutputLine[] }> {
    if (!this.config.contracts.SoothBook) {
      return {
        result: { success: false, message: 'SoothBook not configured' },
        output: [errorLine('SoothBook not available on this chain')],
      };
    }
    return this.sbSetMarket(keyOrIndex);
  }

  getMarketInfo(): { marketKey?: `0x${string}`; marketAddress?: Address } {
    return { marketKey: this.marketKey, marketAddress: this.marketAddress };
  }

  getChainId(): number {
    return this.config.chainId;
  }

  getContracts() {
    return this.config.contracts;
  }

  async balance() {
    return walletCommands.balance(this.getContext());
  }

  async mint(args: string[]) {
    return walletCommands.mint(this.getContext(), args);
  }

  async approve(args: string[]) {
    return walletCommands.approve(this.getContext(), args);
  }

  async allowance() {
    return walletCommands.allowance(this.getContext());
  }

  async createmarket(args: string[], onProgress?: (line: OutputLine) => void) {
    return marketCommands.createmarket(this.getContext(), args, onProgress);
  }

  async graduate(args: string[] = [], onProgress?: (line: OutputLine) => void) {
    return marketCommands.graduate(this.getContext(), args, onProgress);
  }

  async marketstatus(args: string[] = []) {
    return marketCommands.marketstatus(this.getContext(), args);
  }

  async trialstatus(args: string[] = []) {
    return marketCommands.trialstatus(this.getContext(), args);
  }

  async dismiss(args: string[] = [], onProgress?: (line: OutputLine) => void) {
    return marketCommands.dismiss(this.getContext(), args, onProgress);
  }

  async claimrefund(args: string[] = [], onProgress?: (line: OutputLine) => void) {
    return marketCommands.claimrefund(this.getContext(), args, onProgress);
  }

  async lpbalance(args: string[] = []) {
    return marketCommands.lpbalance(this.getContext(), args);
  }

  async redeemlp(args: string[] = [], onProgress?: (line: OutputLine) => void) {
    return marketCommands.redeemlp(this.getContext(), args, onProgress);
  }

  async transferlp(args: string[] = [], onProgress?: (line: OutputLine) => void) {
    return marketCommands.transferlp(this.getContext(), args, onProgress);
  }

  async pausestatus(args: string[] = []) {
    return marketCommands.pausestatus(this.getContext(), args);
  }

  async buyyes(args: string[]) {
    return soothbookCommands.buyyes(this.getContext(), args);
  }

  async buyno(args: string[]) {
    return soothbookCommands.buyno(this.getContext(), args);
  }

  async sbmint(args: string[]) {
    return soothbookCommands.sbmint(this.getContext(), args);
  }

  async sbmerge(args: string[]) {
    return soothbookCommands.sbmerge(this.getContext(), args);
  }

  async sbcancel(args: string[]) {
    return soothbookCommands.sbcancel(this.getContext(), args);
  }

  async sbredeem(args: string[] = []) {
    return soothbookCommands.sbredeem(this.getContext(), args);
  }

  async sbbook(args: string[] = []) {
    return soothbookCommands.sbbook(this.getContext(), args);
  }

  async sbbalance(args: string[] = []) {
    return soothbookCommands.sbbalance(this.getContext(), args);
  }

  async sbstate(args: string[] = []) {
    return soothbookCommands.sbstate(this.getContext(), args);
  }

  async sbprice(args: string[] = []) {
    return soothbookCommands.sbprice(this.getContext(), args);
  }

  async sbhistory(args: string[] = []) {
    return soothbookCommands.sbhistory(this.getContext(), args);
  }

  async sbSetMarket(keyOrIndex: string): Promise<{ result: CommandResult; output: OutputLine[] }> {
    if (!this.config.contracts.SoothBook) {
      return {
        result: { success: false, message: 'SoothBook not configured' },
        output: [errorLine('SoothBook not available on this chain')],
      };
    }

    let nextKey: `0x${string}`;
    if (keyOrIndex.startsWith('0x')) {
      if (keyOrIndex.length !== 66) {
        return {
          result: { success: false, message: 'Market key must be 32-byte hex' },
          output: [errorLine('Usage: sbsetmarket <key|index>')],
        };
      }
      nextKey = keyOrIndex as `0x${string}`;
    } else {
      const idx = parseInt(keyOrIndex.trim(), 10);
      if (isNaN(idx) || idx < 0 || idx >= SOOTHBOOK_TEST_MARKETS.length) {
        return {
          result: { success: false, message: 'Index out of range' },
          output: [errorLine(`Index out of range (0-${SOOTHBOOK_TEST_MARKETS.length - 1})`)],
        };
      }
      nextKey = SOOTHBOOK_TEST_MARKETS[idx];
    }

    try {
      const [collateral, yesToken, noToken, active, finalized, outcome] = await this.config.publicClient.readContract({
        address: this.config.contracts.SoothBook,
        abi: SOOTHBOOK_ABI,
        functionName: 'markets',
        args: [nextKey],
      }) as [Address, Address, Address, boolean, boolean, number];

      if (collateral.toLowerCase() === ZERO_ADDRESS) {
        return {
          result: { success: false, message: 'Market not found' },
          output: [errorLine('Market not found in SoothBook')],
        };
      }

      this.marketKey = nextKey;
      this.persistMarketSelection();

      return {
        result: { success: true, data: { marketKey: this.marketKey, active, finalized, outcome } },
        output: [
          successLine(`SoothBook market set: ${nextKey}`),
          dim(`Collateral: ${collateral}`),
          dim(`YES Token:  ${yesToken}`),
          dim(`NO Token:   ${noToken}`),
          dim(`Active:     ${active ? 'YES' : 'NO'}`),
          dim(`Finalized:  ${finalized ? 'YES' : 'NO'}`),
          dim(`Outcome:    ${outcome}`),
        ],
      };
    } catch (err) {
      return {
        result: { success: false, message: (err as Error).message },
        output: [errorLine(`Failed to set SoothBook market: ${(err as Error).message}`)],
      };
    }
  }

  async executeCommand(input: string): Promise<{ result: CommandResult; output: OutputLine[] }> {
    const parts = input.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) {
      return { result: { success: true }, output: [] };
    }

    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return this.showHelp();
      case 'balance':
      case 'bal':
        return this.balance();
      case 'mint':
        return this.mint(args);
      case 'approve':
        return this.approve(args);
      case 'allowance':
        return this.allowance();
      case 'createmarket':
        return this.createmarket(args);
      case 'graduate':
        return this.graduate(args);
      case 'marketstatus':
        return this.marketstatus(args);
      case 'trialstatus':
        return this.trialstatus(args);
      case 'dismiss':
        return this.dismiss(args);
      case 'claimrefund':
        return this.claimrefund(args);
      case 'lpbalance':
        return this.lpbalance(args);
      case 'redeemlp':
        return this.redeemlp(args);
      case 'transferlp':
        return this.transferlp(args);
      case 'pausestatus':
        return this.pausestatus(args);
      case 'buyyes':
        return this.buyyes(args);
      case 'buyno':
        return this.buyno(args);
      case 'sbmint':
        return this.sbmint(args);
      case 'sbmerge':
        return this.sbmerge(args);
      case 'sbcancel':
        return this.sbcancel(args);
      case 'sbredeem':
        return this.sbredeem(args);
      case 'sbbook':
        return this.sbbook(args);
      case 'sbbalance':
      case 'sbbal':
        return this.sbbalance(args);
      case 'sbstate':
        return this.sbstate(args);
      case 'sbprice':
        return this.sbprice(args);
      case 'sbhistory':
        return this.sbhistory(args);
      case 'sbsetmarket':
      case 'sbm':
        if (args.length < 1) {
          return {
            result: { success: false },
            output: [errorLine('Usage: sbsetmarket <key|index>')],
          };
        }
        return this.sbSetMarket(args[0]);
      case 'setmarket':
        if (args.length < 1) {
          return {
            result: { success: false, message: 'Usage: setmarket <key|index>' },
            output: [errorLine('Usage: setmarket <key|index>')],
          };
        }
        return this.setMarket(args[0]);
      case 'info':
        return this.showInfo();
      default:
        return {
          result: { success: false, message: `Unknown command: ${cmd}` },
          output: [errorLine(`Unknown command: ${cmd}. Type "help" for available commands.`)],
        };
    }
  }

  private showHelp(): { result: CommandResult; output: OutputLine[] } {
    const sep = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
    return {
      result: { success: true },
      output: [
        plain(''),
        info('  Wallet'),
        plain('    balance / mint <n> / approve <target> / allowance'),
        plain(''),
        info('  Market (LaunchpadEngine)'),
        plain('    createmarket <template>   Create (alien, btcath, lakers)'),
        plain('    graduate [steps]          Graduate via trades'),
        plain('    marketstatus              Lifecycle status'),
        plain(''),
        info('  Trial Period (V11)'),
        plain('    trialstatus               Show trial period status'),
        plain('    dismiss                   Dismiss market (creator only)'),
        plain('    claimrefund               Claim refund after dismissal'),
        plain(''),
        info('  LP Tokens (V11 ERC20)'),
        plain('    lpbalance                 Show LP token balance'),
        plain('    redeemlp [amount|max]     Redeem LP tokens for USDC'),
        plain('    transferlp <to> <amount>  Transfer LP tokens'),
        plain(''),
        info('  Protocol (V11)'),
        plain('    pausestatus               Check protocol pause status'),
        plain(''),
        info('  SoothBook (V12)'),
        plain('    buyyes <tick> <amount> [escrow]    Buy YES tokens'),
        plain('    buyno <tick> <amount> [escrow]     Buy NO tokens'),
        plain('    sbmint <amount>                    Mint YES+NO set'),
        plain('    sbmerge <amount>                   Merge YES+NO → USDC'),
        plain('    sbcancel <yes|no> <tick>           Cancel order'),
        plain('    sbredeem                           Redeem winning tokens'),
        plain('    sbbook                             Show orderbook'),
        plain('    sbhistory [page] [size]           Show your order history'),
        plain('    sbbalance / sbstate / sbprice      Query state'),
        plain('    sbsetmarket <key|index>            Select V12 market'),
        plain(''),
      ],
    };
  }

  private showInfo(): { result: CommandResult; output: OutputLine[] } {
    const output: OutputLine[] = [
      plain(''),
      bold('Current Context'),
      plain(`  Chain ID:   ${this.config.chainId}`),
      plain(`  Address:    ${this.address || 'Not connected'}`),
      plain(`  Market:     ${this.marketAddress || 'Not selected'}`),
      plain(`  Market Key: ${this.marketKey || 'N/A'}`),
      plain(''),
    ];
    return { result: { success: true }, output };
  }
}
