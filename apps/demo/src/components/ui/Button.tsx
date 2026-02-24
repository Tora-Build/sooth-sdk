import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'info' | 'glow' | 'cyan' | 'destructive';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'btn btn-primary',
      secondary: 'btn btn-secondary',
      ghost: 'btn btn-ghost',
      danger: 'btn btn-danger',
      success: 'btn bg-emerald-500/15 text-emerald-200 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-400/30 shadow-glow-emerald',
      info: 'btn bg-cyan-500/15 text-cyan-200 border border-cyan-500/25 hover:bg-cyan-500/20 hover:border-cyan-400/30 shadow-glow-cyan',
      glow: 'btn bg-gradient-to-r from-cyan-500/80 to-emerald-500/80 text-white border border-white/10 hover:border-white/20 shadow-glow-cyan',
      cyan: 'btn bg-cyan-500/15 text-cyan-200 border border-cyan-500/25 hover:bg-cyan-500/20 hover:border-cyan-400/30 shadow-glow-cyan',
      destructive: 'btn btn-danger',
    };

    const sizes = {
      xs: 'px-2.5 py-1 text-xs rounded-lg',
      sm: 'px-3.5 py-2 text-xs rounded-xl',
      md: 'px-6 py-2.5 text-sm rounded-xl',
      lg: 'px-7 py-3 text-base rounded-2xl',
    };

    return (
      <button
        ref={ref}
        className={cn(
          variants[variant],
          sizes[size],
          'active:translate-y-[1px]',
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
