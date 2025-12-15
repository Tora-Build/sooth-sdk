import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

export const AppLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-300 font-mono selection:bg-cyan-500/30">
      {/* Subtle scanline overlay - purely decorative */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-scanlines opacity-[0.02]" />
      
      <Navbar />
      
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
      
      <Footer />
    </div>
  );
};

