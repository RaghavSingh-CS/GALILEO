import { ElectricalGraph, MNAResult, ComponentReading, BranchReading } from './types';

export function extractMeasurements(
  graph: ElectricalGraph,
  mna: MNAResult
): { readings: ComponentReading[]; branchData: BranchReading[] } {
  const readings: ComponentReading[] = [];
  const branchData: BranchReading[] = [];

  for (const branch of graph.branches) {
    const nodeAVoltage = mna.nodeVoltages.get(branch.nodeA) ?? 0;
    const nodeBVoltage = mna.nodeVoltages.get(branch.nodeB) ?? 0;
    const voltageDrop = nodeAVoltage - nodeBVoltage;

    let current = 0;

    if (branch.type === 'battery') {
      current = -(mna.sourceCurrents.get(branch.id) ?? 0);
    } else if (branch.type === 'ammeter' || branch.type === 'switch') {
      current = mna.sourceCurrents.get(branch.id) ?? 0;
    } else if (branch.type === 'resistor' || branch.type === 'variable_resistor') {
      current = voltageDrop / branch.value;
    } else if (branch.type === 'voltmeter') {
      current = 0; // Ideal voltmeter has infinite resistance
    }

    branchData.push({
      componentId: branch.componentId,
      type: branch.type,
      voltage: voltageDrop,
      current
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
