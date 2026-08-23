import { describe, it, expect } from 'vitest';
import { buildGraph, getConnectedComponents, hasPathBetween } from '../graph';
import { CircuitState, BatteryComponent, ResistorComponent, SwitchComponent, Wire } from '../types';

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
    
    const graph = buildGraph(state);
    
    expect(graph.nodes.length).toBe(2);
    expect(graph.branches.length).toBe(2);
    expect(graph.branches.find(b => b.type === 'battery')!.value).toBe(9);
    expect(graph.branches.find(b => b.type === 'resistor')!.value).toBe(100);
    expect(graph.groundNodeId).toBeTruthy(); // A ground node was assigned
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
    
    const graph = buildGraph(state);
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
    
    const graph = buildGraph(state);
    // battery, switch. switch open -> shouldn't form a branch.
    // wait, our logic doesn't create branch for switches at all.
    // the nodes should just be disjoint.
    expect(graph.branches.find(b => b.type === 'switch')).toBeUndefined();
    // Path from positive terminal to switch term 1 is there. But not to term 2.
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
    
    const graph = buildGraph(state);
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
    
    const graph = buildGraph(state);
    const connectedComponents = getConnectedComponents(graph);
    
    // b1/r1 form one connected component, r2 forms another since it has branches in the graph. 
    // wait, r2 is a branch with 2 nodes (the two terminals). it forms a component of 2 nodes.
    // total components: 2 (the main circuit + the floating r2).
    expect(connectedComponents.length).toBe(2);
  });
  it('Wire chain: 5 wires in sequence -> 1 node', () => {
    const b1 = makeBattery('b1', 9); // Needed to establish a ground node easily, though not strictly necessary if arbitrary ground works
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
    const graph = buildGraph(state);
    
    // Check if the 4 terminals connected by wires form a single node
    const posTerminalNode = graph.nodes.find(n => n.terminalIds.includes(b1.terminals[0].id))!;
    expect(posTerminalNode.terminalIds).toContain(r1.terminals[0].id);
    expect(posTerminalNode.terminalIds).toContain(r2.terminals[0].id);
    expect(posTerminalNode.terminalIds).toContain(r3.terminals[0].id);
  });
});
