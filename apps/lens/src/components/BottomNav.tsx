import { useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Rss, BarChart3, Plus, User } from 'lucide-react';
import { ShowcaseContext } from '../hooks/useShowcase';
import { PhoneRouteContext } from '../App';

interface NavItem {
  to: string;
  icon: typeof Rss;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/feed', icon: Rss, label: 'FEED' },
  { to: '/markets', icon: BarChart3, label: 'MARKETS' },
  { to: '/create', icon: Plus, label: 'CREATE' },
  { to: '/profile', icon: User, label: 'PROFILE' },
];

function PhoneNavButton({ to: _to, icon: Icon, label, isActive, onClick }: {
  to: string; icon: typeof Rss; label: string; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-px group transition-all bounce-button px-1.5 py-0.5"
    >
      <div className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all group-active:scale-90 ${
        isActive ? 'bg-[#00d4aa]/20 text-[#00d4aa]' : 'text-[#888] group-hover:text-white'
      }`}>
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <span className={`text-[10px] font-bold tracking-wider ${
        isActive ? 'text-[#00d4aa]' : 'text-[#888] group-hover:text-white'
      }`}>
        {label}
      </span>
    </button>
  );
}

export function BottomNav() {
  const isShowcase = useContext(ShowcaseContext);
  const phoneRoute = useContext(PhoneRouteContext);
  const location = useLocation();

  const currentRoute = isShowcase ? phoneRoute.route : location.pathname;
  if (currentRoute === '/create') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
      <nav className="max-w-md mx-auto bg-[#1a1a1b] border border-[#333] rounded-2xl px-2 py-1.5 shadow-lg shadow-black/50">
        <div className="flex items-center justify-between">
          {isShowcase ? (
            // Phone simulator: use state-based routing
            NAV_ITEMS.map(({ to, icon, label }) => (
              <PhoneNavButton
                key={to}
                to={to}
                icon={icon}
                label={label}
                isActive={phoneRoute.route === to}
                onClick={() => phoneRoute.setRoute(to)}
              />
            ))
          ) : (
            // Mobile: use real router
            NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center gap-px group transition-all bounce-button px-1.5 py-0.5"
              >
                {({ isActive }) => (
                  <>
                    <div className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all group-active:scale-90 ${
                      isActive ? 'bg-[#00d4aa]/20 text-[#00d4aa]' : 'text-[#888] group-hover:text-white'
                    }`}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <span className={`text-[10px] font-bold tracking-wider ${
                      isActive ? 'text-[#00d4aa]' : 'text-[#888] group-hover:text-white'
                    }`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))
          )}
        </div>
      </nav>
    </div>
  );
}
