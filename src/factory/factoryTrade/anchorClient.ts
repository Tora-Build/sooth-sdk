/** Quorum reads use caller-pinned endpoints, never endpoints learned from a catalog. */
import { createPublicClient, http, type TransactionReceipt } from 'viem';
import type { BindingRead, BindingReader } from '../factoryClient.js';
import type { ReceiptSource } from './receiptWait.js';
import { TradeMessageError } from './tradeMessageError.js';

/** One slow endpoint must not hold the trade. */
export const ANCHOR_TIMEOUT_MS = 4_000;
/** Answers needed for the quorum reads. */
export const ANCHOR_MIN_ANSWERS = 2;
/**
 * Times an endpoint that failed or timed out is asked again before a read
 * fails. Public RPCs drop single requests; with two endpoints and a quorum of
 * two, one dropped request would otherwise stop the trade. A retry never
 * weakens the quorum: the answers must still agree.
 */
export const ANCHOR_RETRIES = 1;

/**
 * The wallet transport's order for a chain: the build's anchor endpoints
 * first, the manifest's after them. Display reads only. viem's fallback
 * transport moves on at the first error, so this order is a help, not a trust boundary;
 * the binding never uses the wallet transport.
 */
export function walletRpcUrls(
  _chainId: number,
  manifestUrls: readonly string[],
  trustedUrls: readonly string[],
): string[] {
  return [...new Set([...trustedUrls, ...manifestUrls])];
}

export interface AnchorEndpoint {
  url: string;
  reader: BindingReader & { getChainId(): Promise<number> };
}

export interface AnchorOptions {
  timeoutMs?: number;
  minAnswers?: number;
  retries?: number;
}

type ReadCall = Parameters<ReturnType<typeof createPublicClient>['readContract']>[0];

/** One viem client per constant endpoint; no retry, no batching, a short timeout. */
const anchorClient = (url: string) =>
  createPublicClient({
    transport: http(url, { timeout: ANCHOR_TIMEOUT_MS, retryCount: 0, batch: false }),
  });

export function anchorEndpoints(_chainId: number, urls: readonly string[]): AnchorEndpoint[] {
  return urls.map((url) => {
    const client = anchorClient(url);
    return {
      url,
      reader: {
        getChainId: () => client.getChainId(),
        getBlockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
        readContract: (call: BindingRead) => client.readContract(call as unknown as ReadCall),
      },
    };
  });
}

/**
 * The same constant endpoints as sources for a sent transaction's receipt.
 * Any one that has the receipt is enough: a receipt only tells the page to go
 * on, and the binding reads stay quorum reads.
 */
export function anchorReceiptSources(
  _chainId: number,
  urls: readonly string[],
): ReceiptSource<TransactionReceipt>[] {
  return urls.map((url) => {
    const client = anchorClient(url);
    return {
      name: new URL(url).host,
      getTransactionReceipt: (hash: `0x${string}`) => client.getTransactionReceipt({ hash }),
    };
  });
}

const host = (url: string) => new URL(url).host;
const normalise = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint'
      ? item.toString()
      : typeof item === 'string'
        ? item.toLowerCase()
        : item,
  );
const reason = (error: unknown) =>
  error instanceof Error ? error.message || error.name : String(error);

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} did not answer within ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Reads whose answer every endpoint must give alike: the node's deployer and the market's adjudicator (the settle target). */
const QUORUM_READS: Readonly<Record<string, string>> = {
  nodeDeployer: 'the node deployer',
  adjudicator: "the market's adjudicator",
};

/**
 * A `BindingReader` for `assertMarketBinding` over the chain's constant
 * endpoints. The first read asks every endpoint for its chain id and its head
 * (the verification stage): at least `minAnswers` must answer, an endpoint
 * that answers for another chain refuses the binding by name, and the head is
 * the lowest answered, so every endpoint that answered has that block. Only
 * endpoints that passed that stage are asked anything else. Every contract
 * read requires at least two equal answers and refuses any disagreement.
 */
