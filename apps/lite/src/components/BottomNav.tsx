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
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <nav className="max-w-md mx-auto bg-[#1a1a1b] border border-[#333] rounded-2xl px-4 py-2 shadow-lg shadow-black/50">
        <div className="flex items-center justify-between">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 group transition-all bounce-button px-3 py-1"
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all group-active:scale-90 ${isActive
                        ? 'bg-[#00d4aa]/20 text-[#00d4aa]'
                        : 'text-[#888] group-hover:text-white'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wider ${isActive ? 'text-[#00d4aa]' : 'text-[#888] group-hover:text-white'
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
    </div>
  );
}
