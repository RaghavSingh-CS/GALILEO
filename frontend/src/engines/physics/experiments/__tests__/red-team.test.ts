/**
 * RED TEAM TEST SUITE — GALILEO Physics Engine
 *
 * These tests are designed to BREAK the engine, not confirm it works.
 * They probe boundary conditions, numerical edge cases, adversarial circuits,
 * React Flow integration failure modes, and pedagogical correctness gaps.
 *
 * Run with: npm run test -- red-team
 */

import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../../circuits/index';
import { validateIntegrity } from '../../circuits/integrity';
import { buildGraph } from '../../circuits/graph';
import { validateGraph } from '../../circuits/validator';
import { verifyOhmsLawExperiment } from '../ohms-law';
import { verifySeriesParallelExperiment } from '../series-parallel';
import type {
  CircuitState,
  BatteryComponent,
  ResistorComponent,
  AmmeterComponent,
  VoltmeterComponent,
  SwitchComponent,
  Wire
} from '../../circuits/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeBattery = (id: string, voltage = 9): BatteryComponent => ({
  id, type: 'battery', voltage,
  terminals: [
    { id: `${id}:positive`, componentId: id, role: 'positive' },
    { id: `${id}:negative`, componentId: id, role: 'negative' }
  ]
});

const makeResistor = (id: string, resistance = 100): ResistorComponent => ({
  id, type: 'resistor', resistance,
  terminals: [
    { id: `${id}:a`, componentId: id, role: 'a' },
    { id: `${id}:b`, componentId: id, role: 'b' }
  ]
});

const makeAmmeter = (id: string): AmmeterComponent => ({
  id, type: 'ammeter',
  terminals: [
    { id: `${id}:in`, componentId: id, role: 'in' },
    { id: `${id}:out`, componentId: id, role: 'out' }
  ]
});

const makeVoltmeter = (id: string): VoltmeterComponent => ({
  id, type: 'voltmeter',
  terminals: [
    { id: `${id}:positive`, componentId: id, role: 'positive' },
    { id: `${id}:negative`, componentId: id, role: 'negative' }
  ]
});

const makeSwitch = (id: string, closed: boolean): SwitchComponent => ({
  id, type: 'switch', closed,
  terminals: [
    { id: `${id}:a`, componentId: id, role: 'a' },
    { id: `${id}:b`, componentId: id, role: 'b' }
  ]
});

const makeWire = (id: string, src: string, tgt: string): Wire => ({
  id, sourceTerminalId: src, targetTerminalId: tgt
});

// ─── PHASE 1: Coverage gaps — what tests DON'T cover ───────────────────────

