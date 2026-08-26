import { solveCircuit } from '../circuits/index';
import { buildGraph } from '../circuits/graph';
import type { CircuitState } from '../circuits/types';
import type { OhmsLawIssueCode, OhmsLawResult, ExperimentUsability } from './types';

export function verifyOhmsLawExperiment(state: CircuitState): OhmsLawResult {
  const issues: OhmsLawIssueCode[] = [];
  
  const batteries = state.components.filter(c => c.type === 'battery');
  const resistors = state.components.filter(c => c.type === 'resistor' || c.type === 'variable_resistor');
  const ammeters = state.components.filter(c => c.type === 'ammeter');
  const voltmeters = state.components.filter(c => c.type === 'voltmeter');

  if (batteries.length === 0) issues.push('MISSING_BATTERY');
  if (resistors.length === 0) issues.push('MISSING_RESISTOR');
  if (ammeters.length === 0) issues.push('MISSING_AMMETER');
  if (voltmeters.length === 0) issues.push('MISSING_VOLTMETER');

  if (
    batteries.length !== 1 ||
    resistors.length !== 1 ||
    ammeters.length !== 1 ||
    voltmeters.length !== 1 ||
    state.components.length > 4
  ) {
    issues.push('EXTRANEOUS_COMPONENTS');
  }

  // Only proceed with topology checks if the circuit has exactly the 4 required components.
  const hasBasicComponents =
    batteries.length === 1 &&
    resistors.length === 1 &&
    ammeters.length === 1 &&
    voltmeters.length === 1 &&
    state.components.length === 4;

  const result = solveCircuit(state);

  // Check for critical solver issues (open circuit, short circuit, floating)
  const isShortCircuit = result.validation.some(v => v.ruleId === 'SHORT_CIRCUIT');
  const isNotClosed = result.validation.some(v => 
    v.ruleId === 'OPEN_CIRCUIT' || 
    v.ruleId === 'DISCONNECTED_COMPONENT' ||
    v.ruleId === 'FLOATING_TERMINAL' ||
    v.ruleId === 'DANGLING_WIRE'
  );

  if (isShortCircuit) issues.push('SHORT_CIRCUIT');
  if (isNotClosed) issues.push('CIRCUIT_NOT_CLOSED');

  let usability: ExperimentUsability = 'unusable';
  let voltageReadingV: number | null = null;
  let currentReadingA: number | null = null;

  if (hasBasicComponents) {
    const { graph } = buildGraph(state);

    const resistor = resistors[0];
    const ammeter = ammeters[0];
    const voltmeter = voltmeters[0];

    const resistorBranch = graph.branches.find(b => b.componentId === resistor.id);
    const ammeterBranch = graph.branches.find(b => b.componentId === ammeter.id);
    const voltmeterBranch = graph.branches.find(b => b.componentId === voltmeter.id);

    if (resistorBranch && ammeterBranch && voltmeterBranch) {
      // Guard: voltmeter shorted (both terminals on the same node) reads 0V.
      // The isParallel check below would incorrectly return true because
      // rNodes.has(nodeA) && rNodes.has(nodeA) passes when nodeA === nodeB
      // and nodeA is within the resistor nodes. Catch this first.
      if (voltmeterBranch.nodeA === voltmeterBranch.nodeB) {
        issues.push('VOLTMETER_NOT_IN_PARALLEL');
      } else {
        // Voltmeter is in parallel if it connects the exact same two nodes as the resistor
        const rNodes = new Set([resistorBranch.nodeA, resistorBranch.nodeB]);
        const isParallel = rNodes.has(voltmeterBranch.nodeA) && rNodes.has(voltmeterBranch.nodeB);
        
        if (!isParallel) {
          issues.push('VOLTMETER_NOT_IN_PARALLEL');
        }
      }

      // Ammeter is in series if it shares exactly one node with the resistor, and that node has degree 2 in the conductive graph.
      const conductiveBranches = graph.branches.filter(b => b.type !== 'voltmeter');
      const nodeDegree = new Map<string, number>();
      for (const b of conductiveBranches) {
        nodeDegree.set(b.nodeA, (nodeDegree.get(b.nodeA) || 0) + 1);
        nodeDegree.set(b.nodeB, (nodeDegree.get(b.nodeB) || 0) + 1);
      }
      
      // An ammeter could also be further down the chain, but Ohm's law specifically asks to connect it in series with the resistor.
      // So they must be part of the same pure series chain (degree 2 nodes connecting them).
      // If we just check mathematical currents, it's easier, but we only have valid currents if circuit is closed.
      if (!isNotClosed && !isShortCircuit) {
         const ammeterReadingObj = result.readings.find(r => r.componentId === ammeter.id);
         const resData = result.branchData.find(b => b.componentId === resistor.id);
         if (ammeterReadingObj && resData) {
            const iDiff = Math.abs(Math.abs(ammeterReadingObj.value) - Math.abs(resData.current));
            if (iDiff > 1e-6) issues.push('AMMETER_NOT_IN_SERIES');
         }
      } else {
         // If open/shorted, we rely on topology. Easiest check: does the ammeter share a node with the resistor?
         // Actually, if it's placed in parallel, it creates a short circuit, which we already caught.
         // Let's just trust the current matching when closed.
      }
    }
  }

  // Set usability and extract readings only if perfectly valid
  if (hasBasicComponents && !isShortCircuit && !isNotClosed && result.success && issues.length === 0) {
    usability = 'usable';
    const voltmeterReading = result.readings.find(r => r.componentId === voltmeters[0].id);
    const ammeterReadingObj = result.readings.find(r => r.componentId === ammeters[0].id);
    if (voltmeterReading && ammeterReadingObj) {
      voltageReadingV = voltmeterReading.value;
      currentReadingA = ammeterReadingObj.value;
    }
  } else if (hasBasicComponents && issues.length === 0) {
    usability = 'in-progress';
  }
  return {
    usability,
    issues,
    voltageReadingV,
    currentReadingA
  };
}
