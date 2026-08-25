import { describe, it, expect } from 'vitest';
import { verifySeriesParallelExperiment } from '../series-parallel';
import type { CircuitState, BatteryComponent, ResistorComponent, AmmeterComponent, VoltmeterComponent, Wire } from '../../circuits/types';

describe('Series-Parallel Verifier', () => {
  const makeBattery = (id: string, voltage = 9): BatteryComponent => ({
    id, type: 'battery', voltage,
    terminals: [{ id: `${id}:positive`, componentId: id, role: 'positive' }, { id: `${id}:negative`, componentId: id, role: 'negative' }]
  });
  const makeResistor = (id: string, resistance = 100): ResistorComponent => ({
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

  it('rejects circuit with < 2 resistors', () => {
    const state: CircuitState = {
      components: [makeBattery('b1'), makeResistor('r1'), makeAmmeter('a1'), makeVoltmeter('v1')],
      wires: []
    };
    const result = verifySeriesParallelExperiment(state);
    expect(result.issues).toContain('MISSING_RESISTORS');
  });

  it('identifies pure series configuration', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    // Series: b1 -> a1 -> r1 -> r2 -> b1
    const state: CircuitState = {
      components: [b1, r1, r2, a1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, a1.terminals[0].id),
        makeWire('w2', a1.terminals[1].id, r1.terminals[0].id),
        makeWire('w3', r1.terminals[1].id, r2.terminals[0].id),
        makeWire('w4', r2.terminals[1].id, b1.terminals[1].id),
        // Voltmeter across entire series combo
        makeWire('wv1', v1.terminals[0].id, r1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, r2.terminals[1].id)
      ]
    };
    const result = verifySeriesParallelExperiment(state);
    
    expect(result.issues).toEqual([]);
    expect(result.configuration).toBe('series');
    expect(result.equivalentResistanceOhms).toBeCloseTo(200);
  });

  it('identifies pure parallel configuration', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    // Parallel: both r1 and r2 share node A and node B
    const state: CircuitState = {
      components: [b1, r1, r2, a1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, a1.terminals[0].id),
        makeWire('w2', a1.terminals[1].id, r1.terminals[0].id),
        makeWire('w3', a1.terminals[1].id, r2.terminals[0].id), // Node A
        
        makeWire('w4', r1.terminals[1].id, b1.terminals[1].id),
        makeWire('w5', r2.terminals[1].id, b1.terminals[1].id), // Node B
        
        // Voltmeter across the parallel combo
        makeWire('wv1', v1.terminals[0].id, r1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, r1.terminals[1].id)
      ]
    };
    const result = verifySeriesParallelExperiment(state);
    
    expect(result.issues).toEqual([]);
    expect(result.configuration).toBe('parallel');
    expect(result.equivalentResistanceOhms).toBeCloseTo(50);
  });

  it('identifies mixed configuration', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const r3 = makeResistor('r3', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    // Mixed: r1 in series with (r2 || r3)
    const state: CircuitState = {
      components: [b1, r1, r2, r3, a1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, a1.terminals[0].id),
        makeWire('w2', a1.terminals[1].id, r1.terminals[0].id),
        // r1 series to r2/r3 parallel block
        makeWire('w3', r1.terminals[1].id, r2.terminals[0].id),
        makeWire('w4', r1.terminals[1].id, r3.terminals[0].id),
        // Returns to battery
        makeWire('w5', r2.terminals[1].id, b1.terminals[1].id),
        makeWire('w6', r3.terminals[1].id, b1.terminals[1].id),
        // Voltmeter across everything
        makeWire('wv1', v1.terminals[0].id, r1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, b1.terminals[1].id)
      ]
    };
    const result = verifySeriesParallelExperiment(state);
    
    // Equivalent resistance of mixed is 100 + (100 || 100) = 150
    expect(result.issues).toContain('NOT_PURE_SERIES_OR_PARALLEL');
    expect(result.configuration).toBe('mixed');
    expect(result.equivalentResistanceOhms).toBeCloseTo(150);
  });
});
