import { Rocket, TrendingUp, Shield } from 'lucide-react';

export const LaunchpadHeader = () => {
    return (
        <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/30 via-cyan-600/20 to-cyan-500/30" />
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/40 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-500/30 rounded-full blur-[80px] animate-pulse [animation-delay:1s]" />
                <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-orange-500/25 rounded-full blur-[60px] animate-pulse [animation-delay:2s]" />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
            </div>

            <div className="relative px-8 py-14 backdrop-blur-xl border border-white/10 bg-black/20 rounded-3xl">
                <div className="flex items-start justify-between gap-8">
                    <div className="space-y-6 max-w-2xl">
                        <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.1]">
                            <span className="text-white drop-shadow-2xl">Launch Your</span>
                            <br />
                            <span className="bg-gradient-to-r from-cyan-400 via-cyan-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-cycle bg-[length:200%_auto]">
                                Prediction Market
                            </span>
                        </h1>

                        <p className="text-xl text-white/60 leading-relaxed">
                            Deploy a verifiable truth market in <span className="text-white font-semibold">under 60 seconds</span>.
                            Seed initial liquidity, select your adjudicator, and <span className="text-emerald-400 font-semibold">watch your pool grow via flywheel</span>.
                        </p>

                        <p className="text-lg text-cyan-400 font-semibold">
                            50% → Flywheel liquidity • 30% → LP yield after graduation
                        </p>

                        <div className="flex items-center gap-6 pt-2">
                            <div className="flex items-center gap-2 text-sm text-white/50">
                                <Rocket className="w-4 h-4 text-cyan-400" />
                                <span>Instant Deploy</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/50">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span>Auto Liquidity</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/50">
                                <Shield className="w-4 h-4 text-blue-400" />
                                <span>Trustless</span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:block relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-cyan-500 to-cyan-500 rounded-3xl blur-2xl opacity-60 animate-pulse" />
                        <div className="relative p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-sm">
                            <div className="relative">
                                <Rocket className="w-20 h-20 text-white drop-shadow-2xl" />
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-gradient-to-t from-orange-500/80 to-transparent blur-sm rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