export function anchorReader(
  chainId: number,
  endpoints: readonly AnchorEndpoint[],
  options: AnchorOptions = {},
): BindingReader {
  const timeoutMs = options.timeoutMs ?? ANCHOR_TIMEOUT_MS;
  const minAnswers = options.minAnswers ?? ANCHOR_MIN_ANSWERS;
  const retries = options.retries ?? ANCHOR_RETRIES;
  if (!Number.isInteger(minAnswers) || minAnswers < 2)
    throw new TradeMessageError('At least two anchor endpoints must agree.');
  if (
    new Set(
      endpoints.map((endpoint) => {
        const url = new URL(endpoint.url);
        url.hash = '';
        return url.href;
      }),
    ).size !== endpoints.length
  )
    throw new TradeMessageError('Duplicate anchor RPC endpoints.');
  if (endpoints.length < minAnswers) {
    throw new TradeMessageError(
      `This build has no anchor RPC endpoints for chain ${chainId}. Nothing was signed.`,
    );
  }
  /** The endpoints that answered the chain id and head for this chain, and the lowest head. Asked once; a failed check is asked again on the next read. */
  let verified: Promise<{ pool: readonly AnchorEndpoint[]; head: bigint }> | null = null;
  /** The endpoints that answered every quorum read so far. */
  let agreed: readonly AnchorEndpoint[] | null = null;

  const askAll = async <T>(
    pool: readonly AnchorEndpoint[],
    what: string,
    ask: (endpoint: AnchorEndpoint) => Promise<T>,
  ) => {
    const settle = (endpoints: readonly AnchorEndpoint[]) =>
      Promise.allSettled(
        endpoints.map((endpoint) => withTimeout(ask(endpoint), timeoutMs, host(endpoint.url))),
      );
    let results = await settle(pool);
    // Ask the endpoints that failed again; the ones that answered keep their answer.
    for (let n = 0; n < retries && results.some((result) => result.status === 'rejected'); n++) {
      const again = await settle(pool.filter((_, i) => results[i].status === 'rejected'));
      let k = 0;
      results = results.map((result) => (result.status === 'rejected' ? again[k++] : result));
    }
    const answers = results.flatMap((result, i) =>
      result.status === 'fulfilled' ? [{ endpoint: pool[i], value: result.value }] : [],
    );
    const failures = results.flatMap((result, i) =>
      result.status === 'rejected' ? [`${host(pool[i].url)}: ${reason(result.reason)}`] : [],
    );
    if (answers.length < minAnswers) {
      throw new TradeMessageError(
        `Only ${answers.length} of ${pool.length} RPC endpoints answered for ${what}; ${minAnswers} must answer and agree. Nothing was signed.`,
        failures.length > 0 ? failures.join('\n') : null,
      );
    }
    return answers;
  };

  const verify = () => {
    if (verified) return verified;
    const attempt = (async () => {
      const answers = await askAll(endpoints, 'the chain head', async (endpoint) => {
        const [chain, head] = await Promise.all([
          endpoint.reader.getChainId(),
          endpoint.reader.getBlockNumber(),
        ]);
        return { chain, head };
      });
      const elsewhere = answers.find((answer) => answer.value.chain !== chainId);
      if (elsewhere) {
        throw new TradeMessageError(
          `The RPC endpoint ${host(elsewhere.endpoint.url)} answers for chain ${elsewhere.value.chain}, not ${chainId}. Nothing was signed.`,
        );
      }
      return {
        pool: answers.map((answer) => answer.endpoint),
        head: answers
          .map((answer) => answer.value.head)
          .reduce((low, value) => (value < low ? value : low)),
      };
    })();
    verified = attempt;
    // A failed check is not kept: the next read (the user's next Review) asks again.
    attempt.catch(() => {
      if (verified === attempt) verified = null;
    });
    return attempt;
  };

  const quorum = async (what: string, call: BindingRead): Promise<unknown> => {
    const { pool } = await verify();
    const answers = await askAll(pool, what, (endpoint) => endpoint.reader.readContract(call));
    const first = normalise(answers[0].value);
    if (answers.some((answer) => normalise(answer.value) !== first)) {
      throw new TradeMessageError(
        `The RPC endpoints disagree about ${what}: ${answers.map((answer) => `${host(answer.endpoint.url)} says ${normalise(answer.value)}`).join(', ')}. Nothing was signed.`,
      );
    }
    const answered = new Set(answers.map((answer) => answer.endpoint));
    agreed = (agreed ?? pool).filter((endpoint) => answered.has(endpoint));
    if (agreed.length === 0) {
      throw new TradeMessageError(
        `No RPC endpoint answered every binding read. Nothing was signed.`,
      );
    }
    return answers[0].value;
  };

  return {
    async getBlockNumber() {
      return (await verify()).head;
    },
    async readContract(call) {
      return quorum(QUORUM_READS[call.functionName] ?? call.functionName, call);
    },
  };
}