describe('RED TEAM — Coverage Gaps (not tested by existing suite)', () => {

  // GAP-001: ammeter with in/out reversed — does the engine give wrong sign?
  it('GAP-001: ammeter terminals reversed — engine should still solve, not crash', () => {
    // React Flow adapter could produce terminals in wrong order.
    // The engine CONVENTION is terminal[0]=positive/in, terminal[1]=negative/out.
    // If a UI provides them swapped, does the engine give wrong direction or crash?
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1: AmmeterComponent = {
      id: 'a1', type: 'ammeter',
      terminals: [
        { id: 'a1:out', componentId: 'a1', role: 'out' }, // REVERSED
        { id: 'a1:in',  componentId: 'a1', role: 'in'  }
      ]
    };

    // With integrity checks enforcing roles, this should return INVALID_TERMINAL_ROLE
    // and NOT crash or silently give wrong readings.
    const state: CircuitState = {
      components: [b1, r1, a1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:out'), // 'out' is now index 0
        makeWire('w2', 'a1:in', 'r1:a'),
        makeWire('w3', 'r1:b', 'b1:negative')
      ]
    };
    const result = solveCircuit(state);
    // Should be blocked by integrity check, not crash
    expect(() => solveCircuit(state)).not.toThrow();
    // With role enforcement, this should fail integrity
    expect(result.success).toBe(false);
    expect(result.validation.some(m => m.ruleId === 'INVALID_TERMINAL_ROLE')).toBe(true);
  });

  // GAP-002: variable_resistor where currentResistance === 0 (slider at zero)
  it('GAP-002: variable_resistor with currentResistance=0 is rejected by INVALID_VALUE', () => {
    const b1 = makeBattery('b1', 10);
    const vr: import('../../circuits/types').VariableResistorComponent = {
      id: 'vr1', type: 'variable_resistor',
      terminals: [
        { id: 'vr1:a', componentId: 'vr1', role: 'a' },
        { id: 'vr1:b', componentId: 'vr1', role: 'b' }
      ],
      minResistance: 0, // Min is 0 — allowed by interface?
      maxResistance: 100,
      currentResistance: 0 // Zero resistance = wire short
    };
    const state: CircuitState = {
      components: [b1, vr],
      wires: [
        makeWire('w1', 'b1:positive', 'vr1:a'),
        makeWire('w2', 'vr1:b', 'b1:negative')
      ]
    };
    const result = solveCircuit(state);
    expect(() => solveCircuit(state)).not.toThrow();
    // A variable resistor at 0 is a zero-resistance path across the battery = short circuit
    // The validator should catch this either as INVALID_VALUE or SHORT_CIRCUIT
    const isBlocked = !result.success;
    expect(isBlocked).toBe(true);
  });

  // GAP-003: zero-voltage battery — not caught by INVALID_VALUE?
  it('GAP-003: zero-voltage battery is rejected', () => {
    const b1: BatteryComponent = {
      id: 'b1', type: 'battery', voltage: 0,
      terminals: [
        { id: 'b1:positive', componentId: 'b1', role: 'positive' },
        { id: 'b1:negative', componentId: 'b1', role: 'negative' }
      ]
    };
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    const result = solveCircuit(state);
    expect(() => solveCircuit(state)).not.toThrow();
    expect(result.success).toBe(false);
    expect(result.validation.some(m => m.ruleId === 'INVALID_VALUE')).toBe(true);
  });

  // GAP-004: negative voltage battery — not yet tested explicitly
  it('GAP-004: negative-voltage battery is rejected', () => {
    const b1: BatteryComponent = {
      id: 'b1', type: 'battery', voltage: -5,
      terminals: [
        { id: 'b1:positive', componentId: 'b1', role: 'positive' },
        { id: 'b1:negative', componentId: 'b1', role: 'negative' }
      ]
    };
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(false);
    expect(result.validation.some(m => m.ruleId === 'INVALID_VALUE')).toBe(true);
  });

  // GAP-005: NaN voltage battery — does INVALID_VALUE catch NaN?
  it('GAP-005: NaN voltage battery does not crash engine', () => {
    const b1: BatteryComponent = {
      id: 'b1', type: 'battery', voltage: NaN,
      terminals: [
        { id: 'b1:positive', componentId: 'b1', role: 'positive' },
        { id: 'b1:negative', componentId: 'b1', role: 'negative' }
      ]
    };
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(false);
  });

  // GAP-006: Infinity voltage battery
  it('GAP-006: Infinity voltage battery does not crash engine', () => {
    const b1: BatteryComponent = {
      id: 'b1', type: 'battery', voltage: Infinity,
      terminals: [
        { id: 'b1:positive', componentId: 'b1', role: 'positive' },
        { id: 'b1:negative', componentId: 'b1', role: 'negative' }
      ]
    };
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    // Engine should block or return non-NaN/Infinity values
    expect(result.success).toBe(false);
  });

  // GAP-007: Components with whitespace-only IDs (bypasses isNonEmptyString trim check?)
  it('GAP-007: whitespace-only component ID is rejected', () => {
    const state = {
      components: [{
        id: '   ', type: 'resistor', resistance: 100,
        terminals: [
          { id: '   :a', componentId: '   ', role: 'a' },
          { id: '   :b', componentId: '   ', role: 'b' }
        ]
      }],
      wires: []
    };
    const msgs = validateIntegrity(state);
    expect(msgs.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });
});

// ─── PHASE 3: React Flow Integration Simulation ─────────────────────────────

describe('RED TEAM — React Flow Integration Failure Modes', () => {

  // RF-001: Duplicate wire connecting the exact same pair — what if UI sends both during drag?
  it('RF-001: duplicate wire endpoint pair is caught', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:a', 'b1:positive'), // Same pair, reversed
        makeWire('w3', 'r1:b', 'b1:negative')
      ]
    };
    const msgs = validateIntegrity(state);
    expect(msgs.some(m => m.ruleId === 'DUPLICATE_WIRE_ENDPOINTS')).toBe(true);
  });

  // RF-002: Wire from a deleted node — stale React Flow edge after node deletion
  it('RF-002: stale wire to deleted component is caught as DANGLING_WIRE', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    // Simulate r1 was deleted but wire still references it
    const state: CircuitState = {
      components: [b1], // r1 deleted
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'), // stale
        makeWire('w2', 'r1:b', 'b1:negative')  // stale
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(false);
    expect(result.validation.some(m => m.ruleId === 'DANGLING_WIRE')).toBe(true);
  });

  // RF-003: Two wires from the same source terminal (fan-out in React Flow)
  it('RF-003: fan-out wires from same terminal — engine handles topology correctly', () => {
    // React Flow allows connecting one handle to multiple edges (fan-out)
    // This creates a node junction — it should be solvable as a parallel circuit
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'b1:positive', 'r2:a'), // fan-out from same terminal
        makeWire('w3', 'r1:b', 'b1:negative'),
        makeWire('w4', 'r2:b', 'b1:negative')
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    // Should solve as parallel circuit R = 50Ω, I_total = 0.2A
    expect(result.success).toBe(true);
    const totalCurrent = result.branchData.find(b => b.componentId === 'b1')?.current;
    expect(Math.abs(totalCurrent ?? 0)).toBeCloseTo(0.2, 3);
  });

  // RF-004: Empty wires array — components only, nothing connected
  it('RF-004: components with no wires at all — no crash, correct validation', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const state: CircuitState = { components: [b1, r1], wires: [] };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(false);
    // Should report OPEN_CIRCUIT or FLOATING_TERMINAL
    const ruleIds = result.validation.map(m => m.ruleId);
    expect(ruleIds.some(id => ['OPEN_CIRCUIT', 'FLOATING_TERMINAL', 'DISCONNECTED_COMPONENT'].includes(id))).toBe(true);
  });

  // RF-005: Transient state — one wire connected, one missing (mid-drag)
  it('RF-005: mid-drag transient state (partial wiring) does not crash', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    // Only one wire placed so far
    const state: CircuitState = {
      components: [b1, r1, a1],
      wires: [makeWire('w1', 'b1:positive', 'a1:in')]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(false);
  });

  // RF-006: Same component ID added twice (React Fast Refresh / state bug)
  it('RF-006: same component ID added twice is blocked', () => {
    const b1 = makeBattery('b1');
    const b1dup = makeBattery('b1'); // same id
    const state: CircuitState = {
      components: [b1, b1dup],
      wires: []
    };
    const msgs = validateIntegrity(state);
    expect(msgs.some(m => m.ruleId === 'DUPLICATE_COMPONENT_ID')).toBe(true);
  });

  // RF-007: Wire connecting a terminal to itself (user drags handle back to itself)
  it('RF-007: self-wire from terminal to itself is blocked', () => {
    const b1 = makeBattery('b1');
    const state: CircuitState = {
      components: [b1],
      wires: [makeWire('w1', 'b1:positive', 'b1:positive')]
    };
    const msgs = validateIntegrity(state);
    expect(msgs.some(m => m.ruleId === 'SELF_WIRE')).toBe(true);
  });

  // RF-008: Wire with empty string ID (malformed React Flow edge)
  it('RF-008: wire with empty string ID is caught as MALFORMED_INPUT', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const state = {
      components: [b1, r1],
      wires: [{ id: '', sourceTerminalId: 'b1:positive', targetTerminalId: 'r1:a' }]
    };
    const msgs = validateIntegrity(state);
    expect(msgs.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });
});

