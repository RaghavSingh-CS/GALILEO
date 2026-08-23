import { CircuitState, SimulationResult } from './types';
import { buildGraph } from './graph';
import { validateGraph } from './validator';
import { solveMNA } from './solver';
import { extractMeasurements } from './measurements';

export * from './types';

export function solveCircuit(state: CircuitState): SimulationResult {
  // 1. Build graph
  const graph = buildGraph(state);

  // 2. Validate
  const validation = validateGraph(graph, state);

  // 3. Check for blocking errors
  const hasErrors = validation.some(v => v.severity === 'error');
  if (hasErrors) {
    return { success: false, readings: [], branchData: [], validation };
  }

  // 4. Solve MNA
  try {
    const mnaResult = solveMNA(graph);
    const { readings, branchData } = extractMeasurements(graph, mnaResult);
    return { success: true, readings, branchData, validation };
  } catch (e) {
    validation.push({
      ruleId: 'DEGENERATE_TOPOLOGY',
      severity: 'error',
      message: 'Unable to solve the circuit. Check for floating components or unusual connections.',
      componentIds: state.components.filter(c => c.type === 'battery').map(c => c.id)
    });
    return { success: false, readings: [], branchData: [], validation };
  }
}
