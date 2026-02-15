import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import {
  Landmark,
  UserX,
  HeartCrack,
  Ban,
  Link,
  Globe,
  Lock,
  BarChart3,
  Sparkles,
  Zap,
  Link2,
  Hourglass,
  Timer,
  Shield,
  AlertTriangle,
  Banknote,
  Wrench,
  Coins,
  TrendingUp,
  Wallet,
  Check,
  X,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

import { COLORS, FONTS } from './brand';

// Icon wrapper for consistent sizing
const Icon = ({ icon: IconComponent, size = 24, color }: { icon: LucideIcon; size?: number; color?: string }) => (
  <IconComponent size={size} color={color} strokeWidth={2} />
);

// 90 seconds at 30fps = 2700 frames
const FPS = 30;
const SCENES = {
  problem: { duration: 7 * FPS },           // 0-7s: The problem
  logoReveal: { duration: 5 * FPS },        // 7-12s: Logo reveal
  valueProp: { duration: 6 * FPS },         // 12-18s: Value proposition
  launchpad: { duration: 11 * FPS },        // 18-29s: Pillar 1 - Launchpad
  traderRewards: { duration: 8 * FPS },     // 29-37s: Trader LP Rewards (NEW)
  dualVenue: { duration: 12 * FPS },        // 37-49s: Pillar 2 - Dual Venue
  zkSettlement: { duration: 9 * FPS },      // 49-58s: Pillar 3 - ZK Settlement
  trialPeriod: { duration: 8 * FPS },       // 58-66s: Trial Period (NEW)
  lpEconomics: { duration: 8 * FPS },       // 66-74s: LP Economics
  marketShowcase: { duration: 8 * FPS },    // 74-82s: Market showcase
  cta: { duration: 8 * FPS },               // 82-90s: CTA
};

// ============================================================================
// Shared Components
// ============================================================================

const GradientBackground = ({ variant = 'default' }: { variant?: 'default' | 'problem' | 'success' | 'reward' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const gradientX = interpolate(frame, [0, durationInFrames], [20, 80]);
  const gradientY = interpolate(frame, [0, durationInFrames], [30, 70]);
  const pulse = Math.sin(frame * 0.02) * 0.15 + 0.85;

  const colors = {
    default: { primary: 'rgba(6, 182, 212, 0.15)', secondary: 'rgba(192, 132, 252, 0.08)' },
    problem: { primary: 'rgba(244, 63, 94, 0.12)', secondary: 'rgba(251, 146, 60, 0.08)' },
    success: { primary: 'rgba(16, 185, 129, 0.15)', secondary: 'rgba(6, 182, 212, 0.1)' },
    reward: { primary: 'rgba(251, 191, 36, 0.15)', secondary: 'rgba(16, 185, 129, 0.1)' },
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
            linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2, 6, 23, 0.6) 100%)',
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
  const floatY = Math.sin(frame * 0.04) * 4;

  return (
    <div
      style={{
        transform: `scale(${logoScale * scale}) translateY(${floatY}px)`,
        opacity,
        filter: `drop-shadow(0 0 40px rgba(6, 182, 212, 0.5))`,
      }}
    >
      <Img src={staticFile('sooth-logo.svg')} style={{ width: 220, height: 220 }} />
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
  const subtitleProgress = spring({ frame, fps, config: { damping: 15 }, delay: delay + 15 });

  return (
    <div style={{ textAlign: 'center', marginBottom: 45 }}>
      <div
        style={{
          fontSize: 76,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color: COLORS.text.primary,
          opacity: interpolate(titleProgress, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(titleProgress, [0, 1], [30, 0])}px)`,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 30,
            fontFamily: FONTS.mono,
            color,
            marginTop: 16,
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

const FeatureCard = ({
  icon,
  title,
  description,
  delay,
  color = COLORS.cyan[400],
  width = 300,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
  color?: string;
  width?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 15 }, delay });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [40, 0]);
  const scale = interpolate(progress, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        width,
        padding: 36,
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 24,
        border: `1px solid ${color}40`,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px ${color}15`,
      }}
    >
      <div style={{ marginBottom: 16 }}><Icon icon={icon} size={56} color={color} /></div>
      <div
        style={{
          fontSize: 28,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color: COLORS.text.primary,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 19,
          fontFamily: FONTS.heading,
          color: COLORS.text.muted,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
};

const StatCard = ({
  value,
  label,
  delay,
  color = COLORS.cyan[400],
}: {
  value: string;
  label: string;
  delay: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 12 }, delay });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.8, 1]);

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '32px 56px',
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        borderRadius: 20,
        border: `2px solid ${color}30`,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: 60,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          color,
          marginBottom: 10,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 20,
          fontFamily: FONTS.heading,
          color: COLORS.text.muted,
          textTransform: 'uppercase',
          letterSpacing: 3,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ============================================================================
// Scene 1: The Problem (0-7s)
// ============================================================================
const SceneProblem = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 15 }, delay: 10 });

  // Problems from whitepaper Section 1.1
  const problems = [
    { text: 'Centralized Custody', icon: Landmark, delay: 40 },
    { text: 'Single Oracle Trust', icon: UserX, delay: 65 },
    { text: 'Illiquid Markets', icon: HeartCrack, delay: 90 },
    { text: 'Gatekept Creation', icon: Ban, delay: 115 },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
          <div
            style={{
              fontSize: 100,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.text.primary,
              opacity: interpolate(titleProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(titleProgress, [0, 1], [40, 0])}px)`,
              textAlign: 'center',
              lineHeight: 1.1,
            }}
          >
            Prediction Markets<br/>
            <span style={{ color: COLORS.cyan[400] }}>Can Be Better</span>
          </div>

          <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            {problems.map((problem, i) => {
              const progress = spring({ frame, fps, config: { damping: 12 }, delay: problem.delay });
              const opacity = interpolate(progress, [0, 1], [0, 1]);
              const y = interpolate(progress, [0, 1], [20, 0]);

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '20px 36px',
                    background: 'rgba(100, 116, 139, 0.15)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: 16,
                    opacity,
                    transform: `translateY(${y}px)`,
                  }}
                >
                  <Icon icon={problem.icon} size={30} color={COLORS.text.muted} />
                  <span
                    style={{
                      fontSize: 26,
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
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 2: Logo Reveal (7-12s)
// ============================================================================
const SceneLogoReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textProgress = spring({ frame, fps, config: { damping: 15 }, delay: 25 });
  const subtitleProgress = spring({ frame, fps, config: { damping: 15 }, delay: 50 });

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <AnimatedLogo scale={1.5} delay={5} />

          <div
            style={{
              fontSize: 140,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.text.primary,
              letterSpacing: 24,
              opacity: interpolate(textProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(textProgress, [0, 1], [40, 0])}px)`,
              textShadow: `0 0 100px rgba(6, 182, 212, 0.6)`,
            }}
          >
            SOOTH
          </div>

          {/* Whitepaper tagline */}
          <div
            style={{
              fontSize: 38,
              fontFamily: FONTS.mono,
              color: COLORS.cyan[400],
              opacity: interpolate(subtitleProgress, [0, 1], [0, 1]),
              letterSpacing: 6,
            }}
          >
            Trade smarter. Predict better. Discover what matters.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 3: Value Proposition (12-18s)
