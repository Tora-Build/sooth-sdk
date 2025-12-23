import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'info' | 'glow';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'btn-primary hover:scale-[1.02]',
      secondary: 'btn-secondary hover:scale-[1.02]',
      ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white hover:scale-[1.02]',
      danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/50 hover:bg-rose-500/20 hover:scale-[1.02]',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-sm hover:scale-[1.02] hover:shadow-glow-emerald',
      info: 'bg-indigo-600 text-white hover:bg-indigo-700 border-none shadow-sm hover:scale-[1.02]',
      glow: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium hover:shadow-glow-violet hover:scale-[1.02] transition-all',
    };

    const sizes = {
      xs: 'px-2 py-1 text-xs',
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-6 py-2.5 text-sm',
      lg: 'px-8 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
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
