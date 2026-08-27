import { describe, it, expect } from 'vitest';
import type { Connection, Edge, Node } from '@xyflow/react';
import { cleanStaleEdges, hasDuplicateConnection, translateToCircuitState } from './circuitAdapter';
import { solveCircuit, validateIntegrity } from '@/engines/physics';

describe('Circuit Adapter', () => {
  it('translates a normal solve round-trip', () => {
    const nodes: Node[] = [
      { id: 'bat1', type: 'battery', data: { voltage: 9 }, position: { x: 0, y: 0 } },
      { id: 'res1', type: 'resistor', data: { resistance: 100 }, position: { x: 0, y: 0 } }
    ];
    
    const edges: Edge[] = [
      { id: 'e1', source: 'bat1', sourceHandle: 'positive', target: 'res1', targetHandle: 'a' },
      { id: 'e2', source: 'res1', sourceHandle: 'b', target: 'bat1', targetHandle: 'negative' }
    ];

    const state = translateToCircuitState(nodes, edges);
    
    expect(state.components).toHaveLength(2);
    expect(state.wires).toHaveLength(2);

    const validation = validateIntegrity(state);
    expect(validation).toHaveLength(0);

    const result = solveCircuit(state);
    expect(result.success).toBe(true);
    // V = 9, R = 100 -> I = 0.09A = 90mA
    const resReading = result.branchData.find(b => b.componentId === 'res1');
    expect(resReading?.current).toBeCloseTo(0.09, 3);
  });

  it('deleting a wired node cleans up its edges before solve', () => {
    const nodes: Node[] = [
      { id: 'bat1', type: 'battery', data: { voltage: 9 }, position: { x: 0, y: 0 } },
      { id: 'res1', type: 'resistor', data: { resistance: 100 }, position: { x: 0, y: 0 } }
    ];
    
    const edges: Edge[] = [
      { id: 'e1', source: 'bat1', sourceHandle: 'positive', target: 'res1', targetHandle: 'a' },
      { id: 'e2', source: 'res1', sourceHandle: 'b', target: 'bat1', targetHandle: 'negative' }
    ];

    // Simulate node deletion
    const deletedNodes = [nodes[1]];
    const remainingNodes = [nodes[0]];
    const cleanedEdges = cleanStaleEdges(edges, deletedNodes);

    expect(cleanedEdges).toHaveLength(0);

    const state = translateToCircuitState(remainingNodes, cleanedEdges);
    const result = solveCircuit(state);
    
    // A battery left by itself is a safely contained, blocking open circuit.
    expect(result.success).toBe(false);
    expect(result.branchData).toEqual([]);
    expect(result.validation.some(message => message.ruleId === 'OPEN_CIRCUIT')).toBe(true);
  });

  it('malformed/stale edge is rejected with a message rather than reaching the solver', () => {
    const nodes: Node[] = [
      { id: 'bat1', type: 'battery', data: { voltage: 9 }, position: { x: 0, y: 0 } }
    ];
    
    const edges: Edge[] = [
      // Stale edge pointing to a non-existent node
      { id: 'e1', source: 'bat1', sourceHandle: 'positive', target: 'res1', targetHandle: 'a' }
    ];

    const state = translateToCircuitState(nodes, edges);
    
    // validateIntegrity will catch it (or solver will flag floating/invalid wires)
    // Actually, validateIntegrity doesn't check for dangling wires, it checks shape.
    // The graph builder will fail with terminal not found.
    const validation = validateIntegrity(state);
    if (validation.length === 0) {
      const result = solveCircuit(state);
      expect(result.success).toBe(false);
      expect(result.validation.some(v => v.ruleId === 'MALFORMED_INPUT' || v.severity === 'error')).toBe(true);
    } else {
      expect(validation.some(v => v.severity === 'error')).toBe(true);
    }
  });

  it('rejects the same visual-terminal connection in either direction', () => {
    const edges: Edge[] = [{
      id: 'edge-1',
      source: 'resistor-1',
      sourceHandle: 'a',
      target: 'resistor-2',
      targetHandle: 'b',
    }];
    const reversed: Connection = {
      source: 'resistor-2',
      sourceHandle: 'b',
      target: 'resistor-1',
      targetHandle: 'a',
    };

    expect(hasDuplicateConnection(edges, reversed)).toBe(true);
  });

  it('allows reused handle names on different component pairs', () => {
    const edges: Edge[] = [{
      id: 'edge-1',
      source: 'resistor-1',
      sourceHandle: 'a',
      target: 'resistor-2',
      targetHandle: 'b',
    }];
    const distinctConnection: Connection = {
      source: 'resistor-3',
      sourceHandle: 'a',
      target: 'resistor-4',
      targetHandle: 'b',
    };

    expect(hasDuplicateConnection(edges, distinctConnection)).toBe(false);
  });

  it('ignores incomplete intermediate connections during duplicate checks', () => {
    const edges: Edge[] = [];
    const incompleteConnection: Connection = {
      source: 'resistor-1',
      sourceHandle: null,
      target: 'resistor-2',
      targetHandle: 'b',
    };

    expect(hasDuplicateConnection(edges, incompleteConnection)).toBe(false);
  });
});
