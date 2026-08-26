/**
 * solver.ts — Modified Nodal Analysis (MNA) solver.
 *
 * PHY-009: Reachability from ground is now computed from conductive branches
 *   only (voltmeters excluded) before activeBranches is determined. This
 *   prevents voltmeter-linked floating nodes from entering the MNA system and
 *   causing avoidable SINGULAR_MATRIX / DEGENERATE_TOPOLOGY results.
 *
 * PHY-022: solveMNA is an internal function that MAY throw 'SINGULAR_MATRIX'.
 *   Do NOT call it directly from UI code. Use solveCircuit() in index.ts,
 *   which is the safe, non-throwing public boundary for the engine.
 */

import * as math from 'mathjs';
import type { ElectricalGraph, MNAResult } from './types';

/**
 * @internal
 * Solves the circuit using Modified Nodal Analysis.
 *
 * @throws {Error} with message 'SINGULAR_MATRIX' if the system is numerically
 *   singular. This is an internal exception. Callers MUST catch it.
 *   External code should call solveCircuit() in index.ts instead.
 */
export function solveMNA(graph: ElectricalGraph): MNAResult {
  // If there is no ground node, we can't solve anything
  if (!graph.groundNodeId || graph.nodes.length === 0) {
    return {
      nodeVoltages: new Map(),
      sourceCurrents: new Map()
    };
  }

  // PHY-009: Build reachability adjacency from CONDUCTIVE branches only
  // (exclude voltmeters). This prevents ideal voltmeter links from pulling
  // floating nodes into the active MNA system.
  const conductiveAdj = new Map<string, string[]>();
  for (const b of graph.branches) {
    if (b.type === 'voltmeter') continue; // non-conductive — skip for reachability
    if (!conductiveAdj.has(b.nodeA)) conductiveAdj.set(b.nodeA, []);
    if (!conductiveAdj.has(b.nodeB)) conductiveAdj.set(b.nodeB, []);
    conductiveAdj.get(b.nodeA)!.push(b.nodeB);
    conductiveAdj.get(b.nodeB)!.push(b.nodeA);
  }

  // Find all nodes reachable from ground via conductive paths
  const reachableNodes = new Set<string>();
  const queue = [graph.groundNodeId];
  reachableNodes.add(graph.groundNodeId);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const neighbor of conductiveAdj.get(curr) || []) {
      if (!reachableNodes.has(neighbor)) {
        reachableNodes.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  // 1. Filter branches (exclude voltmeters AND unreachable components)
  const activeBranches = graph.branches.filter(
    b => b.type !== 'voltmeter' && reachableNodes.has(b.nodeA) && reachableNodes.has(b.nodeB)
  );

  // 2. Identify voltage source branches (batteries, ammeters)
  const vSources = activeBranches.filter(b => b.type === 'battery' || b.type === 'ammeter');

  const M = vSources.length;

  // 3. Build node index map (excluding ground)
  const nonGroundNodes = graph.nodes.filter(n => !n.isGround && reachableNodes.has(n.id));
  const N = nonGroundNodes.length;

  const nodeIndexMap = new Map<string, number>();
  nonGroundNodes.forEach((node, idx) => {
    nodeIndexMap.set(node.id, idx);
  });

  // If there are no nodes, return empty (e.g. empty circuit)
  if (N === 0) {
    return {
      nodeVoltages: new Map(),
      sourceCurrents: new Map()
    };
  }

  // 4. Initialize matrices
  const A: number[][] = Array(N + M).fill(0).map(() => Array(N + M).fill(0));
  const z: number[] = Array(N + M).fill(0);

  // PHY-026: GMIN Stepping (Implicit Resistance)
  // Inject a microscopic conductance (1e-9 S) from every node to ground.
  // This physically anchors floating nodes and gracefully eliminates 
  // SINGULAR_MATRIX crashes without affecting educational-precision measurements.
  const GMIN = 1e-9;
  for (let i = 0; i < N; i++) {
    A[i][i] += GMIN;
  }

  // 5. Stamp resistive branches
  for (const branch of activeBranches) {
    if (branch.type === 'resistor' || branch.type === 'variable_resistor') {
      const g = 1 / branch.value;
      const i = nodeIndexMap.get(branch.nodeA);
      const j = nodeIndexMap.get(branch.nodeB);

      if (i !== undefined) {
        A[i][i] += g;
      }
      if (j !== undefined) {
        A[j][j] += g;
      }
      if (i !== undefined && j !== undefined) {
        A[i][j] -= g;
        A[j][i] -= g;
      }
    }
  }

  // 6. Stamp voltage source branches
  vSources.forEach((branch, k) => {
    const col = N + k;
    const row = N + k;
    const i = nodeIndexMap.get(branch.nodeA);
    const j = nodeIndexMap.get(branch.nodeB);

    // Convention: branch.nodeA is the positive terminal (terminal 0)
    // branch.nodeB is the negative terminal (terminal 1)
    if (i !== undefined) {
      A[i][col] += 1;
      A[row][i] += 1;
    }
    if (j !== undefined) {
      A[j][col] -= 1;
      A[row][j] -= 1;
    }

    z[row] = branch.value; // For battery it's V, for ammeter it's 0
  });

  // 7. Solve A * x = z
  let x: number[];
  try {
    // math.lusolve returns a 2D array (column vector). We flatten it.
    const result = math.lusolve(A, z) as number[][] | number[];
    if (Array.isArray(result) && Array.isArray(result[0])) {
      x = (result as number[][]).map(r => r[0]);
    } else {
      x = result as number[];
    }
  } catch {
    throw new Error('SINGULAR_MATRIX');
  }

  // 8. Build MNAResult
  const nodeVoltages = new Map<string, number>();
  nonGroundNodes.forEach((node, idx) => {
    nodeVoltages.set(node.id, x[idx]);
  });
  // Add ground node
  if (graph.groundNodeId) {
    nodeVoltages.set(graph.groundNodeId, 0);
  }

  const sourceCurrents = new Map<string, number>();
  vSources.forEach((branch, k) => {
    sourceCurrents.set(branch.id, x[N + k]);
  });

  return {
    nodeVoltages,
    sourceCurrents
  };
}
