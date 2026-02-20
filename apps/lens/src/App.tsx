import { useState, createContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Feed } from './pages/Feed';
import { Search } from './pages/Search';
import { Portfolio } from './pages/Portfolio';
import { Profile } from './pages/Profile';
import { AAP } from './pages/AAP';
import { SkillPage } from './pages/SkillPage';
import { AdjudicatorPage } from './pages/AdjudicatorPage';
import { CreateMarket } from './pages/CreateMarket';
import { BottomNav } from './components/BottomNav';
import { Showcase } from './components/Showcase';
import { DesktopNav } from './components/DesktopNav';
import { ShowcaseContext } from './hooks/useShowcase';
import { useIsMobile } from './hooks/useIsMobile';

// Phone simulator uses its own routing context (not react-router)
const PhoneRouteContext = createContext<{ route: string; setRoute: (r: string) => void }>({ route: '/', setRoute: () => {} });

function MobileApp() {
  return (
    <div className="h-full w-full bg-mesh">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/create" element={<CreateMarket />} />
        <Route path="/markets" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

export { PhoneRouteContext };

const PHONE_PAGES: Record<string, (props: { onBack?: () => void }) => JSX.Element> = {
  '/': Home,
  '/feed': Feed,
  '/create': CreateMarket,
  '/markets': Home,
  '/search': Search,
  '/portfolio': Portfolio,
  '/profile': Profile,
};

function PhoneContent({ initialRoute = '/' }: { initialRoute?: string }) {
  const [route, setRoute] = useState(initialRoute);
  const Page = PHONE_PAGES[route] || Home;

  return (
    <PhoneRouteContext.Provider value={{ route, setRoute }}>
      <div className="h-full w-full bg-mesh">
        <Page />
        <BottomNav />
      </div>
    </PhoneRouteContext.Provider>
  );
}

function DesktopApp() {
  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <DesktopNav />
      <Routes>
        <Route
          path="/"
          element={
            <ShowcaseContext.Provider value={true}>
              <Showcase>
                <PhoneContent />
              </Showcase>
            </ShowcaseContext.Provider>
          }
        />
        <Route path="/aap" element={<AAP />} />
        <Route path="/skill" element={<SkillPage />} />
        <Route path="/adjudicator" element={<AdjudicatorPage />} />
        <Route
          path="/create"
          element={
            <ShowcaseContext.Provider value={true}>
              <Showcase>
                <PhoneContent initialRoute="/create" />
              </Showcase>
            </ShowcaseContext.Provider>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ShowcaseContext.Provider value={false}>
        <MobileApp />
      </ShowcaseContext.Provider>
    );
  }

  return <DesktopApp />;
}
