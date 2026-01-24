import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate, Sequence } from 'remotion';
import { AnimatedText, GlowText } from '../components/AnimatedText';
import { COLORS, FONTS } from '../brand';

const FeatureBlock = ({
  number,
  title,
  description,
  highlight,
  delay,
}: {
  number: string;
  title: string;
  description: string;
  highlight: string;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 15 },
    delay,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [30, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 32,
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 16,
        border: '1px solid rgba(6, 182, 212, 0.2)',
        width: 380,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontFamily: FONTS.mono,
          color: COLORS.cyan[400],
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontSize: 28,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color: COLORS.text.primary,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 16,
          fontFamily: FONTS.mono,
          color: COLORS.text.secondary,
          lineHeight: 1.6,
        }}
      >
        {description}
      </div>
      <div
        style={{
          fontSize: 18,
          fontFamily: FONTS.mono,
          color: COLORS.magenta[400],
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        {highlight}
      </div>
    </div>
  );
};

export const Scene4Features = () => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 60,
        }}
      >
        {/* Header */}
        <AnimatedText
          delay={0}
          fontSize={56}
          color={COLORS.text.primary}
          fontFamily="heading"
          fontWeight={700}
        >
          Why Sooth Wins
        </AnimatedText>

        {/* Feature grid - first row */}
        <div
          style={{
            display: 'flex',
            gap: 32,
          }}
        >
          <FeatureBlock
            number="01"
            title="LMSR Engine"
            description="Logarithmic Market Scoring Rule provides continuous liquidity with bounded loss for LPs"
            highlight="∞ Liquidity"
            delay={30}
          />
          <FeatureBlock
            number="02"
            title="Unified Crossing"
            description="Orders automatically cross between AMM and orderbook for best execution"
            highlight="Best Price Always"
            delay={50}
          />
          <FeatureBlock
            number="03"
            title="Bonding Curve"
            description="Markets bootstrap liquidity through a graduation mechanism before orderbook launch"
            highlight="Zero Cold Start"
            delay={70}
          />
        </div>

        {/* Feature grid - second row */}
        <div
          style={{
            display: 'flex',
            gap: 32,
          }}
        >
          <FeatureBlock
            number="04"
            title="LP Incentives"
            description="Liquidity providers earn fees from both AMM swaps and orderbook trading"
            highlight="Dual Revenue"
            delay={100}
          />
          <FeatureBlock
            number="05"
            title="Settlement Layer"
            description="Trustless resolution via oracle integration and dispute mechanisms"
            highlight="Truth Guaranteed"
            delay={120}
          />
          <FeatureBlock
            number="06"
            title="Gas Optimized"
            description="EIP-1153 transient storage and flash accounting for efficient batch operations"
            highlight="200x Cheaper"
            delay={140}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
