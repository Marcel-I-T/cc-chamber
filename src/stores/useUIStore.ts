import { create } from 'zustand';

export type MainTab = 'terminal' | 'settings';

interface UIStore {
  isSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  activeMainTab: MainTab;
  setSidebarOpen: (v: boolean) => void;
  setRightSidebarOpen: (v: boolean) => void;
  setActiveMainTab: (t: MainTab) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSidebarOpen: true,
  isRightSidebarOpen: true,
  activeMainTab: 'terminal',
  setSidebarOpen: (v) => set({ isSidebarOpen: v }),
  setRightSidebarOpen: (v) => set({ isRightSidebarOpen: v }),
  setActiveMainTab: (t) => set({ activeMainTab: t }),
}));
