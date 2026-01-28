import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import {
  Palette,
  Gamepad2,
  ArrowLeftRight,
  Swords,
  ArrowRight,
  TrendingUp,
  Shield,
  Users,
  Target,
  Sparkles,
  Check,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

import { COLORS, FONTS } from './brand';

const FPS = 30;
export const SPEECH_VIDEO_DURATION_SECONDS = 120;

const SCENES = {
  title: { duration: 15 * FPS },
  problemGood: { duration: 15 * FPS },
  resilience: { duration: 15 * FPS },
  actors: { duration: 15 * FPS },
  creatorDeep: { duration: 20 * FPS },
  lpMechanics: { duration: 15 * FPS },
  alignment: { duration: 10 * FPS },
  closing: { duration: 15 * FPS },
};

// ============================================================================
// Shared Components
// ============================================================================

const Icon = ({ icon: IconComponent, size = 24, color }: { icon: LucideIcon; size?: number; color?: string }) => (
  <IconComponent size={size} color={color} strokeWidth={2} />
);

const GradientBackground = ({ variant = 'default' }: { variant?: 'default' | 'problem' | 'success' | 'creator' | 'purple' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const gradientX = interpolate(frame, [0, durationInFrames], [20, 80]);
  const gradientY = interpolate(frame, [0, durationInFrames], [30, 70]);
  const pulse = Math.sin(frame * 0.015) * 0.15 + 0.85; // Slower pulse for ambient feel

  const colors = {
    default: { primary: 'rgba(6, 182, 212, 0.15)', secondary: 'rgba(192, 132, 252, 0.08)' },
    problem: { primary: 'rgba(244, 63, 94, 0.12)', secondary: 'rgba(251, 146, 60, 0.08)' },
    success: { primary: 'rgba(16, 185, 129, 0.15)', secondary: 'rgba(6, 182, 212, 0.1)' },
    creator: { primary: 'rgba(6, 182, 212, 0.18)', secondary: 'rgba(34, 211, 238, 0.1)' },
    purple: { primary: 'rgba(192, 132, 252, 0.15)', secondary: 'rgba(139, 92, 246, 0.1)' },
  };

  const c = colors[variant];

  return (
    <AbsoluteFill style={{ background: '#020617' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at ${gradientX}% ${gradientY}%, ${c.primary.replace(')', `, ${pulse})`)} 0%, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 80% at ${100 - gradientX}% ${100 - gradientY}%, ${c.secondary.replace(')', `, ${pulse})`)} 0%, transparent 50%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2, 6, 23, 0.5) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const AnimatedLogo = ({ scale = 1, delay = 0 }: { scale?: number; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 12 }, delay });
  const logoScale = interpolate(progress, [0, 1], [0.3, 1]);
  const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' });
  const floatY = Math.sin(frame * 0.03) * 5;

  return (
    <div
      style={{
        transform: `scale(${logoScale * scale}) translateY(${floatY}px)`,
        opacity,
        filter: `drop-shadow(0 0 50px rgba(6, 182, 212, 0.5))`,
      }}
    >
      <Img src={staticFile('sooth-logo.svg')} style={{ width: 200, height: 200 }} />
    </div>
  );
};

const SectionTitle = ({
  title,
  subtitle,
  delay = 0,
  color = COLORS.cyan[400]
}: {
  title: string;
  subtitle?: string;
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 15 }, delay });
  const subtitleProgress = spring({ frame, fps, config: { damping: 15 }, delay: delay + 20 });

  return (
    <div style={{ textAlign: 'center', marginBottom: 60 }}>
      <div
        style={{
          fontSize: 72,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color: COLORS.text.primary,
          opacity: interpolate(titleProgress, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleProgress, [0, 1], [40, 0])}px)`,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 28,
            fontFamily: FONTS.mono,
            color,
            marginTop: 20,
            opacity: interpolate(subtitleProgress, [0, 1], [0, 1]),
            letterSpacing: 4,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Scene 1: Title (0-60s)
// ============================================================================
const SceneTitle = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 12 }, delay: 10 });
  const strikeProgress = spring({ frame, fps, config: { damping: 200 }, delay: 30 });
  const resilienceProgress = spring({ frame, fps, config: { damping: 12 }, delay: 45 });
  const subtitleProgress = spring({ frame, fps, config: { damping: 15 }, delay: 60 });

  const strikeWidth = interpolate(strikeProgress, [0, 1], [0, 100]);

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <AnimatedLogo scale={1.2} delay={0} />

          <div
            style={{
              fontSize: 100,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.text.primary,
              textAlign: 'center',
              lineHeight: 1.2,
              opacity: interpolate(titleProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(titleProgress, [0, 1], [40, 0])}px)`,
            }}
          >
            Gaming Design for
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            {/* "Good" with strikethrough */}
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  fontSize: 100,
                  fontFamily: FONTS.heading,
                  fontWeight: 700,
                  color: COLORS.text.muted,
                  opacity: interpolate(titleProgress, [0, 1], [0, 0.5]),
                }}
              >
                Good
              </span>
              <div
                style={{
                  position: 'absolute',
                  top: '55%',
                  left: 0,
                  width: `${strikeWidth}%`,
                  height: 6,
                  background: COLORS.destructive,
                  borderRadius: 3,
                }}
              />
            </div>

            {/* "Resilience" */}
            <span
              style={{
                fontSize: 100,
                fontFamily: FONTS.heading,
                fontWeight: 700,
                color: COLORS.cyan[400],
                opacity: interpolate(resilienceProgress, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(resilienceProgress, [0, 1], [30, 0])}px)`,
                textShadow: `0 0 60px ${COLORS.cyan[400]}50`,
              }}
            >
              Resilience
            </span>
          </div>

          <div
            style={{
              fontSize: 32,
              fontFamily: FONTS.mono,
              color: COLORS.text.secondary,
              marginTop: 40,
              opacity: interpolate(subtitleProgress, [0, 1], [0, 1]),
              letterSpacing: 3,
            }}
          >
            ETH Chiang Mai 2026
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 2: The Problem with "Design for Good" (60-150s)
// ============================================================================
const SceneProblemGood = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const problems = [
    { text: '"Good actors" is an assumption', delay: 20, icon: Users },
    { text: 'Value systems don\'t scale', delay: 40, icon: Target },
    { text: 'Permissionless = All actors', delay: 60, icon: Shield },
  ];

  const quoteProgress = spring({ frame, fps, config: { damping: 15 }, delay: 90 });

  return (
    <AbsoluteFill>
      <GradientBackground variant="problem" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          <SectionTitle
            title="Why 'Design for Good' Fails"
            subtitle="ON PERMISSIONLESS NETWORKS"
            color={COLORS.destructive}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 40, maxWidth: 1200 }}>
            {problems.map((problem, i) => {
              const progress = spring({ frame, fps, config: { damping: 12 }, delay: problem.delay });
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 30,
                    padding: '36px 50px',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '2px solid rgba(244, 63, 94, 0.25)',
                    borderRadius: 20,
                    opacity: interpolate(progress, [0, 1], [0, 1]),
                    transform: `translateX(${interpolate(progress, [0, 1], [-40, 0])}px)`,
                  }}
                >
                  <Icon icon={problem.icon} size={48} color={COLORS.destructive} />
                  <span
                    style={{
                      fontSize: 36,
                      fontFamily: FONTS.heading,
                      fontWeight: 600,
                      color: COLORS.text.primary,
                    }}
                  >
                    {problem.text}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 40,
              padding: '40px 60px',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: 24,
              border: '1px solid rgba(100, 116, 139, 0.3)',
              maxWidth: 1000,
              textAlign: 'center',
              opacity: interpolate(quoteProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(quoteProgress, [0, 1], [30, 0])}px)`,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontFamily: FONTS.heading,
                fontStyle: 'italic',
                color: COLORS.text.secondary,
                lineHeight: 1.5,
              }}
            >
              "You can't impose morality on a system that's designed to be open to everyone."
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 3: The Resilience Alternative (150-210s)
// ============================================================================
const SceneResilience = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const coreProgress = spring({ frame, fps, config: { damping: 12 }, delay: 20 });
  const insightProgress = spring({ frame, fps, config: { damping: 15 }, delay: 50 });

  return (
    <AbsoluteFill>
      <GradientBackground variant="success" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
          <SectionTitle
            title="Design for Resilience"
            subtitle="ACCEPT ALL ACTORS"
            color={COLORS.success}
          />

          <div
            style={{
              padding: '50px 80px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
              border: '3px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 28,
              opacity: interpolate(coreProgress, [0, 1], [0, 1]),
              transform: `scale(${interpolate(coreProgress, [0, 1], [0.9, 1])})`,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontFamily: FONTS.heading,
                fontWeight: 700,
                color: COLORS.text.primary,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              Create <span style={{ color: COLORS.success }}>survival pressure</span><br />
              that incentivizes long-term thinking
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              padding: '28px 50px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 50,
              opacity: interpolate(insightProgress, [0, 1], [0, 1]),
            }}
          >
            <Icon icon={Sparkles} size={32} color={COLORS.success} />
            <span
              style={{
                fontSize: 28,
                fontFamily: FONTS.mono,
                color: COLORS.success,
              }}
            >
              If surviving requires long-term thinking, actors will think long-term
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 4: Four Actor Archetypes (210-270s)
// ============================================================================
const SceneActors = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const actors = [
    { 
      name: 'Creator', 
      icon: Palette, 
      color: COLORS.cyan[400],
      motivation: 'Monetize insight, earn LP',
      delay: 15 
    },
    { 
      name: 'Gaming Trader', 
      icon: Gamepad2, 
      color: '#10b981',
      motivation: 'Predict & become stakeholder',
      delay: 25 
    },
    { 
      name: 'Arbitrageur', 
      icon: ArrowLeftRight, 
      color: '#3b82f6',
      motivation: 'Capture inefficiencies',
      delay: 35 
    },
    { 
      name: 'PvP Trader', 
      icon: Swords, 
      color: '#f97316',
      motivation: 'Pure conviction trading',
      delay: 45 
    },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          <SectionTitle
            title="Four Actor Archetypes"
            subtitle="EACH WITH ALIGNED INCENTIVES"
          />

          <div style={{ display: 'flex', gap: 36 }}>
            {actors.map((actor, i) => {
              const progress = spring({ frame, fps, config: { damping: 12 }, delay: actor.delay });
              return (
                <div
                  key={i}
                  style={{
                    width: 320,
                    padding: 40,
                    background: 'rgba(15, 23, 42, 0.85)',
                    borderRadius: 24,
                    border: `2px solid ${actor.color}40`,
                    opacity: interpolate(progress, [0, 1], [0, 1]),
                    transform: `translateY(${interpolate(progress, [0, 1], [40, 0])}px)`,
                    boxShadow: `0 20px 50px rgba(0, 0, 0, 0.3), 0 0 30px ${actor.color}10`,
                  }}
                >
                  <div style={{ marginBottom: 24 }}>
                    <Icon icon={actor.icon} size={56} color={actor.color} />
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontFamily: FONTS.heading,
                      fontWeight: 700,
                      color: actor.color,
                      marginBottom: 16,
                    }}
                  >
                    {actor.name}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontFamily: FONTS.mono,
                      color: COLORS.text.muted,
                      lineHeight: 1.4,
                    }}
                  >
                    {actor.motivation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 5: Creator Deep Dive (270-390s) - THE FOCUS
// ============================================================================
const LN2 = 0.693147;
const PRE_GRAD_FEE_RATE = 0.05;
const POST_GRAD_FEE_RATE = 0.01;
const BBASE_SHARE = 0.50;
const LP_YIELD_SHARE = 0.30;

function calculateCreatorPnL(liquidityTier: number, totalVolume: number, positionImbalance: number = 0) {
  const lpDeposit = Math.round(liquidityTier * LN2);
  const lpTokens = lpDeposit;
  const totalLpSupply = lpDeposit * 2;
  const ownershipPercent = 0.5;
  const graduationThreshold = lpDeposit;
  
  const preGradVolume = Math.min(totalVolume, graduationThreshold / PRE_GRAD_FEE_RATE);
  const preGradFees = Math.round(preGradVolume * PRE_GRAD_FEE_RATE);
  const isGraduated = preGradFees >= graduationThreshold;
  
  const postGradVolume = isGraduated ? Math.max(0, totalVolume - preGradVolume) : 0;
  const postGradFees = Math.round(postGradVolume * POST_GRAD_FEE_RATE);
  
  const feeYield = Math.round(postGradFees * LP_YIELD_SHARE * ownershipPercent);
  const flywheelGrowth = Math.round(postGradFees * BBASE_SHARE * ownershipPercent);
  
  const atRisk = lpDeposit + flywheelGrowth;
  const settlementOutcome = Math.round(atRisk * positionImbalance * 2);
  
  const lpRedemption = Math.max(0, lpDeposit + flywheelGrowth + settlementOutcome + feeYield);
  const netPnL = lpRedemption - lpDeposit;
  const roi = lpDeposit > 0 ? Math.round((netPnL / lpDeposit) * 100) : 0;
  
  return { lpDeposit, lpTokens, totalLpSupply, ownershipPercent, flywheelGrowth, feeYield, settlementOutcome, lpRedemption, netPnL, roi };
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  return absValue >= 1000 ? `$${(absValue / 1000).toFixed(1)}k` : `$${absValue.toLocaleString()}`;
}

const SceneCreatorDeep = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const liquidityTier = interpolate(frame, [30, 150], [100, 1000], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const volume = interpolate(frame, [60, 300], [1000, 100000], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const imbalance = 0;

  const result = calculateCreatorPnL(Math.round(liquidityTier), Math.round(volume), imbalance);

  const panelProgress = spring({ frame, fps, config: { damping: 15 }, delay: 10 });
  const equationProgress = spring({ frame, fps, config: { damping: 15 }, delay: 80 });
  const resultProgress = spring({ frame, fps, config: { damping: 15 }, delay: 120 });

  const sliderFillLiquidity = interpolate(liquidityTier, [100, 10000], [0, 100], { extrapolateRight: 'clamp' });
  const sliderFillVolume = interpolate(volume, [1000, 1000000], [0, 100], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <GradientBackground variant="creator" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 60 }}>
        <div style={{ display: 'flex', gap: 60, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 600,
              padding: 40,
              background: 'rgba(15, 23, 42, 0.9)',
              borderRadius: 28,
              border: '2px solid rgba(6, 182, 212, 0.3)',
              opacity: interpolate(panelProgress, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(panelProgress, [0, 1], [-40, 0])}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
              <Icon icon={Palette} size={48} color={COLORS.cyan[400]} />
              <div>
                <div style={{ fontSize: 32, fontFamily: FONTS.heading, fontWeight: 700, color: COLORS.text.primary }}>Creator</div>
                <div style={{ fontSize: 16, fontFamily: FONTS.mono, color: COLORS.text.muted }}>Carol creates markets and earns from volume</div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: 16, marginBottom: 30 }}>
              <div style={{ fontSize: 16, fontFamily: FONTS.heading, color: COLORS.cyan[300] }}>
                <span style={{ fontWeight: 700 }}>Carol's Strategy:</span> Create a market, seed liquidity, and earn from trading volume. No trading required!
              </div>
            </div>

            <div style={{ fontSize: 14, fontFamily: FONTS.mono, color: COLORS.text.muted, marginBottom: 16, letterSpacing: 2 }}>INFLUENCE FACTORS</div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontFamily: FONTS.mono, color: COLORS.text.secondary, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon icon={DollarSign} size={18} color={COLORS.text.muted} /> Liquidity (b)
                </span>
                <span style={{ fontSize: 16, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.primary }}>${Math.round(liquidityTier).toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
                <div style={{ width: `${sliderFillLiquidity}%`, height: '100%', background: COLORS.cyan[400], borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: FONTS.mono, color: COLORS.text.muted, marginTop: 4 }}>
                <span>$100</span><span>$10,000</span>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontFamily: FONTS.mono, color: COLORS.text.secondary, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon icon={TrendingUp} size={18} color={COLORS.text.muted} /> Trading Volume
                </span>
                <span style={{ fontSize: 16, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.primary }}>${Math.round(volume / 1000)}k</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
                <div style={{ width: `${sliderFillVolume}%`, height: '100%', background: COLORS.cyan[400], borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: FONTS.mono, color: COLORS.text.muted, marginTop: 4 }}>
                <span>$1k</span><span>$1.0M</span>
              </div>
            </div>

            <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontFamily: FONTS.mono, color: COLORS.text.muted }}>Your LP Ownership</span>
                <span style={{ fontSize: 16, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.primary }}>
                  {result.lpTokens} / {result.totalLpSupply} = {Math.round(result.ownershipPercent * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              width: 650,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              opacity: interpolate(equationProgress, [0, 1], [0, 1]),
              transform: `translateX(${interpolate(equationProgress, [0, 1], [40, 0])}px)`,
            }}
          >
            <div style={{ fontSize: 14, fontFamily: FONTS.mono, color: COLORS.text.muted, letterSpacing: 2 }}>
              LP EQUATION <span style={{ color: COLORS.text.secondary }}>[{Math.round(result.ownershipPercent * 100)}%]</span>
            </div>

            <div style={{ padding: 32, background: 'rgba(15, 23, 42, 0.9)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontFamily: FONTS.mono, fontWeight: 800, color: COLORS.text.primary }}>{formatCurrency(result.lpRedemption)}</div>
                  <div style={{ fontSize: 12, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase' }}>LP Redemption</div>
                </div>
                <span style={{ fontSize: 28, fontFamily: FONTS.mono, color: COLORS.text.muted }}>=</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.secondary }}>{formatCurrency(result.lpDeposit)}</div>
                  <div style={{ fontSize: 11, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase' }}>Deposit</div>
                </div>
                <span style={{ fontSize: 24, fontFamily: FONTS.mono, color: COLORS.text.muted }}>+</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.secondary }}>{formatCurrency(result.flywheelGrowth)}</div>
                  <div style={{ fontSize: 11, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase' }}>Flywheel</div>
                </div>
                <span style={{ fontSize: 24, fontFamily: FONTS.mono, color: COLORS.text.muted }}>+</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.secondary }}>{formatCurrency(result.settlementOutcome)}</div>
                  <div style={{ fontSize: 11, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase' }}>Settlement</div>
                </div>
                <span style={{ fontSize: 24, fontFamily: FONTS.mono, color: COLORS.text.muted }}>+</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.text.secondary }}>{formatCurrency(result.feeYield)}</div>
                  <div style={{ fontSize: 11, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase' }}>Fee Yield</div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 28,
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(6, 182, 212, 0.1))',
                borderRadius: 20,
                border: '2px solid rgba(6, 182, 212, 0.4)',
                opacity: interpolate(resultProgress, [0, 1], [0, 1]),
                transform: `scale(${interpolate(resultProgress, [0, 1], [0.95, 1])})`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase', fontWeight: 700 }}>Net P&L</div>
                  <div style={{ fontSize: 48, fontFamily: FONTS.mono, fontWeight: 800, color: COLORS.text.primary }}>{formatCurrency(result.netPnL)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontFamily: FONTS.mono, color: COLORS.text.muted, textTransform: 'uppercase', fontWeight: 700 }}>ROI</div>
                  <div style={{ fontSize: 48, fontFamily: FONTS.mono, fontWeight: 800, color: COLORS.text.primary }}>{result.roi}%</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
              <Icon icon={Sparkles} size={20} color={COLORS.cyan[400]} />
              <span style={{ fontSize: 14, fontFamily: FONTS.heading, color: COLORS.text.muted }}>
                <span style={{ fontWeight: 700, color: COLORS.text.primary }}>LMSR Property:</span> Max loss = Deposit, Max win = Deposit + Flywheel. Fee Yield is always yours.
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const InsightCard = ({
  title,
  description,
  icon,
  delay,
  color,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  delay: number;
  color: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 12 }, delay });

  return (
    <div
      style={{
        width: 360,
        padding: 36,
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 20,
        border: `1px solid ${color}40`,
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
      }}
    >
      <div style={{ marginBottom: 16 }}><Icon icon={icon} size={40} color={color} /></div>
      <div style={{ fontSize: 24, fontFamily: FONTS.heading, fontWeight: 700, color: COLORS.text.primary, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 18, fontFamily: FONTS.heading, color: COLORS.text.muted, lineHeight: 1.5 }}>
        {description}
      </div>
    </div>
  );
};

// ============================================================================
// Scene 6: LP Mechanics (390-480s)
// ============================================================================
const SceneLPMechanics = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const equationProgress = spring({ frame, fps, config: { damping: 15 }, delay: 15 });
  
  const components = [
    { label: 'Deposit', color: COLORS.cyan[400], delay: 30 },
    { label: 'Flywheel', color: COLORS.magenta[400], delay: 40 },
    { label: 'Settlement', color: COLORS.success, delay: 50 },
    { label: 'Yield', color: COLORS.purple, delay: 60 },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground variant="purple" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          <SectionTitle
            title="The LP Equation"
            subtitle="CREATOR REDEMPTION VALUE"
            color={COLORS.purple}
          />

          {/* Equation visualization */}
          <div
            style={{
              padding: '50px 80px',
              background: 'rgba(15, 23, 42, 0.9)',
              borderRadius: 28,
              border: '2px solid rgba(192, 132, 252, 0.3)',
              opacity: interpolate(equationProgress, [0, 1], [0, 1]),
              transform: `scale(${interpolate(equationProgress, [0, 1], [0.95, 1])})`,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontFamily: FONTS.mono,
                fontWeight: 700,
                color: COLORS.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              <span style={{ color: COLORS.text.secondary }}>Redemption</span>
              <span>=</span>
              {components.map((comp, i) => {
                const progress = spring({ frame, fps, config: { damping: 12 }, delay: comp.delay });
                return (
                  <>
                    <span
                      key={comp.label}
                      style={{
                        color: comp.color,
                        opacity: interpolate(progress, [0, 1], [0, 1]),
                        transform: `translateY(${interpolate(progress, [0, 1], [10, 0])}px)`,
                      }}
                    >
                      {comp.label}
                    </span>
                    {i < components.length - 1 && <span style={{ color: COLORS.text.muted }}>+</span>}
                  </>
                );
              })}
            </div>
          </div>

          {/* Fee Distribution */}
          <div style={{ display: 'flex', gap: 50, marginTop: 30 }}>
            <FeeBox value="50%" label="Depth (b)" color={COLORS.cyan[400]} delay={75} />
            <FeeBox value="30%" label="LP Yield" color={COLORS.purple} delay={85} />
            <FeeBox value="20%" label="Protocol" color={COLORS.magenta[400]} delay={95} />
          </div>

          {/* Graduation threshold */}
          <div
            style={{
              marginTop: 30,
              padding: '24px 50px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 50,
              fontSize: 26,
              fontFamily: FONTS.mono,
              color: COLORS.success,
              opacity: interpolate(spring({ frame, fps, config: { damping: 12 }, delay: 110 }), [0, 1], [0, 1]),
            }}
          >
            <Icon icon={Check} size={28} color={COLORS.success} /> Graduation when Fees = 2x Deposit
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const FeeBox = ({ value, label, color, delay }: { value: string; label: string; color: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 12 }, delay });

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '32px 50px',
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        borderRadius: 20,
        border: `2px solid ${color}30`,
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
      }}
    >
      <div style={{ fontSize: 52, fontFamily: FONTS.mono, fontWeight: 700, color, marginBottom: 10 }}>
        {value}
      </div>
      <div style={{ fontSize: 18, fontFamily: FONTS.heading, color: COLORS.text.muted, textTransform: 'uppercase', letterSpacing: 2 }}>
        {label}
      </div>
    </div>
  );
};

// ============================================================================
// Scene 7: Survival Creates Alignment (480-540s)
// ============================================================================
const SceneAlignment = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const points = [
    { text: 'Creators risk capital → only quality markets survive', delay: 15 },
    { text: 'Traders become LPs → long-term stake in success', delay: 30 },
    { text: 'Arbitrageurs maintain efficiency → better prices for all', delay: 45 },
  ];

  const conclusionProgress = spring({ frame, fps, config: { damping: 15 }, delay: 70 });

  return (
    <AbsoluteFill>
      <GradientBackground variant="success" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 80 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          <SectionTitle
            title="Survival = Alignment"
            subtitle="NO GATEKEEPERS NEEDED"
            color={COLORS.success}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1100 }}>
            {points.map((point, i) => {
              const progress = spring({ frame, fps, config: { damping: 12 }, delay: point.delay });
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    padding: '32px 50px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '2px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 20,
                    opacity: interpolate(progress, [0, 1], [0, 1]),
                    transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
                  }}
                >
                  <Icon icon={Check} size={36} color={COLORS.success} />
                  <span style={{ fontSize: 30, fontFamily: FONTS.heading, color: COLORS.text.primary }}>
                    {point.text}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 40,
              padding: '40px 70px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 182, 212, 0.1))',
              border: '3px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 28,
              opacity: interpolate(conclusionProgress, [0, 1], [0, 1]),
              transform: `scale(${interpolate(conclusionProgress, [0, 1], [0.95, 1])})`,
            }}
          >
            <div style={{ fontSize: 40, fontFamily: FONTS.heading, fontWeight: 700, color: COLORS.text.primary, textAlign: 'center' }}>
              Truth emerges from the <span style={{ color: COLORS.success }}>market itself</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 8: Closing (540-600s)