// ============================================================================
const SceneValueProp = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 15 }, delay: 10 });

  // From whitepaper Executive Summary
  const features = [
    { icon: Link, text: 'Fully On-Chain', delay: 40 },
    { icon: Globe, text: 'Permissionless', delay: 55 },
    { icon: Lock, text: 'ZK Settlement', delay: 70 },
    { icon: BarChart3, text: 'AMM + Orderbook', delay: 85 },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60 }}>
          <div
            style={{
              fontSize: 64,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.text.primary,
              textAlign: 'center',
              maxWidth: 1400,
              lineHeight: 1.2,
              opacity: interpolate(titleProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(titleProgress, [0, 1], [30, 0])}px)`,
            }}
          >
            The First <span style={{ color: COLORS.cyan[400] }}>Fully On-Chain</span><br/>
            Prediction Market Infrastructure
          </div>

          <div style={{ display: 'flex', gap: 28, justifyContent: 'center' }}>
            {features.map((feature, i) => {
              const progress = spring({ frame, fps, config: { damping: 12 }, delay: feature.delay });
              const opacity = interpolate(progress, [0, 1], [0, 1]);
              const scale = interpolate(progress, [0, 1], [0.8, 1]);

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '20px 40px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: 50,
                    opacity,
                    transform: `scale(${scale})`,
                  }}
                >
                  <Icon icon={feature.icon} size={28} color={COLORS.cyan[400]} />
                  <span
                    style={{
                      fontSize: 24,
                      fontFamily: FONTS.heading,
                      fontWeight: 600,
                      color: COLORS.text.primary,
                    }}
                  >
                    {feature.text}
                  </span>
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
// Scene 4: Launchpad (18-29s)
// ============================================================================
const SceneLaunchpad = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animated bonding progress (fees → graduation)
  const curveProgress = interpolate(frame, [50, 180], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Graduation: fees >= deposit × 2 (from whitepaper Appendix A)
  const thresholdY = 120;
  const currentY = interpolate(curveProgress, [0, 1], [280, 80]);
  const isGraduated = currentY <= thresholdY;

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'center' }}>
          {/* Left: Text */}
          <div style={{ flex: 1, maxWidth: 620 }}>
            <SectionTitle
              title="Launchpad"
              subtitle="PERMISSIONLESS CREATION"
              color={COLORS.magenta[400]}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <FeatureStep icon="1" text="Anyone creates a market" delay={25} />
              <FeatureStep icon="2" text="5% fees bootstrap liquidity" delay={50} />
              <FeatureStep icon="3" text="Graduates at 2x deposit in fees" delay={75} />
            </div>

            {/* Creator economics from Section 3.3 */}
            <div
              style={{
                marginTop: 40,
                padding: '20px 28px',
                background: 'rgba(232, 121, 249, 0.1)',
                border: '1px solid rgba(232, 121, 249, 0.3)',
                borderRadius: 16,
                fontSize: 22,
                fontFamily: FONTS.mono,
                color: COLORS.magenta[400],
                opacity: interpolate(spring({ frame, fps, config: { damping: 12 }, delay: 120 }), [0, 1], [0, 1]),
              }}
            >
              Creators earn from market success
            </div>
          </div>

          {/* Right: Graduation visualization */}
          <div
            style={{
              width: 500,
              height: 400,
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: 28,
              border: '1px solid rgba(232, 121, 249, 0.3)',
              padding: 36,
              position: 'relative',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
              opacity: interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 35 }), [0, 1], [0, 1]),
            }}
          >
            <div style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.text.muted, marginBottom: 16 }}>
              GRADUATION PROGRESS
            </div>

            <svg width="420" height="280" style={{ overflow: 'visible' }}>
              {/* Graduation threshold */}
              <line
                x1="0"
                y1={thresholdY + 40}
                x2="420"
                y2={thresholdY + 40}
                stroke={isGraduated ? '#10b981' : COLORS.magenta[400]}
                strokeWidth="3"
                strokeDasharray="10,5"
              />
              <text x="430" y={thresholdY + 46} fill={COLORS.text.muted} fontSize="16" fontFamily={FONTS.mono}>
                2x Deposit
              </text>

              {/* Progress curve */}
              <path
                d={`M 0 340 Q ${210 * curveProgress} ${340 - 240 * curveProgress} ${420 * curveProgress} ${currentY + 40}`}
                fill="none"
                stroke={isGraduated ? '#10b981' : COLORS.magenta[400]}
                strokeWidth="4"
              />

              <circle
                cx={420 * curveProgress}
                cy={currentY + 40}
                r="12"
                fill={isGraduated ? '#10b981' : COLORS.magenta[400]}
              />
              <circle
                cx={420 * curveProgress}
                cy={currentY + 40}
                r="24"
                fill={isGraduated ? 'rgba(16, 185, 129, 0.3)' : 'rgba(232, 121, 249, 0.3)'}
              />
            </svg>

            {isGraduated && (
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  padding: '10px 20px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  borderRadius: 12,
                  fontSize: 18,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                GRADUATED <Icon icon={Check} size={20} color="#10b981" />
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const FeatureStep = ({ icon, text, delay }: { icon: string; text: string; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 12 }, delay });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const x = interpolate(progress, [0, 1], [-20, 0]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(232, 121, 249, 0.2)',
          border: '2px solid rgba(232, 121, 249, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontFamily: FONTS.mono,
          fontWeight: 700,
          color: COLORS.magenta[400],
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 26,
          fontFamily: FONTS.heading,
          color: COLORS.text.primary,
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ============================================================================
// Scene 5: Trader LP Rewards (29-37s) - NEW from Section 3.4
// ============================================================================
const SceneTraderRewards = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animated flow visualization
  const flowProgress = interpolate(frame, [40, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <GradientBackground variant="reward" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <SectionTitle
            title="Traders Become Stakeholders"
            subtitle="FEES → LP TOKENS"
            color="#fbbf24"
          />

          {/* Flow diagram from Section 3.4 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              padding: '40px 60px',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: 28,
              border: '1px solid rgba(251, 191, 36, 0.3)',
              opacity: interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 30 }), [0, 1], [0, 1]),
            }}
          >
            <FlowBox text="Trade $100" subtext="Pay 5% fee" delay={40} color="#fbbf24" />
            <FlowArrow progress={flowProgress} />
            <FlowBox text="$5 Fee" subtext="Adds to depth" delay={70} color={COLORS.cyan[400]} />
            <FlowArrow progress={flowProgress} />
            <FlowBox text="$5 LP Tokens" subtext="Minted to YOU" delay={100} color="#10b981" />
          </div>

          {/* Comparison table from Section 3.4 */}
          <div style={{ display: 'flex', gap: 40 }}>
            <ComparisonCard
              title="Traditional"
              items={[
                { text: 'Win: +Payout', positive: true },
                { text: 'Lose: -Stake', positive: false },
                { text: 'Market viral: Nothing', positive: false },
              ]}
              delay={130}
              accent="#64748b"
            />
            <ComparisonCard
              title="Sooth"
              items={[
                { text: 'Win: +Payout + LP tokens', positive: true },
                { text: 'Lose: -Stake + LP recovery', positive: true },
                { text: 'Market viral: LP appreciates', positive: true },
              ]}
              delay={150}
              accent="#fbbf24"
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const FlowBox = ({ text, subtext, delay, color }: { text: string; subtext: string; delay: number; color: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 12 }, delay });

  return (
    <div
      style={{
        padding: '24px 36px',
        background: `${color}15`,
        border: `2px solid ${color}40`,
        borderRadius: 16,
        textAlign: 'center',
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
      }}
    >
      <div style={{ fontSize: 28, fontFamily: FONTS.mono, fontWeight: 700, color }}>{text}</div>
      <div style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.text.muted, marginTop: 6 }}>{subtext}</div>
    </div>
  );
};

const FlowArrow = ({ progress }: { progress: number }) => (
  <div
    style={{
      opacity: progress,
    }}
  >
    <Icon icon={ArrowRight} size={40} color={COLORS.text.muted} />
  </div>
);

const ComparisonCard = ({
  title,
  items,
  delay,
  accent,
}: {
  title: string;
  items: { text: string; positive: boolean }[];
  delay: number;
  accent: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 12 }, delay });

  return (
    <div
      style={{
        width: 440,
        padding: 36,
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 20,
        border: `2px solid ${accent}40`,
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color: accent,
          marginBottom: 24,
          textTransform: 'uppercase',
          letterSpacing: 3,
        }}
      >
        {title}
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            fontSize: 21,
            fontFamily: FONTS.mono,
            color: item.positive ? '#10b981' : COLORS.text.muted,
          }}
        >
          <Icon icon={item.positive ? Check : X} size={24} color={item.positive ? '#10b981' : COLORS.text.muted} />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Scene 6: Dual Venue Trading (37-49s)
// ============================================================================
const SceneDualVenue = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const prob = interpolate(frame, [50, 160], [52, 67], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 30 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          <SectionTitle
            title="Dual Venue Trading"
            subtitle="BEST PRICE, ALWAYS"
          />

          <div style={{ display: 'flex', gap: 60, alignItems: 'stretch' }}>
            {/* AMM Card */}
            <div
              style={{
                width: 500,
                background: 'rgba(15, 23, 42, 0.9)',
                borderRadius: 28,
                border: '2px solid rgba(6, 182, 212, 0.3)',
                padding: 36,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(6, 182, 212, 0.1)',
                opacity: interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 25 }), [0, 1], [0, 1]),
                transform: `translateX(${interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 25 }), [0, 1], [-40, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.cyan[400], marginBottom: 10, letterSpacing: 3 }}>
                LMSR AMM · RETAIL
              </div>
              <div style={{ fontSize: 26, fontFamily: FONTS.heading, fontWeight: 600, color: COLORS.text.primary, marginBottom: 28 }}>
                Lakers win 2026 Championship?
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.text.muted }}>Probability</span>
                  <span style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.cyan[400] }}>{Math.round(prob)}%</span>
                </div>
                <div style={{ height: 12, background: 'rgba(30, 41, 59, 0.8)', borderRadius: 6 }}>
                  <div style={{ width: `${prob}%`, height: '100%', background: `linear-gradient(90deg, ${COLORS.cyan[500]}, ${COLORS.cyan[400]})`, borderRadius: 6 }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, padding: '20px 28px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))', border: '2px solid rgba(16, 185, 129, 0.5)', borderRadius: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontFamily: FONTS.mono, color: COLORS.text.muted, marginBottom: 6 }}>YES</div>
                  <div style={{ fontSize: 36, fontFamily: FONTS.mono, fontWeight: 700, color: '#10b981' }}>{Math.round(prob)}c</div>
                </div>
                <div style={{ flex: 1, padding: '20px 28px', background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.3), rgba(244, 63, 94, 0.1))', border: '2px solid rgba(244, 63, 94, 0.5)', borderRadius: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontFamily: FONTS.mono, color: COLORS.text.muted, marginBottom: 6 }}>NO</div>
                  <div style={{ fontSize: 36, fontFamily: FONTS.mono, fontWeight: 700, color: '#f43f5e' }}>{100 - Math.round(prob)}c</div>
                </div>
              </div>

              <div style={{ marginTop: 24, fontSize: 18, fontFamily: FONTS.heading, color: COLORS.text.muted, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Icon icon={Sparkles} size={20} color={COLORS.text.muted} /> Always-on liquidity · One-click trading
              </div>
            </div>

            {/* SoothBook Card */}
            <div
              style={{
                width: 440,
                background: 'rgba(15, 23, 42, 0.9)',
                borderRadius: 28,
                border: '2px solid rgba(232, 121, 249, 0.3)',
                padding: 36,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(232, 121, 249, 0.1)',
                opacity: interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 50 }), [0, 1], [0, 1]),
                transform: `translateX(${interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 50 }), [0, 1], [40, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.magenta[400], marginBottom: 24, letterSpacing: 3 }}>
                SOOTHBOOK · PRO
              </div>

              {[{ price: 71, size: 1200 }, { price: 69, size: 2500 }, { price: 68, size: 1800 }].map((row, i) => (
                <div key={`ask-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontFamily: FONTS.mono, fontSize: 22 }}>
                  <span style={{ color: '#f43f5e' }}>{row.price}c</span>
                  <span style={{ color: COLORS.text.muted }}>{row.size.toLocaleString()}</span>
                </div>
              ))}

              <div style={{ padding: '14px 0', borderTop: '2px solid rgba(100, 116, 139, 0.3)', borderBottom: '2px solid rgba(100, 116, 139, 0.3)', margin: '10px 0', textAlign: 'center', fontFamily: FONTS.mono, fontSize: 18, color: COLORS.text.muted }}>
                Spread: 1c
              </div>

              {[{ price: 67, size: 3100 }, { price: 66, size: 2200 }, { price: 65, size: 1500 }].map((row, i) => (
                <div key={`bid-${i}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontFamily: FONTS.mono, fontSize: 22 }}>
                  <span style={{ color: '#10b981' }}>{row.price}c</span>
                  <span style={{ color: COLORS.text.muted }}>{row.size.toLocaleString()}</span>
                </div>
              ))}

              <div style={{ marginTop: 20, fontSize: 18, fontFamily: FONTS.heading, color: COLORS.text.muted, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Icon icon={BarChart3} size={20} color={COLORS.text.muted} /> Limit orders · Zero slippage
              </div>
            </div>
          </div>

          {/* Arbitrage note from Section 4.3 - CORRECTED */}
          <div
            style={{
              padding: '20px 50px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(232, 121, 249, 0.15))',
              border: '2px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 50,
              fontSize: 24,
              fontFamily: FONTS.heading,
              fontWeight: 600,
              color: COLORS.text.primary,
              opacity: interpolate(spring({ frame, fps, config: { damping: 12 }, delay: 100 }), [0, 1], [0, 1]),
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon icon={Zap} size={28} color={COLORS.cyan[400]} /> Cross-venue arbitrage keeps prices tight
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 7: ZK Settlement (49-58s)
// ============================================================================
const SceneZKSettlement = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Multi-class adjudicators from Section 5.2
  const adjudicators = [
    { name: 'ZK Validated', desc: 'Objective facts', icon: Lock, delay: 50 },
    { name: 'Oracle+ZK', desc: 'Chainlink + proof', icon: Link2, delay: 70 },
    { name: 'Optimistic', desc: 'Challenge period', icon: Hourglass, delay: 90 },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground variant="success" />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 45 }}>
          <SectionTitle
            title="ZK-Secured Settlement"
            subtitle="TRUSTLESS RESOLUTION"
            color="#10b981"
          />

          <div style={{ display: 'flex', gap: 40 }}>
            <FeatureCard
              icon={Lock}
              title="Zero-Knowledge Proofs"
              description="Cryptographic verification ensures honest resolution via ERC-8004 attestation."
              delay={25}
              color="#10b981"
              width={480}
            />
            <FeatureCard
              icon={Timer}
              title="T* Mechanism"
              description="Reports WHEN events occurred. Post-T* trades refunded, protecting LPs from latency attacks."
              delay={50}
              color="#10b981"
              width={480}
            />
            <FeatureCard
              icon={Shield}
              title="Veto Window"
              description="Guardian can challenge suspicious resolutions before finalization."
              delay={75}
              color="#10b981"
              width={480}
            />
          </div>

          {/* Multi-class adjudicators from Section 5.2 */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <span style={{ fontSize: 20, fontFamily: FONTS.mono, color: COLORS.text.muted }}>
              Adjudicator classes:
            </span>
            {adjudicators.map((adj, i) => {
              const progress = spring({ frame, fps, config: { damping: 12 }, delay: adj.delay });
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 24px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '2px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 12,
                    opacity: interpolate(progress, [0, 1], [0, 1]),
                  }}
                >
                  <Icon icon={adj.icon} size={24} color="#10b981" />
                  <span style={{ fontSize: 20, fontFamily: FONTS.mono, color: COLORS.text.primary }}>{adj.name}</span>
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
// Scene 8: Trial Period (58-66s) - NEW from Section 6
// ============================================================================
const SceneTrialPeriod = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <SectionTitle
            title="7-Day Trial Period"
            subtitle="TRADER PROTECTION"
            color={COLORS.cyan[400]}
          />

          {/* Flow from Section 6.3 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 32,
              padding: '32px 60px',
              background: 'rgba(15, 23, 42, 0.8)',
              borderRadius: 24,
              border: '1px solid rgba(6, 182, 212, 0.3)',
              opacity: interpolate(spring({ frame, fps, config: { damping: 15 }, delay: 25 }), [0, 1], [0, 1]),
            }}
          >
            <TrialStep text="CREATE" active delay={30} />
            <Icon icon={ArrowRight} size={36} color={COLORS.text.muted} />
            <TrialStep text="TRIAL" subtext="7 days" highlight delay={50} />
            <Icon icon={ArrowRight} size={36} color={COLORS.text.muted} />
            <TrialStep text="LIVE" active delay={70} />
          </div>

          {/* Benefits from Section 6.2 - CORRECTED */}
          <div style={{ display: 'flex', gap: 36 }}>
            <FeatureCard
              icon={AlertTriangle}
              title="Creator Dismisses"
              description="If question is ambiguous or market manipulated, creator can abort."
              delay={90}
              color={COLORS.cyan[400]}
              width={480}
            />
            <FeatureCard
              icon={Banknote}
              title="Full Refunds"
              description="Traders receive 100% refund of locked costs. No penalty for early exit."
              delay={110}
              color={COLORS.cyan[400]}
              width={480}
            />
            <FeatureCard
              icon={Wrench}
              title="Technical Issues"
              description="Clean exit for everyone if something goes wrong during trial."
              delay={130}
              color={COLORS.cyan[400]}
              width={480}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TrialStep = ({ text, subtext, active, highlight, delay }: { text: string; subtext?: string; active?: boolean; highlight?: boolean; delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 12 }, delay });

  const bg = highlight ? 'rgba(6, 182, 212, 0.2)' : active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)';
  const border = highlight ? 'rgba(6, 182, 212, 0.5)' : active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)';
  const textColor = highlight ? COLORS.cyan[400] : active ? '#10b981' : COLORS.text.muted;

  return (
    <div
      style={{
        padding: '22px 40px',
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 16,
        textAlign: 'center',
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
      }}
    >
      <div style={{ fontSize: 24, fontFamily: FONTS.mono, fontWeight: 700, color: textColor }}>{text}</div>
      {subtext && <div style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.text.muted, marginTop: 6 }}>{subtext}</div>}
    </div>
  );
};

// ============================================================================
// Scene 9: LP Economics (66-74s)
// ============================================================================
const SceneLPEconomics = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
          <SectionTitle
            title="LP Token Economics"
            subtitle="ERC-20 TRANSFERABLE"
            color={COLORS.purple}
          />

          <div style={{ display: 'flex', gap: 36 }}>
            <FeatureCard
              icon={Coins}
              title="Tradeable Positions"
              description="Your LP position is an ERC-20 token. Transfer, sell, or use as collateral."
              delay={25}
              color={COLORS.purple}
              width={480}
            />
            <FeatureCard
              icon={TrendingUp}
              title="Floor Valuation"
              description="Floor = Cash - max(qYes, qNo). Guaranteed minimum redemption value."
              delay={50}
              color={COLORS.purple}
              width={480}
            />
            <FeatureCard
              icon={Wallet}
              title="Revenue Streams"
              description="Earn from swap fees, trading volume, and market resolution."
              delay={75}
              color={COLORS.purple}
              width={480}
            />
          </div>

          {/* Fee distribution from Section 7.3 */}
          <div
            style={{
              display: 'flex',
              gap: 36,
              padding: '28px 60px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 20,
              opacity: interpolate(spring({ frame, fps, config: { damping: 12 }, delay: 110 }), [0, 1], [0, 1]),
            }}
          >
            <StatCard value="50%" label="LP Depth" delay={120} color={COLORS.purple} />
            <StatCard value="30%" label="LP Yield" delay={135} color={COLORS.purple} />
            <StatCard value="20%" label="Protocol" delay={150} color={COLORS.purple} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Scene 10: Market Showcase (74-82s)
// ============================================================================
const SceneMarketShowcase = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sample markets matching actual markets from codebase
  const markets = [
    { question: 'UN confirms extraterrestrial contact', prob: 12, volume: '2.4M', trend: '+5%' },
    { question: 'BTC reaches new ATH in 2026', prob: 67, volume: '8.1M', trend: '+12%' },
    { question: 'Lakers win 2026 NBA Championship', prob: 34, volume: '1.8M', trend: '-3%' },
    { question: 'ETH surpasses $5,000', prob: 45, volume: '5.2M', trend: '+8%' },
  ];

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 45 }}>
          <SectionTitle
            title="Trade on Anything"
            subtitle="PERMISSIONLESS MARKETS"
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28 }}>
            {markets.map((market, i) => {
              const progress = spring({ frame, fps, config: { damping: 15 }, delay: 25 + i * 15 });
              const animatedProb = interpolate(
                frame,
                [40 + i * 8, 140 + i * 8],
                [market.prob - 8, market.prob],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );

              return (
                <div
                  key={i}
                  style={{
                    width: 520,
                    padding: 28,
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: 20,
                    border: '2px solid rgba(6, 182, 212, 0.2)',
                    opacity: interpolate(progress, [0, 1], [0, 1]),
                    transform: `translateY(${interpolate(progress, [0, 1], [25, 0])}px)`,
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div style={{ fontSize: 22, fontFamily: FONTS.heading, fontWeight: 600, color: COLORS.text.primary, marginBottom: 18, lineHeight: 1.3 }}>
                    {market.question}
                  </div>

                  <div style={{ height: 10, background: 'rgba(30, 41, 59, 0.8)', borderRadius: 5, marginBottom: 16 }}>
                    <div
                      style={{
                        width: `${animatedProb}%`,
                        height: '100%',
                        background: animatedProb > 50 ? `linear-gradient(90deg, #10b981, #34d399)` : `linear-gradient(90deg, #f43f5e, #fb7185)`,
                        borderRadius: 5,
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontSize: 28, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.cyan[400] }}>
                        {Math.round(animatedProb)}%
                      </span>
                      <span style={{ fontSize: 18, fontFamily: FONTS.mono, color: market.trend.startsWith('+') ? '#10b981' : '#f43f5e', alignSelf: 'center' }}>
                        {market.trend}
                      </span>
                    </div>
                    <div style={{ fontSize: 18, fontFamily: FONTS.mono, color: COLORS.text.muted }}>
                      Vol: ${market.volume}
                    </div>
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
// Scene 11: CTA (82-90s)
// ============================================================================
const SceneCTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textProgress = spring({ frame, fps, config: { damping: 15 }, delay: 15 });
  const buttonProgress = spring({ frame, fps, config: { damping: 12 }, delay: 45 });
  const taglineProgress = spring({ frame, fps, config: { damping: 15 }, delay: 75 });
  const statsProgress = spring({ frame, fps, config: { damping: 12 }, delay: 105 });

  const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;

  return (
    <AbsoluteFill>
      <GradientBackground />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          <AnimatedLogo scale={1.4} delay={0} />

          <div
            style={{
              fontSize: 88,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.text.primary,
              textAlign: 'center',
              maxWidth: 1200,
              lineHeight: 1.1,
              opacity: interpolate(textProgress, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(textProgress, [0, 1], [30, 0])}px)`,
            }}
          >
            The Future of<br/>
            <span style={{ color: COLORS.cyan[400] }}>Prediction Markets</span>
          </div>

          <div
            style={{
              padding: '28px 100px',
              background: `linear-gradient(135deg, ${COLORS.cyan[500]}, ${COLORS.cyan[600]})`,
              borderRadius: 24,
              fontSize: 56,
              fontFamily: FONTS.mono,
              fontWeight: 700,
              color: '#020617',
              opacity: interpolate(buttonProgress, [0, 1], [0, 1]),
              transform: `scale(${interpolate(buttonProgress, [0, 1], [0.9, 1])})`,
              boxShadow: `0 0 ${100 * pulse}px rgba(6, 182, 212, ${0.5 * pulse})`,
            }}
          >
            sooth.market
          </div>

          <div
            style={{
              fontSize: 36,
              fontFamily: FONTS.mono,
              color: COLORS.text.muted,
              letterSpacing: 6,
              textTransform: 'uppercase',
              opacity: interpolate(taglineProgress, [0, 1], [0, 1]),
            }}
          >
            Permissionless · On-Chain · ZK-Secured
          </div>

          <div
            style={{
              display: 'flex',
              gap: 90,
              marginTop: 30,
              opacity: interpolate(statsProgress, [0, 1], [0, 1]),
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.cyan[400] }}>100%</div>
              <div style={{ fontSize: 22, fontFamily: FONTS.mono, color: COLORS.text.muted }}>On-Chain</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.magenta[400] }}>2x</div>
              <div style={{ fontSize: 22, fontFamily: FONTS.mono, color: COLORS.text.muted }}>Graduation</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.purple }}>Unlimited</div>
              <div style={{ fontSize: 22, fontFamily: FONTS.mono, color: COLORS.text.muted }}>Markets</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// Main Composition
// ============================================================================
export const IntroVideo = () => {
  return (
    <AbsoluteFill>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.problem.duration}>
          <SceneProblem />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.logoReveal.duration}>
          <SceneLogoReveal />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.valueProp.duration}>
          <SceneValueProp />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.launchpad.duration}>
          <SceneLaunchpad />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.traderRewards.duration}>
          <SceneTraderRewards />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.dualVenue.duration}>
          <SceneDualVenue />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.zkSettlement.duration}>
          <SceneZKSettlement />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-left' })}
          timing={linearTiming({ durationInFrames: 18 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.trialPeriod.duration}>
          <SceneTrialPeriod />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.lpEconomics.duration}>
          <SceneLPEconomics />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.marketShowcase.duration}>
          <SceneMarketShowcase />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.cta.duration}>
          <SceneCTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export const INTRO_VIDEO_DURATION_SECONDS = 90;
