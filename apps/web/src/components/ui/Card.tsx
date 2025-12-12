import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'premium' | 'interactive';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'glass-card',
      premium: 'glass-card-premium',
      interactive: 'glass-card hover:border-indigo-500/30 hover:shadow-glow-indigo transition-all duration-300',
    };
    
    return (
      <div
        ref={ref}
        className={cn(variants[variant], 'p-6', className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';
