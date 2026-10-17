import { parseUnits, type Address } from 'viem';
import {
  assertMarketBinding,
  factoryReadClient,
  readFactoryQuote,
} from '../factory/factoryClient.js';
import { assertFactoryCatalogNewExposure } from '../factory/factoryCatalog.js';
import {
  buildFactoryTransaction,
  type FactoryTransactionAction,
} from '../factory/factoryTransactions.js';
import { planAmmTrade } from '../factory/factoryTrade/ammTradePlan.js';
import { BOOK_BUY, BOOK_SELL, centsToTick } from '../factory/factoryTrade/bookOrder.js';
import { planBookOrder } from '../factory/factoryTrade/bookOrderPlan.js';
import { formatSoothMarketReference } from './embed.js';
import { readSoothMarket, type SoothMarketData, type SoothResolvedMarket } from './runtime.js';
import {
  canPersistSoothPending,
  loadSoothPending,
  reconcileSoothPending,
  saveSoothPending,
  type SoothPendingTransaction,
  type SoothWalletAdapter,
} from './wallet.js';

export interface SoothTradeIntent {
  side: 'buy' | 'sell';
  outcome: 0 | 1;
  /** Decimal shares, with at most 18 fractional digits. */
  shares: string;
  /** Book limit price in cents; AMM trades use the live SDK quote. */
  price: string;
}
export interface SoothTradePreview {
  action: FactoryTransactionAction;
  /** Exact approval target. With a nonzero insufficient allowance, first explicitly approve zero. */
  approveNative: bigint | null;
  allowance: bigint;
  requiredNative: bigint;
  boundWad?: bigint;
  feeBps: number;
  description: string;
  data: SoothMarketData;
}
export interface SoothSubmittedTransaction extends SoothPendingTransaction {
  storageAvailable: boolean;
}

function sharesAmount(value: string): bigint {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,18})?$/.test(value)) {
    throw new Error('Enter shares as a decimal with at most 18 fractional digits.');
  }
  const amount = parseUnits(value, 18);
  if (amount <= 0n) throw new Error('Enter a number of shares above zero.');
  return amount;
}

async function checkNewExposure(
  resolved: SoothResolvedMarket,
  data: SoothMarketData,
): Promise<void> {
  const { blockNumber, blockTimestamp } = data.snapshot;
  if (blockTimestamp === null)
    throw new Error('A live chain timestamp is required for new exposure.');
  const catalog = await resolved.refreshCatalog();
  assertFactoryCatalogNewExposure(catalog, resolved.reference.market, {
    context: resolved.context,
    liveBlock: { number: blockNumber, timestamp: blockTimestamp },
  });
}

