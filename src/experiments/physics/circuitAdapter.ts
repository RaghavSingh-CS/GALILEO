import type { Edge, Node } from "@xyflow/react";
import type { 
  CircuitState, 
  Component, 
  Wire,
  ValidationMessage 
} from "@/engines/physics/circuits/types";

/**
 * Validates and maps a single React Flow node to a Physics Engine Component.
 */
function mapNodeToComponent(node: Node): Component | null {
  const t = node.type;
  if (!t) return null;

  const terminals: [any, any] = [
    { id: `${node.id}:a`, componentId: node.id, role: 'a' },
    { id: `${node.id}:b`, componentId: node.id, role: 'b' }
  ];

  if (t === 'battery') {
    return {
      id: node.id,
      type: 'battery',
      terminals: [
        { id: `${node.id}:positive`, componentId: node.id, role: 'positive' },
        { id: `${node.id}:negative`, componentId: node.id, role: 'negative' }
      ],
      voltage: (node.data.voltage as number) ?? 0,
    };
  }

  if (t === 'resistor') {
    return {
      id: node.id,
      type: 'resistor',
      terminals,
      resistance: (node.data.resistance as number) ?? 100,
    };
  }
  
  if (t === 'variable_resistor') {
    return {
      id: node.id,
      type: 'variable_resistor',
      terminals,
      minResistance: (node.data.minResistance as number) ?? 0,
      maxResistance: (node.data.maxResistance as number) ?? 1000,
      currentResistance: (node.data.resistance as number) ?? 100,
    };
  }

  if (t === 'switch') {
    return {
      id: node.id,
      type: 'switch',
      terminals,
      closed: (node.data.closed as boolean) ?? false,
    };
  }

  if (t === 'ammeter') {
    return {
      id: node.id,
      type: 'ammeter',
      terminals: [
        { id: `${node.id}:in`, componentId: node.id, role: 'in' },
        { id: `${node.id}:out`, componentId: node.id, role: 'out' }
      ]
    };
  }

  if (t === 'voltmeter') {
    return {
      id: node.id,
      type: 'voltmeter',
      terminals: [
        { id: `${node.id}:positive`, componentId: node.id, role: 'positive' },
        { id: `${node.id}:negative`, componentId: node.id, role: 'negative' }
      ]
    };
  }

  return null;
}

/**
 * Translates React Flow nodes and edges into the canonical CircuitState
 * required by the Physics Engine.
 */
export function translateToCircuitState(nodes: Node[], edges: Edge[]): CircuitState {
  const components: Component[] = [];
  
  for (const node of nodes) {
    const comp = mapNodeToComponent(node);
    if (comp) components.push(comp);
  }

  const wires: Wire[] = edges.map(e => ({
    id: e.id,
    sourceTerminalId: `${e.source}:${e.sourceHandle}`,
    targetTerminalId: `${e.target}:${e.targetHandle}`
  }));

  return { components, wires };
}

/**
 * PHY-020: Strips stale edges connected to deleted nodes before engine processing.
 * Returns the filtered array of edges.
 */
export function cleanStaleEdges(edges: Edge[], deletedNodes: Node[]): Edge[] {
  const deletedIds = new Set(deletedNodes.map(n => n.id));
  return edges.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target));
}

/**
 * Translates engine ValidationMessages into user-friendly strings for the UI.
 */
export function translateValidationMessages(messages: ValidationMessage[]): string[] {
  return messages.map(m => {
    switch(m.ruleId) {
      case 'MALFORMED_INPUT': return `Invalid configuration: ${m.message}`;
      case 'DUPLICATE_COMPONENT_ID': return `Circuit error: A component is duplicated (${m.componentIds.join(', ')}).`;
      case 'SHORT_CIRCUIT': return `DANGER: Short circuit detected! A power source is directly connected to itself without resistance.`;
      case 'FLOATING_COMPONENT': return `Warning: Component ${m.componentIds.join(', ')} is not fully connected.`;
      case 'OPEN_CIRCUIT': return `Open circuit: Current cannot flow because the path is incomplete.`;
      case 'EXTRANEOUS_COMPONENTS': return `Lab check: You have used extra components that are not needed for this experiment.`;
      default: return m.message;
    }
  });
}
