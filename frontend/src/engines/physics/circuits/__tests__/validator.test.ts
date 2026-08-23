import { describe, it, expect } from 'vitest';
import { validateGraph } from '../validator';
import { buildGraph } from '../graph';
import { CircuitState, BatteryComponent, ResistorComponent, AmmeterComponent, VoltmeterComponent, Wire } from '../types';

describe('Validator', () => {
  const makeBattery = (id: string): BatteryComponent => ({
    id, type: 'battery', voltage: 9,
    terminals: [{ id: `${id}:positive`, componentId: id, role: 'positive' }, { id: `${id}:negative`, componentId: id, role: 'negative' }]
  });

  const makeResistor = (id: string): ResistorComponent => ({
    id, type: 'resistor', resistance: 100,
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

  it('NO_BATTERY: circuit without battery', () => {
    const r1 = makeResistor('r1');
    const state: CircuitState = { components: [r1], wires: [] };
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.length).toBe(1);
    expect(messages[0].ruleId).toBe('NO_BATTERY');
    expect(messages[0].severity).toBe('error');
  });

  it('DISCONNECTED_COMPONENT: floating resistor', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const r2 = makeResistor('r2');
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.some(m => m.ruleId === 'DISCONNECTED_COMPONENT' && m.componentIds.includes('r2'))).toBe(true);
  });

  it('OPEN_CIRCUIT: break in the loop', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const r2 = makeResistor('r2');
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        // break here
        makeWire('w3', r2.terminals[1].id, b1.terminals[1].id)
      ]
    };
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.some(m => m.ruleId === 'OPEN_CIRCUIT')).toBe(true);
  });

  it('AMMETER_IN_PARALLEL: ammeter across a resistor', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const a1 = makeAmmeter('a1');
    
    const state: CircuitState = {
      components: [b1, r1, a1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id),
        makeWire('w3', a1.terminals[0].id, r1.terminals[0].id), // ammeter in parallel
        makeWire('w4', a1.terminals[1].id, r1.terminals[1].id)
      ]
    };
    
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.some(m => m.ruleId === 'AMMETER_IN_PARALLEL')).toBe(true);
  });

  it('Valid circuit: Battery + R + wires (complete loop)', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };
    
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.length).toBe(0);
  });
  it('SHORT_CIRCUIT: battery terminals connected directly', () => {
    const b1 = makeBattery('b1');
    const state: CircuitState = {
      components: [b1],
      wires: [
        makeWire('w1', b1.terminals[0].id, b1.terminals[1].id)
      ]
    };
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.some(m => m.ruleId === 'SHORT_CIRCUIT')).toBe(true);
  });

  it('VOLTMETER_IN_SERIES: voltmeter is the only path between nodes', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    const v1 = makeVoltmeter('v1');
    const state: CircuitState = {
      components: [b1, r1, v1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, v1.terminals[0].id), // series
        makeWire('w3', v1.terminals[1].id, b1.terminals[1].id)
      ]
    };
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.some(m => m.ruleId === 'VOLTMETER_IN_SERIES')).toBe(true);
  });

  it('INVALID_VALUE: resistor with zero or negative resistance', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    r1.resistance = -10; // Invalid
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };
    const graph = buildGraph(state);
    const messages = validateGraph(graph, state);
    
    expect(messages.some(m => m.ruleId === 'INVALID_VALUE' && m.componentIds.includes('r1'))).toBe(true);
  });
});
