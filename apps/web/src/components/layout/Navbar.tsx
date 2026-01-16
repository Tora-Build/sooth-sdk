import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { cn } from '../../lib/utils';
import { ChainSelector } from '../ui/ChainSelector';
import { Drawer } from '../ui/Drawer';
import uiContent from '../../config/ui-content.json';
import { Wallet, TrendingUp, Menu, Droplets, BarChart3, Rocket, Shield, BookOpen, Briefcase, ChevronDown, MoreHorizontal, Terminal } from 'lucide-react';
import { Button } from '../ui/Button';

const { navbar: content } = uiContent;

export const Navbar = () => {
  const location = useLocation();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Dropdown state
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = ['/gov', '/learn', '/faucet'].some(p => isActive(p));

  return (
    <header className="h-16 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
      <div className="container mx-auto max-w-7xl h-full px-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src="/sooth-logo.svg" alt="Sooth" className="w-8 h-8" />
              <div className="absolute inset-0 bg-cyan-500/30 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="hidden sm:block font-heading font-bold text-lg text-white tracking-tight uppercase">
              SOOTH
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-0">
            <NavLink to="/create" active={isActive('/create')}>
              <Rocket className="w-4 h-4" />
              {content.launchpad}
            </NavLink>

            <NavLink to="/trade" active={isActive('/trade') || location.pathname.startsWith('/trade/')}>
              <TrendingUp className="w-4 h-4" />
              {content.amm}
            </NavLink>

            <NavLink to="/pro" active={isActive('/pro') || location.pathname.startsWith('/pro/')}>
              <BarChart3 className="w-4 h-4" />
              {content.pro}
            </NavLink>

            <NavLink to="/geek" active={isActive('/geek')}>
              <Terminal className="w-4 h-4" />
              Geek
            </NavLink>

            <NavLink to="/portfolio" active={isActive('/portfolio')}>
              <Briefcase className="w-4 h-4" />
              Portfolio
            </NavLink>

            {/* More Dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-2 text-sm font-medium rounded-lg transition-all",
                  isMoreActive
                    ? "bg-cyan-500/10"
                    : "hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-center gap-0.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isMoreActive ? "bg-cyan-400" : "bg-blue-400")} />
                  <div className={cn("w-1.5 h-1.5 rounded-full", isMoreActive ? "bg-cyan-400" : "bg-purple-400")} />
                  <div className={cn("w-1.5 h-1.5 rounded-full", isMoreActive ? "bg-cyan-400" : "bg-cyan-400")} />
                </div>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isMoreActive ? "text-cyan-400" : "text-slate-400", moreOpen && "rotate-180")} />
              </button>

              {moreOpen && (
                <div className="absolute top-full right-0 mt-1 w-36 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-1">
                  <DropdownLink to="/gov" active={isActive('/gov')} onClick={() => setMoreOpen(false)}>
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span>{content.gov}</span>
                  </DropdownLink>
                  <DropdownLink to="/learn" active={isActive('/learn')} onClick={() => setMoreOpen(false)}>
                    <BookOpen className="w-4 h-4 text-purple-400" />
                    <span>{content.learn}</span>
                  </DropdownLink>
                  <DropdownLink to="/faucet" active={isActive('/faucet')} onClick={() => setMoreOpen(false)}>
                    <Droplets className="w-4 h-4 text-cyan-400" />
                    <span>{content.faucet}</span>
                  </DropdownLink>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Chain Selector */}
          <ChainSelector />

          {/* Wallet */}
          {!isConnected ? (
            <Button onClick={() => open()} variant="primary" size="sm">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">{content.connect}</span>
            </Button>
          ) : (
            <Button
              onClick={() => open({ view: 'Account' })}
              variant="secondary"
              size="sm"
              className="gap-2 border-slate-800 hover:border-slate-700"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <span className="hidden lg:inline font-mono text-xs text-white tracking-tighter">{displayAddress}</span>
            </Button>
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
            to="/create"
            active={isActive('/create')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Rocket className="w-5 h-5" />
            <span>{content.launchpad}</span>
          </MobileNavLink>

          <MobileNavLink
            to="/trade"
            active={isActive('/trade') || location.pathname.startsWith('/trade/')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <TrendingUp className="w-5 h-5" />
            <span>{content.amm}</span>
          </MobileNavLink>

          <MobileNavLink
            to="/pro"
            active={isActive('/pro') || location.pathname.startsWith('/pro/')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <BarChart3 className="w-5 h-5" />
            <span>{content.pro}</span>
          </MobileNavLink>

          <MobileNavLink
            to="/geek"
            active={isActive('/geek')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Terminal className="w-5 h-5" />
            <span>Geek</span>
          </MobileNavLink>

          <MobileNavLink
            to="/portfolio"
            active={isActive('/portfolio')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Briefcase className="w-5 h-5" />
            <span>Portfolio</span>
          </MobileNavLink>

          <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 border-t border-slate-800/50 pt-4">More</div>

          <MobileNavLink
            to="/gov"
            active={isActive('/gov')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Shield className="w-5 h-5" />
            <span>{content.gov}</span>
          </MobileNavLink>

          <MobileNavLink
            to="/learn"
            active={isActive('/learn')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <BookOpen className="w-5 h-5" />
            <span>{content.learn}</span>
          </MobileNavLink>

          <MobileNavLink
            to="/faucet"
            active={isActive('/faucet')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Droplets className="w-5 h-5" />
            <span>{content.faucet}</span>
          </MobileNavLink>
        </nav>
      </Drawer>
    </header >
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
      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
      active
        ? "text-cyan-400 bg-cyan-500/10"
        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
    )}
  >
    {children}
  </Link>
);

const DropdownLink = ({
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
      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all",
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