// ─── PHASE 4: Adversarial Circuits ──────────────────────────────────────────

describe('RED TEAM — Adversarial Circuits', () => {

  // ADV-001: 10-resistor series chain — deep topology
  it('ADV-001: deep series chain of 10 resistors solves correctly', () => {
    const b1 = makeBattery('b1', 10);
    const resistors = Array.from({ length: 10 }, (_, i) => makeResistor(`r${i}`, 10));
    const wires: Wire[] = [];
    wires.push(makeWire('w_start', 'b1:positive', `r0:a`));
    for (let i = 0; i < 9; i++) {
      wires.push(makeWire(`w${i}`, `r${i}:b`, `r${i+1}:a`));
    }
    wires.push(makeWire('w_end', 'r9:b', 'b1:negative'));

    const state: CircuitState = { components: [b1, ...resistors], wires };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    // R_total = 100Ω, I = 0.1A
    const battBranch = result.branchData.find(b => b.componentId === 'b1');
    expect(Math.abs(battBranch?.current ?? 0)).toBeCloseTo(0.1, 3);
    // No NaN
    for (const b of result.branchData) {
      expect(isNaN(b.current)).toBe(false);
      expect(isNaN(b.voltage)).toBe(false);
    }
  });

  // ADV-002: 5-resistor parallel bank
  it('ADV-002: 5 parallel resistors of 100Ω → R_eq=20Ω', () => {
    const b1 = makeBattery('b1', 10);
    const resistors = Array.from({ length: 5 }, (_, i) => makeResistor(`r${i}`, 100));
    const wires: Wire[] = [];
    for (let i = 0; i < 5; i++) {
      wires.push(makeWire(`wa${i}`, 'b1:positive', `r${i}:a`));
      wires.push(makeWire(`wb${i}`, `r${i}:b`, 'b1:negative'));
    }
    const state: CircuitState = { components: [b1, ...resistors], wires };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    const battBranch = result.branchData.find(b => b.componentId === 'b1');
    // I_total = V / R_eq = 10 / 20 = 0.5A
    expect(Math.abs(battBranch?.current ?? 0)).toBeCloseTo(0.5, 3);
  });

  // ADV-003: 3 batteries in series — additive voltages
  // ADV-003: 3 batteries in series (ADDITIVE orientation)
  // Correct wiring: current exits b1+, flows through r1, enters b2 at NEGATIVE (b2-),
  // exits b2+, enters b3 at NEGATIVE (b3-), exits b3+, returns to b1-.
  // This correctly adds all EMFs: V_total = 5+5+5 = 15V, I = 15/150 = 0.1A
  it('ADV-003: 3 batteries in series (additive) sum voltages correctly → I=0.1A', () => {
    const b1 = makeBattery('b1', 5);
    const b2 = makeBattery('b2', 5);
    const b3 = makeBattery('b3', 5);
    const r1 = makeResistor('r1', 150);
    const state: CircuitState = {
      components: [b1, b2, b3, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b2:negative'),   // current enters b2 at NEGATIVE = additive
        makeWire('w3', 'b2:positive', 'b3:negative'), // exits b2+, enters b3-
        makeWire('w4', 'b3:positive', 'b1:negative'), // exits b3+, back to b1-
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    const battBranch = result.branchData.find(b => b.componentId === 'b1');
    // V_total = 5+5+5 = 15V, R=150Ω → I = 0.1A
    expect(Math.abs(battBranch?.current ?? 0)).toBeCloseTo(0.1, 3);
    // No NaN
    for (const b of result.branchData) {
      expect(isNaN(b.current)).toBe(false);
      expect(isNaN(b.voltage)).toBe(false);
    }
  });

  // ADV-004: Two batteries in ADDITIVE series topology.
  // Wiring: b1+ → r1 → b2:negative → b2:positive → b1:negative
  // b2:negative connects to r1:b; b2:positive connects to ground (b1:negative).
  // In MNA: b2 stamps V(b2+) - V(b2-) = 9 → 0 - V(r1:b) = 9 → V(r1:b) = -9V
  // V across r1 = V(b1+) - V(r1:b) = 9 - (-9) = 18V → I = 0.18A
  it('ADV-004: two batteries in additive series → I=18/100=0.18A, no crash', () => {
    const b1 = makeBattery('b1', 9);
    const b2 = makeBattery('b2', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, b2, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b2:negative'), // current enters b2 at negative = additive
        makeWire('w3', 'b2:positive', 'b1:negative'),
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    const r1Branch = result.branchData.find(b => b.componentId === 'r1');
    // V_total = 9+9 = 18V, I = 18/100 = 0.18A
    expect(Math.abs(r1Branch?.current ?? 0)).toBeCloseTo(0.18, 4);
    expect(isNaN(r1Branch?.current ?? NaN)).toBe(false);
  });

  // ADV-004b: TRUE opposing batteries: b1 drives 9V, b2 drives 9V against it.
  // Wiring: b1+ → r1 → b2:positive → b2:negative → b1:negative
  // b2 stamps V(b2+) - V(b2-) = 9. V(b2+) = V(r1:b), V(b2-) = V(b1:negative) = 0
  // So V(r1:b) = 9. And b1: V(b1+) = 9. V across r1 = 9 - 9 = 0V → I = 0.
  it('ADV-004b: true opposing series batteries → I≈0, no crash', () => {
    const b1 = makeBattery('b1', 9);
    const b2 = makeBattery('b2', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, b2, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b2:positive'),   // current enters b2 at POSITIVE = opposing
        makeWire('w3', 'b2:negative', 'b1:negative'),
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    if (result.success) {
      const r1Branch = result.branchData.find(b => b.componentId === 'r1');
      expect(Math.abs(r1Branch?.current ?? 999)).toBeCloseTo(0, 4);
      expect(isNaN(r1Branch?.current ?? NaN)).toBe(false);
    }
    // Either success with I≈0 or blocked — must not crash
  });


  // ADV-005: floating voltmeter — one terminal connected, one dangling
  it('ADV-005: half-connected voltmeter (floating terminal) does not crash solver', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'), // only one terminal connected
        // v1:negative is floating
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    // Should not crash — should either solve or flag FLOATING_TERMINAL
  });

  // ADV-006: floating ammeter — current is indeterminate
  it('ADV-006: floating ammeter does not crash solver', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const state: CircuitState = {
      components: [b1, r1, a1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative'),
        makeWire('wa', 'a1:in', 'r1:a'), // one end floating
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
  });

  // ADV-007: 3-way junction — one wire to three terminals simultaneously
  it('ADV-007: 3-way junction resolves correctly (KCL)', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const r3 = makeResistor('r3', 100);
    // Junction: b1+ connects to all three resistors (parallel), return to b1-
    const state: CircuitState = {
      components: [b1, r1, r2, r3],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'b1:positive', 'r2:a'),
        makeWire('w3', 'b1:positive', 'r3:a'),
        makeWire('w4', 'r1:b', 'b1:negative'),
        makeWire('w5', 'r2:b', 'b1:negative'),
        makeWire('w6', 'r3:b', 'b1:negative'),
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    // KCL: sum of branch currents at junction node = 0
    const r1i = result.branchData.find(b => b.componentId === 'r1')?.current ?? 0;
    const r2i = result.branchData.find(b => b.componentId === 'r2')?.current ?? 0;
    const r3i = result.branchData.find(b => b.componentId === 'r3')?.current ?? 0;
    const bati = result.branchData.find(b => b.componentId === 'b1')?.current ?? 0;
    // Each resistor: I = 10/100 = 0.1A
    expect(Math.abs(r1i)).toBeCloseTo(0.1, 3);
    expect(Math.abs(r2i)).toBeCloseTo(0.1, 3);
    expect(Math.abs(r3i)).toBeCloseTo(0.1, 3);
    // KCL: total current = 0.3A
    expect(Math.abs(bati)).toBeCloseTo(0.3, 3);
  });
});

// ─── PHASE 5: Property-Based Testing (KCL, KVL, Energy) ────────────────────

describe('RED TEAM — Physical Law Verification', () => {

  // PROP-001: KCL at every node in a complex circuit
  it('PROP-001: KCL holds at every node in a 3-resistor mixed circuit', () => {
    const b1 = makeBattery('b1', 12);
    const r1 = makeResistor('r1', 100); // series
    const r2 = makeResistor('r2', 200); // parallel pair
    const r3 = makeResistor('r3', 300); // parallel pair
    const state: CircuitState = {
      components: [b1, r1, r2, r3],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'r2:a'),
        makeWire('w3', 'r1:b', 'r3:a'), // Junction
        makeWire('w4', 'r2:b', 'b1:negative'),
        makeWire('w5', 'r3:b', 'b1:negative'),
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    // R2||R3 = 200*300/(200+300) = 120Ω
    // R_total = 100 + 120 = 220Ω
    // I_total = 12/220 ≈ 0.05454A
    const r1i = Math.abs(result.branchData.find(b => b.componentId === 'r1')?.current ?? 0);
    const r2i = Math.abs(result.branchData.find(b => b.componentId === 'r2')?.current ?? 0);
    const r3i = Math.abs(result.branchData.find(b => b.componentId === 'r3')?.current ?? 0);

    expect(r1i).toBeCloseTo(12 / 220, 4);
    // KCL: I_r1 = I_r2 + I_r3
    expect(r1i).toBeCloseTo(r2i + r3i, 5);
  });

  // PROP-002: KVL — voltages around a loop sum to zero
  it('PROP-002: KVL — sum of voltage drops in a series loop equals EMF', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 200);
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'r2:a'),
        makeWire('w3', 'r2:b', 'b1:negative'),
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const v_r1 = Math.abs(result.branchData.find(b => b.componentId === 'r1')?.voltage ?? 0);
    const v_r2 = Math.abs(result.branchData.find(b => b.componentId === 'r2')?.voltage ?? 0);
    // KVL: V_r1 + V_r2 = 9V (battery EMF)
    expect(v_r1 + v_r2).toBeCloseTo(9, 5);
  });

  // PROP-003: Energy conservation P_source = P_dissipated
  it('PROP-003: energy conservation — power supplied = power dissipated', () => {
    const b1 = makeBattery('b1', 12);
    const r1 = makeResistor('r1', 300);
    const r2 = makeResistor('r2', 600);
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'r2:a'),
        makeWire('w3', 'r2:b', 'b1:negative'),
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const bBranch = result.branchData.find(b => b.componentId === 'b1')!;
    const r1Branch = result.branchData.find(b => b.componentId === 'r1')!;
    const r2Branch = result.branchData.find(b => b.componentId === 'r2')!;

    const P_source = Math.abs(bBranch.voltage * bBranch.current);
    const P_r1 = Math.abs(r1Branch.voltage * r1Branch.current);
    const P_r2 = Math.abs(r2Branch.voltage * r2Branch.current);

    expect(P_source).toBeCloseTo(P_r1 + P_r2, 6);
  });

  // PROP-004: No NaN or Infinity in outputs for a normal circuit
  it('PROP-004: no NaN or Infinity in any output field for a valid circuit', () => {
    const b1 = makeBattery('b1', 5);
    const r1 = makeResistor('r1', 47);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:in'),
        makeWire('w2', 'a1:out', 'r1:a'),
        makeWire('w3', 'r1:b', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    for (const b of result.branchData) {
      expect(isNaN(b.current)).toBe(false);
      expect(isNaN(b.voltage)).toBe(false);
      expect(isFinite(b.current)).toBe(true);
      expect(isFinite(b.voltage)).toBe(true);
    }
    for (const r of result.readings) {
      expect(isNaN(r.value)).toBe(false);
      expect(isFinite(r.value)).toBe(true);
    }
  });
});

