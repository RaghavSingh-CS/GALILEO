import type { SimulationEngine, SimulationResult } from "../../types";
import { useExperimentStore } from "@/stores/experiment";
import { translateToCircuitState, cleanStaleEdges } from "../circuitAdapter";
import { verifySeriesParallelExperiment } from "@/engines/physics";

export const seriesParallelEngine: SimulationEngine = {
  outputColumns: [
    { key: "configuration", label: "Topology", unit: "" },
    { key: "voltage", label: "Total Voltage", unit: "V" },
    { key: "current", label: "Total Current", unit: "mA" },
    { key: "resistance", label: "Equivalent R", unit: "Ω" },
  ],

  compute(inputs: Record<string, number>): SimulationResult {
    const store = useExperimentStore.getState();
    const state = translateToCircuitState(store.nodes, store.edges);

    // Apply apparatus values to the circuit state components
    for (const comp of state.components) {
      if (comp.type === 'battery' && 'voltage' in inputs) {
        comp.voltage = inputs.voltage;
      }
      if (comp.type === 'resistor' && 'resistance' in inputs) {
        // If we have multiple resistors in this lab, they might need distinct inputs.
        // For simplicity, apply the same apparatus resistance to all variable resistors.
        comp.resistance = inputs.resistance;
      }
    }

    const verification = verifySeriesParallelExperiment(state);

    if (verification.usability !== 'usable') {
      return {
        configuration: 0,
        voltage: 0,
        current: 0,
        resistance: 0
      };
    }

    return {
      configuration: verification.configuration === 'series' ? 1 : (verification.configuration === 'parallel' ? 2 : 0),
      voltage: verification.totalVoltageV ?? 0,
      current: (verification.totalCurrentA ?? 0) * 1000, // convert A to mA
      resistance: verification.equivalentResistanceOhms ?? 0
    };
  },
};
