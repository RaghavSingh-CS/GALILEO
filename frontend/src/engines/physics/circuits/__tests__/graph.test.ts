import { describe, it, expect } from 'vitest';
import { buildGraph, getConnectedComponents, getConductiveComponents, hasPathBetween } from '../graph';
import type { CircuitState, BatteryComponent, ResistorComponent, SwitchComponent, VoltmeterComponent, Wire } from '../types';

describe('Graph Builder', () => {
  const makeBattery = (id: string, voltage: number): BatteryComponent => ({
    id, type: 'battery', voltage,
    terminals: [{ id: `${id}:positive`, componentId: id, role: 'positive' }, { id: `${id}:negative`, componentId: id, role: 'negative' }]
  });

  const makeResistor = (id: string, resistance: number): ResistorComponent => ({
    id, type: 'resistor', resistance,
    terminals: [{ id: `${id}:a`, componentId: id, role: 'a' }, { id: `${id}:b`, componentId: id, role: 'b' }]
  });

  const makeSwitch = (id: string, closed: boolean): SwitchComponent => ({
    id, type: 'switch', closed,
    terminals: [{ id: `${id}:a`, componentId: id, role: 'a' }, { id: `${id}:b`, componentId: id, role: 'b' }]
  });

  const makeVoltmeter = (id: string): VoltmeterComponent => ({
    id, type: 'voltmeter',
    terminals: [{ id: `${id}:positive`, componentId: id, role: 'positive' }, { id: `${id}:negative`, componentId: id, role: 'negative' }]
  });

  const makeWire = (id: string, sourceTerminalId: string, targetTerminalId: string): Wire => ({
    id, sourceTerminalId, targetTerminalId
  });

  it('Single loop: Battery + Resistor + 2 wires', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const { graph, messages } = buildGraph(state);

    expect(messages.length).toBe(0);
    expect(graph.nodes.length).toBe(2);
    expect(graph.branches.length).toBe(2);
    expect(graph.branches.find(b => b.type === 'battery')!.value).toBe(9);
    expect(graph.branches.find(b => b.type === 'resistor')!.value).toBe(100);
    expect(graph.groundNodeId).toBeTruthy();
  });

  it('Series chain: Battery + R1 + R2 + wires', () => {
    const b1 = makeBattery('b1', 9);
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

    const { graph, messages } = buildGraph(state);
    expect(messages.length).toBe(0);
    expect(graph.nodes.length).toBe(3);
    expect(graph.branches.length).toBe(3);
  });

  it('Open switch: Terminals in separate nodes', () => {
    const b1 = makeBattery('b1', 9);
    const s1 = makeSwitch('s1', false);
    const state: CircuitState = {
      components: [b1, s1],
      wires: [
        makeWire('w1', b1.terminals[0].id, s1.terminals[0].id)
      ]
    };

    const { graph } = buildGraph(state);
    // switch open -> no branch for switch
    expect(graph.branches.find(b => b.type === 'switch')).toBeUndefined();
    const rootPos = graph.nodes.find(n => n.terminalIds.includes(b1.terminals[0].id))!.id;
    const rootSw1 = graph.nodes.find(n => n.terminalIds.includes(s1.terminals[0].id))!.id;
    const rootSw2 = graph.nodes.find(n => n.terminalIds.includes(s1.terminals[1].id))!.id;
    expect(rootPos).toBe(rootSw1);
    expect(rootPos).not.toBe(rootSw2);
  });

  it('Closed switch: Terminals merged into same node', () => {
    const b1 = makeBattery('b1', 9);
    const s1 = makeSwitch('s1', true);
    const state: CircuitState = {
      components: [b1, s1],
      wires: [
        makeWire('w1', b1.terminals[0].id, s1.terminals[0].id)
      ]
    };

    const { graph } = buildGraph(state);
    const rootPos = graph.nodes.find(n => n.terminalIds.includes(b1.terminals[0].id))!.id;
    const rootSw1 = graph.nodes.find(n => n.terminalIds.includes(s1.terminals[0].id))!.id;
    const rootSw2 = graph.nodes.find(n => n.terminalIds.includes(s1.terminals[1].id))!.id;
    expect(rootPos).toBe(rootSw1);
    expect(rootSw1).toBe(rootSw2); // closed switch merged them
  });

  it('Disconnected component: battery + R1(connected) + R2(floating)', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 200); // no wires
    const state: CircuitState = {
      components: [b1, r1, r2],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const { graph } = buildGraph(state);
    const connectedComponents = getConnectedComponents(graph);

    // b1/r1 form one connected component, r2 forms another (its terminals are isolated)
    expect(connectedComponents.length).toBe(2);
  });

  it('Wire chain: 5 wires in sequence -> 1 node', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const r2 = makeResistor('r2', 100);
    const r3 = makeResistor('r3', 100);
    const state: CircuitState = {
      components: [b1, r1, r2, r3],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[0].id, r2.terminals[0].id),
        makeWire('w3', r2.terminals[0].id, r3.terminals[0].id),
        makeWire('w4', r3.terminals[0].id, b1.terminals[0].id)
      ]
    };
    const { graph } = buildGraph(state);

    const posTerminalNode = graph.nodes.find(n => n.terminalIds.includes(b1.terminals[0].id))!;
    expect(posTerminalNode.terminalIds).toContain(r1.terminals[0].id);
    expect(posTerminalNode.terminalIds).toContain(r2.terminals[0].id);
    expect(posTerminalNode.terminalIds).toContain(r3.terminals[0].id);
  });

  // ── PHY-001: Dangling wire endpoint ──────────────────────────────────────

  it('PHY-001: Dangling wire source returns DANGLING_WIRE error', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'nonexistent:terminal', r1.terminals[0].id), // dangling source
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const { messages } = buildGraph(state);
    expect(messages.some(m => m.ruleId === 'DANGLING_WIRE' && m.message.includes('w1'))).toBe(true);
  });

  it('PHY-001: Dangling wire target returns DANGLING_WIRE error', () => {
    const b1 = makeBattery('b1', 9);
    const state: CircuitState = {
      components: [b1],
      wires: [
        makeWire('w1', b1.terminals[0].id, 'ghost:terminal') // dangling target
      ]
    };

    const { messages } = buildGraph(state);
    expect(messages.some(m => m.ruleId === 'DANGLING_WIRE')).toBe(true);
    expect(messages[0].message).toContain('w1');
  });

  it('PHY-001: Valid wires produce no DANGLING_WIRE messages', () => {
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const state: CircuitState = {
      components: [b1, r1],
      wires: [
        makeWire('w1', b1.terminals[0].id, r1.terminals[0].id),
        makeWire('w2', r1.terminals[1].id, b1.terminals[1].id)
      ]
    };

    const { messages } = buildGraph(state);
    expect(messages.filter(m => m.ruleId === 'DANGLING_WIRE').length).toBe(0);
  });

  // ── PHY-008: getConductiveComponents excludes voltmeter links ────────────

  it('PHY-008: Voltmeter-only link does not join subgraphs in getConductiveComponents', () => {
    // Battery + voltmeter only (voltmeter across battery but nothing conductive between them)
    const b1 = makeBattery('b1', 9);
    const r1 = makeResistor('r1', 100);
    const v1 = makeVoltmeter('v1');
    // R1 is isolated; only voltmeter bridges battery and R1 nodes
    const state: CircuitState = {
      components: [b1, r1, v1],
      wires: [
        // Voltmeter connects battery positive node to r1 node — but not conductively
        makeWire('wv1', v1.terminals[0].id, b1.terminals[0].id),
        makeWire('wv2', v1.terminals[1].id, r1.terminals[0].id),
      ]
    };

    const { graph } = buildGraph(state);

    // Generic connectivity (including voltmeter) joins subgraphs
    const allComps = getConnectedComponents(graph);
    // Conductive connectivity excludes the voltmeter link
    const conductiveComps = getConductiveComponents(graph);

    // With voltmeter: battery, r1, and v1 are in 1 component (voltmeter bridges them)
    expect(allComps.length).toBeLessThan(conductiveComps.length);
    // Conductive: battery side and r1 side should be in separate components
    const batteryNodeId = graph.nodes.find(n => n.terminalIds.includes(b1.terminals[0].id))!.id;
    const r1NodeId = graph.nodes.find(n => n.terminalIds.includes(r1.terminals[0].id))!.id;
    const sameConductiveComp = conductiveComps.some(comp =>
      comp.some(n => n.id === batteryNodeId) && comp.some(n => n.id === r1NodeId)
    );
    expect(sameConductiveComp).toBe(false);
  });
});
