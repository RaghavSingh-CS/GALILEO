/**
 * measurements.ts — Extracts component readings and branch data from MNA results.
 *
 * PHY-011: The switch branch case has been removed from extractMeasurements.
 *   Switches are never added as branches by buildGraph (closed switches are
 *   merged into nodes via Union-Find; open switches are ignored entirely).
 *   Therefore the `switch` case in sourceCurrents.get was dead code that
 *   implied an unresolved output contract.
 *
 *   Decision: Switch state is topology-only. The open/closed state is
 *   conveyed by the CircuitState input (SwitchComponent.closed) and by the
 *   node topology it produces. No switch branch measurement is emitted.
 *   If a future requirement needs switch current/state output, a deliberate
 *   switch branch must first be introduced in buildGraph and the contract
 *   updated in integration-contract.md.
 */

import type { ElectricalGraph, MNAResult, ComponentReading, BranchReading } from './types';

export function extractMeasurements(
  graph: ElectricalGraph,
  mna: MNAResult,
  options?: { noiseFraction?: number }
): { readings: ComponentReading[]; branchData: BranchReading[] } {
  const readings: ComponentReading[] = [];
  const branchData: BranchReading[] = [];

  const noise = options?.noiseFraction ?? 0;

  function applyNoise(val: number): number {
    if (noise <= 0) return val;
    const u1 = Math.max(1e-6, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return val * (1 + z * noise);
  }

  for (const branch of graph.branches) {
    const nodeAVoltage = mna.nodeVoltages.get(branch.nodeA) ?? 0;
    const nodeBVoltage = mna.nodeVoltages.get(branch.nodeB) ?? 0;
    const voltageDrop = applyNoise(nodeAVoltage - nodeBVoltage);

    let current = 0;

    if (branch.type === 'battery') {
      current = applyNoise(-(mna.sourceCurrents.get(branch.id) ?? 0));
    } else if (branch.type === 'ammeter') {
      current = applyNoise(mna.sourceCurrents.get(branch.id) ?? 0);
    } else if (branch.type === 'resistor' || branch.type === 'variable_resistor') {
      current = voltageDrop / branch.value;
    } else if (branch.type === 'voltmeter') {
      current = 0; // Ideal voltmeter has infinite resistance — draws no current
    }
    // Note: 'switch' is intentionally absent — see module-level comment (PHY-011).

    const power = Math.abs(voltageDrop * current);

    branchData.push({
      componentId: branch.componentId,
      type: branch.type,
      voltage: voltageDrop,
      current,
      power
    });

    if (branch.type === 'ammeter') {
      readings.push({
        componentId: branch.componentId,
        type: 'ammeter',
        value: current,
        unit: 'A'
      });
    } else if (branch.type === 'voltmeter') {
      readings.push({
        componentId: branch.componentId,
        type: 'voltmeter',
        value: voltageDrop,
        unit: 'V'
      });
    }
  }

  return { readings, branchData };
}
