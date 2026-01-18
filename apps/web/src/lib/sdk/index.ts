/**
 * Sooth SDK - Browser-compatible SDK for Sooth Protocol
 */

import type { PublicClient, WalletClient, Address } from 'viem';
import type { SDKConfig, SDKContext, CommandResult, OutputLine, OrderResult } from './types';
import deployments from '../../config/deployments.json';
import { computeMarketKey, computeMarketKeyWithHook, plain, error as errorLine, success as successLine, bold, dim, info, warn } from './utils';
import { ABIS } from '../../config/abis';

import { walletCommands } from './commands/wallet';
import { vaultCommands } from './commands/vault';
import { orderbookCommands } from './commands/orderbook';
import { stateCommands } from './commands/state';
import { marketCommands } from './commands/market';

export * from './types';
export * from './utils';
export * from './commands';

type NetworkKey = keyof typeof deployments.networks;

const STORAGE_KEY_MARKET = 'sooth_selected_market';

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
        TickBookVault: network.contracts.TickBookVault as Address,
        TickBookPoolManager: network.contracts.TickBookPoolManager as Address,
        LaunchpadEngine: network.contracts.LaunchpadEngine as Address,
        Collateralizer: network.contracts.Collateralizer as Address,
        AMMEngine: network.contracts.AMMEngine as Address,
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
    
    if (this.marketAddress) {
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

  async setMarket(indexStr: string): Promise<{ result: CommandResult; output: OutputLine[] }> {
    const publicClient = this.config.publicClient;
    const idx = parseInt(indexStr.trim(), 10);
    
    if (isNaN(idx)) {
      return {
        result: { success: false, message: 'Usage: setmarket <index>' },
        output: [errorLine('Usage: setmarket <index> (e.g., setmarket 0)')],
      };
    }

    const allMarkets = await publicClient.readContract({
      address: this.config.contracts.LaunchpadEngine,
      abi: ABIS.LaunchpadEngine,
      functionName: 'getMarkets',
    }) as Address[];

    if (idx >= allMarkets.length) {
      return {
        result: { success: false, message: `Index ${idx} out of range` },
        output: [errorLine(`Index ${idx} out of range (${allMarkets.length} markets)`)],
      };
    }
    
    const marketAddr = allMarkets[idx];

    const marketSymbol = marketAddr.slice(2, 10).toUpperCase();
    
    let marketName = marketSymbol;
    try {
      const question = await publicClient.readContract({
        address: marketAddr as Address,
        abi: [{ name: 'question', type: 'function', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }],
        functionName: 'question',
      }) as string;
      if (question) {
        marketName = question.length > 40 ? question.slice(0, 37) + '...' : question;
      }
    } catch {}

    try {
      const [yesToken, noToken] = await publicClient.readContract({
        address: this.config.contracts.Collateralizer,
        abi: ABIS.Collateralizer,
        functionName: 'getOutcomeTokens',
        args: [marketAddr as Address],
      }) as [Address, Address];

      const key3Param = computeMarketKey(marketAddr, yesToken, noToken);
      const key4Param = computeMarketKeyWithHook(marketAddr, yesToken, noToken);

      const tryKey = async (k: `0x${string}`) => {
        try {
          const [tm, , , isActive] = await publicClient.readContract({
            address: this.config.contracts.TickBookPoolManager,
            abi: ABIS.TickBookPoolManager,
            functionName: 'getMarketInfo',
            args: [k],
          }) as [string, string, string, boolean];
          return tm !== '0x0000000000000000000000000000000000000000' && isActive;
        } catch {
          return false;
        }
      };

      const active3 = await tryKey(key3Param);
      const active4 = key3Param !== key4Param ? await tryKey(key4Param) : false;

      const output: OutputLine[] = [];
      const idDisplay = marketSymbol ? `[${marketSymbol}]` : `#${idx}`;

      if (active3) {
        this.marketKey = key3Param;
      } else if (active4) {
        this.marketKey = key4Param;
      } else {
        this.marketKey = key3Param;
      }

      this.marketAddress = marketAddr as Address;
      this.persistMarketSelection();

      output.unshift(successLine(`Market set: ${idDisplay}${marketName ? ` ${marketName}` : ''}`));
      output.push(dim(`Address: ${marketAddr}`));
      output.push(dim(`Key: ${this.marketKey}`));
      
      return {
        result: { success: true, data: { marketKey: this.marketKey, marketAddress: this.marketAddress, symbol: marketSymbol } },
        output,
      };
    } catch {
      this.marketAddress = marketAddr;
      this.marketKey = undefined;
      this.persistMarketSelection();
      
      const idDisplay = marketSymbol ? `[${marketSymbol}]` : `#${idx}`;
      
      return {
        result: { success: true, data: { marketAddress: this.marketAddress, symbol: marketSymbol } },
        output: [
          info(`Market set (pre-graduation): ${idDisplay}${marketName ? ` ${marketName}` : ''}`),
          dim(`Address: ${marketAddr}`),
          dim('Key: (not available pre-graduation)'),
        ],
      };
    }
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

  async deposit(args: string[]) {
    return vaultCommands.deposit(this.getContext(), args);
  }

  async withdraw(args: string[]) {
    return vaultCommands.withdraw(this.getContext(), args);
  }

  async reserved() {
    return vaultCommands.reserved(this.getContext());
  }

  async order(args: string[]) {
    return orderbookCommands.order(this.getContext(), args);
  }

  async cancel(args: string[]) {
    return orderbookCommands.cancel(this.getContext(), args);
  }

  async claim(args: string[]) {
    return orderbookCommands.claim(this.getContext(), args);
  }

  async marketOrder(args: string[]) {
    return orderbookCommands.marketOrder(this.getContext(), args);
  }

  async state(args: string[] = []) {
    return stateCommands.state(this.getContext(), args);
  }

  async book(args: string[] = []) {
    return stateCommands.book(this.getContext(), args);
  }

  async positions() {
    return stateCommands.positions(this.getContext());
  }

  async marketinfo() {
    return stateCommands.marketinfo(this.getContext());
  }

  async markets() {
    return stateCommands.markets(this.getContext());
  }

  async orders(args: string[] = []) {
    return orderbookCommands.orders(this.getContext(), args);
  }

  async getorder(args: string[]) {
    return orderbookCommands.getorder(this.getContext(), args);
  }

  async spotsell(args: string[]) {
    return orderbookCommands.spotsell(this.getContext(), args);
  }

  async cancelspotsell(args: string[]) {
    return orderbookCommands.cancelspotsell(this.getContext(), args);
  }

  async spotsells() {
    return orderbookCommands.spotsells(this.getContext(), []);
  }

  async claimspotsell(args: string[]) {
    return orderbookCommands.claimspotsell(this.getContext(), args);
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

  async registermarket(args: string[] = [], onProgress?: (line: OutputLine) => void) {
    return marketCommands.registermarket(this.getContext(), args, onProgress);
  }

  async executeCommand(input: string): Promise<{ result: CommandResult; output: OutputLine[]; orderResult?: OrderResult }> {
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
      case 'deposit':
        return this.deposit(args);
      case 'withdraw':
        return this.withdraw(args);
      case 'reserved':
        return this.reserved();
      case 'order': {
        const res = await this.order(args);
        return { result: res.result, output: res.output, orderResult: res.orderResult };
      }
      case 'cancel':
        return this.cancel(args);
      case 'claim':
        return this.claim(args);
      case 'market':
        return this.marketOrder(args);
      case 'state':
        return this.state(args);
      case 'book':
        return this.book(args);
      case 'positions':
      case 'pos':
        return this.positions();
      case 'marketinfo':
        return this.marketinfo();
      case 'markets':
      case 'm':
        return this.markets();
      case 'orders':
        return this.orders(args);
      case 'getorder':
        return this.getorder(args);
      case 'spotsell':
        return this.spotsell(args);
      case 'cancelspotsell':
        return this.cancelspotsell(args);
      case 'spotsells':
        return this.spotsells();
      case 'claimspotsell':
        return this.claimspotsell(args);
      case 'createmarket':
        return this.createmarket(args);
      case 'graduate':
        return this.graduate(args);
      case 'marketstatus':
        return this.marketstatus(args);
      case 'registermarket':
        return this.registermarket(args);
      case 'setmarket':
        if (args.length < 1) {
          return {
            result: { success: false, message: 'Usage: setmarket <index>' },
            output: [errorLine('Usage: setmarket <index>')],
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
        plain('    registermarket            Register in TickBook (admin)'),
        plain('    setmarket <index>         Select market'),
        plain(''),
        dim(`  ${sep}`),
        plain(''),
        info('  TickBook'),
        dim('    └─ Graduated markets become TickBook pools'),
        plain(''),
        info('    Vault'),
        plain('      deposit <n> / withdraw <n|max> / reserved'),
        plain(''),
        info('    Orderbook'),
        plain('      order <yes|no> <range> <shares>   Place order'),
        plain('        order yes 40-60 100             Range order'),
        plain('        order yes 50 100                Limit order'),
        plain('      cancel <id> / claim <id> / orders / getorder <id>'),
        plain(''),
        info('    Spot Sells'),
        plain('      spotsell <side> <range> <shares>'),
        plain('      spotsells / cancelspotsell <id> / claimspotsell <id>'),
        plain(''),
        info('    State'),
        plain('      state / book [depth] / positions'),
        plain('      markets / marketinfo / info'),
        plain(''),
        info('    Testing'),
        plain('      simulate <n>            Place n random orders (1-1000)'),
        plain(''),
        dim(`  ${sep}`),
        plain(''),
        info('  Local Wallet (auto-sign)'),
        plain('    lw create / lw enable / lw disable / lw clear'),
        dim('    ⚠ Testnet only. Do not fund with real assets.'),
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