/** Read a fresh binding, balances and quote for every preview, including after approvals. */
export async function planSoothTrade(
  resolved: SoothResolvedMarket,
  account: Address,
  intent: SoothTradeIntent,
): Promise<SoothTradePreview> {
  if (intent.side !== 'buy' && intent.side !== 'sell') throw new Error('Invalid trade side.');
  if (intent.outcome !== 0 && intent.outcome !== 1) throw new Error('Invalid outcome.');
  const sharesWad = sharesAmount(intent.shares);
  const context = await assertMarketBinding({
    identity: resolved.reference,
    release: resolved.context.release,
    endpoints: resolved.endpoints,
    catalog: resolved.context.contracts,
    market: resolved.reference.market,
  });
  const current = { ...resolved, context };
  const data = await readSoothMarket(current, account);
  const { snapshot } = data;
  if (!snapshot.tradingOpen) throw new Error('Trading is closed for this market.');
  if (!data.account || data.account.address.toLowerCase() !== account.toLowerCase())
    throw new Error('Wallet balances are unavailable for this account.');
  if (intent.side === 'buy') await checkNewExposure(current, data);
  const wallet = data.account;
  const outcome = intent.outcome === 1 ? 'YES' : 'NO';
  if (resolved.reference.venue === 'amm') {
    const held = wallet.positions?.positions.find(
      (position) => position.market.toLowerCase() === resolved.reference.market.toLowerCase(),
    );
    if (!held) throw new Error('The current AMM position is unavailable.');
    const quote = await readFactoryQuote({
      context,
      client: factoryReadClient(resolved.client),
      market: resolved.reference.market,
      blockNumber: snapshot.blockNumber,
      outcome: intent.outcome,
      deltaShares: intent.side === 'buy' ? sharesWad : -sharesWad,
    });
    const plan = planAmmTrade({
      side: intent.side,
      outcome: intent.outcome,
      sharesWad,
      quote,
      token: data.token,
      balance: wallet.balance,
      allowance: wallet.allowance,
      held,
    });
    if (!plan.ok) throw new Error(plan.reason);
    return {
      action: {
        kind: 'trade',
        outcome: intent.outcome,
        deltaShares: plan.deltaShares,
        boundWad: plan.boundWad,
      },
      approveNative: plan.approveNative,
      allowance: wallet.allowance,
      requiredNative: plan.requiredNative,
      boundWad: plan.boundWad,
      feeBps: snapshot.ammFeeBps,
      data,
      description: `${intent.side === 'buy' ? 'Buy' : 'Sell'} ${intent.shares} ${outcome} shares using the live AMM quote with a 1% slippage bound.`,
    };
  }
  const priceTick = centsToTick(intent.price);
  const inventory = wallet.inventory;
  if (!inventory) throw new Error('The current order book inventory is unavailable.');
  const plan = planBookOrder({
    action: intent.side === 'buy' ? BOOK_BUY : BOOK_SELL,
    outcome: intent.outcome,
    priceTick,
    sharesWad,
    shareUnit: snapshot.shareUnit,
    feeBps: snapshot.bookFeeBps,
    token: data.token,
    balance: wallet.balance,
    allowance: wallet.allowance,
    inventory,
    postOnly: false,
  });
  if (!plan.ok) throw new Error(plan.reason);
  const now = snapshot.blockTimestamp;
  if (now === null || snapshot.deadline <= now)
    throw new Error('A current chain timestamp before the market deadline is required.');
  const validUntil = now + 300n < snapshot.deadline ? now + 300n : snapshot.deadline;
  return {
    action: {
      kind: 'placeOrder',
      order: {
        outcome: intent.outcome,
        action: intent.side === 'buy' ? BOOK_BUY : BOOK_SELL,
        priceTick: priceTick!,
        amount: sharesWad,
        matchLimit: 32,
        validUntil,
        expiry: snapshot.deadline,
        rest: true,
        postOnly: false,
        maxTokenIn: plan.maxTokenIn,
        // A resting order may fill zero shares on arrival; the limit tick protects each execution.
        minTokenOut: 0n,
      },
    },
    approveNative: plan.approveNative,
    allowance: wallet.allowance,
    requiredNative: plan.maxTokenIn,
    feeBps: snapshot.bookFeeBps,
    data,
    description: `Place a limit order to ${intent.side} ${intent.shares} ${outcome} shares at ${intent.price} cents per share before fees. It may fill partially or rest until the market deadline; submission does not mean it filled.`,
  };
}

function actionLabel(action: FactoryTransactionAction): string {
  switch (action.kind) {
    case 'approve':
      return action.amountNative === 0n ? 'Reset collateral approval' : 'Approve collateral';
    case 'trade':
      return `${action.deltaShares > 0n ? 'Buy' : 'Sell'} ${action.outcome === 1 ? 'YES' : 'NO'} shares`;
    case 'placeOrder':
      return `Place ${action.order.action === BOOK_BUY ? 'buy' : 'sell'} limit order`;
    default:
      return action.kind;
  }
}

async function assertWalletSession(
  wallet: SoothWalletAdapter,
  account: Address,
  chainId: number,
): Promise<void> {
  const session = await wallet.getSession();
  if (!session || session.account.toLowerCase() !== account.toLowerCase())
    throw new Error('The wallet account changed. Reconnect and review this action.');
  if (session.chainId !== chainId)
    throw new Error('The wallet chain changed. Switch to the market chain and review this action.');
}

const submitting = new Set<string>();

