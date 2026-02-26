export function SoothLogo({ size = 20, className }: { size?: number; className?: string }) {
  const gap = size * 0.1;
  const r = size * 0.075;
  const cell = (size - gap) / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className={className}
    >
      <rect x={0} y={0} width={cell} height={cell} rx={r} fill="#f59e0b" />
      <rect x={cell + gap} y={0} width={cell} height={cell} rx={r} fill="#f59e0b" opacity={0.6} />
      <rect x={0} y={cell + gap} width={cell} height={cell} rx={r} fill="#f59e0b" opacity={0.6} />
      <rect x={cell + gap} y={cell + gap} width={cell} height={cell} rx={r} fill="#f59e0b" opacity={0.3} />
    </svg>
  );
}
