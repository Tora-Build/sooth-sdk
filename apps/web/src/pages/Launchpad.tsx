import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useConfig, useReadContract, useWriteContract } from 'wagmi';
import { deployContract, waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, Address } from 'viem';
import {
    Rocket, Scale, Shield, DollarSign,
    Info, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { TRUTH_MARKET_BYTECODE } from '../config/bytecode';
import { ABIS, ERC20_ABI } from '../config/abis';
import { ADJUDICATOR_REGISTRY, GUARDIAN_REGISTRY } from '../config/registries';
import { useDeployments } from '../hooks/useDeployments';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

// Features
import { LaunchpadHeader } from '../components/features/launchpad/LaunchpadHeader';
import { EarningsSimulator } from '../components/features/launchpad/EarningsSimulator';
import { AddressSelector } from '../components/common/AddressSelector';

const MARKET_CATEGORIES = [
    { id: 'crypto', name: 'Crypto', icon: '₿' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
    { id: 'politics', name: 'Politics', icon: '⚖️' },
    { id: 'custom', name: 'Custom', icon: '✨' }
];

const InfoTooltip = ({ content }: { content: string }) => (
    <div className="group relative inline-block ml-1">
        <Info className="w-4 h-4 text-slate-500 hover:text-cyan-400 transition-colors cursor-help" />
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
    </div>
);

export const Launchpad = () => {
    const { address: userAddress } = useAccount();
    const config = useConfig();
    const navigate = useNavigate();
    const deployments = useDeployments();
    const { writeContractAsync } = useWriteContract();

    // --- Form State ---
    const [form, setForm] = useState({
        question: '',
        category: 'crypto',
        expirationMode: '7d', // 7d, 30d, custom, open
        customExpiration: '',
        initialLiquidity: '1000', // USDC
        deployPending: false
    });

    // --- Selector States ---
    const [adjudicatorMode, setAdjudicatorMode] = useState<'registry' | 'custom'>('registry');
    const [selectedAdjudicatorId, setSelectedAdjudicatorId] = useState('brevis-opt');
    const [customAdjudicator, setCustomAdjudicator] = useState<string>(ADJUDICATOR_REGISTRY[0].address);

    const [guardianMode, setGuardianMode] = useState<'registry' | 'custom'>('registry');
    const [selectedGuardianId, setSelectedGuardianId] = useState('me');
    const [customGuardian, setCustomGuardian] = useState<string>('');

    // Set default guardian to user address on load
    useEffect(() => {
        if (userAddress && selectedGuardianId === 'me') {
            setCustomGuardian(userAddress);
        }
    }, [userAddress, selectedGuardianId]);

    // --- Derived State ---
    const launchpadEngineAddress = deployments?.contracts['LaunchpadEngine'] as Address;
    const usdcAddress = deployments?.contracts['MockUSDC'] as Address;

    // USDC Decimals
    const { data: usdcDecimals } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !!usdcAddress }
    });

    // Calculate b (Liquidity Parameter)
    // deposit = b * ln(2) => b = deposit / ln(2)
    // b ~= deposit * 1.4427
    const depositAmount = parseFloat(form.initialLiquidity || '0');
    // const bValue = depositAmount * 1.442695; // Math checked
    const bWei = usdcDecimals ? parseUnits((depositAmount * 1.442695).toFixed(6), 18) : BigInt(0);
    const depositWei = usdcDecimals ? parseUnits(depositAmount.toString(), usdcDecimals as number) : BigInt(0);

    // Allowance Check
    const { data: allowanceData } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress as Address, launchpadEngineAddress],
        query: { enabled: !!userAddress && !!launchpadEngineAddress }
    });
    const allowance = allowanceData as bigint | undefined;

    // --- Handlers ---

    const getDeadline = () => {
        if (form.expirationMode === 'open') return 4102444800; // Jan 1 2100
        const now = Math.floor(Date.now() / 1000);
        if (form.expirationMode === '7d') return now + 7 * 86400;
        if (form.expirationMode === '30d') return now + 30 * 86400;
        if (form.expirationMode === 'custom' && form.customExpiration) {
            return Math.floor(new Date(form.customExpiration).getTime() / 1000);
        }
        return now + 7 * 86400; // Fallback
    };

    const handleDeploy = async () => {
        if (!userAddress || !launchpadEngineAddress || !usdcDecimals) {
            toast.error('Network not ready');
            return;
        }

        if (!customAdjudicator.startsWith('0x') || !customGuardian.startsWith('0x')) {
            toast.error('Invalid Adjudicator or Guardian address');
            return;
        }

        const toastId = toast.loading('Initiating Market Creation...');
        setForm(p => ({ ...p, deployPending: true }));

        try {
            // 1. Approve USDC if needed
            if (allowance === undefined || allowance < depositWei) {
                toast.loading('Please approve USDC...', { id: toastId });
                const approveHash = await writeContractAsync({
                    abi: ERC20_ABI,
                    address: usdcAddress,
                    functionName: 'approve',
                    args: [launchpadEngineAddress, depositWei]
                });
                toast.loading("Waiting for Approval...", { id: toastId });
                await waitForTransactionReceipt(config, { hash: approveHash });
                toast.success("USDC Approved!", { id: toastId });
            }

            // 2. Deploy TruthMarket
            toast.loading('Deploying Market Contract...', { id: toastId });
            const deadline = getDeadline();
            const deployHash = await deployContract(config, {
                abi: ABIS.TruthMarket,
                bytecode: TRUTH_MARKET_BYTECODE as `0x${string}`,
                args: [
                    userAddress,
                    customAdjudicator as Address,
                    customGuardian as Address,
                    BigInt(deadline)
                ]
            });

            const receipt = await waitForTransactionReceipt(config, { hash: deployHash });
            const marketAddress = receipt.contractAddress;

            if (!marketAddress) throw new Error("Deployment failed");

            // 3. Register Market
            toast.loading('Initializing Liquidity...', { id: toastId });
            const symbol = "PRED";

            // Save metadata to local storage (Legacy/Fallback)
            const marketMetaKey = `market_meta_${marketAddress.toLowerCase()}`;
            const metadata = {
                name: form.question,
                category: form.category,
                created: Date.now(),
                type: 'v10_launchpad_unified'
            };
            localStorage.setItem(marketMetaKey, JSON.stringify(metadata));

            await writeContractAsync({
                abi: ABIS.LaunchpadEngine,
                address: launchpadEngineAddress,
                functionName: 'createMarket',
                args: [
                    marketAddress,
                    bWei,
                    form.question.slice(0, 50),
                    symbol
                ]
            });

            toast.success('Market Launched!', { id: toastId });

            // Navigate directly to trade page 
            // Trade.tsx now supports direct address lookup for unindexed markets
            navigate(`/trade/${marketAddress}`);

        } catch (e: any) {
            console.error(e);
            toast.error('Failed: ' + (e.shortMessage || e.message), { id: toastId });
        } finally {
            setForm(p => ({ ...p, deployPending: false }));
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-24">
            <LaunchpadHeader />

            {/* 1. Market Details */}
            <Card className="p-6 border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs border border-slate-700 font-mono">1</span>
                    Market Question
                </h2>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">Question</label>
                        <input
                            type="text"
                            value={form.question}
                            onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                            placeholder="e.g. Will Bitcoin exceed $100k by 2026?"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-base text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
                        />
                        <p className="text-xs text-slate-500">Must be resolvable with a clear Yes/No outcome.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">Category</label>
                        <div className="flex flex-wrap gap-2">
                            {MARKET_CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setForm(p => ({ ...p, category: cat.id }))}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium border transition-all flex items-center gap-2",
                                        form.category === cat.id
                                            ? "bg-slate-800 text-white border-slate-600 ring-1 ring-slate-500"
                                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                    )}
                                >
                                    <span>{cat.icon}</span>
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                            Expiration
                            <InfoTooltip content="When trading stops and the market waits for resolution." />
                        </label>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {[
                                { id: '7d', label: '7 Days' },
                                { id: '30d', label: '30 Days' },
                                { id: 'custom', label: 'Custom' },
                                { id: 'open', label: 'Open-End' }
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setForm(p => ({ ...p, expirationMode: mode.id }))}
                                    className={cn(
                                        "py-2 rounded-lg text-xs font-bold border transition-all",
                                        form.expirationMode === mode.id
                                            ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50"
                                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                    )}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                        {form.expirationMode === 'custom' && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <input
                                    type="datetime-local"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm"
                                    value={form.customExpiration}
                                    onChange={e => setForm(p => ({ ...p, customExpiration: e.target.value }))}
                                />
                            </div>
                        )}
                        {form.expirationMode === 'open' && (
                            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-start gap-3 animate-in fade-in">
                                <Activity className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-indigo-300">
                                    <span className="font-bold">Open-Ended Market:</span> Deadline set to Year 2100.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* 2. Oracle & Security */}
            <Card className="p-6 border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs border border-slate-700 font-mono">2</span>
                    Oracle & Security
                </h2>

                <div className="space-y-8">
                    <AddressSelector
                        label="Adjudicator (Resolution Authority)"
                        icon={Scale}
                        options={ADJUDICATOR_REGISTRY}
                        selectedMode={adjudicatorMode}
                        setSelectedMode={setAdjudicatorMode}
                        selectedRegistryId={selectedAdjudicatorId}
                        setSelectedRegistryId={setSelectedAdjudicatorId}
                        customAddress={customAdjudicator}
                        setCustomAddress={setCustomAdjudicator}
                    />

                    <div className="w-full h-px bg-slate-800/50" />

                    <AddressSelector
                        label="Guardian (Veto Power)"
                        icon={Shield}
                        options={GUARDIAN_REGISTRY}
                        selectedMode={guardianMode}
                        setSelectedMode={setGuardianMode}
                        selectedRegistryId={selectedGuardianId}
                        setSelectedRegistryId={setSelectedGuardianId}
                        customAddress={customGuardian}
                        setCustomAddress={setCustomGuardian}
                        userAddress={userAddress}
                    />
                </div>
            </Card>

            {/* 3. Liquidity */}
            <Card className="p-6 border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs border border-slate-700 font-mono">3</span>
                    Liquidity & Economics
                </h2>

                <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                                <DollarSign className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm">Creator Economics</h3>
                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                    You earn <span className="text-emerald-400 font-bold">5% trading fees</span> on all initial volume. Your liquidity seeds <strong>Spot-First</strong> discovery in the Combined Orderbook.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-300">Initial Deposit (USDC)</label>
                        <div className="flex gap-2 mb-2">
                            {['100', '1000', '5000'].map(amt => (
                                <button
                                    key={amt}
                                    onClick={() => setForm(p => ({ ...p, initialLiquidity: amt }))}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-sm font-bold border transition-all",
                                        form.initialLiquidity === amt
                                            ? "bg-slate-800 text-white border-slate-600"
                                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                    )}
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="number"
                                value={form.initialLiquidity}
                                onChange={e => setForm(p => ({ ...p, initialLiquidity: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-3 text-white font-mono"
                            />
                        </div>
                    </div>

                    <EarningsSimulator deposit={depositAmount} />

                </div>
            </Card>


            {/* Static Action Bar - No Empty Space */}
            <div className="p-6 border border-slate-800 bg-slate-900/50 backdrop-blur-sm rounded-xl flex items-center justify-between">
                <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Deposit</p>
                    <p className="text-xl font-mono text-white font-bold">${form.initialLiquidity} <span className="text-sm text-slate-400">USDC</span></p>
                </div>

                <div className="flex items-center gap-4">
                    {allowance !== undefined && allowance < depositWei ? (
                        <Button
                            onClick={handleDeploy}
                            disabled={form.deployPending}
                            variant="secondary"
                            size="lg"
                            className="rounded-xl font-bold"
                        >
                            Approve USDC
                        </Button>
                    ) : (
                        <Button
                            onClick={handleDeploy}
                            disabled={!form.question || !form.initialLiquidity || form.deployPending}
                            isLoading={form.deployPending}
                            variant="primary"
                            size="lg"
                            className="rounded-xl px-8 font-bold shadow-lg shadow-cyan-500/20"
                        >
                            <Rocket className="w-4 h-4 mr-2" />
                            Launch Market
                        </Button>
                    )}
                </div>
            </div>

        </div>
    );
};
