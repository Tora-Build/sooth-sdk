import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { cn } from '../../lib/utils';
import { ChainSelector } from '../ui/ChainSelector';
import { Drawer } from '../ui/Drawer';
import uiContent from '../../config/ui-content.json';
import { 
  Wallet, TrendingUp, Menu, Droplets,
  Zap, PlusCircle, Shield, BookOpen
} from 'lucide-react';

const { navbar: content } = uiContent;

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
            <span className="hidden sm:block font-heading font-bold text-lg text-white tracking-tight">
                SOOTH
            </span>
          </Link>

          {/* Nav Links - Role-Based Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Creator/Adjudicator - First */}
            <NavLink to="/create" active={isActive('/create')}>
              <PlusCircle className="w-4 h-4" />
              {content.launchpad}
            </NavLink>
            
            {/* Trading Pages */}
            <NavLink to="/trade" active={isActive('/trade') || location.pathname.startsWith('/trade/')}>
              <TrendingUp className="w-4 h-4" />
              {content.amm}
            </NavLink>
            <NavLink to="/pro" active={isActive('/pro') || location.pathname.startsWith('/pro/')}>
              <Zap className="w-4 h-4" />
              {content.pro}
            </NavLink>
            
            {/* Guardian/Governance */}
            <NavLink to="/gov" active={isActive('/gov')}>
              <Shield className="w-4 h-4" />
              {content.gov}
            </NavLink>
            
            {/* Education / Info */}
            <NavLink to="/about" active={isActive('/about')}>
              <BookOpen className="w-4 h-4" />
              {content.learn}
            </NavLink>
            
            {/* Utility - Faucet for testnet */}
            <NavLink to="/faucet" active={isActive('/faucet')}>
              <Droplets className="w-4 h-4" />
              {content.faucet}
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
              <span className="hidden sm:inline">{content.connect}</span>
            </button>
          ) : (
            <button
              onClick={() => open({ view: 'Account' })}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border border-slate-700 hover:border-cyan-500/50 rounded-lg transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
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
          {/* Create - First */}
          <MobileNavLink
            to="/create"
            active={isActive('/create')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <PlusCircle className="w-5 h-5" />
            <span>{content.launchpad}</span>
          </MobileNavLink>
          
          {/* Trading Pages */}
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
            <Zap className="w-5 h-5" />
            <span>{content.pro}</span>
          </MobileNavLink>
          <MobileNavLink
            to="/gov"
            active={isActive('/gov')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Shield className="w-5 h-5" />
            <span>{content.gov}</span>
          </MobileNavLink>
          <MobileNavLink
            to="/about"
            active={isActive('/about')}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <BookOpen className="w-5 h-5" />
            <span>{content.learn}</span>
          </MobileNavLink>
          
          {/* Divider */}
          <div className="border-t border-slate-800 my-2" />
          
          {/* Utility */}
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
