import { useState, useEffect, useMemo } from 'react';
import { useAccount, useConfig, useReadContract, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, formatUnits, Address, decodeEventLog } from 'viem';
import {
    Rocket, Scale, Shield, DollarSign,
    Activity, Check, Coins, BookOpen,
    Loader2, ExternalLink, Bitcoin, Trophy, Theater, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ABIS, ERC20_ABI } from '../config/abis';
import { ADJUDICATOR_REGISTRY, GUARDIAN_REGISTRY } from '../config/registries';
import { useDeployments } from '../hooks/useDeployments';
import { cn } from '../lib/utils';

import { LaunchpadHeader } from '../components/features/launchpad/LaunchpadHeader';
import { AddressSelector } from '../components/common/AddressSelector';
import { PnLSimulator } from '../components/features/launchpad/PnLSimulator';
import { RiskDisclosure } from '../components/features/launchpad/RiskDisclosure';
import { PolymarketExplorer, PolymarketSelectData } from '../components/features/launchpad/PolymarketExplorer';
import { Drawer } from '../components/ui/Drawer';

const MARKET_CATEGORIES = [
    { id: 'crypto', name: 'Crypto', icon: Bitcoin, gradient: 'from-cyan-500 to-slate-500' },
    { id: 'sports', name: 'Sports', icon: Trophy, gradient: 'from-emerald-500 to-teal-500' },
    { id: 'cultures', name: 'Cultures', icon: Theater, gradient: 'from-pink-500 to-rose-500' },
    { id: 'others', name: 'Others', icon: Zap, gradient: 'from-cyan-500 to-emerald-500' }
];




