import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useConfig, useReadContract, useWriteContract } from 'wagmi';
import { deployContract, waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, Address } from 'viem';
import {
    Rocket, Scale, Shield, DollarSign,
    Info, AlertTriangle, CheckCircle, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TRUTH_MARKET_BYTECODE } from '../config/bytecode';
import { ABIS } from '../config/abis';
import { ERC20_ABI } from '../config/abis';
import { useDeployments } from '../hooks/useDeployments';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

// --- Mocks & Constants ---

const MOCK_REGISTRY = {
    adjudicators: [
        {
            id: 'brevis-opt',
            name: 'Brevis ZK-Optimistic',
            address: '0x1111111111111111111111111111111111111111' as Address,
            desc: 'Optimistic verification with ZK proofs (Recommended).',
            badge: 'Partner'
        },
        {
            id: 'brevis-price',
            name: 'Brevis Price Oracle',
            address: '0x2222222222222222222222222222222222222222' as Address,
            desc: 'Automated resolution via decentralized price feeds.',
            badge: 'Beta'
        }
    ],
    guardians: [
        {
            id: 'me',
            name: 'Me (Creator)',
            address: 'SELF',
            desc: 'You retain full control over emergency vetoes.',
            badge: 'Default'
        },
        {
            id: 'dao',
            name: 'Sooth DAO',
            address: '0x3333333333333333333333333333333333333333' as Address,
            desc: 'Managed by the protocol community governance.',
            badge: 'Trustless'
        }
    ]
};

