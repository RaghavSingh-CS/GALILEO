import { solveCircuit } from '../circuits/index';
import { buildGraph } from '../circuits/graph';
import type { CircuitState } from '../circuits/types';
import type { SeriesParallelIssueCode, SeriesParallelResult, ExperimentUsability } from './types';

export function verifySeriesParallelExperiment(state: CircuitState): SeriesParallelResult {
  const issues: SeriesParallelIssueCode[] = [];
  
  const batteries = state.components.filter(c => c.type === 'battery');
  const resistors = state.components.filter(c => c.type === 'resistor' || c.type === 'variable_resistor');
  const ammeters = state.components.filter(c => c.type === 'ammeter');
  const voltmeters = state.components.filter(c => c.type === 'voltmeter');

  if (batteries.length === 0) issues.push('MISSING_BATTERY');
  if (resistors.length < 2) issues.push('MISSING_RESISTORS');
  if (ammeters.length === 0) issues.push('MISSING_AMMETER');
  if (voltmeters.length === 0) issues.push('MISSING_VOLTMETER');

  if (
    batteries.length !== 1 ||
    ammeters.length !== 1 ||
    voltmeters.length !== 1 ||
    state.components.length > resistors.length + 3
  ) {
    issues.push('EXTRANEOUS_COMPONENTS');
  }

  const hasBasicComponents =
    batteries.length === 1 &&
    resistors.length >= 2 &&
    ammeters.length === 1 &&
    voltmeters.length === 1 &&
    state.components.length === resistors.length + 3;

  const result = solveCircuit(state);

  const isShortCircuit = result.validation.some(v => v.ruleId === 'SHORT_CIRCUIT');
  const isNotClosed = result.validation.some(v => 
    v.ruleId === 'OPEN_CIRCUIT' || 
    v.ruleId === 'DISCONNECTED_COMPONENT' ||
    v.ruleId === 'FLOATING_TERMINAL' ||
    v.ruleId === 'DANGLING_WIRE'
  );

  if (isShortCircuit) issues.push('SHORT_CIRCUIT');
  if (isNotClosed) issues.push('CIRCUIT_NOT_CLOSED');
  if (result.validation.some(v => v.severity === 'error') && !isShortCircuit && !isNotClosed) {
    issues.push('INVALID_CIRCUIT');
  }

  let usability: ExperimentUsability = 'unusable';
  let configuration: 'series' | 'parallel' | 'mixed' | 'unknown' = 'unknown';
  let equivalentResistanceOhms: number | null = null;
  let totalVoltageV: number | null = null;
  let totalCurrentA: number | null = null;

  if (hasBasicComponents && !isShortCircuit && !isNotClosed && result.success) {
    const { graph } = buildGraph(state);
    const rBranches = graph.branches.filter(b => resistors.some(r => r.id === b.componentId));
    
    // Evaluate pure parallel
    const nodes0 = new Set([rBranches[0].nodeA, rBranches[0].nodeB]);
    const isParallel = rBranches.every(b => nodes0.has(b.nodeA) && nodes0.has(b.nodeB));

    // Evaluate pure series
    const conductiveBranches = graph.branches.filter(b => b.type !== 'voltmeter');
    const nodeDegree = new Map<string, number>();
    for (const b of conductiveBranches) {
      nodeDegree.set(b.nodeA, (nodeDegree.get(b.nodeA) || 0) + 1);
      nodeDegree.set(b.nodeB, (nodeDegree.get(b.nodeB) || 0) + 1);
    }

    const rNodes = new Set<string>();
    for (const b of rBranches) {
      rNodes.add(b.nodeA);
      rNodes.add(b.nodeB);
    }

    // A pure series chain of N resistors touches exactly N+1 nodes.
    // And at least N-1 of those nodes must only connect resistors to each other (degree 2 in conductive graph).
    const internalNodesCount = Array.from(rNodes).filter(n => nodeDegree.get(n) === 2).length;
    const isSeries = rNodes.size === resistors.length + 1 && internalNodesCount >= resistors.length - 1;

    if (isParallel) configuration = 'parallel';
    else if (isSeries) configuration = 'series';
    else configuration = 'mixed';

    if (configuration === 'mixed') {
      issues.push('NOT_PURE_SERIES_OR_PARALLEL');
    }

    const ammeterReading = result.readings.find(r => r.componentId === ammeters[0].id);
    const batteryData = result.branchData.find(b => b.componentId === batteries[0].id);
    if (!ammeterReading || !batteryData) {
      issues.push('AMMETER_MISPLACED');
    } else {
      const scale = Math.max(1, Math.abs(batteryData.current));
      if (Math.abs(Math.abs(ammeterReading.value) - Math.abs(batteryData.current)) > 1e-9 * scale) {
        issues.push('AMMETER_MISPLACED');
      }
    }

    // NEW-001/PHY-021: Validate voltmeter placement.
    // The voltmeter must span the resistor network — it cannot be shorted
    // to a single node (measuring nothing) or connected outside the network.
    const voltmeter = voltmeters[0];
    const vmBranch = graph.branches.find(b => b.componentId === voltmeter.id);
    if (vmBranch) {
      if (vmBranch.nodeA === vmBranch.nodeB) {
        // Both terminals collapsed to same node — voltmeter measures 0V across nothing.
        issues.push('VOLTMETER_MISPLACED');
      } else {
        const resistorNodeDegree = new Map<string, number>();
        for (const rb of rBranches) {
          resistorNodeDegree.set(rb.nodeA, (resistorNodeDegree.get(rb.nodeA) ?? 0) + 1);
          resistorNodeDegree.set(rb.nodeB, (resistorNodeDegree.get(rb.nodeB) ?? 0) + 1);
        }

        const expectedBoundaryNodes = configuration === 'parallel'
          ? new Set([rBranches[0].nodeA, rBranches[0].nodeB])
          : new Set(
              Array.from(resistorNodeDegree.entries())
                .filter(([, degree]) => degree === 1)
                .map(([nodeId]) => nodeId),
            );
        const measuredNodes = new Set([vmBranch.nodeA, vmBranch.nodeB]);
        if (
          expectedBoundaryNodes.size !== 2
          || measuredNodes.size !== 2
          || !Array.from(expectedBoundaryNodes).every(nodeId => measuredNodes.has(nodeId))
        ) {
          issues.push('VOLTMETER_MISPLACED');
        }
      }
    }

    // Always compute equivalent resistance from solver data when the circuit is solved.
    // This is a physical measurement, independent of whether the configuration
    // meets the lab's pedagogical requirements.
    const battery = batteries[0];
    const batBranch = result.branchData.find(b => b.componentId === battery.id);
    if (batBranch && Math.abs(batBranch.current) > 1e-9) {
      totalVoltageV = battery.voltage;
      totalCurrentA = Math.abs(batBranch.current);
      equivalentResistanceOhms = totalVoltageV / totalCurrentA;
    }

    if (issues.length === 0) {
      usability = 'usable';
    }
  } else if (hasBasicComponents && issues.length === 0) {
    usability = 'in-progress';
  }


  return {
    usability,
    configuration,
    issues,
    equivalentResistanceOhms,
    totalVoltageV,
    totalCurrentA
  };
}
