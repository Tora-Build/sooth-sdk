import React from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => {
  return (
    <div className={cn('w-full', className)} data-value={value}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { value, onValueChange });
        }
        return child;
      })}
    </div>
  );
};

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('inline-flex h-10 items-center justify-center rounded-lg bg-slate-900/50 p-1 text-slate-400', className)}>
    {children}
  </div>
);

export const TabsTrigger: React.FC<{ value: string; children: React.ReactNode; className?: string; onValueChange?: (val: string) => void; activeValue?: string }> = ({ value, children, className, onValueChange, activeValue }) => {
  // Note: activeValue and onValueChange are injected by parent Tabs/TabsList if we used Context, 
  // but for simplicity in this quick implementation we'll assume direct usage or simple composition.
  // To make it robust without context, we might need a different pattern or Context.
  // Let's use a simple Context for Tabs.
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm',
        className
      )}
      onClick={() => onValueChange?.(value)}
      data-state={activeValue === value ? 'active' : 'inactive'}
    >
      {children}
    </button>
  );
};

// Re-implementing Tabs with Context for cleaner usage
import { createContext, useContext } from 'react';

const TabsContext = createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

export const TabsRoot: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={cn('w-full', className)}>{children}</div>
  </TabsContext.Provider>
);

export const TabsListImpl: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('inline-flex h-10 sm:h-12 items-center justify-center rounded-xl bg-slate-950/50 p-1 text-slate-400 border border-slate-800', className)}>
    {children}
  </div>
);

export const TabsTriggerImpl: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({ value, children, className }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');
  
  const isActive = context.value === value;
  
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-all',
        isActive ? 'bg-slate-800 text-white shadow-sm' : 'hover:text-slate-200 hover:bg-slate-900/50',
        className
      )}
      onClick={() => context.onValueChange(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{ value: string; children: React.ReactNode; className?: string }> = ({ value, children, className }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');
  
  if (context.value !== value) return null;
  
  return (
    <div className={cn('mt-4 animate-fade-in', className)}>
      {children}
    </div>
  );
};