const MARKET_CATEGORIES = [
    { id: 'crypto', name: 'Crypto', icon: '₿' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
    { id: 'politics', name: 'Politics', icon: '⚖️' },
    { id: 'custom', name: 'Custom', icon: '✨' }
];

// --- Components ---

const InfoTooltip = ({ content }: { content: string }) => (
    <div className="group relative inline-block ml-1">
        <Info className="w-4 h-4 text-slate-500 hover:text-cyan-400 transition-colors cursor-help" />
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
    </div>
);

const AddressSelector = ({
    label,
    icon: Icon,
    options,
    selectedMode,
    setSelectedMode,
    selectedRegistryId,
    setSelectedRegistryId,
    customAddress,
    setCustomAddress,
    userAddress
}: {
    label: string;
    icon: any;
    options: any[];
    selectedMode: 'registry' | 'custom';
    setSelectedMode: (m: 'registry' | 'custom') => void;
    selectedRegistryId: string;
    setSelectedRegistryId: (id: string) => void;
    customAddress: string;
    setCustomAddress: (addr: string) => void;
    userAddress?: Address;
}) => {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    {label}
                </label>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setSelectedMode('registry')}
                        className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            selectedMode === 'registry' ? "bg-cyan-500/20 text-cyan-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        Registry (Recommended)
                    </button>
                    <button
                        onClick={() => setSelectedMode('custom')}
                        className={cn(
                            "px-3 py-1 text-xs font-bold rounded-md transition-all",
                            selectedMode === 'custom' ? "bg-amber-500/20 text-amber-400 shadow-sm" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        Custom
                    </button>
                </div>
            </div>

            {selectedMode === 'registry' ? (
                <div className="grid sm:grid-cols-2 gap-3">
                    {options.map((opt) => (
                        <div
                            key={opt.id}
                            onClick={() => {
                                setSelectedRegistryId(opt.id);
                                if (opt.address !== 'SELF') setCustomAddress(opt.address);
                                else if (userAddress) setCustomAddress(userAddress);
                            }}
                            className={cn(
                                "cursor-pointer p-4 rounded-xl border transition-all hover:bg-slate-800/50 relative overflow-hidden group",
                                selectedRegistryId === opt.id
                                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                    : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                            )}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">{opt.name}</span>
                                {opt.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{opt.badge}</span>}
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                            {selectedRegistryId === opt.id && (
                                <div className="absolute top-2 right-2 text-cyan-500 animate-in zoom-in duration-200">
                                    <CheckCircle className="w-4 h-4 fill-cyan-500/20" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-500 mb-1">Advanced Mode Warning</p>
                            <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                Using a custom address bypasses safety checks. Ensure the address is a valid contract or EOA that can perform the required duties.
                            </p>
                        </div>
                    </div>
                    <input
                        type="text"
                        value={customAddress}
                        onChange={(e) => setCustomAddress(e.target.value)}
                        placeholder={`0x... (${label} Address)`}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 font-mono transition-all"
                    />
                </div>
            )}
        </div>
    );
};

const EarningsSimulator = ({ deposit }: { deposit: number }) => {
    const [volume, setVolume] = useState(100000); // Default $100k volume
    const feeRate = 0.05; // 5% pre-grad fee

    const estimatedEarnings = volume * feeRate;
    const roi = deposit > 0 ? (estimatedEarnings / deposit) * 100 : 0;

    return (
        <div className="mt-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700/50 shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Earnings Simulator
                </h4>
                <div className="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                    Based on 5% Fee
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-400">Projected Trading Volume</span>
                        <span className="text-white font-mono">${volume.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        min="1000"
                        max="1000000"
                        step="1000"
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                        <span>$1k</span>
                        <span>$1M</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Your Deposit</p>
                        <p className="text-lg font-mono text-white">${deposit.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Est. Fees Earned</p>
                        <p className="text-lg font-mono text-emerald-400 font-bold">+${estimatedEarnings.toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-500/70 font-mono">({roi.toFixed(1)}% ROI)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Launchpad = () => {
    const { address: userAddress } = useAccount();
    const chainId = useChainId();
    const config = useConfig();
    const navigate = useNavigate();
    const deployments = useDeployments(); // Corrected: No args
    const { writeContractAsync } = useWriteContract(); // Corrected: Destructure async

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
    const [customAdjudicator, setCustomAdjudicator] = useState<string>(MOCK_REGISTRY.adjudicators[0].address);

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
    // Corrected: contracts[Name] is string, not object with address property
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
    const bValue = depositAmount * 1.442695;
    const bWei = usdcDecimals ? parseUnits(bValue.toFixed(6), 18) : BigInt(0); // Launchpad takes b in WAD (always 18)
    const depositWei = usdcDecimals ? parseUnits(depositAmount.toString(), usdcDecimals as number) : BigInt(0);

    // Allowance Check
    const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
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

        // Validate Addresses
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
                    userAddress, // Owner (temp)
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

            // Save metadata to local storage (temporary solution)
            const marketMetaKey = `market_meta_${marketAddress.toLowerCase()}`;
            const metadata = {
                name: form.question,
                category: form.category,
                created: Date.now(),
                type: 'v9_launchpad'
            };
            localStorage.setItem(marketMetaKey, JSON.stringify(metadata));

            await writeContractAsync({
                abi: ABIS.LaunchpadEngine,
                address: launchpadEngineAddress,
                functionName: 'createMarket',
                args: [
                    marketAddress,
                    bWei, // initialLiquidity (b) in WAD
                    form.question.slice(0, 50), // Name
                    symbol
                ]
            });

            toast.success('Market Launched!', { id: toastId });
            navigate(`/trade/${marketAddress}`); // Redirect to trade page

        } catch (e: any) {
            console.error(e);
            toast.error('Failed: ' + (e.shortMessage || e.message), { id: toastId });
        } finally {
            setForm(p => ({ ...p, deployPending: false }));
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 pb-32">
            {/* Header */}
            <div className="pt-24 pb-12 bg-gradient-to-b from-indigo-900/20 to-slate-950 border-b border-indigo-500/10">
                <div className="container mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4">
                        <Rocket className="w-4 h-4" />
                        Launchpad V9
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
                        Create a Prediction Market
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        Launch a verifiable truth market in seconds. Seed liquidity, earn protocol fees, and graduate to the permanent orderbook.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 max-w-3xl -mt-8 relative z-10 space-y-6">

                {/* 1. Market Details */}
                <Card className="p-6 border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-slate-700">1</span>
                        The Question
                    </h2>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-300">Market Question</label>
                            <input
                                type="text"
                                value={form.question}
                                onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                                placeholder="e.g. Will Bitcoin exceed $100k by 2026?"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
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
                                Expiration Date
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
                                        <span className="font-bold">Open-Ended Market:</span> Deadline set to Year 2100. The market stays active indefinitely until manually settled by an adjudicator.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* 2. Oracle & Security */}
                <Card className="p-6 border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-slate-700">2</span>
                        Oracle & Security
                    </h2>

                    <div className="space-y-8">
                        <AddressSelector
                            label="Adjudicator (Resolution Authority)"
                            icon={Scale}
                            options={MOCK_REGISTRY.adjudicators}
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
                            options={MOCK_REGISTRY.guardians}
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
                <Card className="p-6 border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-slate-700">3</span>
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
                                        You earn <span className="text-emerald-400 font-bold">5% trading fees</span> on all volume during the initial phase. When the market graduates, your position converts to permanent LP tokens.
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-white font-mono"
                                />
                            </div>
                            <p className="text-right text-xs text-slate-500 font-mono">
                                Market Depth (b): {bValue.toFixed(2)}
                            </p>
                        </div>

                        {/* Earnings Simulator */}
                        <EarningsSimulator deposit={depositAmount} />

                    </div>
                </Card>

            </div>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-xl z-50">
                <div className="container mx-auto max-w-3xl flex items-center justify-between">
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

        </div>
    );
};
