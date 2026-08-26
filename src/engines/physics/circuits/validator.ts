/**
 * validator.ts — Validates an ElectricalGraph against known circuit rules.
 *
 * PHY-007: Zero-resistance short-circuit detection is extended to cover
 *   arbitrary wire-chain, closed-switch, and multi-ammeter paths, not just
 *   the trivial collapsed-terminal and single-ammeter cases.
 *
 * PHY-008: Disconnected-component and active-subgraph checks now use
 *   getConductiveComponents, so a voltmeter-only link cannot make an
 *   electrically isolated subgraph appear connected.
 *
 * PHY-010: Known degenerate topologies (all-zero-resistance loops) now return
 *   specific rule IDs instead of falling through to DEGENERATE_TOPOLOGY.
 */

import type { CircuitState, ElectricalGraph, ValidationMessage } from './types';
import { getConductiveComponents, hasPathBetween } from './graph';

/**
 * PHY-007 — Detects zero-resistance short-circuit paths between battery
 * terminal nodes.
 *
 * Builds a subgraph containing only zero-resistance elements (wires that have
 * been union-found into the same node, closed switches merged into nodes, and
 * ammeter branches which have value=0). Uses BFS to determine if a battery's
 * two terminal nodes are reachable from one another through this subgraph
 * without passing through any resistive element.
 *
 * Returns SHORT_CIRCUIT messages for each shorted battery.
 */
function detectZeroResistanceShorts(graph: ElectricalGraph): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // Zero-resistance branches: ammeters (value=0) only.
  // Wires are already collapsed into nodes by buildGraph, so zero-resistance
  // wire-chain paths manifest as identical nodeA/nodeB on the battery branch
  // (collapsed terminal short), or as an ammeter path between battery nodes.
  const zeroResBranches = graph.branches.filter(
    b => b.type === 'ammeter' // value = 0 (ideal short)
  );

  for (const battery of graph.branches.filter(b => b.type === 'battery')) {
    // Trivial: battery terminals collapsed into a single node (direct wire short)
    if (battery.nodeA === battery.nodeB) {
      messages.push({
        ruleId: 'SHORT_CIRCUIT',
        severity: 'error',
        message: `Short circuit detected — battery '${battery.componentId}' terminals are connected with no resistance.`,
        componentIds: [battery.componentId],
      });
      continue;
    }

    // Non-trivial: BFS through zero-resistance branches between battery nodes.
    // Build adjacency from zero-resistance elements only.
    const adj = new Map<string, Set<string>>();
    for (const b of zeroResBranches) {
      if (!adj.has(b.nodeA)) adj.set(b.nodeA, new Set());
      if (!adj.has(b.nodeB)) adj.set(b.nodeB, new Set());
      adj.get(b.nodeA)!.add(b.nodeB);
      adj.get(b.nodeB)!.add(b.nodeA);
    }

    if (!adj.has(battery.nodeA) && !adj.has(battery.nodeB)) continue;

    // BFS from battery.nodeA through zero-resistance branches
    const visited = new Set<string>([battery.nodeA]);
    const queue = [battery.nodeA];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const neighbor of adj.get(curr) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    if (visited.has(battery.nodeB)) {
      // Collect all ammeter component IDs on the short path
      const shortedAmmeters = zeroResBranches
        .filter(b => visited.has(b.nodeA) && visited.has(b.nodeB))
        .map(b => b.componentId);

      messages.push({
        ruleId: 'SHORT_CIRCUIT',
        severity: 'error',
        message: `Short circuit detected — a zero-resistance path exists between the terminals of battery '${battery.componentId}' (through: ${shortedAmmeters.join(', ')}).`,
        componentIds: [battery.componentId, ...shortedAmmeters],
      });
    }
  }

  return messages;
}

/**
 * PHY-010 (Upgraded) — Detects loops of ideal voltage sources.
 *
 * Any closed loop consisting solely of ideal voltage sources (batteries, ammeters)
 * creates an indeterminate or contradictory MNA system (Singular Matrix).
 * Uses a Depth First Search (DFS) spanning tree approach to detect cycles.
 */
