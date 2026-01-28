import blessed from 'blessed';
import type { ArbitrageOpportunity } from './types.js';

const C = {
  bg: '#272822',
  fg: '#F8F8F2',
  gray: '#75715E',
  green: '#A6E22E',
  pink: '#F92672',
  cyan: '#66D9EF',
  yellow: '#E6DB74',
  purple: '#AE81FF',
  orange: '#FD971F',
};

export interface DashboardState {
  chain: string;
  chainId: number;
  keeperAddress: string;
  mode: 'LIVE' | 'DRY RUN';
  walletEth: string;
  walletUsdc: string;
  vaultUsdc: string;
  vaultYes: string;
  vaultNo: string;
  totalProfit: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  opportunities: ArbitrageOpportunity[];
  logs: string[];
  marketsCount: number;
  activeMarkets: number;
  lastScanTime: Date | null;
}

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private mainBox: blessed.Widgets.BoxElement;
  private logBox: blessed.Widgets.Log;
  private state: DashboardState;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.state = {
      chain: '', chainId: 0, keeperAddress: '', mode: 'DRY RUN',
      walletEth: '0.00', walletUsdc: '0.00', vaultUsdc: '0.00',
      vaultYes: '0.00', vaultNo: '0.00',
      totalProfit: 0, totalTrades: 0, successfulTrades: 0, failedTrades: 0,
      opportunities: [], logs: [],
      marketsCount: 0, activeMarkets: 0, lastScanTime: null,
    };

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Sooth Keeper',
      fullUnicode: true,
    });

    this.mainBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      style: { fg: C.fg },
    });

    this.logBox = blessed.log({
      parent: this.screen,
      top: '50%',
      left: 0,
      width: '100%',
      height: '50%',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: ' ', style: { bg: C.gray } },
      border: { type: 'line' },
      label: ' LOG ',
      style: { 
        fg: C.fg, 
        border: { fg: C.gray },
        label: { fg: C.gray },
      },
      padding: { left: 1 },
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.destroy();
      process.exit(0);
    });

    this.render();
  }

  private formatUptime(): string {
    const s = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }

  private pad(str: string, len: number): string {
    return str.padEnd(len);
  }

  private render(): void {
    const mode = this.state.mode === 'LIVE' 
      ? `{${C.pink}-fg}●{/} LIVE` 
      : `{${C.yellow}-fg}○{/} DRY`;
    
    const profit = this.state.totalProfit;
    const profitStr = `{${profit >= 0 ? C.green : C.pink}-fg}${profit >= 0 ? '+' : ''}${profit.toFixed(2)}{/}`;
    
    const winRate = this.state.totalTrades > 0 
      ? Math.round((this.state.successfulTrades / this.state.totalTrades) * 100)
      : 0;

    let content = `
  {bold}SOOTH KEEPER{/}  {${C.gray}-fg}│{/}  {${C.cyan}-fg}${this.state.chain}{/}  {${C.gray}-fg}│{/}  ${mode}  {${C.gray}-fg}│{/}  {${C.gray}-fg}${this.state.keeperAddress.slice(0, 8)}...{/}

  {${C.gray}-fg}PROFIT{/}     ${profitStr} {${C.gray}-fg}USDC{/}
  {${C.gray}-fg}TRADES{/}     {${C.green}-fg}${this.state.successfulTrades}{/}W {${C.pink}-fg}${this.state.failedTrades}{/}L {${C.gray}-fg}(${winRate}%){/}
  {${C.gray}-fg}UPTIME{/}     ${this.formatUptime()}
  {${C.gray}-fg}VAULT{/}      {${C.green}-fg}${this.state.vaultUsdc}{/} USDC  {${C.cyan}-fg}${this.state.vaultYes}{/} YES  {${C.purple}-fg}${this.state.vaultNo}{/} NO

  {${C.gray}-fg}─────────────────────────────────────────────────────────────────────{/}
  {${C.gray}-fg}SIDE     SPREAD     SHARES     RANGE                PROFIT{/}
  {${C.gray}-fg}─────────────────────────────────────────────────────────────────────{/}`;

    if (this.state.opportunities.length === 0) {
      content += `\n  {${C.gray}-fg}No opportunities{/}`;
    } else {
      for (const opp of this.state.opportunities.slice(0, 5)) {
        const side = opp.buyOrder.outcome === 1 
          ? `{${C.cyan}-fg}YES{/}` 
          : `{${C.purple}-fg}NO{/}`;
        const spread = `{${C.yellow}-fg}${(opp.spread / 10).toFixed(1)}%{/}`;
        const shares = (Number(opp.maxShares) / 1e18).toFixed(1);
        const range = `${(opp.sellPrice / 10).toFixed(0)}% -> ${(opp.buyPrice / 10).toFixed(0)}%`;
        const est = `{${C.green}-fg}+${(Number(opp.estimatedProfitWad) / 1e18).toFixed(2)}{/}`;
        
        content += `\n  ${this.pad(side, 12)}${this.pad(spread, 14)}${this.pad(shares, 14)}${this.pad(range, 22)}${est}`;
      }
    }

    this.mainBox.setContent(content);
    this.screen.render();
  }

  updateChainInfo(chain: string, chainId: number, keeperAddress: string, mode: 'LIVE' | 'DRY RUN'): void {
    this.state.chain = chain;
    this.state.chainId = chainId;
    this.state.keeperAddress = keeperAddress;
    this.state.mode = mode;
    this.render();
  }

  updateBalances(eth: string, usdc: string, vaultUsdc: string, vaultYes: string, vaultNo: string): void {
    this.state.walletEth = eth;
    this.state.walletUsdc = usdc;
    this.state.vaultUsdc = vaultUsdc;
    this.state.vaultYes = vaultYes;
    this.state.vaultNo = vaultNo;
    this.render();
  }

  updateMarkets(total: number, active: number): void {
    this.state.marketsCount = total;
    this.state.activeMarkets = active;
    this.render();
  }

  updateOpportunities(opportunities: ArbitrageOpportunity[]): void {
    this.state.opportunities = opportunities;
    this.state.lastScanTime = new Date();
    this.render();
  }

  recordTrade(success: boolean, profit: number): void {
    this.state.totalTrades++;
    if (success) {
      this.state.successfulTrades++;
      this.state.totalProfit += profit;
    } else {
      this.state.failedTrades++;
    }
    this.render();
  }

  log(message: string): void {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.logBox.log(`{${C.gray}-fg}${ts}{/} ${message}`);
  }

  logSuccess(message: string): void {
    this.log(`{${C.green}-fg}✓{/} ${message}`);
  }

  logError(message: string): void {
    this.log(`{${C.pink}-fg}✗{/} ${message}`);
  }

  logInfo(message: string): void {
    this.log(`{${C.cyan}-fg}›{/} ${message}`);
  }

  logWarn(message: string): void {
    this.log(`{${C.yellow}-fg}!{/} ${message}`);
  }

  destroy(): void {
    this.screen.destroy();
  }
}
