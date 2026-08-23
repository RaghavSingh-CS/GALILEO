import type { ExperimentConfig } from "./types";
import type { SimulationEngine } from "./types";
import { ohmsLawConfig } from "./physics/ohms-law/config";
import { ohmsLawEngine } from "./physics/ohms-law/engine";
import { titrationConfig } from "./chemistry/titration-analysis/config";
import { titrationEngine } from "./chemistry/titration-analysis/engine";

export interface ExperimentEntry {
  config: ExperimentConfig;
  engine: SimulationEngine;
}

const experiments: Record<string, ExperimentEntry> = {
  "ohms-law": {
    config: ohmsLawConfig,
    engine: ohmsLawEngine,
  },
  "titration-analysis": {
    config: titrationConfig,
    engine: titrationEngine,
  },
};

export function getExperiment(id: string): ExperimentEntry | undefined {
  return experiments[id];
}

export function getAllExperiments(): ExperimentEntry[] {
  return Object.values(experiments);
}

export default experiments;
