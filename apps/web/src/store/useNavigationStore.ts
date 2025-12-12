import { create } from 'zustand';

type View = 'landing' | 'about' | 'dapp';

interface NavigationState {
  currentView: View;
  setView: (view: View) => void;
}

export const useNavigationStore = create<NavigationState>()((set) => ({
  currentView: 'landing',
  setView: (view) => set({ currentView: view }),
}));
