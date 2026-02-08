import { Routes, Route, MemoryRouter, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Portfolio } from './pages/Portfolio';
import { Profile } from './pages/Profile';
import { AAP } from './pages/AAP';
import { SkillPage } from './pages/SkillPage';
import { AdjudicatorPage } from './pages/AdjudicatorPage';
import { BottomNav } from './components/BottomNav';
import { Showcase } from './components/Showcase';
import { DesktopNav } from './components/DesktopNav';
import { ShowcaseContext } from './hooks/useShowcase';
import { useIsMobile } from './hooks/useIsMobile';

function MobileApp() {
  return (
    <div className="h-full w-full bg-mesh">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </div>
  );
}

function PhoneContent() {
  return (
    <MemoryRouter>
      <div className="h-full w-full bg-mesh">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        <BottomNav />
      </div>
    </MemoryRouter>
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