/** Submit exactly one explicit action. Approvals and trades each require their own call. */
export async function sendSoothAction(
  resolved: SoothResolvedMarket,
  wallet: SoothWalletAdapter,
  account: Address,
  action: FactoryTransactionAction,
  onPending: (pending: SoothSubmittedTransaction) => void,
): Promise<SoothSubmittedTransaction> {
  const market = formatSoothMarketReference(resolved.reference);
  const normalizedAccount = account.toLowerCase();
  const key = `${market}:${normalizedAccount}`;
  if (submitting.has(key)) {
    throw new Error(
      'This account already has a pending action on this market. Wait for its receipt before submitting another action.',
    );
  }
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== 'function') {
    throw new Error(
      'This browser cannot coordinate wallet submissions across windows. Use a browser with Web Locks support.',
    );
  }
  submitting.add(key);
  return new Promise<SoothSubmittedTransaction>((resolve, reject) => {
    void locks
      .request(`sooth:submit:${key}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock) {
          throw new Error(
            'Another window is submitting an action on this market. Wait for it to finish, then review again.',
          );
        }
        if (!canPersistSoothPending()) {
          throw new Error(
            'Shared pending transaction storage is unavailable. Enable browser storage before signing.',
          );
        }
        if (
          loadSoothPending(market).some(
            (pending) => pending.account.toLowerCase() === normalizedAccount,
          )
        ) {
          throw new Error(
            'This account already has a pending action on this market. Wait for its receipt before submitting another action.',
          );
        }
        await assertWalletSession(wallet, account, resolved.reference.chainId);
        const request = await buildFactoryTransaction({
          context: resolved.context,
          endpoints: resolved.endpoints,
          market: resolved.reference.market,
          account,
          action,
        });
        const grantsAllowance = action.kind === 'approve' && action.amountNative > 0n;
        if (action.kind === 'trade' || action.kind === 'placeOrder' || grantsAllowance) {
          const current = { ...resolved, context: request.verifiedContext };
          const data = await readSoothMarket(current, account);
          if (!data.snapshot.tradingOpen) throw new Error('Trading is closed for this market.');
          const addsExposure =
            grantsAllowance ||
            (action.kind === 'trade' && action.deltaShares > 0n) ||
            (action.kind === 'placeOrder' && action.order.action === BOOK_BUY);
          if (addsExposure) await checkNewExposure(current, data);
        }
        await assertWalletSession(wallet, account, request.chainId);
        await resolved.client.simulateContract({
          account: request.account,
          address: request.address,
          abi: request.abi,
          functionName: request.functionName,
          args: request.args,
          value: request.value,
        });
        await assertWalletSession(wallet, account, request.chainId);
        if (!canPersistSoothPending()) {
          throw new Error(
            'Shared pending transaction storage is unavailable. Enable browser storage before signing.',
          );
        }
        if (
          loadSoothPending(market).some(
            (pending) => pending.account.toLowerCase() === normalizedAccount,
          )
        ) {
          throw new Error(
            'This account already has a pending action on this market. Wait for its receipt before submitting another action.',
          );
        }
        const hash = await wallet.sendTransaction({
          account: request.account,
          chainId: request.chainId,
          to: request.to,
          data: request.data,
          value: request.value,
        });
        const pending: SoothPendingTransaction = {
          version: 1,
          market,
          account: request.account,
          chainId: request.chainId,
          hash,
          to: request.to,
          data: request.data,
          submittedAt: Date.now(),
          label: actionLabel(action),
        };
        const submitted = { ...pending, storageAvailable: saveSoothPending(pending) };
        try {
          onPending(submitted);
        } catch {
          /* A host notification failure cannot undo a broadcast or its stored receipt identity. */
        }
        if (!submitted.storageAvailable) {
          // Return the known hash immediately, but keep other windows out until they can recover it.
          resolve(submitted);
          for (;;) {
            await new Promise<void>((resume) => setTimeout(resume, 4_000));
            if (saveSoothPending(pending)) break;
            try {
              const state = await reconcileSoothPending(resolved.client, pending);
              if (state.status !== 'pending') break;
            } catch {
              // Unavailable receipt evidence must not permit another signature.
            }
          }
        }
        return submitted;
      })
      .then(
        (submitted) => {
          submitting.delete(key);
          resolve(submitted);
        },
        (error: unknown) => {
          submitting.delete(key);
          reject(error);
        },
      );
  });
}
