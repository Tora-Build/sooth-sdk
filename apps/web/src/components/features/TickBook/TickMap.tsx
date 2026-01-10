import React, { useRef, useEffect, useCallback } from 'react';

interface Tick {
  index: number;
  yesDepth: bigint;
  noDepth: bigint;
}

interface TickMapProps {
  currentTick: number;
  bids: Tick[];
  asks: Tick[];
  onTickClick?: (tick: number) => void;
}

export const TickMap: React.FC<TickMapProps> = ({
  currentTick,
  bids,
  asks,
  onTickClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map ticks to a 100x100 grid
  // Ticks 0-99 -> Row 99 (bottom)
  // Ticks 9900-9999 -> Row 0 (top)
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 400; // Fixed size for the map
    const cellSize = size / 100;
    
    // Clear
    ctx.fillStyle = '#0f172a'; // bg-slate-900
    ctx.fillRect(0, 0, size, size);

    // Draw Grid Lines (optional, very subtle)
    ctx.strokeStyle = '#1e293b'; // bg-slate-800
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 100; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(size, i * cellSize);
      ctx.stroke();
    }

    // Draw Bids (Emerald)
    bids.forEach(tick => {
      const x = (tick.index % 100) * cellSize;
      const y = (99 - Math.floor(tick.index / 100)) * cellSize;
      
      const intensity = Math.min(1, Number(tick.yesDepth + tick.noDepth) / 1e21); // Normalize
      ctx.fillStyle = `rgba(16, 185, 129, ${0.3 + intensity * 0.7})`; // emerald-500
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#10b981';
      ctx.fillRect(x, y, cellSize, cellSize);
    });

    // Draw Asks (Rose)
    asks.forEach(tick => {
      const x = (tick.index % 100) * cellSize;
      const y = (99 - Math.floor(tick.index / 100)) * cellSize;
      
      const intensity = Math.min(1, Number(tick.yesDepth + tick.noDepth) / 1e21);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.3 + intensity * 0.7})`; // rose-500
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#f43f5e';
      ctx.fillRect(x, y, cellSize, cellSize);
    });

    // Draw Current Tick (Cyan/White Pulse)
    const curX = (currentTick % 100) * cellSize;
    const curY = (99 - Math.floor(currentTick / 100)) * cellSize;
    
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#06b6d4'; // cyan-500
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(curX - 1, curY - 1, cellSize + 2, cellSize + 2);
    
    // Reset shadow for performance
    ctx.shadowBlur = 0;
  }, [currentTick, bids, asks]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onTickClick) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const size = rect.width;
    const cellSize = size / 100;
    
    const gridX = Math.floor(x / cellSize);
    const gridY = 99 - Math.floor(y / cellSize);
    
    const tick = gridY * 100 + gridX;
    if (tick >= 0 && tick < 10000) {
      onTickClick(tick);
    }
  };

  return (
    <div className="relative group" ref={containerRef}>
      <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/10 to-cyan-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        onClick={handleClick}
        className="relative z-10 rounded-lg border border-slate-800 cursor-crosshair bg-slate-950 shadow-2xl"
        title="10,000 Ticks Heatmap"
      />
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981]" />
          <span>Bids</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_5px_#f43f5e]" />
          <span>Asks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-white border border-cyan-500 rounded-sm" />
          <span>Current</span>
        </div>
      </div>
    </div>
  );
};

