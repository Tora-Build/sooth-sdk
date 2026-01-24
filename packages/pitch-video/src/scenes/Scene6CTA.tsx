import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Logo } from '../components/Logo';
import { GlowText, AnimatedText } from '../components/AnimatedText';
import { COLORS, FONTS } from '../brand';

export const Scene6CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo pulse animation
  const logoProgress = spring({
    frame,
    fps,
    config: { damping: 12 },
    delay: 0,
  });

  const logoScale = interpolate(logoProgress, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(logoProgress, [0, 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtle breathing animation for the glow
  const breathe = Math.sin(frame * 0.05) * 0.1 + 1;

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
          gap: 50,
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale * breathe})`,
            opacity: logoOpacity,
          }}
        >
          <Logo scale={1.8} />
        </div>

        {/* Main CTA */}
        <GlowText
          delay={30}
          fontSize={72}
          glowColor={COLORS.cyan[400]}
        >
          The Future of Prediction Markets
        </GlowText>

        {/* Tagline */}
        <AnimatedText
          delay={60}
          fontSize={32}
          color={COLORS.text.secondary}
          fontFamily="mono"
        >
          Trade smarter. Predict better. Win bigger.
        </AnimatedText>

        {/* Contact / Links */}
        <div
          style={{
            display: 'flex',
            gap: 60,
            marginTop: 40,
          }}
        >
          <CTAButton
            text="sooth.markets"
            delay={90}
            primary
          />
          <CTAButton
            text="@sloothprotocol"
            delay={105}
          />
        </div>

        {/* Final tagline */}
        <AnimatedText
          delay={140}
          fontSize={24}
          color={COLORS.text.muted}
          fontFamily="mono"
        >
          Built by traders, for traders.
        </AnimatedText>
      </div>
    </AbsoluteFill>
  );
};

const CTAButton = ({
  text,
  delay,
  primary = false,
}: {
  text: string;
  delay: number;
  primary?: boolean;
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
  const scale = interpolate(progress, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        padding: '16px 40px',
        background: primary
          ? `linear-gradient(135deg, ${COLORS.cyan[500]}, ${COLORS.cyan[600]})`
          : 'transparent',
        border: primary
          ? 'none'
          : `2px solid ${COLORS.cyan[400]}`,
        borderRadius: 12,
        fontSize: 24,
        fontFamily: FONTS.mono,
        fontWeight: 600,
        color: primary ? COLORS.background : COLORS.cyan[400],
        opacity,
        transform: `scale(${scale})`,
        boxShadow: primary ? `0 0 30px ${COLORS.cyan[500]}40` : 'none',
      }}
    >
      {text}
    </div>
  );
};
