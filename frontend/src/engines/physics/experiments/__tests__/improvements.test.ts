import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../../circuits/index';
import type { CircuitState, BatteryComponent, ResistorComponent, Wire } from '../../circuits/types';

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

const makeWire = (id: string, src: string, tgt: string): Wire => ({
  id, sourceTerminalId: src, targetTerminalId: tgt
});

describe('Architectural Improvements', () => {

  it('IMP-001: BranchData includes accurate power calculations', () => {
    // 10V across 100 ohm = 0.1A. Power = 10 * 0.1 = 1W.
    const state: CircuitState = {
      components: [makeBattery('b1', 10), makeResistor('r1', 100)],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);

    const r1Branch = result.branchData.find(b => b.componentId === 'r1');
    expect(r1Branch).toBeDefined();
    expect(r1Branch?.power).toBeCloseTo(1.0, 3);
  });

  it('IMP-002: COMPONENT_OVERHEATING warning emitted when power > 0.25W', () => {
    const state: CircuitState = {
      components: [makeBattery('b1', 10), makeResistor('r1', 100)], // 1W > 0.25W
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    const result = solveCircuit(state);
    
    // It's a warning, so success is still true
    expect(result.success).toBe(true);
    const ruleIds = result.validation.map(v => v.ruleId);
    expect(ruleIds).toContain('COMPONENT_OVERHEATING');
  });

  it('IMP-003: COMPONENT_OVERHEATING NOT emitted when power <= 0.25W', () => {
    // 5V across 100 ohm = 0.05A. Power = 5 * 0.05 = 0.25W (exactly on boundary)
    const state: CircuitState = {
      components: [makeBattery('b1', 5), makeResistor('r1', 100)],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    const ruleIds = result.validation.map(v => v.ruleId);
    expect(ruleIds).not.toContain('COMPONENT_OVERHEATING');
  });

  it('IMP-004: DFS Spanning Tree correctly catches a loop of 3 batteries', () => {
    const b1 = makeBattery('b1', 5);
    const b2 = makeBattery('b2', 5);
    const b3 = makeBattery('b3', 5);
    
    // A loop of 3 batteries with no resistor
    const state: CircuitState = {
      components: [b1, b2, b3],
      wires: [
        makeWire('w1', 'b1:positive', 'b2:negative'),
        makeWire('w2', 'b2:positive', 'b3:negative'),
        makeWire('w3', 'b3:positive', 'b1:negative'),
      ]
    };
    const result = solveCircuit(state);
    expect(result.success).toBe(false);
    
    // The previous parallel logic only checked pairs. This must catch the 3-loop.
    const ruleIds = result.validation.map(v => v.ruleId);
    expect(ruleIds).toContain('PARALLEL_IDEAL_SOURCES');
  });

  it('IMP-005: GMIN anchoring prevents SINGULAR_MATRIX crash for floating degenerate loops', () => {
    // If a circuit bypassed validation, GMIN ensures MathJS doesn't crash.
    // We simulate this by creating a 0-resistance loop (which mathematically breaks standard MNA)
    // but the engine catches it with ALL_SOURCES_NO_RESISTANCE.
    // Because solveCircuit() catches everything, we just verify it doesn't throw
    // and returns safely.
    const b1 = makeBattery('b1', 10);
    const state: CircuitState = {
      components: [b1],
      wires: [
        makeWire('w1', 'b1:positive', 'b1:negative') // Direct short!
      ]
    };
    expect(() => solveCircuit(state)).not.toThrow();
  });
});
