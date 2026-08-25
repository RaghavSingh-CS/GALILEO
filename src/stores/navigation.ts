import { create } from "zustand";

export type ActiveView = "dashboard" | "workspace" | "my-experiments" | "library" | "settings";

interface NavigationStore {
  activeView: ActiveView;
  previousView: ActiveView | null;
  activeExperimentId: string | null;
  galileoPanelOpen: boolean;
  isNewExpModalOpen: boolean;

  openExperiment: (id: string) => void;
  goToDashboard: () => void;
  goToMyExperiments: () => void;
  goToLibrary: () => void;
  goToSettings: () => void;
  goBackFromSettings: () => void;
  toggleGalileoPanel: () => void;
  setGalileoPanel: (open: boolean) => void;
  openNewExpModal: () => void;
  closeNewExpModal: () => void;
  setActiveView: (view: ActiveView) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  activeView: "dashboard",
  previousView: null,
  activeExperimentId: null,
  galileoPanelOpen: false,
  isNewExpModalOpen: false,

  openExperiment: (id: string) =>
    set({
      activeView: "workspace",
      activeExperimentId: id,
      galileoPanelOpen: false,
      isNewExpModalOpen: false,
    }),

  goToDashboard: () =>
    set({
      activeView: "dashboard",
      activeExperimentId: null,
      galileoPanelOpen: false,
    }),

  goToMyExperiments: () =>
    set({
      activeView: "my-experiments",
      galileoPanelOpen: false,
    }),

  goToLibrary: () =>
    set({
      activeView: "library",
      galileoPanelOpen: false,
    }),

  goToSettings: () =>
    set((state) => ({
      previousView: state.activeView,
      activeView: "settings",
      galileoPanelOpen: false,
    })),

  goBackFromSettings: () =>
    set((state) => ({
      activeView: state.previousView || "dashboard",
      previousView: null,
    })),

  toggleGalileoPanel: () =>
    set((state) => ({ galileoPanelOpen: !state.galileoPanelOpen })),

  setGalileoPanel: (open: boolean) => set({ galileoPanelOpen: open }),

  openNewExpModal: () => set({ isNewExpModalOpen: true }),
  closeNewExpModal: () =>
    set({
      isNewExpModalOpen: false,
    }),
  setActiveView: (view: ActiveView) => set({ activeView: view }),
}));
