import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Palette, Gamepad2, ArrowLeftRight, Swords, Coins,
    TrendingUp, DollarSign, Percent, Clock, Target,
    Zap, AlertTriangle, HelpCircle, Sparkles
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
    calculateCreatorPnL,
    calculateGamingTraderPnL,
    calculateArbitrageurPnL,
    calculatePvPTraderPnL,
    formatCurrency,
    formatPercent,
    CreatorResult,
    GamingTraderResult,
    ArbitrageurResult,
    PvPTraderResult
} from '../../../lib/pnl-calculators';

type Archetype = 'creator' | 'gaming' | 'arb' | 'pvp';

interface ArchetypeConfig {
    id: Archetype;
    name: string;
    icon: typeof Palette;
    story: string;
    gradient: string;
    shadowColor: string;
}

const ARCHETYPES: ArchetypeConfig[] = [
    {
        id: 'creator',
        name: 'Creator',
        icon: Palette,
        story: 'Carol creates markets and earns from volume',
        gradient: 'from-violet-500 to-fuchsia-500',
        shadowColor: 'shadow-violet-500/30'
    },
    {
        id: 'gaming',
        name: 'Gaming Trader',
        icon: Gamepad2,
        story: 'Alice trades early and earns LP tokens',
        gradient: 'from-emerald-500 to-teal-500',
        shadowColor: 'shadow-emerald-500/30'
    },
    {
        id: 'arb',
        name: 'Arbitrageur',
        icon: ArrowLeftRight,
        story: 'Bob captures spreads between venues',
        gradient: 'from-blue-500 to-cyan-500',
        shadowColor: 'shadow-blue-500/30'
    },
    {
        id: 'pvp',
        name: 'PvP Trader',
        icon: Swords,
        story: 'Dave bets on conviction, winner takes all',
        gradient: 'from-orange-500 to-red-500',
        shadowColor: 'shadow-orange-500/30'
    }
];

interface SliderProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    format?: (v: number) => string;
    icon?: typeof DollarSign;
    hint?: string;
}

const Slider = ({ label, value, onChange, min, max, step = 1, format, icon: Icon, hint }: SliderProps) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <span className="text-sm text-white/60 flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4" />}
                {label}
                {hint && (
                    <span className="group relative">
                        <HelpCircle className="w-3.5 h-3.5 text-white/30 hover:text-white/50 cursor-help" />
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-black/90 border border-white/20 rounded-lg text-xs text-white/80 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            {hint}
                        </span>
                    </span>
                )}
            </span>
            <span className="text-sm font-mono font-bold text-white">
                {format ? format(value) : value}
            </span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
        />
        <div className="flex justify-between text-[10px] text-white/30 font-mono">
            <span>{format ? format(min) : min}</span>
            <span>{format ? format(max) : max}</span>
        </div>
    </div>
);

const ResultCard = ({ label, value, subtext, positive }: { 
    label: string; 
    value: string; 
    subtext?: string;
    positive?: boolean;
}) => (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
        <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{label}</p>
        <p className={cn(
            "text-lg font-mono font-bold mt-1",
            positive === true && "text-emerald-400",
            positive === false && "text-red-400",
            positive === undefined && "text-white"
        )}>
            {value}
        </p>
        {subtext && <p className="text-[10px] text-white/40 mt-0.5">{subtext}</p>}
    </div>
);

interface EquationTerm {
    value: string;
    label: string;
}

