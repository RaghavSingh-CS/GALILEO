import { create } from "zustand";
import type { Observation } from "@/experiments/types";

export interface ConductedExperimentSession {
  id: string;
  experimentId: string;
  title: string;
  subject: "physics" | "chemistry" | "biology";
  date: string;
  apparatusValues: Record<string, number>;
  observations: Observation[];
  readingsCount: number;
  summaryResult: string;
}

interface HistoryStore {
  sessions: ConductedExperimentSession[];
  saveSession: (session: Omit<ConductedExperimentSession, "id" | "date">) => string;
  deleteSession: (id: string) => void;
  clearAll: () => void;
}

const STORAGE_KEY = "galileo_conducted_experiments_v1";

// Initial default sessions to show existing work
const DEFAULT_SESSIONS: ConductedExperimentSession[] = [
  {
    id: "run-ohm-01",
    experimentId: "ohms-law",
    title: "Ohm's Law Precision Resistance Calibration",
    subject: "physics",
    date: "Aug 23, 2026, 03:45 PM",
    apparatusValues: { voltage: 12.0, resistance: 100 },
    observations: [
      { id: 1, timestamp: 1724406300000, inputs: { voltage: 2.0, resistance: 100 }, outputs: { current: 19.85, power: 39.7 } },
      { id: 2, timestamp: 1724406310000, inputs: { voltage: 4.0, resistance: 100 }, outputs: { current: 40.21, power: 160.84 } },
      { id: 3, timestamp: 1724406320000, inputs: { voltage: 6.0, resistance: 100 }, outputs: { current: 59.90, power: 359.4 } },
      { id: 4, timestamp: 1724406330000, inputs: { voltage: 8.0, resistance: 100 }, outputs: { current: 80.12, power: 640.96 } },
      { id: 5, timestamp: 1724406340000, inputs: { voltage: 10.0, resistance: 100 }, outputs: { current: 99.78, power: 997.8 } },
      { id: 6, timestamp: 1724406350000, inputs: { voltage: 12.0, resistance: 100 }, outputs: { current: 120.34, power: 1444.08 } },
    ],
    readingsCount: 6,
    summaryResult: "Calculated Slope R: 99.8 Ω · Error: ±0.20%",
  },
  {
    id: "run-titr-01",
    experimentId: "titration-analysis",
    title: "Standard 0.1M HCl vs Unknown NaOH Neutralization",
    subject: "chemistry",
    date: "Aug 23, 2026, 04:12 PM",
    apparatusValues: { volumeAdded: 30.0, flowRate: 0.5, stirrerSpeed: 300, analyteVolume: 25.0 },
    observations: [
      { id: 1, timestamp: 1724407920000, inputs: { volumeAdded: 5.0, analyteVolume: 25.0 }, outputs: { ph: 12.82, volAdded: 5.0, totalVol: 30.0 } },
      { id: 2, timestamp: 1724407930000, inputs: { volumeAdded: 15.0, analyteVolume: 25.0 }, outputs: { ph: 12.39, volAdded: 15.0, totalVol: 40.0 } },
      { id: 3, timestamp: 1724407940000, inputs: { volumeAdded: 23.0, analyteVolume: 25.0 }, outputs: { ph: 11.61, volAdded: 23.0, totalVol: 48.0 } },
      { id: 4, timestamp: 1724407950000, inputs: { volumeAdded: 25.0, analyteVolume: 25.0 }, outputs: { ph: 7.02, volAdded: 25.0, totalVol: 50.0 } },
      { id: 5, timestamp: 1724407960000, inputs: { volumeAdded: 27.0, analyteVolume: 25.0 }, outputs: { ph: 2.41, volAdded: 27.0, totalVol: 52.0 } },
      { id: 6, timestamp: 1724407970000, inputs: { volumeAdded: 30.0, analyteVolume: 25.0 }, outputs: { ph: 1.95, volAdded: 30.0, totalVol: 55.0 } },
    ],
    readingsCount: 6,
    summaryResult: "Equivalence Point: 25.0 mL · Analyte Molarity: 0.100 M NaOH",
  },
];

function loadSavedSessions(): ConductedExperimentSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_SESSIONS;
}

function persistSessions(sessions: ConductedExperimentSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore storage issues
  }
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  sessions: loadSavedSessions(),

  saveSession: (sessionData) => {
    const newId = `run-${Date.now()}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const newSession: ConductedExperimentSession = {
      ...sessionData,
      id: newId,
      date: formattedDate,
    };

    // Prepend new run to history
    const updated = [newSession, ...get().sessions];
    set({ sessions: updated });
    persistSessions(updated);
    return newId;
  },

  deleteSession: (id) => {
    const updated = get().sessions.filter((s) => s.id !== id);
    set({ sessions: updated });
    persistSessions(updated);
  },

  clearAll: () => {
    set({ sessions: [] });
    persistSessions([]);
  },
}));
