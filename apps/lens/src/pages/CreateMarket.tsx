import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { post, fetchPosts } from '@lens-protocol/client/actions';
import { blockchainData, evmAddress, type SessionClient } from '@lens-protocol/client';
import { handleOperationWith } from '@lens-protocol/client/viem';
import { article, MetadataAttributeType } from '@lens-protocol/metadata';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { CheckCircle2, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  maxUint256,
  parseAbiParameters,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { useLensAuth } from '../hooks/useLensAuth';
import { useShowcase } from '../hooks/useShowcase';
import { useWGHOBalance } from '../hooks/useWGHOBalance';
import {
  ACTION_HUB_MAINNET,
  ACTION_HUB_TESTNET,
  PARAM_KEYS,
  WGHO_MAINNET,
  WGHO_TESTNET,
  encodeUint256Param,
} from '../lib/soothAction';
import {
  ACTIVE_LENS_CHAIN_ID,
  ACTIVE_SOOTH_POST_ACTION,
  IS_TESTNET,
} from '../lib/lensConfig';

const TAG_OPTIONS = ['crypto', 'politics', 'sports', 'tech', 'culture', 'defi'] as const;
const WAD = 10n ** 18n;
const LN2_WAD = 693147180559945309n;
const ACTION_HUB = (IS_TESTNET ? ACTION_HUB_TESTNET : ACTION_HUB_MAINNET) as Address;
const WGHO_TOKEN = (IS_TESTNET ? WGHO_TESTNET : WGHO_MAINNET) as Address;
const TOKEN_SYMBOL = IS_TESTNET ? 'WGRASS' : 'WGHO';
const EXPLORER_BASE = IS_TESTNET ? 'https://explorer.testnet.lens.xyz' : 'https://explorer.lens.xyz';

const EXECUTE_TX_ABI = [
  {
    name: 'executeTransaction',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

const UINT64_PARAMS = parseAbiParameters('uint64');
const UINT16_PARAMS = parseAbiParameters('uint16');

const encodeUint64Param = (value: bigint): Hex => encodeAbiParameters(UINT64_PARAMS, [value]);
const encodeUint16Param = (value: number): Hex => encodeAbiParameters(UINT16_PARAMS, [value]);

type Step = 1 | 2 | 3;

interface FormErrors {
  question?: string;
  resolution?: string;
  deadline?: string;
  liquidity?: string;
  fee?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getHeadline(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object' || !('__typename' in metadata)) {
    return '';
  }

  const typed = metadata as {
    __typename: string;
    title?: string | null;
    content?: string | null;
  };

  if (
    typed.__typename === 'ArticleMetadata' ||
    typed.__typename === 'ImageMetadata' ||
    typed.__typename === 'VideoMetadata'
  ) {
    return (typed.title ?? typed.content ?? '').trim();
  }

  if (typed.__typename === 'TextOnlyMetadata' || typed.__typename === 'LinkMetadata') {
    return (typed.content ?? '').trim();
  }

  return '';
}

async function resolvePostUrl(
  sessionClient: SessionClient,
  lensAccount: string,
  expectedQuestion: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await fetchPosts(sessionClient, {
      filter: {
        authors: [evmAddress(lensAccount)],
        metadata: { tags: { oneOf: ['sooth-market'] } },
      },
      pageSize: 'TEN',
    });

    if (!result.isErr()) {
      const match = result.value.items.find((item) => {
        if (item.__typename !== 'Post') {
          return false;
        }

        return getHeadline(item.metadata) === expectedQuestion.trim();
      });

      if (match && match.__typename === 'Post') {
        return `https://hey.xyz/posts/${match.id}`;
      }
    }

    await delay(1_500);
  }

  return null;
}

function formatTokenAmount(value: bigint): string {
  const asNumber = Number.parseFloat(formatUnits(value, 18));
  if (!Number.isFinite(asNumber)) {
    return '0.00';
  }
  return asNumber.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CreateMarket() {
  const navigate = useNavigate();
  const { open: openWalletModal } = useAppKit();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const auth = useLensAuth();
  const inShowcase = useShowcase();

  const [step, setStep] = useState<Step>(1);
  const [question, setQuestion] = useState('');
  const [resolutionCriteria, setResolutionCriteria] = useState('');
  const [deadline, setDeadline] = useState('');
  const [liquidityB, setLiquidityB] = useState('100');
  const [feePercent, setFeePercent] = useState('2');
  const [selectedTags, setSelectedTags] = useState<string[]>(['crypto']);
  const [errors, setErrors] = useState<FormErrors>({});

  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTxHash, setCreatedTxHash] = useState<string | null>(null);
  const [createdPostUrl, setCreatedPostUrl] = useState<string | null>(null);

  const derivedValues = useMemo(() => {
    let bWad: bigint | null = null;
    try {
      bWad = parseUnits(liquidityB.trim() === '' ? '0' : liquidityB, 18);
    } catch {
      bWad = null;
    }

    const fee = Number.parseFloat(feePercent);
    const feeBps = Number.isFinite(fee) ? Math.round(fee * 100) : NaN;

    const deadlineMs = deadline ? new Date(deadline).getTime() : NaN;
    const deadlineTimestamp = Number.isFinite(deadlineMs)
      ? BigInt(Math.floor(deadlineMs / 1000))
      : null;

    const subsidyWad = bWad && bWad > 0n ? (bWad * LN2_WAD) / WAD : 0n;

    return {
      bWad,
      feeBps,
      deadlineTimestamp,
      subsidyWad,
    };
  }, [deadline, feePercent, liquidityB]);

  const lensAccountAddress = auth.lensAccount ? (auth.lensAccount as Address) : undefined;
  const wgho = useWGHOBalance(lensAccountAddress, ACTION_HUB);

  const balance = wgho.data?.balance ?? 0n;
  const allowance = wgho.data?.allowance ?? 0n;
  const hasEnoughBalance = balance >= derivedValues.subsidyWad;
  const hasEnoughAllowance = allowance >= derivedValues.subsidyWad;

  const postOrExplorerUrl = createdPostUrl ?? (createdTxHash ? `${EXPLORER_BASE}/tx/${createdTxHash}` : null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag],
    );
  };

  const validateStepOne = () => {
    const nextErrors: FormErrors = {};

    const questionValue = question.trim();
    if (!questionValue) {
      nextErrors.question = 'Question is required.';
    } else if (questionValue.length > 280) {
      nextErrors.question = 'Question must be 280 characters or less.';
    }

    if (!resolutionCriteria.trim()) {
      nextErrors.resolution = 'Resolution criteria is required.';
    }

    if (!deadline) {
      nextErrors.deadline = 'Deadline is required.';
    } else {
      const deadlineMs = new Date(deadline).getTime();
      if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
        nextErrors.deadline = 'Deadline must be in the future.';
      }
    }

    if (!derivedValues.bWad || derivedValues.bWad <= 0n) {
      nextErrors.liquidity = 'Liquidity b must be greater than 0.';
    }

    if (!Number.isFinite(derivedValues.feeBps)) {
      nextErrors.fee = 'Fee must be a valid number.';
    } else if (derivedValues.feeBps < 0 || derivedValues.feeBps > 10_000) {
      nextErrors.fee = 'Fee must be between 0% and 100%.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinueToPreview = () => {
    if (!validateStepOne()) {
      return;
    }
    setStep(2);
  };

  const handleApprove = async () => {
    if (!walletClient || !auth.lensAccount) {
      setApprovalError('Connect wallet and sign into Lens before approving.');
      return;
    }

    setApprovalError(null);
    setIsApproving(true);

    try {
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [ACTION_HUB, maxUint256],
      });

      await walletClient.writeContract({
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
        address: auth.lensAccount as Address,
        abi: EXECUTE_TX_ABI,
        functionName: 'executeTransaction',
        args: [WGHO_TOKEN, 0n, approveData],
      });

      await wgho.refetch();
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateMarket = async () => {
    if (!auth.sessionClient || !auth.lensAccount) {
      setCreateError('Sign into Lens first.');
      return;
    }

    if (!walletClient) {
      setCreateError('Wallet client unavailable. Reconnect your wallet and try again.');
      return;
    }

    if (!derivedValues.bWad || !derivedValues.deadlineTimestamp || !Number.isFinite(derivedValues.feeBps)) {
      setCreateError('Form values are invalid. Return to Step 1 and review inputs.');
      return;
    }

    if (!hasEnoughBalance) {
      setCreateError(`Insufficient ${TOKEN_SYMBOL} balance for creator subsidy.`);
      return;
    }

    if (!hasEnoughAllowance) {
      setCreateError(`Approve ${TOKEN_SYMBOL} spending before creating the market.`);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreatedTxHash(null);
    setCreatedPostUrl(null);

    try {
      const metadata = article({
        title: question.trim(),
        content: `${question.trim()}\n\nResolution: ${resolutionCriteria.trim()}`,
        tags: ['sooth-market', ...selectedTags],
        attributes: [
          { key: 'sooth:type', value: 'prediction-market', type: MetadataAttributeType.STRING },
          { key: 'sooth:question', value: question.trim(), type: MetadataAttributeType.STRING },
          {
            key: 'sooth:resolution',
            value: resolutionCriteria.trim(),
            type: MetadataAttributeType.STRING,
          },
          {
            key: 'sooth:deadline',
            value: String(derivedValues.deadlineTimestamp),
            type: MetadataAttributeType.STRING,
          },
          { key: 'sooth:b', value: String(derivedValues.bWad), type: MetadataAttributeType.STRING },
          {
            key: 'sooth:feeBps',
            value: String(derivedValues.feeBps),
            type: MetadataAttributeType.STRING,
          },
          { key: 'sooth:oracle', value: 'creator', type: MetadataAttributeType.STRING },
        ],
      });

      const storageClient = StorageClient.create();
      const uploadResult = await storageClient.uploadAsJson(metadata, {
        acl: immutable(ACTIVE_LENS_CHAIN_ID),
      });

      const createResult = await post(auth.sessionClient, {
        contentUri: uploadResult.uri,
        actions: [
          {
            unknown: {
              address: evmAddress(ACTIVE_SOOTH_POST_ACTION),
              params: [
                {
                  raw: {
                    key: blockchainData(PARAM_KEYS.B),
                    data: blockchainData(encodeUint256Param(derivedValues.bWad)),
                  },
                },
                {
                  raw: {
                    key: blockchainData(PARAM_KEYS.DEADLINE),
                    data: blockchainData(encodeUint64Param(derivedValues.deadlineTimestamp)),
                  },
                },
                {
                  raw: {
                    key: blockchainData(PARAM_KEYS.FEE_BPS),
                    data: blockchainData(encodeUint16Param(derivedValues.feeBps)),
                  },
                },
              ],
            },
          },
        ],
      });

      if (createResult.isErr()) {
        throw new Error(createResult.error.message ?? 'Failed to create post');
      }

      const signAndSubmit = handleOperationWith(walletClient);
      type SignAndSubmitInput = Parameters<typeof signAndSubmit>[0];
      const txResult = await signAndSubmit(createResult.value as SignAndSubmitInput);

      if (txResult.isErr()) {
        throw new Error(txResult.error.message ?? 'Failed to submit transaction');
      }

      const txHash = txResult.value;
      setCreatedTxHash(txHash);

      const indexingResult = await auth.sessionClient.waitForTransaction(txHash);
      if (indexingResult.isErr()) {
        throw new Error(indexingResult.error.message ?? 'Transaction was not indexed');
      }

      const postUrl = await resolvePostUrl(auth.sessionClient, auth.lensAccount, question.trim());
      setCreatedPostUrl(postUrl);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create market');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`${inShowcase ? 'h-full' : 'h-dvh'} w-full bg-[#1a1a1b] text-white flex flex-col`}>
      <header className="shrink-0 border-b border-[#2d2d2e] px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="size-9 rounded-full bg-[#2d2d2e] border border-[#444] flex items-center justify-center"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold">Create Market</h1>
          <p className="text-xs text-[#888]">Step {step} of 3</p>
        </div>
      </header>

      <div className="px-4 pt-4 pb-2 grid grid-cols-3 gap-2">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className={`h-1.5 rounded-full transition-colors ${item <= step ? 'bg-[#00d4aa]' : 'bg-[#2d2d2e]'}`}
          />
        ))}
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-2 space-y-4">
        {step === 1 && (
          <section className="glass-panel rounded-2xl p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#888] mb-1.5">Question *</label>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={280}
                placeholder="Will ETH close above $5,000 by June 30, 2026?"
                className="w-full rounded-xl bg-[#1a1a1b] border border-[#444] px-3 py-2.5 text-sm focus:border-[#00d4aa] focus:outline-none"
              />
              <div className="mt-1 flex justify-between text-[11px] text-[#888]">
                <span>{errors.question ? <span className="text-[#e01b24]">{errors.question}</span> : 'Required'}</span>
                <span>{question.length}/280</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#888] mb-1.5">Resolution criteria *</label>
              <textarea
                value={resolutionCriteria}
                onChange={(event) => setResolutionCriteria(event.target.value)}
                rows={4}
                placeholder="Define exactly how YES/NO is resolved."
                className="w-full rounded-xl bg-[#1a1a1b] border border-[#444] px-3 py-2.5 text-sm focus:border-[#00d4aa] focus:outline-none"
              />
              {errors.resolution && <p className="mt-1 text-[11px] text-[#e01b24]">{errors.resolution}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#888] mb-1.5">Resolution deadline *</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="w-full rounded-xl bg-[#1a1a1b] border border-[#444] px-3 py-2.5 text-sm focus:border-[#00d4aa] focus:outline-none"
              />
              {errors.deadline && <p className="mt-1 text-[11px] text-[#e01b24]">{errors.deadline}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Liquidity b ({TOKEN_SYMBOL}) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={liquidityB}
                  onChange={(event) => setLiquidityB(event.target.value)}
                  className="w-full rounded-xl bg-[#1a1a1b] border border-[#444] px-3 py-2.5 text-sm focus:border-[#00d4aa] focus:outline-none"
                />
                {errors.liquidity && <p className="mt-1 text-[11px] text-[#e01b24]">{errors.liquidity}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1.5">Fee (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={feePercent}
                  onChange={(event) => setFeePercent(event.target.value)}
                  className="w-full rounded-xl bg-[#1a1a1b] border border-[#444] px-3 py-2.5 text-sm focus:border-[#00d4aa] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-[#888]">{Number.isFinite(derivedValues.feeBps) ? `${derivedValues.feeBps} bps` : 'Invalid fee'}</p>
                {errors.fee && <p className="mt-1 text-[11px] text-[#e01b24]">{errors.fee}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#888] mb-1.5">Category tags</label>
              <div className="flex flex-wrap gap-2">
                {TAG_OPTIONS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-[#00d4aa]/20 border-[#00d4aa]/40 text-[#00d4aa]'
                          : 'bg-[#1a1a1b] border-[#444] text-[#888]'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <>
            <section className="glass-panel rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#888] uppercase">Preview</p>
              <h2 className="text-base font-bold leading-snug">{question.trim()}</h2>
              <p className="text-sm text-[#bcbcbc] whitespace-pre-wrap">{resolutionCriteria.trim()}</p>
              <div className="text-xs text-[#888] space-y-1">
                <p>
                  Deadline:{' '}
                  <span className="text-white">{deadline ? new Date(deadline).toLocaleString() : 'Not set'}</span>
                </p>
                <p>
                  Liquidity b: <span className="text-white">{liquidityB || '0'} {TOKEN_SYMBOL}</span>
                </p>
                <p>
                  Fee: <span className="text-white">{feePercent || '0'}% ({Number.isFinite(derivedValues.feeBps) ? derivedValues.feeBps : '--'} bps)</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-[#888] uppercase">Creator Subsidy</p>
              <p className="text-2xl font-bold text-[#00d4aa]">~{formatTokenAmount(derivedValues.subsidyWad)} {TOKEN_SYMBOL}</p>
              <p className="text-[11px] text-[#888]">Calculated as b × ln(2). For b=100, subsidy is ~69.31 {TOKEN_SYMBOL}.</p>

              {!isConnected ? (
                <button
                  type="button"
                  onClick={() => openWalletModal()}
                  className="w-full rounded-xl bg-[#00d4aa] text-[#1a1a1b] py-2.5 text-sm font-bold"
                >
                  Connect Wallet
                </button>
              ) : !auth.isAuthenticated ? (
                auth.missingLensAccountMessage ? (
                  <div className="space-y-2">
                    <p className="text-sm text-[#e01b24]">{auth.missingLensAccountMessage}</p>
                    <a
                      href="https://onboarding.lens.xyz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-sm font-semibold text-[#00d4aa] underline"
                    >
                      Create a Lens account →
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => auth.login()}
                    className="w-full rounded-xl bg-[#00d4aa] text-[#1a1a1b] py-2.5 text-sm font-bold"
                  >
                    Sign into Lens
                  </button>
                )
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[#888]">Balance</span>
                      <span className="font-semibold">{formatTokenAmount(balance)} {TOKEN_SYMBOL}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#888]">Allowance to ActionHub</span>
                      <span className="font-semibold">{formatTokenAmount(allowance)} {TOKEN_SYMBOL}</span>
                    </div>
                  </div>

                  {!hasEnoughBalance && (
                    <div className="rounded-xl border border-[#e01b24]/40 bg-[#e01b24]/10 px-3 py-2 text-sm text-[#ff8f94] flex gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Insufficient {TOKEN_SYMBOL} balance for creator subsidy.</span>
                    </div>
                  )}

                  {!hasEnoughAllowance && (
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="w-full rounded-xl bg-[#00d4aa] text-[#1a1a1b] py-2.5 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isApproving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Approve {TOKEN_SYMBOL}
                    </button>
                  )}

                  {hasEnoughAllowance && hasEnoughBalance && (
                    <div className="rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/10 px-3 py-2 text-sm text-[#00d4aa] flex gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Approval ready. You can continue to create.</span>
                    </div>
                  )}

                  {approvalError && <p className="text-sm text-[#e01b24]">{approvalError}</p>}
                </>
              )}
            </section>
          </>
        )}

        {step === 3 && (
          <section className="glass-panel rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-[#888] uppercase">Create</p>
            <p className="text-sm text-[#bcbcbc]">This uploads metadata to Grove and creates a Lens post with SoothPostAction parameters (b, deadline, feeBps).</p>

            <div className="rounded-xl bg-[#1a1a1b] border border-[#444] px-3 py-2.5 text-sm space-y-1">
              <p className="flex justify-between"><span className="text-[#888]">Question</span><span className="text-right max-w-[70%]">{question.trim()}</span></p>
              <p className="flex justify-between"><span className="text-[#888]">Creator subsidy</span><span>~{formatTokenAmount(derivedValues.subsidyWad)} {TOKEN_SYMBOL}</span></p>
              <p className="flex justify-between"><span className="text-[#888]">Action contract</span><span className="font-mono text-[11px]">{ACTIVE_SOOTH_POST_ACTION}</span></p>
            </div>

            {isCreating && (
              <div className="rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/10 px-3 py-2 text-sm text-[#00d4aa] flex gap-2 items-center">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Creating market...</span>
              </div>
            )}

            {createError && (
              <div className="rounded-xl border border-[#e01b24]/40 bg-[#e01b24]/10 px-3 py-2 text-sm text-[#ff8f94]">
                {createError}
              </div>
            )}

            {createdTxHash && (
              <div className="rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/10 px-3 py-2 text-sm text-[#00d4aa] space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Market created!</span>
                </div>
                {postOrExplorerUrl && (
                  <a
                    href={postOrExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {createdPostUrl ? 'View post' : 'View transaction'}
                  </a>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer
        className="glass-nav border-t border-[#333] px-4 py-3 flex gap-2"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
            className="flex-1 rounded-xl border border-[#444] bg-[#2d2d2e] py-2.5 text-sm font-semibold"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded-xl border border-[#444] bg-[#2d2d2e] py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
        )}

        {step === 1 && (
          <button
            type="button"
            onClick={handleContinueToPreview}
            className="flex-1 rounded-xl bg-[#00d4aa] text-[#1a1a1b] py-2.5 text-sm font-bold"
          >
            Continue
          </button>
        )}

        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={!isConnected || !auth.isAuthenticated || !hasEnoughBalance || !hasEnoughAllowance}
            className="flex-1 rounded-xl bg-[#00d4aa] text-[#1a1a1b] py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Continue
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            onClick={handleCreateMarket}
            disabled={isCreating || Boolean(createdTxHash)}
            className="flex-1 rounded-xl bg-[#00d4aa] text-[#1a1a1b] py-2.5 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
            {createdTxHash ? 'Created' : 'Create Market'}
          </button>
        )}
      </footer>
    </div>
  );
}
