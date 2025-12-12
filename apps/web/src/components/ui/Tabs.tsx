import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = createContext<{ value: string; onValueChange: (v: string) => void } | null>(null);

export const TabsRoot: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={cn('w-full', className)}>{children}</div>
  </TabsContext.Provider>
);

export const TabsListImpl: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('relative flex h-10 sm:h-12 items-center rounded-xl bg-slate-950/50 p-1 border border-slate-800', className)}>
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
        'relative z-10 flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors duration-200',
        isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200',
        className
      )}
      onClick={() => context.onValueChange(value)}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-slate-800 rounded-lg shadow-sm"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <span className="relative z-20">{children}</span>
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
