// ─── Component Types ───────────────────────────────────
export type ComponentType =
  | 'battery'
  | 'resistor'
  | 'variable_resistor'
  | 'switch'
  | 'ammeter'
  | 'voltmeter';

// ─── Terminal ──────────────────────────────────────────
export interface Terminal {
  id: string;           // Format: "{componentId}:{role}"
  componentId: string;
  role: string;         // Semantic role, e.g., 'positive', 'negative', 'a', 'b'
}

// ─── Components ────────────────────────────────────────
// No BaseComponent with `position`. Engine types are position-free.

export interface BatteryComponent {
  id: string;
  type: 'battery';
  terminals: [Terminal, Terminal]; // [positive, negative]
  voltage: number;                // Volts
}

export interface ResistorComponent {
  id: string;
  type: 'resistor';
  terminals: [Terminal, Terminal]; // [a, b] — no polarity
  resistance: number;             // Ohms, must be > 0
}

export interface VariableResistorComponent {
  id: string;
  type: 'variable_resistor';
  terminals: [Terminal, Terminal];
  minResistance: number;
  maxResistance: number;
  currentResistance: number;      // Must be in [min, max]
}

export interface SwitchComponent {
  id: string;
  type: 'switch';
  terminals: [Terminal, Terminal];
  closed: boolean;
}

export interface AmmeterComponent {
  id: string;
  type: 'ammeter';
  terminals: [Terminal, Terminal]; // [in, out] — defines positive current direction
}

export interface VoltmeterComponent {
  id: string;
  type: 'voltmeter';
  terminals: [Terminal, Terminal]; // [positive, negative]
}

export type Component =
  | BatteryComponent
  | ResistorComponent
  | VariableResistorComponent
  | SwitchComponent
  | AmmeterComponent
  | VoltmeterComponent;

// ─── Wire ──────────────────────────────────────────────
export interface Wire {
  id: string;
  sourceTerminalId: string;
  targetTerminalId: string;
}

// ─── Circuit State (Engine Input) ──────────────────────
export interface CircuitState {
  components: Component[];
  wires: Wire[];
}

// ─── Electrical Graph ──────────────────────────────────
export interface ElectricalNode {
  id: string;
  terminalIds: string[];
  isGround: boolean;
}

export interface Branch {
  id: string;
  componentId: string;
  type: ComponentType;
  nodeA: string;  // ElectricalNode id (terminal[0]'s node)
  nodeB: string;  // ElectricalNode id (terminal[1]'s node)
  value: number;  // Resistance for resistors, voltage for batteries, 0 for ammeters
}

export interface ElectricalGraph {
  nodes: ElectricalNode[];
  branches: Branch[];
  groundNodeId: string;
}

// ─── Solver Output ─────────────────────────────────────
export interface MNAResult {
  nodeVoltages: Map<string, number>;  // nodeId → voltage
  sourceCurrents: Map<string, number>; // branchId → current (for voltage source branches)
}

// ─── Measurements ──────────────────────────────────────
export interface ComponentReading {
  componentId: string;
  type: 'ammeter' | 'voltmeter';
  value: number;
  unit: 'A' | 'V';
}

export interface BranchReading {
  componentId: string;
  type: ComponentType;
  voltage: number;
  current: number;
}

// ─── Validation ────────────────────────────────────────
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationMessage {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  componentIds: string[];
}

// ─── Simulation Result (Engine Output) ─────────────────
export interface SimulationResult {
  success: boolean;
  readings: ComponentReading[];
  branchData: BranchReading[];
  validation: ValidationMessage[];
}

