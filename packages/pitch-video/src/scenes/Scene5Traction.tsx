import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { AnimatedText, GlowText } from '../components/AnimatedText';
import { COLORS, FONTS } from '../brand';

const MetricCard = ({
  value,
  label,
  suffix,
  color,
  delay,
}: {
  value: string;
  label: string;
  suffix?: string;
  color: string;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 12 },
    delay,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.8, 1]);

  // Number counting animation
  const countProgress = interpolate(progress, [0.3, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 80,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color,
            textShadow: `0 0 40px ${color}60`,
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            style={{
              fontSize: 36,
              fontFamily: FONTS.heading,
              fontWeight: 600,
              color,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 20,
          fontFamily: FONTS.mono,
          color: COLORS.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
};

const ChainLogo = ({
  name,
  delay,
}: {
  name: string;
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
  const y = interpolate(progress, [0, 1], [20, 0]);

  return (
    <div
      style={{
        padding: '12px 32px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 12,
        border: '1px solid rgba(6, 182, 212, 0.3)',
        fontSize: 20,
        fontFamily: FONTS.mono,
        color: COLORS.text.primary,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {name}
    </div>
  );
};

export const Scene5Traction = () => {
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
          gap: 80,
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
          Built for Scale
        </AnimatedText>

        {/* Metrics row */}
        <div
          style={{
            display: 'flex',
            gap: 120,
          }}
        >
          <MetricCard
            value="V10"
            label="Protocol Version"
            color={COLORS.cyan[400]}
            delay={30}
          />
          <MetricCard
            value="92"
            suffix="+"
            label="Test Coverage"
            color={COLORS.magenta[400]}
            delay={60}
          />
          <MetricCard
            value="4"
            label="Chains Live"
            color={COLORS.purple}
            delay={90}
          />
        </div>

        {/* Chains */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <AnimatedText
            delay={120}
            fontSize={24}
            color={COLORS.text.secondary}
            fontFamily="mono"
          >
            Deployed on
          </AnimatedText>
          <div
            style={{
              display: 'flex',
              gap: 20,
            }}
          >
            <ChainLogo name="Base Sepolia" delay={140} />
            <ChainLogo name="Monad Testnet" delay={155} />
            <ChainLogo name="Arc Testnet" delay={170} />
            <ChainLogo name="MegaETH" delay={185} />
          </div>
        </div>

        {/* Additional context */}
        <AnimatedText
          delay={220}
          fontSize={28}
          color={COLORS.cyan[400]}
          fontFamily="mono"
        >
          Audited • Gas Optimized • Production Ready
        </AnimatedText>
      </div>
    </AbsoluteFill>
  );
};
