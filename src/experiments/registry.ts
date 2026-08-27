import type { ExperimentConfig } from "./types";
import type { SimulationEngine } from "./types";
import { ohmsLawConfig } from "./physics/ohms-law/config";
import { ohmsLawEngine } from "./physics/ohms-law/engine";
import { oxalicAcidConfig } from "./chemistry/oxalic-acid/config";
import { oxalicAcidEngine } from "./chemistry/oxalic-acid/engine";
import { mohrsSaltConfig } from "./chemistry/mohrs-salt/config";
import { mohrsSaltEngine } from "./chemistry/mohrs-salt/engine";
import { seriesParallelConfig } from "./physics/series-parallel/config";
import { seriesParallelEngine } from "./physics/series-parallel/engine";

export interface ExperimentEntry {
  config: ExperimentConfig;
  engine: SimulationEngine;
}

const experiments: Record<string, ExperimentEntry> = {
  "ohms-law": {
    config: ohmsLawConfig,
    engine: ohmsLawEngine,
  },
  "series-parallel": {
    config: seriesParallelConfig,
    engine: seriesParallelEngine,
  },
  "oxalic-acid-titration": {
    config: oxalicAcidConfig,
    engine: oxalicAcidEngine,
  },
  "mohrs-salt-titration": {
    config: mohrsSaltConfig,
    engine: mohrsSaltEngine,
  },
};

export function getExperiment(id: string): ExperimentEntry | undefined {
  return experiments[id];
}

export function getAllExperiments(): ExperimentEntry[] {
  return Object.values(experiments);
}

export default experiments;
