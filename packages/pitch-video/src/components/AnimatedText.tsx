import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, FONTS } from '../brand';

type AnimatedTextProps = {
  children: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: 'heading' | 'mono';
  fontWeight?: number;
  style?: React.CSSProperties;
};

export const AnimatedText = ({
  children,
  delay = 0,
  fontSize = 48,
  color = COLORS.text.primary,
  fontFamily = 'heading',
  fontWeight = 600,
  style,
}: AnimatedTextProps) => {
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
        fontSize,
        fontFamily: FONTS[fontFamily],
        fontWeight,
        color,
        opacity,
        transform: `translateY(${y}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

type TypewriterTextProps = {
  children: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: 'heading' | 'mono';
  charsPerFrame?: number;
  style?: React.CSSProperties;
};

export const TypewriterText = ({
  children,
  delay = 0,
  fontSize = 32,
  color = COLORS.text.primary,
  fontFamily = 'mono',
  charsPerFrame = 0.5,
  style,
}: TypewriterTextProps) => {
  const frame = useCurrentFrame();

  const effectiveFrame = Math.max(0, frame - delay);
  const charsToShow = Math.floor(effectiveFrame * charsPerFrame);
  const displayText = children.slice(0, charsToShow);

  // Blinking cursor
  const showCursor = Math.floor(frame / 15) % 2 === 0;
  const cursorOpacity = charsToShow < children.length ? 1 : showCursor ? 1 : 0;

  return (
    <div
      style={{
        fontSize,
        fontFamily: FONTS[fontFamily],
        color,
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {displayText}
      <span
        style={{
          opacity: cursorOpacity,
          color: COLORS.cyan[400],
          marginLeft: 2,
        }}
      >
        |
      </span>
    </div>
  );
};

type GlowTextProps = {
  children: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  style?: React.CSSProperties;
};

export const GlowText = ({
  children,
  delay = 0,
  fontSize = 72,
  color = COLORS.text.primary,
  glowColor = COLORS.cyan[400],
  style,
}: GlowTextProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 12 },
    delay,
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.9, 1]);
  const glowIntensity = interpolate(progress, [0, 0.5, 1], [0, 0, 1]);

  return (
    <div
      style={{
        fontSize,
        fontFamily: FONTS.heading,
        fontWeight: 700,
        color,
        opacity,
        transform: `scale(${scale})`,
        textShadow: `0 0 ${20 * glowIntensity}px ${glowColor}, 0 0 ${40 * glowIntensity}px ${glowColor}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
