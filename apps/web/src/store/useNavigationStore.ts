import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type View = 'landing' | 'about' | 'dapp';

interface NavigationState {
  currentView: View;
  setView: (view: View) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      currentView: 'landing',
      setView: (view) => set({ currentView: view }),
    }),
    {
      name: 'sooth-navigation-storage',
    }
  )
);
