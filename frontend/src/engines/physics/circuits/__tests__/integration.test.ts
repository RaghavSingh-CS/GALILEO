import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../index';
import { CircuitState, BatteryComponent, ResistorComponent, AmmeterComponent, VoltmeterComponent, VariableResistorComponent, Wire } from '../types';

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
    // voltage drops from a to b, so V_a - V_b is 5V
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
    
    // I = 10 / 300 = 0.033333333...
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
    const b2 = makeBattery('b2', 5); // Connect positive of b2 to negative of b1
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

  it('DEGENERATE_TOPOLOGY error when matrix is singular', () => {
    // Two ammeters in series across a battery.
    // The validator checks for a single ammeter short, but two ammeters in series will bypass that specific check
    // and reach the solver, which will fail to solve the singular MNA matrix.
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
    expect(result.validation.some(v => v.ruleId === 'DEGENERATE_TOPOLOGY')).toBe(true);
  });
});
