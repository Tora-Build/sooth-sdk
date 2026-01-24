import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS } from '../brand';

type LogoProps = {
  scale?: number;
  showBeam?: boolean;
};

export const Logo = ({ scale = 1, showBeam = true }: LogoProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered entrance for each layer
  const layer1Progress = spring({ frame, fps, config: { damping: 15 }, delay: 0 });
  const layer2Progress = spring({ frame, fps, config: { damping: 15 }, delay: 5 });
  const layer3Progress = spring({ frame, fps, config: { damping: 15 }, delay: 10 });
  const beamProgress = spring({ frame, fps, config: { damping: 200 }, delay: 20 });

  // Scale and opacity for each layer
  const layer1Scale = interpolate(layer1Progress, [0, 1], [0.5, 1]);
  const layer2Scale = interpolate(layer2Progress, [0, 1], [0.5, 1]);
  const layer3Scale = interpolate(layer3Progress, [0, 1], [0.5, 1]);

  const beamHeight = interpolate(beamProgress, [0, 1], [0, 180]);
  const beamOpacity = interpolate(beamProgress, [0, 0.5, 1], [0, 1, 1]);

  // Subtle float animation
  const floatY = Math.sin(frame * 0.03) * 3;

  const size = 200 * scale;
  const center = size / 2;

  return (
    <div
      style={{
        width: size,
        height: size,
        transform: `translateY(${floatY}px)`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
      >
        {/* Bottom Layer (Settlement) */}
        <g
          style={{
            transform: `scale(${layer1Scale})`,
            transformOrigin: '100px 120px',
            opacity: layer1Progress,
          }}
        >
          <path
            d={`M${center} 50L${center + 80} 120L${center} 190L${center - 80} 120Z`}
            fill={COLORS.indigo}
            fillOpacity={0.4}
            stroke={COLORS.indigo}
            strokeWidth={1}
          />
        </g>

        {/* Middle Layer (Liquidity) */}
        <g
          style={{
            transform: `scale(${layer2Scale})`,
            transformOrigin: '100px 100px',
            opacity: layer2Progress,
          }}
        >
          <path
            d={`M${center} 30L${center + 80} 100L${center} 170L${center - 80} 100Z`}
            fill={COLORS.purple}
            fillOpacity={0.4}
            stroke={COLORS.purple}
            strokeWidth={1}
          />
        </g>

        {/* Top Layer (Market) */}
        <g
          style={{
            transform: `scale(${layer3Scale})`,
            transformOrigin: '100px 80px',
            opacity: layer3Progress,
          }}
        >
          <path
            d={`M${center} 10L${center + 80} 80L${center} 150L${center - 80} 80Z`}
            fill={COLORS.cyan[400]}
            fillOpacity={0.6}
            stroke={COLORS.cyan[400]}
            strokeWidth={2}
          />
        </g>

        {/* Central Beam */}
        {showBeam && (
          <line
            x1={center}
            y1={10 + (180 - beamHeight)}
            x2={center}
            y2={190}
            stroke="white"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={beamOpacity}
            style={{
              filter: 'drop-shadow(0 0 8px white)',
            }}
          />
        )}
      </svg>
    </div>
  );
};