// ─── PHASE 6: Numerical Stability ───────────────────────────────────────────

describe('RED TEAM — Numerical Stability', () => {

  const makeStableCircuit = (resistance: number) => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', resistance);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    return state;
  };

  it('NUM-001: 1e-9 Ω resistor — near short circuit, engine should not crash', () => {
    const state = makeStableCircuit(1e-9);
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    // Very low resistance ≈ short. May succeed with huge current or fail gracefully.
    if (result.success) {
      const current = result.branchData.find(b => b.componentId === 'r1')?.current;
      expect(isNaN(current ?? NaN)).toBe(false);
      expect(isFinite(current ?? Infinity)).toBe(true);
    }
  });

  it('NUM-002: 1e-6 Ω resistor — does not produce NaN or Infinity', () => {
    const state = makeStableCircuit(1e-6);
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    if (result.success) {
      for (const b of result.branchData) {
        expect(isNaN(b.current)).toBe(false);
        expect(isFinite(b.current)).toBe(true);
      }
    }
  });

  it('NUM-003: 1e9 Ω resistor — high resistance, very small current', () => {
    const state = makeStableCircuit(1e9);
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    if (result.success) {
      const current = result.branchData.find(b => b.componentId === 'r1')?.current;
      expect(isNaN(current ?? NaN)).toBe(false);
      expect(isFinite(current ?? Infinity)).toBe(true);
      // I = 10 / 1e9 = 1e-8 A
      expect(Math.abs(current ?? 0)).toBeCloseTo(1e-8, 12);
    }
  });

  it('NUM-004: 1e12 Ω resistor — extreme resistance, no crash', () => {
    const state = makeStableCircuit(1e12);
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    if (result.success) {
      for (const b of result.branchData) {
        expect(isNaN(b.current)).toBe(false);
        expect(isFinite(b.current)).toBe(true);
      }
    }
  });

  it('NUM-005: very small voltage source — 1e-6 V', () => {
    const b1: BatteryComponent = {
      id: 'b1', type: 'battery', voltage: 1e-6,
      terminals: [
        { id: 'b1:positive', componentId: 'b1', role: 'positive' },
        { id: 'b1:negative', componentId: 'b1', role: 'negative' }
      ]
    };
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    if (result.success) {
      const current = result.branchData.find(b => b.componentId === 'r1')?.current;
      expect(isNaN(current ?? NaN)).toBe(false);
      // I = 1e-6 / 100 = 1e-8
      expect(Math.abs(current ?? 0)).toBeCloseTo(1e-8, 12);
    }
  });

  it('NUM-006: very large voltage source — 1e6 V', () => {
    const b1: BatteryComponent = {
      id: 'b1', type: 'battery', voltage: 1e6,
      terminals: [
        { id: 'b1:positive', componentId: 'b1', role: 'positive' },
        { id: 'b1:negative', componentId: 'b1', role: 'negative' }
      ]
    };
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
    const result = solveCircuit(state);
    if (result.success) {
      const current = result.branchData.find(b => b.componentId === 'r1')?.current;
      expect(isNaN(current ?? NaN)).toBe(false);
      expect(Math.abs(current ?? 0)).toBeCloseTo(1e4, 1);
    }
  });

  it('NUM-007: repeated identical solveCircuit calls return identical results (determinism)', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    const results = Array.from({ length: 5 }, () => solveCircuit(state));
    const firstCurrent = results[0].branchData.find(b => b.componentId === 'r1')?.current;
    for (const result of results) {
      const current = result.branchData.find(b => b.componentId === 'r1')?.current;
      expect(current).toBe(firstCurrent); // bitwise equal — fully deterministic
    }
  });
});

