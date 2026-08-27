import type { Node } from "@xyflow/react";
import type { ExperimentUsability, SeriesParallelResult } from "@/engines/physics";

export function buildOhmsLawObservation(voltageV: number, currentA: number, usability: ExperimentUsability) {
  const resistanceOhms = voltageV / currentA;
  const powerW = voltageV * currentA;
  return {
    inputs: { voltage: voltageV, resistance: resistanceOhms },
    outputs: {
      current: currentA * 1000,
      power: powerW * 1000,
      currentA,
      powerW,
      validity: usability,
    },
  };
}

export function buildSeriesParallelObservation(
  result: SeriesParallelResult,
  measuredVoltageV: number,
  measuredCurrentA: number,
  nodes: Node[],
) {
  const resistorValuesOhms = nodes
    .filter(node => node.type === "resistor" || node.type === "variable_resistor")
    .map(node => Number(node.data.resistance))
    .filter(Number.isFinite);
  const totalVoltageV = result.totalVoltageV ?? measuredVoltageV;
  const totalCurrentA = result.totalCurrentA ?? measuredCurrentA;
  const equivalentResistanceOhms = result.equivalentResistanceOhms ?? totalVoltageV / totalCurrentA;

  return {
    inputs: { voltage: measuredVoltageV },
    outputs: {
      configuration: result.configuration === "series" ? 1 : 2,
      voltage: totalVoltageV,
      current: totalCurrentA * 1000,
      resistance: equivalentResistanceOhms,
      totalCurrentA,
      equivalentResistanceOhms,
      resistorValuesOhms: resistorValuesOhms.join("; "),
      validity: result.usability,
    },
  };
}
