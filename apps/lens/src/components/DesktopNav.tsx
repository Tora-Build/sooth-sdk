import { NavLink } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/aap', label: 'AAP' },
  { to: '/skill', label: 'Plugin' },
  { to: '/adjudicator', label: 'Adjudicator' },
];

export function DesktopNav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 border-b border-white/5 bg-black/80 backdrop-blur-md">
      <div className="flex items-center gap-8">
        <NavLink to="/" className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="SoothSayer" className="w-7 h-7 rounded-lg" />
          <span className="font-mono font-bold text-base tracking-tight text-white">SoothSayer</span>
        </NavLink>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                  isActive
                    ? 'text-[#00d4aa] bg-[#00d4aa]/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <a
           href="https://github.com/sooth-protocol"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-[#00d4aa]/50 hover:text-[#00d4aa] text-white/70 text-sm font-mono transition-all"
        >
          GitHub <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </nav>
  );
}
