/**
 * index.ts — Public API facade for the Physics circuit engine.
 *
 * solveCircuit() is the ONLY public entry point. It is guaranteed to never
 * throw — all exceptions are caught and converted to ValidationMessages.
 * (PHY-022: solveMNA in solver.ts is an internal function that may throw;
 * this facade contains it.)
 *
 * Execution order:
 *   1. validateIntegrity — structural/runtime boundary check (PHY-024)
 *   2. buildGraph — topology construction, dangling-wire detection (PHY-001)
 *   3. validateGraph — circuit rules, short-circuit, topology checks
 *   4. solveMNA — numerical solve (only if no blocking errors)
 *   5. extractMeasurements — produce readings from MNA result
 */

import type { CircuitState, SimulationResult } from './types';
import { buildGraph } from './graph';
import { validateGraph } from './validator';
import { solveMNA } from './solver';
import { extractMeasurements } from './measurements';
import { validateIntegrity } from './integrity';

export * from './types';

/**
 * Solves a circuit and returns simulation results.
 *
 * This function never throws. All errors are returned as ValidationMessages
 * in the result. It is safe to call directly from UI/adapter code.
 *
 * @param state - The circuit state from the UI adapter. Accepts `unknown` so
 *   untrusted runtime data (from adapters, persisted state, or React Flow)
 *   is safely handled before any type assertions occur.
 */
export function solveCircuit(state: CircuitState, options?: { noiseFraction?: number }): SimulationResult {
  // 1. Runtime input-integrity validation (PHY-002/003/004/005/006/024)
  //    Accepts unknown so malformed adapter output doesn't bypass checks.
  const integrityMessages = validateIntegrity(state as unknown);
  if (integrityMessages.some(v => v.severity === 'error')) {
    return { success: false, readings: [], branchData: [], validation: integrityMessages };
  }

  // 2. Build graph + detect dangling wire endpoints (PHY-001)
  const { graph, messages: graphMessages } = buildGraph(state);

  // Dangling wires are blocking — a mismatched edge can silently change topology
  const validation = [...integrityMessages, ...graphMessages];
  if (graphMessages.some(v => v.severity === 'error')) {
    return { success: false, readings: [], branchData: [], validation };
  }

  // 3. Validate graph (PHY-007/008/010 and existing rules)
  const graphValidation = validateGraph(graph, state);
  validation.push(...graphValidation);

  // 4. Check for blocking errors
  const hasErrors = validation.some(v => v.severity === 'error');
  if (hasErrors) {
    return { success: false, readings: [], branchData: [], validation };
  }

  // 5. Solve MNA (PHY-009: voltmeter-aware reachability inside solveMNA)
  try {
    const mnaResult = solveMNA(graph);
    const { readings, branchData } = extractMeasurements(graph, mnaResult, options);
    return { success: true, readings, branchData, validation };
  } catch (e) {
    // Unknown numerical failure — fallback DEGENERATE_TOPOLOGY.
    // Known degenerate topologies are caught earlier in validateGraph (PHY-010)
    // and return specific rule IDs. This catch is a safety net only.
    validation.push({
      ruleId: 'DEGENERATE_TOPOLOGY',
      severity: 'error',
      message: 'Unable to solve the circuit. Check for floating components or unusual connections.',
      componentIds: state.components.filter(c => c.type === 'battery').map(c => c.id)
    });
    return { success: false, readings: [], branchData: [], validation };
  }
}