export const Launchpad = () => {
    const { address: userAddress } = useAccount();
    const config = useConfig();
    const navigate = useNavigate();
    const deployments = useDeployments();
    const { writeContractAsync } = useWriteContract();

    const [question, setQuestion] = useState('');
    const [form, setForm] = useState({
        category: 'others',
        expirationMode: '7d',
        customExpiration: '',
        initialLiquidity: '693',
        deployPending: false,
    });

    const [adjudicatorMode, setAdjudicatorMode] = useState<'registry' | 'custom'>('registry');
    const [selectedAdjudicatorId, setSelectedAdjudicatorId] = useState('brevis-zk-rule');
    const [customAdjudicator, setCustomAdjudicator] = useState<string>('');

    const [guardianMode, setGuardianMode] = useState<'registry' | 'custom'>('registry');
    const [selectedGuardianId, setSelectedGuardianId] = useState('dao');
    const [customGuardian, setCustomGuardian] = useState<string>('');

    const [mobileTab, setMobileTab] = useState<'create' | 'learn'>('create');
    const [showPolymarket, setShowPolymarket] = useState(false);

    // Handler for importing market data from Polymarket Explorer
    const handlePolymarketSelect = (data: PolymarketSelectData) => {
        // Smart expiration mode derivation
        let expirationMode = 'open';
        let customExpiration = '';
        let expirationLabel = 'Open-ended';

        if (data.daysUntilExpiration !== null) {
            if (data.daysUntilExpiration >= 6 && data.daysUntilExpiration <= 8) {
                expirationMode = '7d';
                expirationLabel = '7 days';
            } else if (data.daysUntilExpiration >= 28 && data.daysUntilExpiration <= 32) {
                expirationMode = '30d';
                expirationLabel = '30 days';
            } else if (data.expiration) {
                expirationMode = 'custom';
                customExpiration = data.expiration;
                expirationLabel = `${data.daysUntilExpiration}d`;
            }
        }

        // Smart liquidity suggestion: 0.1% of Polymarket liquidity, clamped $100-$5000
        // If liquidity is 0 or very small, keep the default
        let suggestedLiquidity = form.initialLiquidity;
        if (data.liquidity >= 1000) {
            const suggested = Math.round(data.liquidity * 0.001);
            const clamped = Math.max(100, Math.min(5000, suggested));
            suggestedLiquidity = clamped.toString();
        }

        setQuestion(data.question);
        setForm(p => ({
            ...p,
            category: data.category,
            expirationMode,
            customExpiration,
            initialLiquidity: suggestedLiquidity
        }));
        setShowPolymarket(false);

        // Show detailed import toast
        const categoryLabel = MARKET_CATEGORIES.find(c => c.id === data.category)?.name || data.category;
        toast.success(
            `Imported: ${categoryLabel} • ${expirationLabel} • $${suggestedLiquidity} deposit`,
            { duration: 4000 }
        );
    };



    useEffect(() => {
        if (adjudicatorMode === 'registry') {
            const selected = ADJUDICATOR_REGISTRY.find(a => a.id === selectedAdjudicatorId);
            if (selected) {
                setCustomAdjudicator(selected.address as string);
            }
        } else if (adjudicatorMode === 'custom' && userAddress) {
            const isRegistryAddress = ADJUDICATOR_REGISTRY.some(a => a.address === customAdjudicator);
            if (!customAdjudicator || isRegistryAddress) {
                setCustomAdjudicator(userAddress);
            }
        }
    }, [adjudicatorMode, selectedAdjudicatorId, userAddress, customAdjudicator]);

    useEffect(() => {
        if (guardianMode === 'registry') {
            const selected = GUARDIAN_REGISTRY.find(g => g.id === selectedGuardianId);
            if (selected && selected.address !== 'SELF') {
                setCustomGuardian(selected.address as string);
            }
        } else if (guardianMode === 'custom' && userAddress) {
            const isRegistryAddress = GUARDIAN_REGISTRY.some(g => g.address === customGuardian);
            if (!customGuardian || isRegistryAddress) {
                setCustomGuardian(userAddress);
            }
        }
    }, [guardianMode, selectedGuardianId, userAddress, customGuardian]);

    const launchpadEngineAddress = deployments?.contracts['LaunchpadEngine'] as Address;
    const usdcAddress = deployments?.contracts['MockUSDC'] as Address;

    const { data: usdcDecimals } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
        query: { enabled: !!usdcAddress }
    });

    const depositAmount = parseFloat(form.initialLiquidity || '0');
    const bWei = usdcDecimals ? parseUnits((depositAmount * 1.442695).toFixed(6), 18) : BigInt(0);
    const depositWei = usdcDecimals ? parseUnits(depositAmount.toString(), usdcDecimals as number) : BigInt(0);

    const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress as Address, launchpadEngineAddress],
        query: { enabled: !!userAddress && !!launchpadEngineAddress }
    });
    const allowance = allowanceData as bigint | undefined;

    const { data: usdcBalanceData } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress as Address],
        query: { enabled: !!usdcAddress && !!userAddress }
    });
    const usdcBalance = usdcBalanceData as bigint | undefined;
    const formattedBalance = usdcBalance && usdcDecimals 
        ? parseFloat(formatUnits(usdcBalance, usdcDecimals as number)) 
        : 0;

    const getDeadline = () => {
        if (form.expirationMode === 'open') return 4102444800;
        const now = Math.floor(Date.now() / 1000);
        if (form.expirationMode === '7d') return now + 7 * 86400;
        if (form.expirationMode === '30d') return now + 30 * 86400;
        if (form.expirationMode === 'custom' && form.customExpiration) {
            return Math.floor(new Date(form.customExpiration).getTime() / 1000);
        }
        return now + 7 * 86400;
    };

    const validateForm = () => {
        if (!userAddress) {
            toast.error('Please connect your wallet first');
            return false;
        }
        if (!question.trim() || question.length < 10) {
            toast.error('Question must be at least 10 characters');
            return false;
        }
        if (!customAdjudicator.startsWith('0x') || customAdjudicator.length !== 42) {
            toast.error('Invalid Adjudicator address');
            return false;
        }
        if (!customGuardian.startsWith('0x') || customGuardian.length !== 42) {
            toast.error('Invalid Guardian address');
            return false;
        }
        if (depositAmount < 10) {
            toast.error('Minimum deposit is $10 USDC');
            return false;
        }
        return true;
    };

    const handleApproveUsdc = async () => {
        if (!validateForm()) return;
        setForm(p => ({ ...p, deployPending: true }));

        try {
            const approveHash = await writeContractAsync({
                abi: ERC20_ABI,
                address: usdcAddress,
                functionName: 'approve',
                args: [launchpadEngineAddress, depositWei]
            });
            await waitForTransactionReceipt(config, { hash: approveHash });
            await refetchAllowance();
            toast.success('USDC approved!');
        } catch (e: unknown) {
            const error = e as { shortMessage?: string; message: string; code?: string };
            const msg = error.code === 'ACTION_REJECTED' ? 'Transaction rejected' : (error.shortMessage || 'Approval failed');
            toast.error(msg);
        } finally {
            setForm(p => ({ ...p, deployPending: false }));
        }
    };

    const handleCreateMarket = async () => {
        if (!validateForm()) return;
        setForm(p => ({ ...p, deployPending: true }));

        const toastId = toast.loading('Creating market...');

        try {
            const deadline = getDeadline();

            const createHash = await writeContractAsync({
                abi: ABIS.LaunchpadEngine,
                address: launchpadEngineAddress,
                functionName: 'createMarket',
                args: [
                    question,
                    0n,
                    BigInt(deadline),
                    customAdjudicator as Address,
                    customGuardian as Address,
                    bWei,
                    'PRED'
                ]
            });

            const receipt = await waitForTransactionReceipt(config, { hash: createHash });
            let marketAddress: Address | undefined;

            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: ABIS.TruthMarket,
                        data: log.data,
                        topics: log.topics
                    });
                    if (decoded.eventName === 'MarketCreated' && decoded.args) {
                        marketAddress = (decoded.args as unknown as { market: Address }).market;
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!marketAddress) {
                throw new Error('MarketCreated event not found');
            }

            const marketMetaKey = `market_meta_${marketAddress.toLowerCase()}`;
            const metadata = {
                name: question,
                category: form.category,
                created: Date.now(),
                type: 'v10_launchpad_unified'
            };
            localStorage.setItem(marketMetaKey, JSON.stringify(metadata));

            toast.success('Market launched!', { id: toastId });
            navigate(`/trade/${marketAddress}`);
        } catch (e: unknown) {
            const error = e as { shortMessage?: string; message: string; code?: string };
            const msg = error.code === 'ACTION_REJECTED' ? 'Transaction rejected' : (error.shortMessage || 'Market creation failed');
            toast.error(msg, { id: toastId });
        } finally {
            setForm(p => ({ ...p, deployPending: false }));
        }
    };

    const needsApproval = allowance !== undefined && allowance < depositWei;
    const isFormValid = question.length >= 10 && form.initialLiquidity && customAdjudicator && customGuardian;
    const canProceed = isFormValid && !form.deployPending;

    const particles = useMemo(() => Array.from({ length: 25 }, (_, i) => ({
        id: i,
        left: `${3 + (i * 3.8) % 94}%`,
        delay: `${(i * 0.5) % 8}s`,
        duration: `${6 + (i % 5) * 2}s`,
        size: `${4 + (i % 4) * 3}px`,
    })), []);

    return (
        <div className="relative max-w-6xl mx-auto px-4">
            <div className="launchpad-bg">
                <div className="launchpad-grid" />
                <div className="launchpad-orb launchpad-orb-1" />
                <div className="launchpad-orb launchpad-orb-2" />
                <div className="launchpad-orb launchpad-orb-3" />
                {particles.map((p) => (
                    <div
                        key={p.id}
                        className="launchpad-particle"
                        style={{
                            left: p.left,
                            width: p.size,
                            height: p.size,
                            animationDelay: p.delay,
                            animationDuration: p.duration,
                        }}
                    />
                ))}
            </div>
            <LaunchpadHeader />

            <div className="lg:hidden flex gap-2 my-6">
                <button
                    onClick={() => setMobileTab('create')}
                    className={cn(
                        "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        mobileTab === 'create'
                            ? "bg-cyan-500 text-white"
                            : "bg-white/5 text-white/50"
                    )}
                >
                    <Rocket className="w-4 h-4" />
                    Create
                </button>
                <button
                    onClick={() => setMobileTab('learn')}
                    className={cn(
                        "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        mobileTab === 'learn'
                            ? "bg-emerald-500 text-white"
                            : "bg-white/5 text-white/50"
                    )}
                >
                    <BookOpen className="w-4 h-4" />
                    Simulator
                </button>
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-8 mt-6">
                <div className={cn(
                    "lg:block",
                    mobileTab === 'create' ? "block" : "hidden"
                )}>
                    <div className="p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                                <Coins className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Create Market</h2>
                                <p className="text-xs text-white/50">Launch in 60 seconds</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Question</label>
                                    <button
                                        onClick={() => setShowPolymarket(true)}
                                        type="button"
                                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Browse Polymarket
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    placeholder="Will Bitcoin exceed $100k by 2026?"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-white/20"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Category</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {MARKET_CATEGORIES.map(cat => {
                                        const IconComponent = cat.icon;
                                        return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setForm(p => ({ ...p, category: cat.id }))}
                                            className={cn(
                                                "p-3 rounded-xl font-semibold border transition-all flex items-center gap-2",
                                                form.category === cat.id
                                                    ? `bg-gradient-to-br ${cat.gradient} text-white border-transparent`
                                                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                                            )}
                                        >
                                            <IconComponent className="w-5 h-5" />
                                            <span className="text-sm">{cat.name}</span>
                                            {form.category === cat.id && <Check className="w-4 h-4 ml-auto" />}
                                        </button>
                                    );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Expiration</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: '7d', label: '7D' },
                                        { id: '30d', label: '30D' },
                                        { id: 'custom', label: '📅' },
                                        { id: 'open', label: '∞' }
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            onClick={() => setForm(p => ({ ...p, expirationMode: mode.id }))}
                                            className={cn(
                                                "py-2 rounded-lg text-sm font-bold border transition-all",
                                                form.expirationMode === mode.id
                                                    ? "bg-cyan-500/20 text-white border-cyan-500/50"
                                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                            )}
                                        >
                                            {mode.label}
                                        </button>
                                    ))}
                                </div>
                                {form.expirationMode === 'custom' && (
                                    <div className="space-y-1">
                                        <input
                                            type="datetime-local"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                            value={form.customExpiration}
                                            onChange={e => setForm(p => ({ ...p, customExpiration: e.target.value }))}
                                        />
                                        <p className="text-xs text-white/40">All times are in UTC</p>
                                    </div>
                                )}
                                {form.expirationMode === 'open' && (
                                    <p className="text-xs text-cyan-300 flex items-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        Open until resolved
                                    </p>
                                )}
                            </div>

                            <div className="h-px bg-white/10" />

                            <AddressSelector
                                label="Adjudicator"
                                icon={Scale}
                                options={ADJUDICATOR_REGISTRY}
                                selectedMode={adjudicatorMode}
                                setSelectedMode={setAdjudicatorMode}
                                selectedRegistryId={selectedAdjudicatorId}
                                setSelectedRegistryId={setSelectedAdjudicatorId}
                                customAddress={customAdjudicator}
                                setCustomAddress={setCustomAdjudicator}
                                userAddress={userAddress}
                            />

                            <AddressSelector
                                label="Guardian"
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

                            <div className="h-px bg-white/10" />

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Deposit (USDC)</label>
                                    <div className="text-right">
                                        <span className="text-white font-mono font-bold block">${depositAmount.toLocaleString()}</span>
                                        {userAddress && (
                                            <span className={cn(
                                                "text-xs font-mono transition-colors",
                                                (usdcBalance !== undefined && depositWei > usdcBalance) 
                                                    ? "text-red-400 font-bold" 
                                                    : "text-white/40"
                                            )}>
                                                Balance: ${formattedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="10000"
                                    step="10"
                                    value={form.initialLiquidity || '693'}
                                    onChange={e => setForm(p => ({ ...p, initialLiquidity: e.target.value }))}
                                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg"
                                />

                                {depositAmount > 0 && (
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-white/50">Liquidity (b)</span>
                                            <span className="text-white font-mono font-bold">
                                                {Math.round(depositAmount * 1.442695).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-white/50">Graduation Fee</span>
                                            <span className="text-cyan-400 font-mono font-bold">
                                                ${depositAmount.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-white/50">Graduation Vol</span>
                                            <span className="text-emerald-400 font-mono font-bold">
                                                ${(depositAmount * 20).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 space-y-3">
                                {/* Single button - shows validation state, approval, or launch */}
                                {!isFormValid ? (
                                    <button
                                        disabled
                                        className={cn(
                                            "w-full py-4 rounded-xl text-lg font-black transition-all",
                                            "bg-slate-800/60 border border-slate-700/50",
                                            "text-slate-500 cursor-not-allowed",
                                            "flex items-center justify-center gap-2"
                                        )}
                                    >
                                        Complete Form to Continue
                                    </button>
                                ) : needsApproval ? (
                                    <button
                                        onClick={handleApproveUsdc}
                                        disabled={form.deployPending}
                                        className={cn(
                                            "w-full py-4 rounded-xl text-lg font-black transition-all",
                                            "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
                                            "hover:shadow-[0_0_40px_-8px] hover:shadow-emerald-500/50",
                                            "disabled:opacity-40 disabled:cursor-not-allowed",
                                            "text-white flex items-center justify-center gap-2"
                                        )}
                                    >
                                        {form.deployPending ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Approving...
                                            </>
                                        ) : (
                                            <>
                                                <Rocket className="w-5 h-5" />
                                                Approve USDC
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCreateMarket}
                                        disabled={form.deployPending}
                                        className={cn(
                                            "w-full py-4 rounded-xl text-lg font-black transition-all",
                                            "bg-gradient-to-r from-cyan-500 via-cyan-600 to-emerald-500",
                                            "hover:shadow-[0_0_40px_-8px] hover:shadow-fuchsia-500/50",
                                            "disabled:opacity-40 disabled:cursor-not-allowed",
                                            "text-white flex items-center justify-center gap-2"
                                        )}
                                    >
                                        {form.deployPending ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Launching...
                                            </>
                                        ) : (
                                            <>
                                                <Rocket className="w-5 h-5" />
                                                Launch Market
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Faucet link */}
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs text-slate-500 font-mono">
                                        Wallet USDC: ${formattedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <a
                                        href="/faucet"
                                        className="text-xs text-slate-500 hover:text-cyan-400 transition-colors inline-flex items-center gap-1"
                                    >
                                        <DollarSign className="w-3 h-3" />
                                        Need test USDC? Get from faucet →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={cn(
                    "lg:block",
                    mobileTab === 'learn' ? "block" : "hidden"
                )}>
                    <div className="space-y-6">
                        <PnLSimulator />

                        <RiskDisclosure collapsed />
                    </div>
                </div>
            </div>

            <Drawer
                isOpen={showPolymarket}
                onClose={() => setShowPolymarket(false)}
                title="Browse Polymarket"
                className="max-w-3xl"
            >
                <PolymarketExplorer
                    onSelectMarket={handlePolymarketSelect}
                    compact
                />
            </Drawer>
        </div>
    );
};
