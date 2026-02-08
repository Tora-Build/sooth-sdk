import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Portfolio } from './pages/Portfolio';
import { Profile } from './pages/Profile';
import { BottomNav } from './components/BottomNav';
import { Showcase } from './components/Showcase';
import { ShowcaseContext } from './hooks/useShowcase';
import { useIsMobile } from './hooks/useIsMobile';

function AppContent() {
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

export default function App() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ShowcaseContext.Provider value={false}>
        <AppContent />
      </ShowcaseContext.Provider>
    );
  }

  return (
    <ShowcaseContext.Provider value={true}>
      <Showcase>
        <AppContent />
      </Showcase>
    </ShowcaseContext.Provider>
  );
}