function detectVoltageSourceLoops(graph: ElectricalGraph): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const vSourceBranches = graph.branches.filter(b => b.type === 'battery' || b.type === 'ammeter');

  if (vSourceBranches.length === 0) return messages;

  // Build adjacency list: node -> array of { neighbor, branchId, componentId }
  const adj = new Map<string, { neighbor: string; branchId: string; componentId: string }[]>();
  for (const b of vSourceBranches) {
    if (!adj.has(b.nodeA)) adj.set(b.nodeA, []);
    if (!adj.has(b.nodeB)) adj.set(b.nodeB, []);
    adj.get(b.nodeA)!.push({ neighbor: b.nodeB, branchId: b.id, componentId: b.componentId });
    adj.get(b.nodeB)!.push({ neighbor: b.nodeA, branchId: b.id, componentId: b.componentId });
  }

  const visitedNodes = new Set<string>();
  
  // DFS to find cycle
  for (const startNode of adj.keys()) {
    if (visitedNodes.has(startNode)) continue;

    // Stack stores: [currentNode, parentBranchId, pathOfComponentIds]
    const stack: { node: string; parentBranch: string | null; path: string[] }[] = [];
    stack.push({ node: startNode, parentBranch: null, path: [] });

    // Note: since it's an undirected graph, standard DFS cycle detection
    // works by checking if we hit a visited node that isn't the parent.
    // However, to extract the exact cycle, we just track the path.
    const pathMap = new Map<string, string>(); // node -> parent node
    const branchMap = new Map<string, string>(); // node -> branch componentId connecting from parent

    const localVisited = new Set<string>();
    let cycleFound = false;
    let cycleNode = '';

    while (stack.length > 0) {
      const { node, parentBranch } = stack.pop()!;
      if (localVisited.has(node)) {
        cycleFound = true;
        cycleNode = node;
        break;
      }
      
      localVisited.add(node);
      visitedNodes.add(node);

      for (const edge of adj.get(node) ?? []) {
        if (edge.branchId === parentBranch) continue; // Don't go immediately back
        
        // If we see it again, it's a cycle.
        if (localVisited.has(edge.neighbor)) {
          // Push to stack so it gets processed as a cycle
          pathMap.set(edge.neighbor, node);
          branchMap.set(edge.neighbor, edge.componentId);
          stack.push({ node: edge.neighbor, parentBranch: edge.branchId, path: [] });
        } else {
          pathMap.set(edge.neighbor, node);
          branchMap.set(edge.neighbor, edge.componentId);
          stack.push({ node: edge.neighbor, parentBranch: edge.branchId, path: [] });
        }
      }
    }

    if (cycleFound) {
      // Reconstruct cycle (simplistic collection of all visited v-sources in this subgraph component)
      // For educational simplicity, if a loop exists, we flag all voltage sources in that connected subgraph.
      const loopComponentIds = new Set<string>();
      for (const edge of vSourceBranches) {
        if (localVisited.has(edge.nodeA) && localVisited.has(edge.nodeB)) {
          loopComponentIds.add(edge.componentId);
        }
      }
      
      messages.push({
        ruleId: 'PARALLEL_IDEAL_SOURCES',
        severity: 'error',
        message: 'The circuit contains a closed loop made entirely of batteries and/or ammeters. Ideal voltage sources in a loop create a contradictory system.',
        componentIds: Array.from(loopComponentIds),
      });
      return messages; // Return early, one loop is enough to fail
    }
  }

  return messages;
}

