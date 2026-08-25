import type { SimulationEngine, SimulationResult } from "../../types";
import { solveCircuit } from "@/engines/physics/circuits";
import type { CircuitState, Terminal } from "@/engines/physics/circuits";

export const ohmsLawEngine: SimulationEngine = {
  outputColumns: [
    { key: "current", label: "Current", unit: "mA" },
    { key: "power", label: "Power Dissipated", unit: "mW" },
  ],

  compute(inputs: Record<string, number>, options?: { noiseFraction?: number }): SimulationResult {
    const V = inputs.voltage ?? 0;
    const R = inputs.resistance ?? 100;

    const batT1: Terminal = { id: "bat_1:pos", componentId: "bat_1", role: "positive" };
    const batT2: Terminal = { id: "bat_1:neg", componentId: "bat_1", role: "negative" };
    const resT1: Terminal = { id: "res_1:a", componentId: "res_1", role: "a" };
    const resT2: Terminal = { id: "res_1:b", componentId: "res_1", role: "b" };
    const amT1: Terminal = { id: "am_1:in", componentId: "am_1", role: "in" };
    const amT2: Terminal = { id: "am_1:out", componentId: "am_1", role: "out" };

    const circuitState: CircuitState = {
      components: [
        { id: "bat_1", type: "battery", terminals: [batT1, batT2], voltage: V },
        { id: "res_1", type: "resistor", terminals: [resT1, resT2], resistance: Math.max(R, 0.1) },
        { id: "am_1", type: "ammeter", terminals: [amT1, amT2] }
      ],
      wires: [
        { id: "w1", sourceTerminalId: batT1.id, targetTerminalId: resT1.id },
        { id: "w2", sourceTerminalId: resT2.id, targetTerminalId: amT1.id },
        { id: "w3", sourceTerminalId: amT2.id, targetTerminalId: batT2.id }
      ]
    };

    const result = solveCircuit(circuitState, options);
    let currentMA = 0;
    let powerMW = 0;

    const ammeter = result.readings.find(r => r.type === "ammeter");
    if (ammeter) {
      currentMA = Math.abs(ammeter.value) * 1000;
    }

    const resBranch = result.branchData.find(b => b.type === "resistor");
    if (resBranch) {
      powerMW = Math.abs(resBranch.voltage * resBranch.current) * 1000;
    }

    return {
      current: Math.round(currentMA * 100) / 100,
      power: Math.round(powerMW * 100) / 100,
    };
  },
};
