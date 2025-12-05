import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/30 py-8 mt-auto">
      <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
        <div>
          &copy; 2025 Sooth Protocol.
        </div>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">GitHub</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Discord</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Twitter</a>
        </div>
      </div>
    </footer>
  );
};
