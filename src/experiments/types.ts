export interface ApparatusParam {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface ExperimentConfig {
  id: string;
  title: string;
  subject: "physics" | "chemistry";
  description: string;
  aim: string;
  apparatus: ApparatusParam[];
  procedure: string[];
}

export interface SimulationResult {
  [key: string]: number;
}

export interface Observation {
  id: number;
  timestamp: number;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
}

export interface SimulationEngine {
  /**
   * Run the simulation with the given apparatus values.
   * Must be deterministic given the same inputs (noise seed optional).
   */
  compute(inputs: Record<string, number>, options?: { noiseFraction?: number }): SimulationResult;

  /**
   * Column definitions for the observations table.
   */
  outputColumns: { key: string; label: string; unit: string }[];
}