// ============================================================================
const SceneClosing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textProgress = spring({ frame, fps, config: { damping: 15 }, delay: 10 });
  const urlProgress = spring({ frame, fps, config: { damping: 12 }, delay: 30 });
  const taglineProgress = spring({ frame, fps, config: { damping: 15 }, delay: 50 });

  const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <AnimatedLogo scale={1.5} delay={0} />

          <div
            style={{
              fontSize: 120,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.text.primary,
              letterSpacing: 20,
              opacity: interpolate(textProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(textProgress, [0, 1], [30, 0])}px)`,
              textShadow: `0 0 100px rgba(6, 182, 212, 0.5)`,
            }}
          >
            SOOTH
          </div>

          <div
            style={{
              padding: '24px 80px',
              background: `linear-gradient(135deg, ${COLORS.cyan[500]}, ${COLORS.cyan[600]})`,
              borderRadius: 20,
              fontSize: 42,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              color: '#020617',
              opacity: interpolate(urlProgress, [0, 1], [0, 1]),
              transform: `scale(${interpolate(urlProgress, [0, 1], [0.9, 1])})`,
              boxShadow: `0 0 ${80 * pulse}px rgba(6, 182, 212, ${0.5 * pulse})`,
            }}
          >
            sooth.market
          </div>

          <div
            style={{
              fontSize: 28,
              fontFamily: FONTS.mono,
              color: COLORS.text.muted,
              letterSpacing: 4,
              opacity: interpolate(taglineProgress, [0, 1], [0, 1]),
            }}
          >
            Gaming Design for Resilience
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Main Composition
// ============================================================================
export const SpeechVideo = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.background }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.title.duration}>
          <SceneTitle />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.problemGood.duration}>
          <SceneProblemGood />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.resilience.duration}>
          <SceneResilience />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.actors.duration}>
          <SceneActors />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.creatorDeep.duration}>
          <SceneCreatorDeep />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.lpMechanics.duration}>
          <SceneLPMechanics />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.alignment.duration}>
          <SceneAlignment />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 30 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.closing.duration}>
          <SceneClosing />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
