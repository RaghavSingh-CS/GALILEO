import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../index';
import type { CircuitState, BatteryComponent, ResistorComponent, AmmeterComponent, VoltmeterComponent, VariableResistorComponent, Wire } from '../types';

describe('Solver Integration', () => {
  const makeBattery = (id: string, voltage: number): BatteryComponent => ({
    id, type: 'battery', voltage,
    terminals: [{ id: `${id}:positive`, componentId: id, role: 'positive' }, { id: `${id}:negative`, componentId: id, role: 'negative' }]
  });

  const makeResistor = (id: string, resistance: number): ResistorComponent => ({
    id, type: 'resistor', resistance,
    terminals: [{ id: `${id}:a`, componentId: id, role: 'a' }, { id: `${id}:b`, componentId: id, role: 'b' }]
  });

  const makeAmmeter = (id: string): AmmeterComponent => ({
    id, type: 'ammeter',
    terminals: [{ id: `${id}:in`, componentId: id, role: 'in' }, { id: `${id}:out`, componentId: id, role: 'out' }]
  });

  const makeVoltmeter = (id: string): VoltmeterComponent => ({
    id, type: 'voltmeter',
    terminals: [{ id: `${id}:positive`, componentId: id, role: 'positive' }, { id: `${id}:negative`, componentId: id, role: 'negative' }]
  });

  const makeWire = (id: string, src: string, tgt: string): Wire => ({ id, sourceTerminalId: src, targetTerminalId: tgt });

  const closeTo = (val: number, expected: number, tol = 1e-9) => Math.abs(val - expected) < tol;

  it('Ohms Law basic: 5V battery, 100Ω resistor -> I = 0.05A', () => {
    const b1 = makeBattery('b1', 5);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const r1Branch = result.branchData.find(b => b.componentId === 'r1')!;
    const b1Branch = result.branchData.find(b => b.componentId === 'b1')!;
    expect(closeTo(r1Branch.current, 0.05)).toBe(true);
    expect(closeTo(b1Branch.current, 0.05)).toBe(true);
    expect(closeTo(r1Branch.voltage, 5)).toBe(true);
  });

  it('Series: 10V, R1=100Ω, R2=200Ω', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 200);
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, r2.terminals[0].id),
        makeWire('w3', r2.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const r1Branch = result.branchData.find(b => b.componentId === 'r1')!;
    const r2Branch = result.branchData.find(b => b.componentId === 'r2')!;

    expect(closeTo(r1Branch.current, 10 / 300)).toBe(true);
    expect(closeTo(r2Branch.current, 10 / 300)).toBe(true);
    expect(closeTo(r1Branch.voltage, 100 * (10 / 300))).toBe(true); // 3.33V
    expect(closeTo(r2Branch.voltage, 200 * (10 / 300))).toBe(true); // 6.67V
  });

  it('Parallel: 10V, R1=100Ω ∥ R2=200Ω', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 200);
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', b1.terminals[0].id, r2.terminals[0].id),
        makeWire('w3', r1.terminals[1].id, b1.terminals[1].id),
        makeWire('w4', r2.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const b1Branch = result.branchData.find(b => b.componentId === 'b1')!;
    const r1Branch = result.branchData.find(b => b.componentId === 'r1')!;
    const r2Branch = result.branchData.find(b => b.componentId === 'r2')!;

    expect(closeTo(r1Branch.voltage, 10)).toBe(true);
    expect(closeTo(r2Branch.voltage, 10)).toBe(true);
    expect(closeTo(r1Branch.current, 0.1)).toBe(true);
    expect(closeTo(r2Branch.current, 0.05)).toBe(true);
    expect(closeTo(b1Branch.current, 0.15)).toBe(true);
  });

  it('Meter readings: Battery + R + Ammeter in series + Voltmeter across R', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');

    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, a1.terminals[0].id),
        makeWire('w2', a1.terminals[1].id, r1.terminals[0].id),
        makeWire('w3', r1.terminals[1].id, b1.terminals[1].id),
        // Voltmeter in parallel across R1
        makeWire('wv1', v1.terminals[0].id, r1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, r1.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const aReading = result.readings.find(r => r.type === 'ammeter')!;
    const vReading = result.readings.find(r => r.type === 'voltmeter')!;

    expect(aReading).toBeDefined();
    expect(vReading).toBeDefined();

    expect(closeTo(aReading.value, 0.1)).toBe(true); // 10V / 100Ω = 0.1A
    expect(closeTo(vReading.value, 10)).toBe(true); // Voltage across R1 is 10V
  });

  it('Variable resistor solve', () => {
    const b1 = makeBattery('b1', 10);
    const vr1 = {
      id: 'vr1',
      type: 'variable_resistor',
      minResistance: 10,
      maxResistance: 1000,
      currentResistance: 50,
      terminals: [
        { id: 'vr1:a', componentId: 'vr1', role: 'a' },
        { id: 'vr1:b', componentId: 'vr1', role: 'b' }
      ]
    } as VariableResistorComponent;

    const state: CircuitState = {
      components: [b1, vr1],
      wires: [
        makeWire('w1', b1.terminals[0].id, vr1.terminals[0].id),
        makeWire('w2', vr1.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    const vr1Branch = result.branchData.find(b => b.componentId === 'vr1')!;
    expect(closeTo(vr1Branch.current, 0.2)).toBe(true); // 10 / 50 = 0.2A
  });

  it('Multiple batteries in series', () => {
    const b1 = makeBattery('b1', 5);
    const b2 = makeBattery('b2', 5);
    const r1 = makeResistor('r1', 100);

    const state: CircuitState = {
      components: [b1, b2, r1],
      wires: [
        makeWire('w1', b2.terminals[0].id, b1.terminals[1].id), // Series: 5 + 5 = 10V
        makeWire('w2', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w3', r1.terminals[1].id, b2.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    const r1Branch = result.branchData.find(b => b.componentId === 'r1')!;
    expect(closeTo(r1Branch.current, 0.1)).toBe(true); // 10V / 100Ω = 0.1A
  });

  // ── PHY-007: Two ammeters in series across battery → SHORT_CIRCUIT not DEGENERATE_TOPOLOGY

  it('PHY-007 SHORT_CIRCUIT: two ammeters in series across battery returns SHORT_CIRCUIT', () => {
    // Previously this fell through to DEGENERATE_TOPOLOGY because only a single
    // ammeter directly parallel to battery was detected. Now the full zero-resistance
    // BFS detects multi-element short paths.
    const b1 = makeBattery('b1', 5);
    const a1 = makeAmmeter('a1');
    const a2 = makeAmmeter('a2');

    const state: CircuitState = {
      components: [b1, a1, a2],
      wires: [
        makeWire('w1', b1.terminals[0].id, a1.terminals[0].id),
        makeWire('w2', a1.terminals[1].id, a2.terminals[0].id),
        makeWire('w3', a2.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(false);
    // Must return SHORT_CIRCUIT with specific component IDs, not generic DEGENERATE_TOPOLOGY
    expect(result.validation.some(v => v.ruleId === 'SHORT_CIRCUIT')).toBe(true);
    expect(result.validation.some(v => v.ruleId === 'DEGENERATE_TOPOLOGY')).toBe(false);
  });

  // ── PHY-001: Dangling wire endpoint integration test ─────────────────────

  it('PHY-001 DANGLING_WIRE: wire referencing unknown terminal returns error', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id),
        makeWire('stale', 'deleted_component:a', r1.terminals[0].id) // stale adapter edge
      ]
    };

    const result = solveCircuit(state);
    expect(result.success).toBe(false);
    expect(result.validation.some(v => v.ruleId === 'DANGLING_WIRE')).toBe(true);
    expect(result.validation.find(v => v.ruleId === 'DANGLING_WIRE')!.message).toContain('stale');
  });

  // ── PHY-024: Malformed runtime input is contained ────────────────────────

  it('PHY-024 MALFORMED_INPUT: solveCircuit does not throw on null input', () => {
    // Cast to bypass TypeScript — simulating untrusted runtime data
    expect(() => solveCircuit(null as unknown as CircuitState)).not.toThrow();
    const result = solveCircuit(null as unknown as CircuitState);
    expect(result.success).toBe(false);
    expect(result.validation.some(v => v.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024 MALFORMED_INPUT: solveCircuit does not throw on object with missing arrays', () => {
    const result = solveCircuit({} as unknown as CircuitState);
    expect(result.success).toBe(false);
    expect(result.validation.some(v => v.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('Integration: Graceful degradation — half-connected component (FLOATING_TERMINAL) does not prevent solving the rest of the circuit', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id),
        // r2 is attached to the positive rail but its other end is dangling
        makeWire('w3', r2.terminals[0].id, b1.terminals[0].id)
      ]
    };

    const result = solveCircuit(state);
    
    // The solve should succeed because warnings do not block execution
    expect(result.success).toBe(true);
    
    // It should emit FLOATING_TERMINAL warning for r2
    expect(result.validation.some(v => v.ruleId === 'FLOATING_TERMINAL')).toBe(true);
    // Note: It does NOT emit DISCONNECTED_COMPONENT because r2 is attached to the active circuit (dead end branch).

    // The rest of the circuit (b1 and r1) should be solved correctly (10V / 100ohm = 0.1A)
    const r1Branch = result.branchData.find(b => b.componentId === 'r1')!;
    expect(closeTo(r1Branch.current, 0.1)).toBe(true);
    // r2 is in the branch data but since it's a dead end, it receives 0A and 0V
    const r2Branch = result.branchData.find(b => b.componentId === 'r2')!;
    expect(r2Branch).toBeDefined();
    expect(r2Branch.current).toBe(0);
    expect(r2Branch.voltage).toBe(0);
  });
});