export function validateGraph(graph: ElectricalGraph, state: CircuitState): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // ── INVALID_VALUE ────────────────────────────────────────────────────────
  for (const comp of state.components) {
    if (comp.type === 'battery' && (!Number.isFinite(comp.voltage) || comp.voltage <= 0)) {
      messages.push({
        ruleId: 'INVALID_VALUE',
        severity: 'error',
        message: `Battery '${comp.id}' has invalid voltage. Must be > 0.`,
        componentIds: [comp.id]
      });
    } else if (comp.type === 'resistor' && (!Number.isFinite(comp.resistance) || comp.resistance <= 0)) {
      messages.push({
        ruleId: 'INVALID_VALUE',
        severity: 'error',
        message: `Resistor '${comp.id}' has invalid resistance. Must be > 0.`,
        componentIds: [comp.id]
      });
    } else if (comp.type === 'variable_resistor') {
      if (!Number.isFinite(comp.minResistance) || comp.minResistance <= 0 ||
          !Number.isFinite(comp.maxResistance) || comp.maxResistance < comp.minResistance ||
          !Number.isFinite(comp.currentResistance) || comp.currentResistance < comp.minResistance || comp.currentResistance > comp.maxResistance) {
        messages.push({
          ruleId: 'INVALID_VALUE',
          severity: 'error',
          message: `Variable Resistor '${comp.id}' has invalid resistance values.`,
          componentIds: [comp.id]
        });
      }
    }
  }

  // ── FLOATING_TERMINAL (PHY-023) ──────────────────────────────────────────
  for (const node of graph.nodes) {
    if (node.terminalIds.length === 1) {
      const floatingTerminalId = node.terminalIds[0];
      const ownerComponent = state.components.find(c => 
        c.terminals.some(t => t.id === floatingTerminalId)
      );
      if (ownerComponent) {
        messages.push({
          ruleId: 'FLOATING_TERMINAL',
          severity: 'warning',
          message: `Terminal '${floatingTerminalId}' on component '${ownerComponent.id}' is completely unconnected.`,
          componentIds: [ownerComponent.id]
        });
      }
    }
  }

  // ── NO_BATTERY ───────────────────────────────────────────────────────────
  const batteries = state.components.filter(c => c.type === 'battery');

  if (batteries.length === 0) {
    messages.push({
      ruleId: 'NO_BATTERY',
      severity: 'error',
      message: 'No battery in the circuit. A voltage source is required.',
      componentIds: []
    });
    return messages;
  }

  // ── SHORT_CIRCUIT (PHY-007: full zero-resistance path detection) ─────────
  messages.push(...detectZeroResistanceShorts(graph));

  // ── PARALLEL_IDEAL_SOURCES (PHY-010) ─────────────────────────────────────
  // Must run before MNA to catch closed loops of ideal voltage sources.
  messages.push(...detectVoltageSourceLoops(graph));

  // PHY-008: Use conductive components for all connectivity-based checks.
  // This ensures voltmeter-only links do not falsely connect subgraphs.
  const conductiveComponents = getConductiveComponents(graph);

  // ── Find which conductive components contain a battery node ──────────────
  const batteryNodeIds = new Set<string>();
  for (const b of graph.branches) {
    if (b.type === 'battery') {
      batteryNodeIds.add(b.nodeA);
      batteryNodeIds.add(b.nodeB);
    }
  }

  const activeGraphComponents = new Set<number>();
  conductiveComponents.forEach((compNodes, index) => {
    if (compNodes.some(n => batteryNodeIds.has(n.id))) {
      activeGraphComponents.add(index);
    }
  });

  // ── DISCONNECTED_COMPONENT ───────────────────────────────────────────────
  const warnedGraphComps = new Set<number>();
  for (const branch of graph.branches) {
    const nodeA = graph.nodes.find(n => n.id === branch.nodeA)!;

    const graphCompIndex = conductiveComponents.findIndex(comp => comp.some(n => n.id === nodeA.id));
    if (!activeGraphComponents.has(graphCompIndex) && !warnedGraphComps.has(graphCompIndex)) {
      const compNodes = conductiveComponents[graphCompIndex];
      const subgraphComponentIds = new Set<string>();

      graph.branches.forEach(b => {
        if (compNodes.some(n => n.id === b.nodeA)) {
          subgraphComponentIds.add(b.componentId);
        }
      });

      state.components.filter(c => c.type === 'switch').forEach(c => {
        if (compNodes.some(n => n.terminalIds.includes(c.terminals[0].id) || n.terminalIds.includes(c.terminals[1].id))) {
          subgraphComponentIds.add(c.id);
        }
      });

      messages.push({
        ruleId: 'DISCONNECTED_COMPONENT',
        severity: 'warning',
        message: 'One or more components are not connected to the active circuit.',
        componentIds: Array.from(subgraphComponentIds)
      });
      warnedGraphComps.add(graphCompIndex);
    }
  }

  // Check switches not in active circuit (they don't form branches)
  for (const comp of state.components.filter(c => c.type === 'switch')) {
    const nodeIdsForSwitch = graph.nodes.filter(n =>
      n.terminalIds.includes(comp.terminals[0].id) || n.terminalIds.includes(comp.terminals[1].id)
    );
    let isActive = false;
    let handledInSubgraph = false;
    for (const node of nodeIdsForSwitch) {
      const graphCompIndex = conductiveComponents.findIndex(compNodes => compNodes.some(n => n.id === node.id));
      if (activeGraphComponents.has(graphCompIndex)) {
        isActive = true;
      }
      if (warnedGraphComps.has(graphCompIndex)) {
        handledInSubgraph = true;
      }
    }
    if (!isActive && !handledInSubgraph) {
      messages.push({
        ruleId: 'DISCONNECTED_COMPONENT',
        severity: 'warning',
        message: `'${comp.id}' is not connected to the active circuit.`,
        componentIds: [comp.id]
      });
    }
  }

  // ── OPEN_CIRCUIT ─────────────────────────────────────────────────────────
  // Check if every battery is part of a closed conductive loop.
  for (const batteryBranch of graph.branches.filter(b => b.type === 'battery')) {
    // Check for a path between battery terminals excluding the battery itself
    // and all voltmeters (voltmeters don't conduct current).
    const graphWithoutBattery: ElectricalGraph = {
      nodes: graph.nodes,
      branches: graph.branches.filter(b => b.id !== batteryBranch.id && b.type !== 'voltmeter'),
      groundNodeId: graph.groundNodeId
    };

    if (!hasPathBetween(graphWithoutBattery, batteryBranch.nodeA, batteryBranch.nodeB)) {
      messages.push({
        ruleId: 'OPEN_CIRCUIT',
        severity: 'error',
        message: 'Circuit incomplete — there is no closed path for current.',
        componentIds: [batteryBranch.componentId]
      });
    }
  }

  // ── PHY-010: All-voltage-source loop (known degeneracy, specific rule ID) ─
  // A loop made entirely of voltage sources (batteries + ammeters) with no
  // resistive elements has a degenerate MNA matrix. Detect and name it
  // specifically rather than letting it fall through to DEGENERATE_TOPOLOGY.
  const conductiveBranches = graph.branches.filter(b => b.type !== 'voltmeter');
  const hasResistiveBranch = conductiveBranches.some(
    b => b.type === 'resistor' || b.type === 'variable_resistor'
  );
  const hasVoltageSources = conductiveBranches.some(
    b => b.type === 'battery' || b.type === 'ammeter'
  );
  if (hasVoltageSources && !hasResistiveBranch && conductiveBranches.length > 0) {
    // Only flag as degenerate if there is no OPEN_CIRCUIT already (an open
    // circuit with no resistors is legitimately open, not a degenerate loop).
    const alreadyOpen = messages.some(m => m.ruleId === 'OPEN_CIRCUIT');
    if (!alreadyOpen) {
      messages.push({
        ruleId: 'ALL_SOURCES_NO_RESISTANCE',
        severity: 'error',
        message: 'The circuit contains only voltage sources and zero-resistance elements with no resistive load. This creates an indeterminate system.',
        componentIds: conductiveBranches.filter(b => b.type === 'battery').map(b => b.componentId),
      });
    }
  }

  // ── AMMETER_IN_PARALLEL ──────────────────────────────────────────────────
  const ammeterBranches = graph.branches.filter(b => b.type === 'ammeter');
  for (const ammeter of ammeterBranches) {
    if (ammeter.nodeA === ammeter.nodeB) {
      messages.push({
        ruleId: 'AMMETER_IN_PARALLEL',
        severity: 'warning',
        message: `Ammeter '${ammeter.componentId}' is shorted (connected to the same node).`,
        componentIds: [ammeter.componentId]
      });
      continue;
    }

    const parallelBranch = graph.branches.find(b =>
      b.id !== ammeter.id &&
      ((b.nodeA === ammeter.nodeA && b.nodeB === ammeter.nodeB) ||
       (b.nodeA === ammeter.nodeB && b.nodeB === ammeter.nodeA))
    );

    if (parallelBranch) {
      messages.push({
        ruleId: 'AMMETER_IN_PARALLEL',
        severity: 'warning',
        message: `Ammeter '${ammeter.componentId}' appears to be connected in parallel. Ammeters must be connected in series.`,
        componentIds: [ammeter.componentId, parallelBranch.componentId]
      });
    }
  }

  // ── VOLTMETER_IN_SERIES ──────────────────────────────────────────────────
  const voltmeterBranches = graph.branches.filter(b => b.type === 'voltmeter');
  for (const voltmeter of voltmeterBranches) {
    const nonVoltmeterBranches = graph.branches.filter(b => b.type !== 'voltmeter');
    const nodeADegree = nonVoltmeterBranches.filter(b => b.nodeA === voltmeter.nodeA || b.nodeB === voltmeter.nodeA).length;
    const nodeBDegree = nonVoltmeterBranches.filter(b => b.nodeA === voltmeter.nodeB || b.nodeB === voltmeter.nodeB).length;

    if (nodeADegree <= 1 || nodeBDegree <= 1) {
      messages.push({
        ruleId: 'VOLTMETER_IN_SERIES',
        severity: 'warning',
        message: 'Voltmeter should be connected in parallel across the component being measured.',
        componentIds: [voltmeter.componentId]
      });
    }
  }

  return messages;
}
