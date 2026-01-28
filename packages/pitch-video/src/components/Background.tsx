import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../brand';

export const Background = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slowly moving gradient
  const gradientX = interpolate(frame, [0, durationInFrames], [30, 70], {
    extrapolateRight: 'clamp',
  });
  const gradientY = interpolate(frame, [0, durationInFrames], [20, 40], {
    extrapolateRight: 'clamp',
  });

  // Subtle pulse for the glow
  const glowOpacity = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [0.1, 0.2]
  );

  return (
    <AbsoluteFill
      style={{
        background: COLORS.background,
      }}
    >
      {/* Animated gradient glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at ${gradientX}% ${gradientY}%, ${COLORS.cyan[500]}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 50%)`,
        }}
      />
      {/* Second glow - magenta */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at ${100 - gradientX}% ${100 - gradientY}%, ${COLORS.magenta[500]}${Math.round(glowOpacity * 0.5 * 255).toString(16).padStart(2, '0')} 0%, transparent 40%)`,
        }}
      />
      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </AbsoluteFill>
  );
};
