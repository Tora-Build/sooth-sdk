import React, { useId, useState, useRef, useEffect } from 'react';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  content: string;
  learnMore?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  learnMore,
  position = 'top',
  delay = 200,
  children,
  className,
  showIcon = false,
}) => {
  const tooltipId = useId();
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const trigger = triggerRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      let newPosition = position;

      if (position === 'top' && trigger.top - tooltip.height < 10) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && trigger.bottom + tooltip.height > viewport.height - 10) {
        newPosition = 'top';
      } else if (position === 'left' && trigger.left - tooltip.width < 10) {
        newPosition = 'right';
      } else if (position === 'right' && trigger.right + tooltip.width > viewport.width - 10) {
        newPosition = 'left';
      }

      if (newPosition !== actualPosition) {
        setActualPosition(newPosition);
      }
    }
  }, [isVisible, position, actualPosition]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-zinc-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-zinc-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-l-zinc-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-r-zinc-800 border-y-transparent border-l-transparent',
  };

  return (
    <div
      ref={triggerRef}
      className={cn('relative inline-flex items-center gap-1', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {showIcon && (
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          aria-label="Help"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
        >
          <HelpCircle className="w-3.5 h-3.5 text-zinc-500 hover:text-amber-400 transition-colors" />
        </button>
      )}

      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 w-max bg-zinc-800 border border-white/10 rounded-lg px-3 py-1.5 max-w-[280px] shadow-xl animate-fade-in',
            positionClasses[actualPosition]
          )}
          role="tooltip"
          id={tooltipId}
        >
          <div
            className={cn(
              'absolute w-0 h-0 border-[6px]',
              arrowClasses[actualPosition]
            )}
          />
          <p className="text-sm text-zinc-200 leading-relaxed">{content}</p>
          {learnMore && (
            <a
              href={learnMore}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              Learn
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export const TOOLTIP_CONTENT = {
  probability: {
    content: "The current market price represents the crowd's probability estimate. 60% means traders think there's a 60% chance this happens.",
    learnMore: '/learn#probability',
  },
  fee: {
    content: "Trading fees support market liquidity. Pre-graduation: 5% (all to liquidity). Post-graduation: 1% (split between liquidity, creators, and protocol).",
    learnMore: '/learn#fees',
  },
  lock24h: {
    content: "Sell proceeds are locked for 24 hours. This prevents manipulation while still letting you use the funds for new trades.",
    learnMore: '/learn#lock',
  },
  graduation: {
    content: "Markets graduate when liquidity reaches 2x the initial amount. Graduation unlocks the orderbook and reduces fees.",
    learnMore: '/learn#graduation',
  },
  lmsr: {
    content: "LMSR (Logarithmic Market Scoring Rule) ensures you can always trade. The price adjusts based on the ratio of YES to NO shares.",
    learnMore: '/learn#lmsr',
  },
  lpToken: {
    content: "LP tokens represent your share of the market's liquidity pool. They earn fees from every trade.",
    learnMore: '/learn#lp',
  },
  tStar: {
    content: "Truth Time (T*) is the exact moment when the outcome became known. Trades after T* may be invalidated.",
    learnMore: '/learn#settlement',
  },
  spendable: {
    content: "Spendable balance can be used immediately for new trades, even if some proceeds are still locked.",
    learnMore: '/learn#lock',
  },
  withdrawable: {
    content: "Withdrawable balance can be transferred to your wallet. This is the portion of your proceeds that has passed the 24h lock.",
    learnMore: '/learn#lock',
  },
  split: {
    content: "Split converts USDC into equal amounts of YES and NO tokens. 1000 USDC becomes 1000 YES + 1000 NO.",
    learnMore: '/learn#orderbook',
  },
  merge: {
    content: "Merge combines equal amounts of YES and NO tokens back into USDC. 1000 YES + 1000 NO becomes 1000 USDC.",
    learnMore: '/learn#orderbook',
  },
};

interface InfoTooltipProps {
  type: keyof typeof TOOLTIP_CONTENT;
  children: React.ReactNode;
  showIcon?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  type,
  children,
  showIcon = true,
  position = 'top',
}) => {
  const tooltipData = TOOLTIP_CONTENT[type];
  return (
    <Tooltip
      content={tooltipData.content}
      learnMore={tooltipData.learnMore}
      showIcon={showIcon}
      position={position}
    >
      {children}
    </Tooltip>
  );
};

export default Tooltip;