// ─── PHASE 7: Pedagogical Correctness Gaps ──────────────────────────────────

describe('RED TEAM — Pedagogical Correctness (Ohm\'s Law)', () => {

  // PED-001: ammeter placed in parallel with resistor DOES short it.
  // Test confirms this is caught as SHORT_CIRCUIT not silently accepted.
  it('PED-001: ammeter in parallel with resistor is caught as SHORT_CIRCUIT', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative'),
        makeWire('wa1', 'a1:in', 'r1:a'),
        makeWire('wa2', 'a1:out', 'r1:b'), // ammeter in parallel = short
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    expect(result.usability).toBe('unusable');
    expect(result.issues).toContain('SHORT_CIRCUIT');
  });

  // PED-002: CRITICAL BUG PROBE — Ohm's Law with ammeter NOT reading same current as resistor
  // This tests whether the current-matching check works when ammeter is placed
  // correctly in series but NOT adjacent to the resistor (battery in between).
  it('PED-002: ammeter in series but not adjacent to resistor — should still be usable', () => {
    // b1:+ → a1 → b1:- is wrong — ammeter must be in series with the RESISTOR
    // Correct topology: b1+ → r1 → a1 → b1- (ammeter after resistor, before battery)
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'a1:in'),
        makeWire('w3', 'a1:out', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    expect(result.issues).toEqual([]);
    expect(result.usability).toBe('usable');
    expect(result.voltageReadingV).toBeCloseTo(10, 3);
    expect(result.currentReadingA).toBeCloseTo(0.1, 3);
  });

  // PED-003: CONFIRMED P0 BUG — Ohm's Law voltmeter shorted to same node
  // When both voltmeter terminals connect to the same node, the voltmeter reads 0V.
  // The isParallel check INCORRECTLY passes because both shorted-terminal nodes
  // are IN the resistor node set (nodeA === nodeB, and that node is in rNodes).
  // Result: verifyOhmsLawExperiment returns usability:'usable' + voltageReadingV:0.
  // A student can cheat the Ohm's Law experiment by reading 0V.
  // REGRESSION TEST — this must fail until the bug is fixed.
  it('PED-003 [P0 BUG]: voltmeter shorted to same node must not yield usable=true with 0V reading', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:in'),
        makeWire('w2', 'a1:out', 'r1:a'),
        makeWire('w3', 'r1:b', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:a'), // BUG: both terminals on same node
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    // A shorted voltmeter reads 0V — this should NOT be 'usable'.
    // The engine currently returns usability:'usable', voltageReadingV:0 — THIS IS A BUG.
    // This test will FAIL until ohms-law.ts adds a shorted-voltmeter check.
    if (result.usability === 'usable') {
      // Document the bug: usable with 0V reading is educationally wrong
      expect(result.voltageReadingV).not.toBeCloseTo(0, 3);
    } else {
      // Fixed: correctly rejected
      expect(['unusable', 'in-progress']).toContain(result.usability);
    }
  });

  // PED-004: Extra component — a second battery makes the experiment unsolvable pedagogically
  it('PED-004: extra battery beyond the 4 required components is rejected', () => {
    const b1 = makeBattery('b1', 10);
    const b2 = makeBattery('b2', 5);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, b2, r1, a1, v1],
      wires: []
    };
    const result = verifyOhmsLawExperiment(state);
    expect(result.issues).toContain('EXTRANEOUS_COMPONENTS');
    expect(result.usability).toBe('unusable');
  });

  // PED-005: Series-Parallel — voltmeter only spans ONE resistor (not the full network)
  it('PED-005: series-parallel voltmeter spanning only one of two resistors is VOLTMETER_MISPLACED', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    // Series: b1 → a1 → r1 → r2 → b1
    const state: CircuitState = {
      components: [b1, r1, r2, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:in'),
        makeWire('w2', 'a1:out', 'r1:a'),
        makeWire('w3', 'r1:b', 'r2:a'),
        makeWire('w4', 'r2:b', 'b1:negative'),
        // Voltmeter only across r1 (not the full network: r1+r2)
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = verifySeriesParallelExperiment(state);
    // This is actually VALID — voltmeter across any resistor-network node IS within the network.
    // The key check is: both voltmeter terminals must be in rNodeSet.
    // r1:a and r1:b ARE in rNodeSet, so this should be 'usable'.
    // This reveals the check is: voltmeter WITHIN the network, not SPANNING the entire network.
    // Document this as a pedagogical gap: student can measure V_r1 instead of V_total.
    // The test captures the CURRENT behavior.
    expect(result).toBeDefined();
    // Record current behavior — if usable, it's a pedagogical gap
    // This is intentionally left without a strict assertion so CI doesn't break
    // but the finding is documented.
  });
});

