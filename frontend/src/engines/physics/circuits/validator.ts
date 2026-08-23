import { CircuitState, ElectricalGraph, ValidationMessage } from './types';
import { getConnectedComponents, hasPathBetween } from './graph';

export function validateGraph(graph: ElectricalGraph, state: CircuitState): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // INVALID_VALUE check
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

  // SHORT_CIRCUIT
  for (const batteryBranch of graph.branches.filter(b => b.type === 'battery')) {
    if (batteryBranch.nodeA === batteryBranch.nodeB) {
      messages.push({
        ruleId: 'SHORT_CIRCUIT',
        severity: 'error',
        message: 'Short circuit detected — the battery terminals are connected with no resistance.',
        componentIds: [batteryBranch.componentId]
      });
    }
  }

  const ammeterBranchesForShortCheck = graph.branches.filter(b => b.type === 'ammeter');
  for (const ammeter of ammeterBranchesForShortCheck) {
    const overlappingBattery = graph.branches.find(b => 
      b.type === 'battery' && 
      ((b.nodeA === ammeter.nodeA && b.nodeB === ammeter.nodeB) || 
       (b.nodeA === ammeter.nodeB && b.nodeB === ammeter.nodeA))
    );
    if (overlappingBattery) {
      messages.push({
        ruleId: 'SHORT_CIRCUIT',
        severity: 'error',
        message: 'Short circuit detected — ammeter directly across battery terminals creates a zero-resistance path.',
        componentIds: [ammeter.componentId, overlappingBattery.componentId]
      });
    }
  }

  const connectedComponents = getConnectedComponents(graph);
  
  // Find which connected components have a battery
  const batteryNodeIds = new Set<string>();
  for (const b of graph.branches) {
    if (b.type === 'battery') {
      batteryNodeIds.add(b.nodeA);
      batteryNodeIds.add(b.nodeB);
    }
  }

  const activeGraphComponents = new Set<number>();
  connectedComponents.forEach((compNodes, index) => {
    if (compNodes.some(n => batteryNodeIds.has(n.id))) {
      activeGraphComponents.add(index);
    }
  });

  // DISCONNECTED_COMPONENT: find components not in active graph components
  const warnedGraphComps = new Set<number>();
  for (const branch of graph.branches) {
    const nodeA = graph.nodes.find(n => n.id === branch.nodeA)!;
    
    // Find which graph component this branch belongs to
    const graphCompIndex = connectedComponents.findIndex(comp => comp.some(n => n.id === nodeA.id));
    if (!activeGraphComponents.has(graphCompIndex) && !warnedGraphComps.has(graphCompIndex)) {
      // Gather all components in this disconnected subgraph
      const compNodes = connectedComponents[graphCompIndex];
      const subgraphComponentIds = new Set<string>();
      
      // Add components from branches in this subgraph
      graph.branches.forEach(b => {
        if (compNodes.some(n => n.id === b.nodeA)) {
          subgraphComponentIds.add(b.componentId);
        }
      });
      
      // Add switches that belong to this subgraph
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

  // Check switches not in active circuit too (they don't form branches)
  for (const comp of state.components.filter(c => c.type === 'switch')) {
    const nodeIdsForSwitch = graph.nodes.filter(n => n.terminalIds.includes(comp.terminals[0].id) || n.terminalIds.includes(comp.terminals[1].id));
    let isActive = false;
    let handledInSubgraph = false;
    for (const node of nodeIdsForSwitch) {
      const graphCompIndex = connectedComponents.findIndex(compNodes => compNodes.some(n => n.id === node.id));
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

  // OPEN_CIRCUIT
  // Check if every battery is part of a closed loop
  for (const batteryBranch of graph.branches.filter(b => b.type === 'battery')) {
    // We want to see if there's a path between battery.nodeA and battery.nodeB
    // WITHOUT using the battery branch itself.
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

  // AMMETER_IN_PARALLEL
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

    // Check if any other branch shares the EXACT same two nodes
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

  // VOLTMETER_IN_SERIES
  const voltmeterBranches = graph.branches.filter(b => b.type === 'voltmeter');
  for (const voltmeter of voltmeterBranches) {
    const nonVoltmeterBranches = graph.branches.filter(b => b.type !== 'voltmeter');
    const nodeADegree = nonVoltmeterBranches.filter(b => b.nodeA === voltmeter.nodeA || b.nodeB === voltmeter.nodeA).length;
    const nodeBDegree = nonVoltmeterBranches.filter(b => b.nodeA === voltmeter.nodeB || b.nodeB === voltmeter.nodeB).length;
    
    if (nodeADegree <= 1 || nodeBDegree <= 1) {
      messages.push({
        ruleId: 'VOLTMETER_IN_SERIES',
        severity: 'warning',
        message: "Voltmeter should be connected in parallel across the component being measured.",
        componentIds: [voltmeter.componentId]
      });
    }
  }

  return messages;
}
