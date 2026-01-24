import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate, Sequence } from 'remotion';
import { AnimatedText, GlowText } from '../components/AnimatedText';
import { COLORS, FONTS } from '../brand';

const ProblemPoint = ({
  icon,
  title,
  description,
  delay,
}: {
  icon: string;
  title: string;
  description: string;
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
  const x = interpolate(progress, [0, 1], [-50, 0]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 24,
        opacity,
        transform: `translateX(${x}px)`,
        maxWidth: 600,
      }}
    >
      <div
        style={{
          fontSize: 48,
          lineHeight: 1,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 28,
            fontFamily: FONTS.heading,
            fontWeight: 600,
            color: COLORS.text.primary,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 20,
            fontFamily: FONTS.mono,
            color: COLORS.text.secondary,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
};

export const Scene2Problem = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 60,
          maxWidth: 1400,
        }}
      >
        {/* Header */}
        <AnimatedText
          delay={0}
          fontSize={56}
          color={COLORS.destructive}
          fontFamily="heading"
          fontWeight={700}
        >
          The Problem with Prediction Markets
        </AnimatedText>

        {/* Problem points */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 40,
            marginLeft: 40,
          }}
        >
          <ProblemPoint
            icon="💸"
            title="High Slippage"
            description="Traditional AMMs punish large trades with massive price impact"
            delay={30}
          />
          <ProblemPoint
            icon="🐌"
            title="Illiquid Markets"
            description="Low liquidity means poor prices and stuck positions"
            delay={60}
          />
          <ProblemPoint
            icon="🔒"
            title="No Price Discovery"
            description="AMM-only systems can't find true market clearing prices"
            delay={90}
          />
        </div>

        {/* Transition text */}
        <Sequence from={150} durationInFrames={150} premountFor={30}>
          <div
            style={{
              marginTop: 40,
              textAlign: 'center',
            }}
          >
            <GlowText
              delay={0}
              fontSize={42}
              glowColor={COLORS.cyan[400]}
            >
              What if there was a better way?
            </GlowText>
          </div>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};