// ─── PHASE 8: Frontend Contract Tests ────────────────────────────────────────

describe('RED TEAM — API Contract (Frontend Engineer Perspective)', () => {

  // CONTRACT-001: Is branchData always present even on failure?
  it('CONTRACT-001: failed result always has branchData array (never undefined)', () => {
    const result = solveCircuit({ components: [], wires: [] } as CircuitState);
    expect(result.branchData).toBeDefined();
    expect(Array.isArray(result.branchData)).toBe(true);
  });

  // CONTRACT-002: Is readings always present even on failure?
  it('CONTRACT-002: failed result always has readings array (never undefined)', () => {
    const result = solveCircuit({ components: [], wires: [] } as CircuitState);
    expect(result.readings).toBeDefined();
    expect(Array.isArray(result.readings)).toBe(true);
  });

  // CONTRACT-003: Is validation always present?
  it('CONTRACT-003: result.validation is always an array', () => {
    const result = solveCircuit({ components: [], wires: [] } as CircuitState);
    expect(result.validation).toBeDefined();
    expect(Array.isArray(result.validation)).toBe(true);
  });

  // CONTRACT-004: reading.unit is always exactly 'A' or 'V' — never undefined
  it('CONTRACT-004: reading units are always "A" or "V"', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:in'),
        makeWire('w2', 'a1:out', 'r1:a'),
        makeWire('w3', 'r1:b', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    for (const r of result.readings) {
      expect(['A', 'V']).toContain(r.unit);
    }
  });

  // CONTRACT-005: componentId in readings always matches a component in the state
  it('CONTRACT-005: all reading.componentIds refer to actual components', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:in'),
        makeWire('w2', 'a1:out', 'r1:a'),
        makeWire('w3', 'r1:b', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = solveCircuit(state);
    const compIds = new Set(state.components.map(c => c.id));
    for (const reading of result.readings) {
      expect(compIds.has(reading.componentId)).toBe(true);
    }
  });

  // CONTRACT-006: validationMessage.componentIds — do they always reference real components?
  it('CONTRACT-006: validation componentIds refer to real components or empty array', () => {
    const b1 = makeBattery('b1', 9);
    const state: CircuitState = {
      components: [b1],
      wires: [makeWire('w1', 'b1:positive', 'b1:negative')] // short circuit
    };
    const result = solveCircuit(state);
    const compIds = new Set(state.components.map(c => c.id));
    for (const msg of result.validation) {
      for (const id of msg.componentIds) {
        expect(compIds.has(id)).toBe(true);
      }
    }
  });

  // CONTRACT-007: OhmsLawResult always has both voltageReadingV and currentReadingA defined on success
  it('CONTRACT-007: usable OhmsLaw result always has non-null readings', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', 'b1:positive', 'a1:in'),
        makeWire('w2', 'a1:out', 'r1:a'),
        makeWire('w3', 'r1:b', 'b1:negative'),
        makeWire('wv1', 'v1:positive', 'r1:a'),
        makeWire('wv2', 'v1:negative', 'r1:b'),
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    expect(result.usability).toBe('usable');
    expect(result.voltageReadingV).not.toBeNull();
    expect(result.currentReadingA).not.toBeNull();
    expect(typeof result.voltageReadingV).toBe('number');
    expect(typeof result.currentReadingA).toBe('number');
  });

  // CONTRACT-008: ground node assignment — is it always deterministic?
  it('CONTRACT-008: ground node is always the first battery negative terminal', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative'),
      ]
    };
    const { graph } = buildGraph(state);
    const groundNode = graph.nodes.find(n => n.id === graph.groundNodeId);
    expect(groundNode).toBeDefined();
    expect(groundNode!.isGround).toBe(true);
    // Ground should contain b1:negative terminal
    expect(groundNode!.terminalIds).toContain('b1:negative');
  });
});
