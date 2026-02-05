import { Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Trade } from './pages/Trade';
import { Search } from './pages/Search';
import { Portfolio } from './pages/Portfolio';
import { Profile } from './pages/Profile';
import { BottomNav } from './components/BottomNav';

export default function App() {
  const location = useLocation();
  const showNav = !location.pathname.startsWith('/trade/');

  return (
    <div className="h-full w-full bg-mesh">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trade/:marketId" element={<Trade />} />
        <Route path="/search" element={<Search />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
