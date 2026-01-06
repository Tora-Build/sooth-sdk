/**
 * About Page (formerly Learn) - Actor-Centric Onboarding
 * 
 * Based on Sooth Whitepaper (Dec 2025)
 * Refactored to focus on Actor-Driven Design and the 3 Pillars of Decentralization.
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, ChevronRight, ChevronLeft, CheckCircle,
  TrendingUp, TrendingDown, DollarSign, Clock, Lock,
  Zap, GraduationCap, Rocket, Scale, BarChart3,
  Users, Target, RefreshCw, Sword, Info
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { cn } from '../lib/utils';
import uiContent from '../config/ui-content.json';

const { learn: content } = uiContent;

// Learning steps
const STEPS = content.steps;

// --- Subcomponents ---

const PillarCard: React.FC<{
  icon: any;
  title: string;
  description: string;
  innovation: string;
}> = ({ icon: Icon, title, description, innovation }) => (
  <Card className="p-4 border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 transition-colors h-full">
    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-indigo-400" />
    </div>
    <h3 className="font-bold text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-400 mb-4">{description}</p>
    <div className="pt-3 border-t border-slate-700/50">
      <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold mb-1">Innovation</p>
      <p className="text-xs text-slate-300">{innovation}</p>
    </div>
  </Card>
);

const ActorCard: React.FC<{
  icon: any;
  title: string;
  motivation: string;
  colorClass: string;
  onClick?: () => void;
}> = ({ icon: Icon, title, motivation, colorClass, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-4 rounded-xl border border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50 transition-all hover:-translate-y-1 focus-ring group`}
  >
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
    <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors">{title}</h3>
    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{motivation}</p>
  </button>
);

// Interactive LMSR curve component (reused and contextualized)
const LMSRCurve: React.FC = () => {
  const [shares, setShares] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const calculatePrice = (q: number) => {
    const b = 1000;
    const Q = 1000;
    return Math.exp(q / b) / (Math.exp(q / b) + Math.exp((Q - q) / b));
  };

  const price = calculatePrice(500 + shares);
  const cost = shares > 0 ? shares * price : 0;

  const handleDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const newShares = Math.round(((x / width) - 0.5) * 1000);
    setShares(Math.max(-400, Math.min(400, newShares)));
  }, [isDragging]);

  return (
    <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/30">
      <div className="flex justify-between text-sm mb-4">
        <span className="text-slate-400">Current Price (Probability)</span>
        <span className="font-mono text-lg text-emerald-400 tabular-nums">
          {(price * 100).toFixed(1)}%
        </span>
      </div>

      <div
        className="relative h-40 cursor-crosshair"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleDrag}
      >
        <svg viewBox="0 0 400 160" className="w-full h-full">
          <line x1="0" y1="80" x2="400" y2="80" stroke="#334155" strokeDasharray="4" />
          <line x1="200" y1="0" x2="200" y2="160" stroke="#334155" strokeDasharray="4" />
          <path
            d="M 0,140 Q 100,130 150,100 T 200,80 T 250,60 T 400,20"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
          />
          <circle
            cx={200 + shares / 2.5}
            cy={160 - price * 140}
            r="8"
            fill="#10b981"
            stroke="white"
            strokeWidth="2"
            className="cursor-grab"
          />
          <text x="10" y="155" fill="#64748b" fontSize="10">$0.00</text>
          <text x="10" y="15" fill="#64748b" fontSize="10">$1.00</text>
          <text x="380" y="155" fill="#64748b" fontSize="10" textAnchor="end">Inventory Shift →</text>
        </svg>
      </div>

      <p className="text-center text-xs text-slate-500 mt-2">
        👆 Drag to see how tradingYES vs NO shifts the price curve
      </p>

      {shares !== 0 && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">
              {shares > 0 ? 'Buying' : 'Selling'} {Math.abs(shares)} shares
            </span>
            <span className="text-emerald-400 font-mono font-bold">
              {shares > 0 ? 'Impact' : 'Recovery'}: +{(Math.abs(shares) / 10).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Sandbox trading panel (reused for Gaming Trader)
const SandboxTradingPanel: React.FC<{
  onTrade: (amount: number, isYes: boolean) => void;
}> = ({ onTrade }) => {
  const [amount, setAmount] = useState('100');
  const [selectedOutcome, setSelectedOutcome] = useState<'yes' | 'no'>('yes');
  const [isPending, setIsPending] = useState(false);

  const handleTrade = () => {
    setIsPending(true);
    setTimeout(() => {
      onTrade(parseFloat(amount), selectedOutcome === 'yes');
      setIsPending(false);
      setAmount('100');
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSelectedOutcome('yes')}
          className={`p-4 rounded-xl border-2 transition-all focus-ring ${selectedOutcome === 'yes'
            ? 'border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/10'
            : 'border-slate-700 bg-slate-800/50 hover:border-emerald-500/50 hover:-translate-y-0.5'
            }`}
        >
          <TrendingUp className={`w-6 h-6 mx-auto mb-2 transition-transform ${selectedOutcome === 'yes' ? 'text-emerald-400 scale-110' : 'text-slate-500'
            }`} />
          <p className={`font-bold ${selectedOutcome === 'yes' ? 'text-emerald-400' : 'text-slate-400'
            }`}>YES</p>
          <p className="text-2xl font-bold mt-1 text-white tabular-nums">62%</p>
        </button>
        <button
          onClick={() => setSelectedOutcome('no')}
          className={`p-4 rounded-xl border-2 transition-all focus-ring ${selectedOutcome === 'no'
            ? 'border-rose-500 bg-rose-500/20 shadow-lg shadow-rose-500/10'
            : 'border-slate-700 bg-slate-800/50 hover:border-rose-500/50 hover:-translate-y-0.5'
            }`}
        >
          <TrendingDown className={`w-6 h-6 mx-auto mb-2 transition-transform ${selectedOutcome === 'no' ? 'text-rose-400 scale-110' : 'text-slate-500'
            }`} />
          <p className={`font-bold ${selectedOutcome === 'no' ? 'text-rose-400' : 'text-slate-400'
            }`}>NO</p>
          <p className="text-2xl font-bold mt-1 text-white tabular-nums">38%</p>
        </button>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Amount (USDC)</label>
        <div className="flex gap-2 mb-3">
          {['50', '100', '500'].map(preset => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`quick-trade-btn flex-1 ${amount === preset ? 'active' : ''}`}
            >
              ${preset}
            </button>
          ))}
        </div>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field pl-9"
            placeholder="Custom amount"
          />
        </div>
      </div>

      <div className="bg-slate-900/60 rounded-xl p-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">You receive</span>
          <span className="text-white font-mono font-bold">
            ~{(parseFloat(amount || '0') / (selectedOutcome === 'yes' ? 0.62 : 0.38)).toFixed(0)} shares
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Fee (5% Internal Phase)</span>
          <span className="text-emerald-400 font-mono font-bold">
            +${(parseFloat(amount || '0') * 0.05).toFixed(2)} LP Reward
          </span>
        </div>
      </div>

      <Button
        variant={selectedOutcome === 'yes' ? 'success' : 'danger'}
        className="w-full py-4 font-bold rounded-xl"
        onClick={handleTrade}
        isLoading={isPending}
      >
        Trade {selectedOutcome.toUpperCase()}
      </Button>
    </div>
  );
};

export const Learn = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [sandboxBalance, setSandboxBalance] = useState(10000);
  const [sandboxPositions, setSandboxPositions] = useState<Array<{
    isYes: boolean;
    shares: number;
    entryPrice: number;
  }>>([]);

  const handleSandboxTrade = (amount: number, isYes: boolean) => {
    const price = isYes ? 0.62 : 0.38;
    const shares = amount / price;
    setSandboxBalance(prev => prev - amount);
    setSandboxPositions(prev => [...prev, { isYes, shares, entryPrice: price }]);
  };

  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                {content.header.title}
              </h1>
            </div>
            <p className="text-slate-400 max-w-lg">
              {content.header.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/trade">
              <Button variant="ghost" className="text-slate-400 hover:text-white">
                Skip to Trade →
              </Button>
            </Link>
          </div>
        </div>

        {/* Progress Timeline */}
        <div className="relative mb-16">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -translate-y-1/2" />
          <div className="flex justify-between relative z-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center">
                <button
                  onClick={() => setCurrentStep(i)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${i < currentStep ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' :
                    i === currentStep ? 'bg-slate-900 border-2 border-indigo-500 text-indigo-400 scale-110' :
                      'bg-slate-900 border-2 border-slate-700 text-slate-500'
                    }`}
                >
                  {i < currentStep ? <CheckCircle className="w-6 h-6" /> : i + 1}
                </button>
                <span className={`text-[10px] uppercase tracking-widest mt-3 font-bold ${i === currentStep ? 'text-indigo-400' : 'text-slate-500'
                  }`}>
                  {s.id}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content Container */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">

          {/* Main Tutorial Card */}
          <div className="lg:col-span-8">
            <Card className="p-8 border-slate-700/50 min-h-[500px] flex flex-col">

              {/* Step 1: Decentralization Thesis */}
              {currentStep === 0 && (
                <div className="space-y-8 animate-fade-in flex-1">
                  <div>
                    <Badge variant="outline" className="mb-4 text-indigo-400 border-indigo-400/30">{step.badge}</Badge>
                    <h2 className="text-3xl font-bold text-white mb-4">{step.title}</h2>
                    <p className="text-slate-400 leading-relaxed">
                      {step.description.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part)}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <PillarCard
                      icon={Rocket}
                      title={content.pillars.launchpad.title}
                      description={content.pillars.launchpad.description}
                      innovation={content.pillars.launchpad.innovation}
                    />
                    <PillarCard
                      icon={Scale}
                      title={content.pillars.zkRules.title}
                      description={content.pillars.zkRules.description}
                      innovation={content.pillars.zkRules.innovation}
                    />
                    <PillarCard
                      icon={BarChart3}
                      title={content.pillars.tickBook.title}
                      description={content.pillars.tickBook.description}
                      innovation={content.pillars.tickBook.innovation}
                    />
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-800">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Sword className="w-4 h-4 text-indigo-400" />
                      {content.advantage.title}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-800">
                            {content.advantage.table.headers.map((h, i) => (
                              <th key={i} className={cn("pb-2 font-medium", h === 'Sooth' && "font-bold text-emerald-400")}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="text-slate-400">
                          {content.advantage.table.rows.map((row, i) => (
                            <tr key={i} className="border-b border-slate-800/30">
                              <td className="py-3">{row[0]}</td>
                              <td className="py-3">{row[1]}</td>
                              <td className="py-3 text-white">{row[2]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: The Creator */}
              {currentStep === 1 && (
                <div className="space-y-8 animate-fade-in flex-1">
                  <div>
                    <Badge variant="outline" className="mb-4 text-cyan-400 border-cyan-400/30">{step.badge}</Badge>
                    <h2 className="text-3xl font-bold text-white mb-4">{step.title}</h2>
                    <p className="text-slate-400">
                      {step.description.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part)}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        {content.creator.plTitle}
                      </h4>
                      <div className="space-y-3">
                        {content.creator.plItems.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-xs p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                            <span className="text-slate-400">{item.event}</span>
                            <span className={item.pos ? 'text-emerald-400' : 'text-rose-400'}>{item.impact}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-6">
                      <h4 className="text-sm font-bold text-cyan-400 mb-4 uppercase tracking-widest">{content.creator.example.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed mb-4">
                        {content.creator.example.text.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part)}
                      </p>
                      <div className="p-3 rounded-lg bg-slate-900/60 text-center">
                        <span className="text-slate-500 text-[10px] uppercase block mb-1">{content.creator.example.pnlLabel}</span>
                        <span className="text-2xl font-bold text-emerald-400">{content.creator.example.pnlValue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">{content.creator.tiersTitle}</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {content.creator.tiers.map((t, i) => (
                        <div key={i} className="text-center p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                          <p className="text-[10px] text-slate-500 mb-1">{t.tier}</p>
                          <p className="text-sm font-bold text-white">{t.b}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Deposit: {t.dep}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Gaming Trader */}
              {currentStep === 2 && (
                <div className="space-y-8 animate-fade-in flex-1">
                  <div>
                    <Badge variant="outline" className="mb-4 text-emerald-400 border-emerald-400/30">{step.badge}</Badge>
                    <h2 className="text-3xl font-bold text-white mb-4">{step.title}</h2>
                    <p className="text-slate-400">
                      {step.description.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part)}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                        <h4 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4" />
                          {content.gaming.mechanismTitle}
                        </h4>
                        <div className="space-y-4 relative">
                          {content.gaming.mechanismSteps.map((s, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded flex items-center justify-center text-xs font-bold", i === 2 ? "bg-emerald-500 text-black" : "bg-slate-800 text-white")}>{i + 1}</div>
                              <p className={cn("text-xs", i === 2 ? "text-white font-medium" : "text-slate-300")}>{s}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                        <h4 className="text-sm font-bold text-white mb-4">{content.gaming.pricingTitle}</h4>
                        <LMSRCurve />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                        <h4 className="text-sm font-bold text-white mb-4">{content.gaming.practiceTitle}</h4>
                        <SandboxTradingPanel onTrade={handleSandboxTrade} />
                      </div>

                      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-500 mb-1 uppercase tracking-widest">{content.gaming.sellLock.title}</p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            {content.gaming.sellLock.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Pro Traders */}
              {currentStep === 3 && (
                <div className="space-y-8 animate-fade-in flex-1">
                  <div>
                    <Badge variant="outline" className="mb-4 text-purple-400 border-purple-400/30">{step.badge}</Badge>
                    <h2 className="text-3xl font-bold text-white mb-4">{step.title}</h2>
                    <p className="text-slate-400">
                      {step.description.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white">{part}</strong> : part)}
                    </p>
                  </div>

                  <div className="bg-slate-900/60 rounded-xl p-6 border border-slate-800">
                    <h4 className="text-sm font-bold text-white mb-6 text-center uppercase tracking-widest">{content.pro.architectureTitle}</h4>
                    <div className="grid md:grid-cols-2 gap-0 border border-slate-700/50 rounded-xl overflow-hidden">
                      <div className="p-6 border-b md:border-b-0 md:border-r border-slate-700/50">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">🐢</div>
                          <h5 className="font-bold text-white">{content.pro.amm.title}</h5>
                        </div>
                        <ul className="space-y-3 text-xs text-slate-400">
                          {content.pro.amm.items.map((item, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{item[0]}</span>
                              <span className={cn("text-white", item[1].includes('24h') && "text-amber-400")}>{item[1]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-6 bg-indigo-500/5">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">⚡</div>
                          <h5 className="font-bold text-white text-indigo-400">{content.pro.tickBook.title}</h5>
                        </div>
                        <ul className="space-y-3 text-xs text-slate-400">
                          {content.pro.tickBook.items.map((item, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{item[0]}</span>
                              <span className={cn("text-white", (item[1].includes('Instant') || item[1].includes('ERC20')) && "font-bold text-emerald-400")}>{item[1]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                      <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-indigo-400" />
                        {content.pro.arb.title}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        {content.pro.arb.description}
                      </p>
                      <div className="p-4 rounded-lg bg-slate-900 font-mono text-[10px] text-slate-300">
                        AMM Price: 62% <br />
                        TickBook Ask: 58% <br />
                        <span className="text-emerald-400">→ Arb: +4¢ per share</span>
                      </div>
                    </div>
                    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                      <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Sword className="w-4 h-4 text-rose-400" />
                        {content.pro.pvp.title}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {content.pro.pvp.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-800 bg-indigo-500/5">
                    <h4 className="text-sm font-bold text-indigo-400 mb-4 uppercase tracking-widest">{content.pro.evolutionTitle}</h4>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-4">
                      {content.pro.evolutionStages.map((s, i) => (
                        <React.Fragment key={i}>
                          <span className={i === 0 ? "text-indigo-300" : ""}>{s}</span>
                          {i < content.pro.evolutionStages.length - 1 && <ChevronRight className="w-4 h-4" />}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="bg-indigo-500/30" />
                      <div className="bg-indigo-500/60" />
                      <div className="bg-indigo-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4 text-[10px] text-slate-400 text-center">
                      {content.pro.evolutionStates.map((s, i) => (
                        <div key={i} className={i === 2 ? "text-white" : ""}>{s}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Start Journey */}
              {currentStep === 4 && (
                <div className="space-y-12 animate-fade-in flex-1 flex flex-col items-center justify-center text-center">
                  <div className="max-w-xl mx-auto space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-6">
                      <GraduationCap className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h2 className="text-4xl font-bold text-white">{content.ready.title}</h2>
                    <p className="text-slate-400 text-lg">
                      {content.ready.subtitle}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                    {content.ready.actors.map((actor, i) => (
                      <ActorCard
                        key={i}
                        icon={[Rocket, Target, RefreshCw, Sword][i]}
                        title={actor.title}
                        motivation={actor.motivation}
                        colorClass={["bg-cyan-500/10 text-cyan-400", "bg-emerald-500/10 text-emerald-400", "bg-purple-500/10 text-purple-400", "bg-rose-500/10 text-rose-400"][i]}
                        onClick={() => window.location.href = ['/create', '/trade', '/pro', '/pro'][i]}
                      />
                    ))}
                  </div>

                  <div className="pt-8 border-t border-slate-800 w-full max-w-2xl">
                    <div className="flex items-center gap-3 justify-center mb-6">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Protocol is live on Base Sepolia</span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">V8.1</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Architecture</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">0%</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Platform Fees</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">∞</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Open-End Markets</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="mt-auto pt-8 flex justify-between border-t border-slate-800">
                <Button
                  variant="secondary"
                  size="lg"
                  className="rounded-xl px-8"
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button
                    variant="primary"
                    size="lg"
                    className="rounded-xl px-8 bg-indigo-600 hover:bg-indigo-500"
                    onClick={() => setCurrentStep(prev => prev + 1)}
                  >
                    Next Step
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Link to="/trade">
                    <Button variant="primary" size="lg" className="rounded-xl px-8 bg-emerald-600 hover:bg-emerald-500">
                      Launch App
                      <Zap className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Whitepaper Snip/Notes */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 bg-slate-900/60 border-slate-800">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="w-3 h-3" />
                {content.context.title}
              </h3>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">
                    "{content.context.quotes[step.id as keyof typeof content.context.quotes]}"
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase">{content.context.mechanismsTitle}</h4>
                  {content.context.mechanisms.map((m, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1" />
                      <div>
                        <span className="text-[11px] font-bold text-white block">{m.label}</span>
                        <span className="text-[10px] text-slate-500">{m.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-indigo-500/10 border-indigo-500/20">
              <h3 className="text-xs font-bold text-white mb-3">Pro Tip</h3>
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                {content.proTip}
              </p>
            </Card>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-500 mt-8 uppercase tracking-[0.2em]">
          Sooth Protocol Tutorial • Step {currentStep + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
};
