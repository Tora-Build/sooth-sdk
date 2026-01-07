import { useState, useEffect } from 'react';
import { useAccount, useConfig, useReadContract, useWriteContract } from 'wagmi';
import { deployContract, waitForTransactionReceipt } from 'wagmi/actions';
import { parseUnits, Address } from 'viem';
import {
    Rocket, Scale, Shield, DollarSign,
    Activity, Check, Coins, Calculator,
    BookOpen, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { TRUTH_MARKET_BYTECODE } from '../config/bytecode';
import { ABIS, ERC20_ABI } from '../config/abis';
import { ADJUDICATOR_REGISTRY, GUARDIAN_REGISTRY } from '../config/registries';
import { useDeployments } from '../hooks/useDeployments';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { cn } from '../lib/utils';

import { LaunchpadHeader } from '../components/features/launchpad/LaunchpadHeader';
import { AddressSelector } from '../components/common/AddressSelector';
import { TraderBenefitsBanner } from '../components/features/launchpad/TraderBenefitsBanner';
import { PnLSimulator } from '../components/features/launchpad/PnLSimulator';
import { MarketJourneyTimeline } from '../components/features/launchpad/MarketJourneyTimeline';
import { RiskDisclosure } from '../components/features/launchpad/RiskDisclosure';

const MARKET_CATEGORIES = [
    { id: 'crypto', name: 'Crypto', icon: '₿', gradient: 'from-orange-500 to-amber-500' },
    { id: 'sports', name: 'Sports', icon: '⚽', gradient: 'from-emerald-500 to-teal-500' },
    { id: 'politics', name: 'Politics', icon: '⚖️', gradient: 'from-blue-500 to-indigo-500' },
    { id: 'custom', name: 'Custom', icon: '✨', gradient: 'from-violet-500 to-fuchsia-500' }
];

export const Launchpad = () => {
    const { address: userAddress } = useAccount();
    const config = useConfig();
    const navigate = useNavigate();
    const deployments = useDeployments();
    const { writeContractAsync } = useWriteContract();

    const [form, setForm] = useState({
        question: '',
        category: 'crypto',
        expirationMode: '7d',
        customExpiration: '',
        initialLiquidity: '1000',
        deployPending: false
    });

    const [adjudicatorMode, setAdjudicatorMode] = useState<'registry' | 'custom'>('registry');
    const [selectedAdjudicatorId, setSelectedAdjudicatorId] = useState('brevis-opt');
    const [customAdjudicator, setCustomAdjudicator] = useState<string>(ADJUDICATOR_REGISTRY[0].address);

    const [guardianMode, setGuardianMode] = useState<'registry' | 'custom'>('registry');
    const [selectedGuardianId, setSelectedGuardianId] = useState('me');
    const [customGuardian, setCustomGuardian] = useState<string>('');

    const [mobileTab, setMobileTab] = useState<'create' | 'learn'>('create');
    const [showSimulator, setShowSimulator] = useState(false);

    useEffect(() => {
        if (userAddress && selectedGuardianId === 'me') {
            setCustomGuardian(userAddress);
        }
    }, [userAddress, selectedGuardianId]);

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

    const { data: allowanceData } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddress as Address, launchpadEngineAddress],
        query: { enabled: !!userAddress && !!launchpadEngineAddress }
    });
    const allowance = allowanceData as bigint | undefined;

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

            toast.loading('Initializing Liquidity...', { id: toastId });
            const symbol = "PRED";

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
            navigate(`/trade/${marketAddress}`);

        } catch (e: unknown) {
            const error = e as { shortMessage?: string; message: string };
            console.error(e);
            toast.error('Failed: ' + (error.shortMessage || error.message), { id: toastId });
        } finally {
            setForm(p => ({ ...p, deployPending: false }));
        }
    };

    const isFormValid = form.question && form.initialLiquidity && customAdjudicator && customGuardian;

    const FormContent = () => (
        <div className="space-y-6">
            <div className="space-y-3">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Question</label>
                <input
                    type="text"
                    value={form.question}
                    onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                    placeholder="Will Bitcoin exceed $100k by 2026?"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-white/20"
                />
            </div>

            <div className="space-y-3">
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Category</label>
                <div className="grid grid-cols-2 gap-2">
                    {MARKET_CATEGORIES.map(cat => (
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
                            <span className="text-lg">{cat.icon}</span>
                            <span className="text-sm">{cat.name}</span>
                            {form.category === cat.id && <Check className="w-4 h-4 ml-auto" />}
                        </button>
                    ))}
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
                                    ? "bg-violet-500/20 text-white border-violet-500/50"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            )}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
                {form.expirationMode === 'custom' && (
                    <input
                        type="datetime-local"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                        value={form.customExpiration}
                        onChange={e => setForm(p => ({ ...p, customExpiration: e.target.value }))}
                    />
                )}
                {form.expirationMode === 'open' && (
                    <p className="text-xs text-violet-300 flex items-center gap-1">
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
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider">Deposit (USDC)</label>
                <div className="grid grid-cols-3 gap-2">
                    {['100', '1000', '5000'].map(amt => (
                        <button
                            key={amt}
                            onClick={() => setForm(p => ({ ...p, initialLiquidity: amt }))}
                            className={cn(
                                "py-3 rounded-xl font-bold border transition-all",
                                form.initialLiquidity === amt
                                    ? "bg-emerald-500/20 text-white border-emerald-500/50"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            )}
                        >
                            ${amt}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                        type="number"
                        value={form.initialLiquidity}
                        onChange={e => setForm(p => ({ ...p, initialLiquidity: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white font-mono focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                </div>
            </div>

            <div className="pt-4">
                {allowance !== undefined && allowance < depositWei ? (
                    <Button
                        onClick={handleDeploy}
                        disabled={form.deployPending}
                        variant="secondary"
                        size="lg"
                        className="w-full rounded-xl font-bold"
                    >
                        Approve USDC
                    </Button>
                ) : (
                    <button
                        onClick={handleDeploy}
                        disabled={!isFormValid || form.deployPending}
                        className={cn(
                            "w-full py-4 rounded-xl text-lg font-black transition-all",
                            "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-500",
                            "hover:shadow-[0_0_40px_-8px] hover:shadow-fuchsia-500/50",
                            "disabled:opacity-40 disabled:cursor-not-allowed",
                            "text-white flex items-center justify-center gap-2"
                        )}
                    >
                        {form.deployPending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
            </div>
        </div>
    );

    const ContextContent = () => (
        <div className="space-y-6">
            <TraderBenefitsBanner />

            <button
                onClick={() => setShowSimulator(true)}
                className="w-full p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 hover:border-violet-500/50 transition-all group"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                            <Calculator className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-white">P&L Simulator</p>
                            <p className="text-xs text-white/50">Explore 4 trading archetypes</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
                </div>
            </button>

            <MarketJourneyTimeline />

            <RiskDisclosure />
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto px-4">
            <LaunchpadHeader />

            <div className="lg:hidden flex gap-2 my-6">
                <button
                    onClick={() => setMobileTab('create')}
                    className={cn(
                        "flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2",
                        mobileTab === 'create'
                            ? "bg-violet-500 text-white"
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
                    Learn
                </button>
            </div>

            <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-8 mt-6">
                <div className={cn(
                    "lg:sticky lg:top-6 lg:self-start",
                    "lg:block",
                    mobileTab === 'create' ? "block" : "hidden"
                )}>
                    <div className="p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                                <Coins className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white">Create Market</h2>
                                <p className="text-xs text-white/50">Launch in 60 seconds</p>
                            </div>
                        </div>
                        <FormContent />
                    </div>
                </div>

                <div className={cn(
                    "lg:block",
                    mobileTab === 'learn' ? "block" : "hidden"
                )}>
                    <ContextContent />
                </div>
            </div>

            <Drawer
                isOpen={showSimulator}
                onClose={() => setShowSimulator(false)}
                title="P&L Simulator"
                className="max-w-2xl"
            >
                <PnLSimulator />
            </Drawer>
        </div>
    );
};
