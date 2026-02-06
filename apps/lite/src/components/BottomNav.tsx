import { NavLink } from 'react-router-dom';
import { Home, Search, PieChart, User } from 'lucide-react';

interface NavItem {
  to: string;
  icon: typeof Home;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: Home, label: 'FEED' },
  { to: '/search', icon: Search, label: 'DISCOVER' },
  { to: '/portfolio', icon: PieChart, label: 'PORTFOLIO' },
  { to: '/profile', icon: User, label: 'PROFILE' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav px-6 pt-2 pb-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 group transition-all bounce-button"
          >
            {({ isActive }) => (
              <>
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all group-active:scale-90 ${
                    isActive
                      ? 'bg-white/10 text-cyan-400 border border-white/20 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                      : 'text-white/40 group-hover:bg-white/5 group-hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[10px] font-bold tracking-wider ${
                    isActive ? 'text-cyan-400' : 'text-white/40 group-hover:text-white'
                  }`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
