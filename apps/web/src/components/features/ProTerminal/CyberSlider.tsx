import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../../../lib/utils';

interface CyberSliderProps {
    value: [number, number];
    onChange: (value: [number, number]) => void;
    min?: number;
    max?: number;
    step?: number;
    isSingle?: boolean;
}

export const CyberSlider: React.FC<CyberSliderProps> = ({
    value, onChange, min = 1, max = 99, step = 1, isSingle = false
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState<'lower' | 'upper' | null>(null);

    const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

    const handleMouseDown = (thumb: 'lower' | 'upper') => (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(thumb);
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            const val = Math.round((percent * (max - min) + min) / step) * step;

            const [lower, upper] = value;
            if (isDragging === 'lower') {
                const newLower = isSingle ? val : Math.min(val, upper);
                onChange([newLower, isSingle ? newLower : upper]);
            } else {
                const newUpper = Math.max(val, lower);
                onChange([lower, newUpper]);
            }
        };

        const handleMouseUp = () => setIsDragging(null);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, value, min, max, step, onChange, isSingle]);

    const lowerPercent = getPercentage(value[0]);
    const upperPercent = getPercentage(value[1]);

    return (
        <div className="relative h-8 flex items-center select-none cursor-pointer group" ref={trackRef}>
            {/* Track Background */}
            <div className="absolute inset-x-0 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                {/* Fill Gradient */}
                <div
                    className={cn(
                        "absolute h-full transition-all duration-75",
                        isSingle ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    )}
                    style={{
                        left: `${lowerPercent}%`,
                        width: isSingle ? '4px' : `${upperPercent - lowerPercent}%`
                    }}
                />
            </div>

            {/* Thumbs */}
            {/* Lower Thumb */}
            <div
                className={cn(
                    "absolute w-4 h-4 -ml-2 bg-slate-100 rounded-full border-2 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-20 shadow-lg",
                    isSingle ? "border-cyan-500" : "border-indigo-500"
                )}
                style={{ left: `${lowerPercent}%` }}
                onMouseDown={handleMouseDown('lower')}
            >
                <div className={cn("absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold px-1.5 rounded bg-slate-800 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity", isDragging && "opacity-100")}>
                    {value[0]}%
                </div>
            </div>

            {/* Upper Thumb (only for ranged) */}
            {!isSingle && (
                <div
                    className="absolute w-4 h-4 -ml-2 bg-slate-100 rounded-full border-2 border-indigo-500 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-20 shadow-lg"
                    style={{ left: `${upperPercent}%` }}
                    onMouseDown={handleMouseDown('upper')}
                >
                    <div className={cn("absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono font-bold px-1.5 rounded bg-slate-800 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity", isDragging && "opacity-100")}>
                        {value[1]}%
                    </div>
                </div>
            )}
        </div>
    );
};
