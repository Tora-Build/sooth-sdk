import React from 'react';
import { Card } from '../../ui/Card';

export const MarketSkeleton: React.FC = () => {
  return (
    <Card className="h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-5 shimmer rounded w-3/4 mb-2"></div>
          <div className="flex items-center gap-2">
            <div className="h-4 shimmer rounded w-16"></div>
            <div className="h-4 shimmer rounded w-12"></div>
          </div>
        </div>
      </div>

      {/* Probability Display */}
      <div className="mb-3 p-2 rounded-lg bg-slate-900/30">
        <div className="h-4 shimmer rounded w-full"></div>
      </div>

      {/* Outcome Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="h-20 shimmer rounded-xl border border-slate-800"></div>
        <div className="h-20 shimmer rounded-xl border border-slate-800"></div>
      </div>

      {/* Quote Preview */}
      <div className="mb-4 p-3 rounded-lg bg-slate-900/50 space-y-2">
        <div className="h-3 shimmer rounded w-full"></div>
        <div className="h-3 shimmer rounded w-2/3"></div>
      </div>

      {/* Input and Button */}
      <div className="space-y-3">
        <div className="h-10 shimmer rounded-lg border border-slate-800"></div>
        <div className="h-10 shimmer rounded-lg"></div>
      </div>
    </Card>
  );
};
