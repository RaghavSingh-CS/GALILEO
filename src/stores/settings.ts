import { create } from "zustand";

export type NoiseLevel = "ideal" | "realistic" | "high";
export type SweepSpeed = "slow" | "standard" | "fast";
export type GraphLineType = "monotone" | "linear" | "step";
export type AIVerbosity = "concise" | "detailed";

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
}

interface SettingsStore {
  noiseLevel: NoiseLevel;
  sweepSpeed: SweepSpeed;
  graphLineType: GraphLineType;
  aiVerbosity: AIVerbosity;
  profile: UserProfile;

  setNoiseLevel: (level: NoiseLevel) => void;
  setSweepSpeed: (speed: SweepSpeed) => void;
  setGraphLineType: (type: GraphLineType) => void;
  setAiVerbosity: (verbosity: AIVerbosity) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  getNoiseFraction: () => number;
  getSweepIntervalMs: () => number;
}

const STORAGE_KEY = "galileo_settings_v1";

function loadSavedSettings(): Partial<SettingsStore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Fallback
  }
  return {};
}

function persistSettings(data: Partial<SettingsStore>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // LocalStorage error fallback
  }
}

export const useSettingsStore = create<SettingsStore>((set, get) => {
  const saved = loadSavedSettings();

  return {
    noiseLevel: (saved.noiseLevel as NoiseLevel) || "realistic",
    sweepSpeed: (saved.sweepSpeed as SweepSpeed) || "standard",
    graphLineType: (saved.graphLineType as GraphLineType) || "monotone",
    aiVerbosity: (saved.aiVerbosity as AIVerbosity) || "concise",
    profile: saved.profile || {
      firstName: "Dr. Aris",
      lastName: "Thorne",
      email: "a.thorne@galileo-lab.io",
      department: "Quantitative Science & Simulation Labs",
    },

    setNoiseLevel: (noiseLevel) => {
      set({ noiseLevel });
      persistSettings({ ...get(), noiseLevel });
    },

    setSweepSpeed: (sweepSpeed) => {
      set({ sweepSpeed });
      persistSettings({ ...get(), sweepSpeed });
    },

    setGraphLineType: (graphLineType) => {
      set({ graphLineType });
      persistSettings({ ...get(), graphLineType });
    },

    setAiVerbosity: (aiVerbosity) => {
      set({ aiVerbosity });
      persistSettings({ ...get(), aiVerbosity });
    },

    updateProfile: (partialProfile) => {
      const updated = { ...get().profile, ...partialProfile };
      set({ profile: updated });
      persistSettings({ ...get(), profile: updated });
    },

    getNoiseFraction: () => {
      const level = get().noiseLevel;
      if (level === "ideal") return 0.0;
      if (level === "high") return 0.05;
      return 0.015; // standard realistic
    },

    getSweepIntervalMs: () => {
      const speed = get().sweepSpeed;
      if (speed === "fast") return 300;
      if (speed === "slow") return 1200;
      return 700; // standard
    },
  };
});
