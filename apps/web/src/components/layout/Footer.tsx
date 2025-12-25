import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="border-t border-slate-800/50 bg-slate-950/50 py-8 mt-auto">
      <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
        <div className="flex items-center gap-4">
          <img src="/sooth-logo.svg" alt="Sooth" className="w-6 h-6 opacity-50" />
          <span className="font-mono text-slate-500">© 2025 Sooth Protocol</span>
        </div>
        
        <div className="flex items-center gap-6 font-mono text-slate-500">
          <Link to="/about" className="hover:text-cyan-400 transition-colors">
            About
          </Link>
          <a href="https://docs.sooth.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
            Docs
          </a>
          <a href="https://github.com/sooth-protocol" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
            GitHub
          </a>
          <a href="https://discord.gg/sooth" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
};
