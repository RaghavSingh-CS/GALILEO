import { describe, it, expect } from 'vitest';
import { verifyOhmsLawExperiment } from '../ohms-law';
import type { CircuitState, BatteryComponent, ResistorComponent, AmmeterComponent, VoltmeterComponent, Wire } from '../../circuits/types';

describe('Ohm\'s Law Verifier', () => {
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

  it('rejects missing components', () => {
    const result = verifyOhmsLawExperiment({ components: [], wires: [] });
    expect(result.issues).toContain('MISSING_BATTERY');
    expect(result.issues).toContain('MISSING_RESISTOR');
    expect(result.issues).toContain('MISSING_AMMETER');
    expect(result.issues).toContain('MISSING_VOLTMETER');
    expect(result.usability).toBe('unusable');
  });

  it('accepts a perfectly formed Ohms Law circuit', () => {
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
        // Voltmeter in parallel with resistor
        makeWire('wv1', v1.terminals[0].id, r1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, r1.terminals[1].id)
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    
    expect(result.issues).toEqual([]);
    expect(result.usability).toBe('usable');
    expect(result.voltageReadingV).toBeCloseTo(10);
    expect(result.currentReadingA).toBeCloseTo(0.1);
  });

  it('detects ammeter not in series', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    // Place ammeter in parallel with resistor
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id),
        // Ammeter in parallel
        makeWire('wa1', a1.terminals[0].id, r1.terminals[0].id),
        makeWire('wa2', a1.terminals[1].id, r1.terminals[1].id),
        // Voltmeter in parallel
        makeWire('wv1', v1.terminals[0].id, r1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, r1.terminals[1].id)
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    
    // The circuit solves (though ammeter shorts the resistor), but topological rules reject it.
    // Wait, an ammeter in parallel with a resistor is technically a SHORT_CIRCUIT in our general validator.
    expect(result.issues).toContain('SHORT_CIRCUIT');
    expect(result.usability).toBe('unusable');
  });

  it('detects voltmeter not in parallel', () => {
    const b1 = makeBattery('b1', 10);
    const r1 = makeResistor('r1', 100);
    const a1 = makeAmmeter('a1');
    const v1 = makeVoltmeter('v1');
    // Place voltmeter in series with resistor
    const state: CircuitState = {
      components: [b1, r1, a1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, a1.terminals[0].id),
        makeWire('w2', a1.terminals[1].id, v1.terminals[0].id),
        makeWire('w3', v1.terminals[1].id, r1.terminals[0].id),
        makeWire('w4', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };
    const result = verifyOhmsLawExperiment(state);
    
    expect(result.issues).toContain('VOLTMETER_NOT_IN_PARALLEL');
    expect(result.usability).toBe('unusable');
  });
});
