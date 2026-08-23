import { CircuitState, ElectricalGraph, ElectricalNode, Branch, ComponentType, Component } from './types';

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor(elements: string[]) {
    this.parent = new Map();
    this.rank = new Map();
    for (const el of elements) {
      this.parent.set(el, el);
      this.rank.set(el, 0);
    }
  }

  find(x: string): string {
    if (!this.parent.has(x)) return x;
    let root = x;
    while (root !== this.parent.get(root)) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let curr = x;
    while (curr !== root) {
      const nxt = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = nxt;
    }
    return root;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX) ?? 0;
    const rankY = this.rank.get(rootY) ?? 0;

    if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const el of this.parent.keys()) {
      const root = this.find(el);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(el);
    }
    return groups;
  }
}

export function buildGraph(state: CircuitState): ElectricalGraph {
  const terminalIds: string[] = [];
  for (const comp of state.components) {
    for (const term of comp.terminals) {
      terminalIds.push(term.id);
    }
  }

  const uf = new UnionFind(terminalIds);

  const terminalSet = new Set(terminalIds);
  for (const wire of state.wires) {
    if (terminalSet.has(wire.sourceTerminalId) && terminalSet.has(wire.targetTerminalId)) {
      uf.union(wire.sourceTerminalId, wire.targetTerminalId);
    }
  }

  for (const comp of state.components) {
    if (comp.type === 'switch' && comp.closed) {
      uf.union(comp.terminals[0].id, comp.terminals[1].id);
    }
  }

  const groups = uf.getGroups();
  const nodes: ElectricalNode[] = [];
  const rootToNodeId = new Map<string, string>();

  let nodeIndex = 0;
  for (const [root, members] of groups.entries()) {
    const nodeId = `node_${nodeIndex++}`;
    nodes.push({
      id: nodeId,
      terminalIds: members,
      isGround: false
    });
    rootToNodeId.set(root, nodeId);
  }

  const branches: Branch[] = [];
  let groundNodeId = '';

  for (const comp of state.components) {
    if (comp.type === 'switch') {
      continue; // switches are handled via union (if closed) or ignored (if open)
    }

    const rootA = uf.find(comp.terminals[0].id);
    const rootB = uf.find(comp.terminals[1].id);
    const nodeA = rootToNodeId.get(rootA)!;
    const nodeB = rootToNodeId.get(rootB)!;

    let value = 0;
    if (comp.type === 'battery') value = comp.voltage;
    else if (comp.type === 'resistor') value = comp.resistance;
    else if (comp.type === 'variable_resistor') value = comp.currentResistance;
    else if (comp.type === 'ammeter') value = 0;
    else if (comp.type === 'voltmeter') value = Infinity;

    branches.push({
      id: comp.id,
      componentId: comp.id,
      type: comp.type,
      nodeA,
      nodeB,
      value
    });

    if (comp.type === 'battery' && groundNodeId === '') {
      // First battery's negative terminal sets the ground
      // Convention: terminal[1] is negative for battery
      groundNodeId = nodeB; 
    }
  }

  if (groundNodeId) {
    const gNode = nodes.find(n => n.id === groundNodeId);
    if (gNode) gNode.isGround = true;
  } else if (nodes.length > 0) {
    // If no battery, pick arbitrary ground
    nodes[0].isGround = true;
    groundNodeId = nodes[0].id;
  }

  return {
    nodes,
    branches,
    groundNodeId
  };
}

export function getConnectedComponents(graph: ElectricalGraph): ElectricalNode[][] {
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }

  for (const branch of graph.branches) {
    adj.get(branch.nodeA)!.push(branch.nodeB);
    adj.get(branch.nodeB)!.push(branch.nodeA);
  }

  const visited = new Set<string>();
  const components: ElectricalNode[][] = [];
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      const compNodes: ElectricalNode[] = [];
      const queue = [node.id];
      visited.add(node.id);

      while (queue.length > 0) {
        const currId = queue.shift()!;
        compNodes.push(nodeMap.get(currId)!);

        for (const neighborId of adj.get(currId) || []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
      components.push(compNodes);
    }
  }

  return components;
}

export function hasPathBetween(graph: ElectricalGraph, nodeA: string, nodeB: string): boolean {
  if (nodeA === nodeB) return true;

  const adj = new Map<string, string[]>();
  for (const branch of graph.branches) {
    if (!adj.has(branch.nodeA)) adj.set(branch.nodeA, []);
    if (!adj.has(branch.nodeB)) adj.set(branch.nodeB, []);
    adj.get(branch.nodeA)!.push(branch.nodeB);
    adj.get(branch.nodeB)!.push(branch.nodeA);
  }

  if (!adj.has(nodeA) || !adj.has(nodeB)) return false;

  const visited = new Set<string>();
  const queue = [nodeA];
  visited.add(nodeA);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (currId === nodeB) return true;

    for (const neighborId of adj.get(currId) || []) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return false;
}
