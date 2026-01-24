import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Logo } from '../components/Logo';
import { GlowText, AnimatedText } from '../components/AnimatedText';
import { COLORS } from '../brand';

export const Scene1LogoReveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scales up and settles
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 12 },
    delay: 15,
  });

  const logoScale = interpolate(logoProgress, [0, 1], [0.3, 1.5]);
  const logoOpacity = interpolate(logoProgress, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Title appears after logo
  const titleDelay = 60; // 2 seconds

  // Tagline appears after title
  const taglineDelay = 90; // 3 seconds

  // Subtitle with stats
  const statsDelay = 140; // ~4.5 seconds

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
        }}
      >
        <Logo scale={1.2} />
      </div>

      {/* Title */}
      <GlowText
        delay={titleDelay}
        fontSize={96}
        glowColor={COLORS.cyan[400]}
      >
        SOOTH
      </GlowText>

      {/* Tagline */}
      <AnimatedText
        delay={taglineDelay}
        fontSize={36}
        color={COLORS.text.secondary}
        fontFamily="mono"
        fontWeight={400}
      >
        Prediction Markets for Everything
      </AnimatedText>

      {/* Key stat teaser */}
      <div
        style={{
          display: 'flex',
          gap: 60,
          marginTop: 40,
        }}
      >
        <AnimatedText
          delay={statsDelay}
          fontSize={24}
          color={COLORS.cyan[400]}
          fontFamily="mono"
        >
          AMM + Orderbook
        </AnimatedText>
        <AnimatedText
          delay={statsDelay + 10}
          fontSize={24}
          color={COLORS.magenta[400]}
          fontFamily="mono"
        >
          LMSR Liquidity
        </AnimatedText>
        <AnimatedText
          delay={statsDelay + 20}
          fontSize={24}
          color={COLORS.purple}
          fontFamily="mono"
        >
          Zero Slippage
        </AnimatedText>
      </div>
    </AbsoluteFill>
  );
};
