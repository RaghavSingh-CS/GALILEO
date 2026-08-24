/**
 * Physics Engine Public Facade
 * 
 * This is the sole integration point for the UI / Experiment layers.
 * 
 * Note on UI Integration (Architectural Contract):
 * The Physics Engine uses a graphical Modified Nodal Analysis (MNA) solver.
 * It CANNOT be consumed by the legacy `SimulationEngine` interface 
 * (`compute(inputs: Record<string, number>)`) defined in `src/experiments/types.ts`.
 * 
 * The UI/UX adapters (e.g. React Flow) must translate the visual nodes and edges 
 * into a `CircuitState`, invoke these pedagogical verifiers (or `solveCircuit`),
 * and map the `SimulationResult` back into the UI observation tables.
 */

// 1. Core State & Graph Contracts
export type {
  CircuitState,
  ElectricalNode,
  ElectricalGraph,
  Branch,
  Component,
  ComponentType,
  BatteryComponent,
  ResistorComponent,
  AmmeterComponent,
  VoltmeterComponent,
  SwitchComponent,
  Wire,
  Terminal
} from './circuits/types';

// 2. Core Simulation & Validation Contracts
export type {
  SimulationResult,
  ComponentReading,
  BranchReading,
  ValidationMessage,
  ValidationSeverity
} from './circuits/types';

export { solveCircuit } from './circuits/index';
export { validateIntegrity } from './circuits/integrity';

// 3. Pedagogical Experiment Verifiers (Mini-Engines)
export type {
  ExperimentUsability,
  OhmsLawIssueCode,
  OhmsLawResult,
  SeriesParallelIssueCode,
  SeriesParallelResult
} from './experiments/types';

export { verifyOhmsLawExperiment } from './experiments/ohms-law';
export { verifySeriesParallelExperiment } from './experiments/series-parallel';
