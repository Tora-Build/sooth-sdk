import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { cn } from '../../lib/utils';
import { ChainSelector } from '../ui/ChainSelector';
import { Drawer } from '../ui/Drawer';
import { Wallet, TrendingUp, Briefcase, Menu } from 'lucide-react';

export const Navbar = () => {
  const location = useLocation();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="h-16 border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-40">
      <div className="container mx-auto max-w-7xl h-full px-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src="/sooth-logo.svg" alt="Sooth" className="w-8 h-8" />
              <div className="absolute inset-0 bg-cyan-500/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="hidden sm:block">
              <div className="font-heading font-bold text-lg text-white tracking-tight">
                SOOTH
              </div>
              <div className="text-[9px] font-mono text-cyan-500/70 tracking-[0.25em] uppercase">
                protocol
              </div>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/markets" active={isActive('/markets')}>
              <TrendingUp className="w-4 h-4" />
              Markets
            </NavLink>
            <NavLink to="/portfolio" active={isActive('/portfolio')}>
              <Briefcase className="w-4 h-4" />
              Portfolio
            </NavLink>
            <NavLink to="/about" active={isActive('/about')}>
              About
            </NavLink>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Chain Selector */}
          <ChainSelector />

          {/* Wallet */}
          {!isConnected ? (
            <button
              onClick={() => open()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-lg transition-all hover:shadow-lg hover:shadow-cyan-500/25"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Connect</span>
            </button>
          ) : (
            <button
              onClick={() => open({ view: 'Account' })}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 rounded-lg transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline font-mono text-sm text-white">{displayAddress}</span>
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <Drawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        title="Navigation"
      >
        <nav className="flex flex-col gap-2">
          <MobileNavLink
            to="/markets"
            active={isActive('/markets')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Markets</span>
          </MobileNavLink>
          <MobileNavLink
            to="/portfolio"
            active={isActive('/portfolio')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Briefcase className="w-5 h-5" />
            <span>Portfolio</span>
          </MobileNavLink>
          <MobileNavLink
            to="/about"
            active={isActive('/about')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>About</span>
          </MobileNavLink>
        </nav>
      </Drawer>
    </header>
  );
};

const NavLink = ({ 
  to, 
  active, 
  children 
}: { 
  to: string; 
  active: boolean; 
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all",
      active
        ? "text-cyan-400 bg-cyan-500/10"
        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
    )}
  >
    {children}
  </Link>
);

const MobileNavLink = ({
  to,
  active,
  onClick,
  children
}: {
  to: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 text-base font-medium rounded-lg transition-all",
      active
        ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
        : "text-slate-300 hover:text-white hover:bg-slate-800/50"
    )}
  >
    {children}
  </Link>
);
