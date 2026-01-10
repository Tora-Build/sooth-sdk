import { useState } from 'react';
import { 
    Rocket, TrendingUp, Award, Scale, Flag, Coins,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface TimelineStep {
    id: string;
    icon: typeof Rocket;
    title: string;
    subtitle: string;
    details: string[];
    color: string;
}

const TIMELINE_STEPS: TimelineStep[] = [
    {
        id: 'create',
        icon: Rocket,
        title: 'Create',
        subtitle: 'Launch your market',
        details: [
            'Deposit USDC using the b × ln(2) formula',
            'Receive LP tokens at 1:1 ratio with your deposit',
            'Market instantly goes live and ready for trading'
        ],
        color: 'violet'
    },
    {
        id: 'accumulate',
        icon: TrendingUp,
        title: 'Accumulate',
        subtitle: 'Fees grow your stake',
        details: [
            'Collect 5% fee on every single trade',
            'Fees automatically boost bBase liquidity',
            'Traders receive LP tokens for their fee payments (aligned incentives!)'
        ],
        color: 'blue'
    },
    {
        id: 'graduate',
        icon: Award,
        title: 'Graduate',
        subtitle: 'Fee reduction unlocked',
        details: [
            'Automatically triggered when fees equal your deposit threshold',
            'Trading fees drop from 5% to just 1% (80% reduction!)',
            'Fee split: 50% to bBase / 30% to LP Yield Pool / 20% to Protocol',
            'Post-graduation: Traders pay lower fees but no longer receive LP tokens'
        ],
        color: 'emerald'
    },
    {
        id: 'settle',
        icon: Scale,
        title: 'Settle',
        subtitle: 'Outcome determined',
        details: [
            'Adjudicator reports the final outcome + termination time (T*)',
            '24-hour veto window for Guardian to dispute if needed',
            'All trading is paused during the settlement process'
        ],
        color: 'orange'
    },
    {
        id: 'finalize',
        icon: Flag,
        title: 'Finalize',
        subtitle: 'Resolution locked',
        details: [
            'Outcome becomes permanently locked on-chain',
            'Winning token holders can redeem for USDC',
            'LP token holders can redeem for their proportional share of remaining funds'
        ],
        color: 'pink'
    },
    {
        id: 'redeem',
        icon: Coins,
        title: 'Redeem',
        subtitle: 'Collect your returns',
        details: [
            'Exchange your LP tokens for USDC at current value',
            'Your share = (Floor Value / Total LP Supply) × Your LP Balance',
            'Settlement complete! Market lifecycle finished.'
        ],
        color: 'yellow'
    }
];

const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
        violet: { bg: 'bg-violet-500', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-violet-500/30' },
        blue: { bg: 'bg-blue-500', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
        emerald: { bg: 'bg-emerald-500', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/30' },
        orange: { bg: 'bg-orange-500', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
        pink: { bg: 'bg-pink-500', border: 'border-pink-500/30', text: 'text-pink-400', glow: 'shadow-pink-500/30' },
        yellow: { bg: 'bg-yellow-500', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' }
    };
    return colors[color] || colors.violet;
};

interface MarketJourneyTimelineProps {
    defaultExpanded?: boolean;
}

export const MarketJourneyTimeline = ({ defaultExpanded = false }: MarketJourneyTimelineProps) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [activeStep, setActiveStep] = useState<string | null>(null);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Rocket className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <h4 className="font-bold text-white text-sm">Market Journey</h4>
                        <p className="text-[10px] text-white/50">Create → Graduate → Settle → Redeem</p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-white/50" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-white/50" />
                )}
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between px-2">
                        {TIMELINE_STEPS.map((step, i) => {
                            const colors = getColorClasses(step.color);
                            const Icon = step.icon;
                            const isActive = activeStep === step.id;

                            return (
                                <div key={step.id} className="flex items-center">
                                    <button
                                        onClick={() => setActiveStep(isActive ? null : step.id)}
                                        className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                            isActive
                                                ? `${colors.bg} shadow-lg ${colors.glow}`
                                                : "bg-white/10 hover:bg-white/20"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "w-5 h-5",
                                            isActive ? "text-white" : colors.text
                                        )} />
                                    </button>
                                    {i < TIMELINE_STEPS.length - 1 && (
                                        <div className="w-4 sm:w-8 h-0.5 bg-white/10 mx-1" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-between px-0 sm:px-2">
                        {TIMELINE_STEPS.map((step) => {
                            const colors = getColorClasses(step.color);
                            return (
                                <div key={step.id} className="text-center w-10 sm:w-auto">
                                    <p className={cn(
                                        "text-[10px] font-bold hidden sm:block",
                                        activeStep === step.id ? colors.text : "text-white/40"
                                    )}>
                                        {step.title}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {activeStep && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            {TIMELINE_STEPS.filter(s => s.id === activeStep).map(step => {
                                const colors = getColorClasses(step.color);
                                const Icon = step.icon;

                                return (
                                    <div
                                        key={step.id}
                                        className={cn(
                                            "p-4 rounded-xl border",
                                            `bg-${step.color}-500/5`,
                                            colors.border
                                        )}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <Icon className={cn("w-5 h-5", colors.text)} />
                                            <div>
                                                <h5 className="font-bold text-white">{step.title}</h5>
                                                <p className="text-xs text-white/50">{step.subtitle}</p>
                                            </div>
                                        </div>
                                        <ul className="space-y-2">
                                            {step.details.map((detail, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                                        colors.bg
                                                    )} />
                                                    {detail}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!activeStep && (
                        <p className="text-center text-xs text-white/40">
                            Click a step to learn more
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
