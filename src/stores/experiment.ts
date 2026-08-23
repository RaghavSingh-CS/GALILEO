import { create } from "zustand";
import type { Observation } from "@/experiments/types";

interface ExperimentSessionStore {
  // Apparatus values keyed by param ID
  apparatusValues: Record<string, number>;
  setApparatusValue: (key: string, value: number) => void;
  initApparatus: (defaults: Record<string, number>) => void;

  // Observations log
  observations: Observation[];
  addObservation: (inputs: Record<string, number>, outputs: Record<string, number>) => void;
  clearObservations: () => void;

  // Session lifecycle
  isRunning: boolean;
  observationCounter: number;
  startExperiment: () => void;
  resetExperiment: (defaults: Record<string, number>) => void;
  loadSession: (apparatus: Record<string, number>, observations: Observation[]) => void;
}

export const useExperimentStore = create<ExperimentSessionStore>((set, get) => ({
  apparatusValues: {},
  observations: [],
  isRunning: false,
  observationCounter: 0,

  loadSession: (apparatus, observations) =>
    set({
      apparatusValues: { ...apparatus },
      observations: [...observations],
      observationCounter: observations.length,
      isRunning: false,
    }),

  setApparatusValue: (key, value) =>
    set((state) => ({
      apparatusValues: { ...state.apparatusValues, [key]: value },
    })),

  initApparatus: (defaults) =>
    set({ apparatusValues: { ...defaults } }),

  addObservation: (inputs, outputs) => {
    const count = get().observationCounter + 1;
    const obs: Observation = {
      id: count,
      timestamp: Date.now(),
      inputs: { ...inputs },
      outputs: { ...outputs },
    };
    set((state) => ({
      observations: [...state.observations, obs],
      observationCounter: count,
    }));
  },

  clearObservations: () => set({ observations: [], observationCounter: 0 }),

  startExperiment: () => set({ isRunning: true }),

  resetExperiment: (defaults) =>
    set({
      apparatusValues: { ...defaults },
      observations: [],
      isRunning: false,
      observationCounter: 0,
    }),
}));
