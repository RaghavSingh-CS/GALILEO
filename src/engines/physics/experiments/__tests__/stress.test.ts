import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../../circuits/index';
import type { CircuitState, BatteryComponent, ResistorComponent, Wire } from '../../circuits/types';

describe('Extreme Red Team — Stress Testing (Phase 4)', () => {
  const makeBattery = (id: string, voltage = 9): BatteryComponent => ({
    id, type: 'battery', voltage,
    terminals: [
      { id: `${id}:positive`, componentId: id, role: 'positive' },
      { id: `${id}:negative`, componentId: id, role: 'negative' }
    ]
  });

  const makeResistor = (id: string, resistance = 10): ResistorComponent => ({
    id, type: 'resistor', resistance,
    terminals: [
      { id: `${id}:a`, componentId: id, role: 'a' },
      { id: `${id}:b`, componentId: id, role: 'b' }
    ]
  });

  const makeWire = (id: string, src: string, tgt: string): Wire => ({
    id, sourceTerminalId: src, targetTerminalId: tgt
  });

  const generateDeepSeriesCircuit = (nResistors: number): CircuitState => {
    const components: any[] = [makeBattery('b1', 100)];
    const wires: Wire[] = [];

    for (let i = 0; i < nResistors; i++) {
      components.push(makeResistor(`r${i}`, 10));
    }

    wires.push(makeWire('w_start', 'b1:positive', 'r0:a'));
    for (let i = 0; i < nResistors - 1; i++) {
      wires.push(makeWire(`w_${i}`, `r${i}:b`, `r${i + 1}:a`));
    }
    wires.push(makeWire('w_end', `r${nResistors - 1}:b`, 'b1:negative'));

    return { components, wires };
  };

  const generateDeepParallelCircuit = (nResistors: number): CircuitState => {
    const components: any[] = [makeBattery('b1', 100)];
    const wires: Wire[] = [];

    for (let i = 0; i < nResistors; i++) {
      components.push(makeResistor(`r${i}`, 10));
    }

    for (let i = 0; i < nResistors; i++) {
      wires.push(makeWire(`w_${i}_a`, 'b1:positive', `r${i}:a`));
      wires.push(makeWire(`w_${i}_b`, `r${i}:b`, 'b1:negative'));
    }

    return { components, wires };
  };

  it('STRESS-001: 100 components in series solves correctly', () => {
    const state = generateDeepSeriesCircuit(100);
    const start = performance.now();
    const result = solveCircuit(state);
    const end = performance.now();
    
    expect(result.success).toBe(true);
    // V=100, R=1000 -> I=0.1A
    expect(result.branchData.find(b => b.componentId === 'b1')!.current).toBeCloseTo(0.1, 5);
    console.log(`STRESS-001 (N=100 Series) executed in ${(end - start).toFixed(2)}ms`);
  });

  it('STRESS-002: 500 components in series solves within reasonable bounds', () => {
    const state = generateDeepSeriesCircuit(500);
    const start = performance.now();
    const result = solveCircuit(state);
    const end = performance.now();
    
    expect(result.success).toBe(true);
    // V=100, R=5000 -> I=0.02A. GMIN leakage accumulates over 500 nodes, so precision is relaxed to 3 decimal places.
    expect(result.branchData.find(b => b.componentId === 'b1')!.current).toBeCloseTo(0.02, 3);
    console.log(`STRESS-002 (N=500 Series) executed in ${(end - start).toFixed(2)}ms`);
  });

  it('STRESS-003: 1000 components in parallel massive star topology', () => {
    const state = generateDeepParallelCircuit(1000);
    const start = performance.now();
    const result = solveCircuit(state);
    const end = performance.now();
    
    expect(result.success).toBe(true);
    // V=100, R_eq=10/1000 = 0.01. I = 100 / 0.01 = 10000A
    expect(result.branchData.find(b => b.componentId === 'b1')!.current).toBeCloseTo(10000, 2);
    console.log(`STRESS-003 (N=1000 Parallel) executed in ${(end - start).toFixed(2)}ms`);
  });
});
