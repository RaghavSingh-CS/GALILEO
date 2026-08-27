import { create } from "zustand";
import type { Observation } from "@/experiments/types";
import type { Edge, Node } from "@xyflow/react";

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
  notes?: string;
  circuit?: { nodes: Node[]; edges: Edge[] };
}

interface HistoryStore {
  sessions: ConductedExperimentSession[];
  saveSession: (session: Omit<ConductedExperimentSession, "id" | "date">) => string;
  deleteSession: (id: string) => void;
  clearAll: () => void;
}

const STORAGE_KEY = "galileo_conducted_experiments_v1";

// Initial default sessions to show existing work
const DEFAULT_SESSIONS: ConductedExperimentSession[] = [];

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