const Equation = ({ 
    result, 
    resultLabel,
    terms, 
    useArrow = false
}: { 
    result: string;
    resultLabel: string;
    terms: EquationTerm[];
    useArrow?: boolean;
}) => (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="text-center">
                <p className="text-xl font-mono font-black text-white">{result}</p>
                <p className="text-[10px] text-white/40 uppercase font-bold">{resultLabel}</p>
            </div>
            <span className="text-white/30 text-lg font-mono">{useArrow ? '←' : '='}</span>
            {terms.map((term, i) => (
                <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-white/30 text-lg font-mono">+</span>}
                    <div className="text-center">
                        <p className="text-lg font-mono font-bold text-white/80">{term.value}</p>
                        <p className="text-[10px] text-white/40 uppercase">{term.label}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const CreatorPanel = () => {
    const [liquidityTier, setLiquidityTier] = useState(1000);
    const [volume, setVolume] = useState(100000);
    const [imbalance, setImbalance] = useState(0);

    const result = useMemo(() => 
        calculateCreatorPnL(liquidityTier, volume, imbalance),
        [liquidityTier, volume, imbalance]
    );

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <p className="text-sm text-violet-200">
                    <span className="font-bold">Carol's Strategy:</span> Create a market, seed liquidity, 
                    and earn from trading volume. No trading required!
                </p>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Influence Factors</h4>
                
                <Slider
                    label="Liquidity (b)"
                    value={liquidityTier}
                    onChange={setLiquidityTier}
                    min={100}
                    max={10000}
                    step={100}
                    format={(v) => `$${v.toLocaleString()}`}
                    icon={DollarSign}
                />

                <Slider
                    label="Trading Volume"
                    value={volume}
                    onChange={setVolume}
                    min={1000}
                    max={1000000}
                    step={1000}
                    format={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`}
                    icon={TrendingUp}
                />

                <Slider
                    label="Settlement Luck"
                    value={imbalance}
                    onChange={setImbalance}
                    min={-0.5}
                    max={0.5}
                    step={0.1}
                    format={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`}
                    icon={Target}
                    hint="How the market resolves for LP. Negative = unlucky (lose). Positive = lucky (gain)."
                />
            </div>

            <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Your LP Ownership</span>
                        <span className="font-mono font-bold text-white">
                            {result.lpTokens} / {result.totalLpSupply} = {(result.ownershipPercent * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>

                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">
                    LP Equation <span className="text-white/30 font-mono normal-case">[{(result.ownershipPercent * 100).toFixed(0)}%]</span>
                </h4>
                
                <Equation
                    result={formatCurrency(result.lpRedemption)}
                    resultLabel="LP Redemption"
                    terms={[
                        { value: formatCurrency(result.lpDeposit), label: "Deposit" },
                        { value: formatCurrency(result.flywheelGrowth), label: "Flywheel" },
                        { value: formatCurrency(result.settlementOutcome), label: "Settlement" },
                        { value: formatCurrency(result.feeYield), label: "Fee Yield" }
                    ]}
                />

                <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-white/50 uppercase font-bold">Net P&L</p>
                            <p className="text-2xl font-mono font-black text-white">
                                {formatCurrency(result.netPnL)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50 uppercase font-bold">ROI</p>
                            <p className="text-2xl font-mono font-black text-white">
                                {result.roi < 0 ? `(${Math.abs(result.roi)}%)` : `${result.roi}%`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 text-xs text-white/60">
                    <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <span>
                        <span className="font-bold text-white">LMSR Property:</span> Max win = Max loss = Deposit + Flywheel. 
                        Fee Yield is always yours.
                    </span>
                </div>
            </div>
        </div>
    );
};

const EntryTimingToggle = ({ 
    isPreGrad, 
    onChange 
}: { 
    isPreGrad: boolean; 
    onChange: (v: boolean) => void;
}) => (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
        <button
            onClick={() => onChange(false)}
            className={cn(
                "py-2.5 px-3 rounded-lg text-sm font-bold transition-all",
                !isPreGrad 
                    ? "bg-violet-500/20 text-violet-300 shadow-sm"
                    : "text-white/40 hover:text-white/60"
            )}
        >
            <span className="block">Post-Grad</span>
            <span className="block text-[10px] font-normal opacity-70">1% fee</span>
        </button>
        <button
            onClick={() => onChange(true)}
            className={cn(
                "py-2.5 px-3 rounded-lg text-sm font-bold transition-all",
                isPreGrad 
                    ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                    : "text-white/40 hover:text-white/60"
            )}
        >
            <span className="block">Pre-Grad</span>
            <span className="block text-[10px] font-normal opacity-70">5% fee → LP</span>
        </button>
    </div>
);

const GamingTraderPanel = () => {
    const [tradeSize, setTradeSize] = useState(200);
    const [entryPrice, setEntryPrice] = useState(0.5);
    const [isPreGrad, setIsPreGrad] = useState(true);
    const [isCorrect, setIsCorrect] = useState(true);
    const [volumeAfter, setVolumeAfter] = useState(50000);
    const [imbalance, setImbalance] = useState(0);

    const result = useMemo(() =>
        calculateGamingTraderPnL(tradeSize, entryPrice, isPreGrad, isCorrect, volumeAfter, imbalance),
        [tradeSize, entryPrice, isPreGrad, isCorrect, volumeAfter, imbalance]
    );

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-200">
                    <span className="font-bold">Alice's Strategy:</span> Trade early to earn LP tokens from fees. 
                    Even wrong predictions can profit!
                </p>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Influence Factors</h4>
                
                <Slider
                    label="Trade Size"
                    value={tradeSize}
                    onChange={setTradeSize}
                    min={50}
                    max={2000}
                    step={50}
                    format={(v) => `$${v}`}
                    icon={DollarSign}
                />

                <Slider
                    label="Entry Price (Your Side)"
                    value={entryPrice}
                    onChange={setEntryPrice}
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                    icon={Target}
                />

                <div className="space-y-2">
                    <span className="text-sm text-white/60 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Prediction Outcome
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setIsCorrect(true)}
                            className={cn(
                                "p-3 rounded-xl text-sm font-bold border transition-all",
                                isCorrect 
                                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                    : "bg-white/5 border-white/10 text-white/50"
                            )}
                        >
                            Correct
                        </button>
                        <button
                            onClick={() => setIsCorrect(false)}
                            className={cn(
                                "p-3 rounded-xl text-sm font-bold border transition-all",
                                !isCorrect 
                                    ? "bg-red-500/20 border-red-500/50 text-red-300"
                                    : "bg-white/5 border-white/10 text-white/50"
                            )}
                        >
                            Wrong
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Trade Equation</h4>
                    <Equation
                        result={formatCurrency(result.tradePnL)}
                        resultLabel="Trade P&L"
                        terms={[
                            { value: `${result.sharesReceived}`, label: isCorrect ? "Payout" : "Payout ($0)" },
                            { value: formatCurrency(-result.positionValue), label: "Cost" }
                        ]}
                    />
                </div>

                <EntryTimingToggle isPreGrad={isPreGrad} onChange={setIsPreGrad} />

                {isPreGrad && (
                    <>
                        <Slider
                            label="Volume After Entry"
                            value={volumeAfter}
                            onChange={setVolumeAfter}
                            min={1000}
                            max={1000000}
                            step={1000}
                            format={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`}
                            icon={TrendingUp}
                        />

                        <Slider
                            label="Settlement Luck"
                            value={imbalance}
                            onChange={setImbalance}
                            min={-0.5}
                            max={0.5}
                            step={0.1}
                            format={(v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`}
                            icon={Target}
                            hint="How market resolves for LP. Negative = unlucky. Positive = lucky."
                        />
                    </>
                )}
            </div>

            <div className="space-y-4">
                {isPreGrad && (
                    <>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-white/60">Your LP Ownership</span>
                                <span className="font-mono font-bold text-white">
                                    ${result.lpDeposit} / ${result.totalLpSupply} = {(result.ownershipPercent * 100).toFixed(2)}%
                                </span>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex items-baseline gap-2">
                                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">
                                    LP Equation <span className="text-white/30 font-mono normal-case">[{(result.ownershipPercent * 100).toFixed(2)}%]</span>
                                </h4>
                                <span className="text-[10px] text-white/25 italic">*$2k graduation</span>
                            </div>
                            <Equation
                                result={formatCurrency(result.lpRedemption)}
                                resultLabel="LP Redemption"
                                terms={[
                                    { value: formatCurrency(result.lpDeposit), label: "Deposit" },
                                    { value: formatCurrency(result.flywheelGrowth), label: "Flywheel" },
                                    { value: formatCurrency(result.settlementOutcome), label: "Settlement" },
                                    { value: formatCurrency(result.feeYield), label: "Fee Yield" }
                                ]}
                            />
                        </div>
                    </>
                )}

                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-white/50 uppercase font-bold">Net P&L</p>
                            <p className="text-2xl font-mono font-black text-white">
                                {formatCurrency(result.netPnL)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50 uppercase font-bold">ROI</p>
                            <p className="text-2xl font-mono font-black text-white">
                                {result.roi < 0 ? `(${Math.abs(result.roi)}%)` : `${result.roi}%`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 text-xs text-white/60">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                        {isPreGrad ? (
                            <span>
                                <span className="font-bold text-white">Pre-Grad Bonus:</span> {isCorrect 
                                    ? "Trade profit + LP redemption = double upside!" 
                                    : `Trade loss cushioned by LP redemption of ${formatCurrency(result.lpRedemption)}.`}
                            </span>
                        ) : (
                            <span>
                                <span className="font-bold text-white">Post-Grad:</span> Lower 1% fees but no LP tokens. Pure trading P&L.
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
};

const ArbitrageurPanel = () => {
    const [tradeSize, setTradeSize] = useState(5000);
    const [spread, setSpread] = useState(0.04);
    const [gasCost, setGasCost] = useState(1);

    const result = useMemo(() =>
        calculateArbitrageurPnL(tradeSize, spread, gasCost),
        [tradeSize, spread, gasCost]
    );

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-200">
                    <span className="font-bold">Bob's Strategy:</span> Capture price differences between 
                    AMM and TickBook. Risk-free profit when spread exceeds costs!
                </p>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Influence Factors</h4>
                
                <Slider
                    label="Trade Size"
                    value={tradeSize}
                    onChange={setTradeSize}
                    min={500}
                    max={50000}
                    step={500}
                    format={(v) => `$${(v/1000).toFixed(1)}k`}
                    icon={DollarSign}
                />

                <Slider
                    label="Price Divergence"
                    value={spread}
                    onChange={setSpread}
                    min={0.005}
                    max={0.10}
                    step={0.005}
                    format={(v) => `${(v * 100).toFixed(1)}%`}
                    icon={Percent}
                />

                <Slider
                    label="Gas Cost (2 txs)"
                    value={gasCost}
                    onChange={setGasCost}
                    min={0.1}
                    max={10}
                    step={0.1}
                    format={(v) => `$${v.toFixed(2)}`}
                    icon={Zap}
                />
            </div>

            <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Bob's P&L</h4>
                
                <div className="grid grid-cols-3 gap-3">
                    <ResultCard 
                        label="Gross Profit" 
                        value={formatCurrency(result.grossProfit)}
                        subtext={`${result.spreadPercent.toFixed(1)}% spread`}
                    />
                    <ResultCard 
                        label="Total Costs" 
                        value={formatCurrency(result.totalCosts)}
                        subtext={`Gas + ${formatCurrency(result.ammFee)} fee`}
                    />
                    <ResultCard 
                        label="Net Profit" 
                        value={`${result.netProfit >= 0 ? '+' : ''}${formatCurrency(result.netProfit)}`}
                        positive={result.isProfitable}
                    />
                </div>

                <div className={cn(
                    "p-4 rounded-xl border",
                    result.isProfitable 
                        ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30"
                        : "bg-red-500/10 border-red-500/30"
                )}>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-white/50 uppercase font-bold">
                                {result.isProfitable ? "Profitable!" : "Not Profitable"}
                            </p>
                            <p className={cn(
                                "text-2xl font-mono font-black",
                                result.isProfitable ? "text-emerald-400" : "text-red-400"
                            )}>
                                {result.returnPercent >= 0 ? '+' : ''}{result.returnPercent}%
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50 uppercase font-bold">Min Viable Spread</p>
                            <p className="text-lg font-mono font-bold text-white">
                                {result.minViableSpread.toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 text-xs text-white/60">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>
                        <span className="font-bold text-white">Key Insight:</span> Arbs provide a SERVICE 
                        by tightening spreads. All traders benefit from their activity!
                    </span>
                </div>
            </div>
        </div>
    );
};

const PvPTraderPanel = () => {
    const [positionSize, setPositionSize] = useState(1000);
    const [entryPrice, setEntryPrice] = useState(0.35);
    const [winProb, setWinProb] = useState(0.6);
    const [outcome, setOutcome] = useState<'win' | 'lose' | 'expected'>('expected');

    const result = useMemo(() =>
        calculatePvPTraderPnL(positionSize, entryPrice, winProb, outcome),
        [positionSize, entryPrice, winProb, outcome]
    );

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-sm text-orange-200">
                    <span className="font-bold">Dave's Strategy:</span> Bet on conviction against other traders. 
                    No LP safety net — winner takes all!
                </p>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Influence Factors</h4>
                
                <Slider
                    label="Position Size"
                    value={positionSize}
                    onChange={setPositionSize}
                    min={100}
                    max={10000}
                    step={100}
                    format={(v) => `$${v.toLocaleString()}`}
                    icon={DollarSign}
                />

                <Slider
                    label="Entry Price (Your Side)"
                    value={entryPrice}
                    onChange={setEntryPrice}
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                    icon={Target}
                />

                <Slider
                    label="Your Estimated Win Probability"
                    value={winProb}
                    onChange={setWinProb}
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    format={(v) => `${(v * 100).toFixed(0)}%`}
                    icon={Percent}
                />

                <div className="space-y-2">
                    <span className="text-sm text-white/60 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Outcome Scenario
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setOutcome('win')}
                            className={cn(
                                "p-3 rounded-xl text-sm font-bold border transition-all",
                                outcome === 'win' 
                                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                    : "bg-white/5 border-white/10 text-white/50"
                            )}
                        >
                            Win 🚀
                        </button>
                        <button
                            onClick={() => setOutcome('lose')}
                            className={cn(
                                "p-3 rounded-xl text-sm font-bold border transition-all",
                                outcome === 'lose' 
                                    ? "bg-red-500/20 border-red-500/50 text-red-300"
                                    : "bg-white/5 border-white/10 text-white/50"
                            )}
                        >
                            Lose 💀
                        </button>
                        <button
                            onClick={() => setOutcome('expected')}
                            className={cn(
                                "p-3 rounded-xl text-sm font-bold border transition-all",
                                outcome === 'expected' 
                                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                    : "bg-white/5 border-white/10 text-white/50"
                            )}
                        >
                            Expected
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Dave's P&L</h4>
                
                <div className="grid grid-cols-2 gap-3">
                    <ResultCard 
                        label="Shares Received" 
                        value={result.sharesReceived.toLocaleString()}
                        subtext={`@ ${(entryPrice * 100).toFixed(0)}%`}
                    />
                    <ResultCard 
                        label="Expected Value" 
                        value={`${result.expectedValue >= 0 ? '+' : ''}${formatCurrency(result.expectedValue)}`}
                        subtext={result.expectedValue > 0 ? "+EV bet!" : "-EV bet"}
                        positive={result.expectedValue > 0}
                    />
                    <ResultCard 
                        label="If Win" 
                        value={`+${formatCurrency(result.profitIfWin)}`}
                        subtext={`+${Math.round((result.profitIfWin / positionSize) * 100)}% return`}
                        positive={true}
                    />
                    <ResultCard 
                        label="If Lose" 
                        value={formatCurrency(result.lossIfWrong)}
                        subtext="100% loss"
                        positive={false}
                    />
                </div>

                <div className={cn(
                    "p-4 rounded-xl border",
                    result.actualPnL >= 0
                        ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30"
                        : "bg-red-500/10 border-red-500/30"
                )}>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs text-white/50 uppercase font-bold">
                                {outcome === 'expected' ? 'Expected P&L' : `Actual P&L (${outcome})`}
                            </p>
                            <p className={cn(
                                "text-2xl font-mono font-black",
                                result.actualPnL >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                                {result.actualPnL >= 0 ? '+' : ''}{formatCurrency(result.actualPnL)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-white/50 uppercase font-bold">Return</p>
                            <p className={cn(
                                "text-2xl font-mono font-black",
                                result.returnPercent >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                                {result.returnPercent >= 0 ? '+' : ''}{result.returnPercent}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                        <span className="font-bold">Warning:</span> PvP trading has NO LP safety net. 
                        If you don't have an edge, you're the counterparty smart money bets against.
                    </span>
                </div>
            </div>
        </div>
    );
};

export const PnLSimulator = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeArchetype = ARCHETYPES[activeIndex];

    const renderPanel = () => {
        switch (activeArchetype.id) {
            case 'creator': return <CreatorPanel />;
            case 'gaming': return <GamingTraderPanel />;
            case 'arb': return <ArbitrageurPanel />;
            case 'pvp': return <PvPTraderPanel />;
        }
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl">
            <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                            activeArchetype.gradient,
                            activeArchetype.shadowColor
                        )}>
                            <activeArchetype.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                {activeArchetype.name}
                            </h3>
                            <p className="text-xs text-white/50">{activeArchetype.story}</p>
                        </div>
                    </div>
                    <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <HelpCircle className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                {/* Desktop: Tab navigation */}
                <div className="hidden sm:flex gap-2">
                    {ARCHETYPES.map((arch, i) => (
                        <button
                            key={arch.id}
                            onClick={() => setActiveIndex(i)}
                            className={cn(
                                "flex-1 p-3 rounded-xl text-sm font-bold border transition-all",
                                i === activeIndex
                                    ? `bg-gradient-to-br ${arch.gradient} text-white border-transparent shadow-lg ${arch.shadowColor}`
                                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                            )}
                        >
{arch.name}
                        </button>
                    ))}
                </div>

                <div className="sm:hidden flex justify-center gap-2">
                    {ARCHETYPES.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveIndex(i)}
                            className={cn(
                                "h-2 rounded-full transition-all",
                                i === activeIndex 
                                    ? "w-6 bg-white" 
                                    : "w-2 bg-white/30"
                            )}
                        />
                    ))}
                </div>
            </div>

            <div className="p-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeArchetype.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderPanel()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};
