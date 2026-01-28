import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { AnimatedText, GlowText } from '../components/AnimatedText';
import { COLORS, FONTS } from '../brand';

const VenueCard = ({
  title,
  subtitle,
  features,
  color,
  delay,
}: {
  title: string;
  subtitle: string;
  features: string[];
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
  const y = interpolate(progress, [0, 1], [40, 0]);

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${COLORS.surface}, rgba(15, 23, 42, 0.95))`,
        border: `2px solid ${color}40`,
        borderRadius: 24,
        padding: 48,
        width: 500,
        opacity,
        transform: `scale(${scale}) translateY(${y}px)`,
        boxShadow: `0 0 60px ${color}20`,
      }}
    >
      <div
        style={{
          fontSize: 42,
          fontFamily: FONTS.heading,
          fontWeight: 700,
          color,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 18,
          fontFamily: FONTS.mono,
          color: COLORS.text.secondary,
          marginBottom: 32,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {features.map((feature, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 20,
              fontFamily: FONTS.mono,
              color: COLORS.text.primary,
            }}
          >
            <span style={{ color }}>▸</span>
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Scene3Solution = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Plus sign animation
  const plusProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 60,
  });

  const plusOpacity = interpolate(plusProgress, [0, 1], [0, 1]);
  const plusScale = interpolate(plusProgress, [0, 1], [0.5, 1]);

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
        <GlowText
          delay={0}
          fontSize={64}
          glowColor={COLORS.cyan[400]}
        >
          The Sooth Solution
        </GlowText>

        {/* Two venue cards */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 60,
          }}
        >
          <VenueCard
            title="AMM"
            subtitle="Instant Liquidity"
            features={[
              'LMSR market maker',
              'Always-on liquidity',
              'LP yield opportunities',
            ]}
            color={COLORS.cyan[400]}
            delay={30}
          />

          {/* Plus sign */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: COLORS.text.primary,
              opacity: plusOpacity,
              transform: `scale(${plusScale})`,
            }}
          >
            +
          </div>

          <VenueCard
            title="Orderbook"
            subtitle="Price Discovery"
            features={[
              'Limit orders',
              'Zero slippage',
              'Professional trading',
            ]}
            color={COLORS.magenta[400]}
            delay={45}
          />
        </div>

        {/* Result */}
        <AnimatedText
          delay={120}
          fontSize={32}
          color={COLORS.text.secondary}
          fontFamily="mono"
        >
          Best of both worlds. Unified in one protocol.
        </AnimatedText>
      </div>
    </AbsoluteFill>
  );
};
