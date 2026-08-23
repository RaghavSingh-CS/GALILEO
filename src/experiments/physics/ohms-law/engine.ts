import type { SimulationEngine, SimulationResult } from "../../types";
import { useSettingsStore } from "@/stores/settings";

function gaussianNoise(mean: number, stddevFraction: number): number {
  if (stddevFraction <= 0) return mean;
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean * (1 + z * stddevFraction);
}

export const ohmsLawEngine: SimulationEngine = {
  outputColumns: [
    { key: "current", label: "Current", unit: "mA" },
    { key: "power", label: "Power Dissipated", unit: "mW" },
  ],

  compute(inputs: Record<string, number>): SimulationResult {
    const V = inputs.voltage ?? 0;
    const R = inputs.resistance ?? 100;
    const noiseFraction = useSettingsStore.getState().getNoiseFraction();

    // I = V / R (Ohm's Law), apply configured noise fraction
    const idealCurrent = R > 0 ? V / R : 0;
    const noisyCurrent = R > 0 ? gaussianNoise(idealCurrent, noiseFraction) : 0;

    // Convert to mA for display
    const currentMA = noisyCurrent * 1000;

    // P = V * I
    const powerMW = V * noisyCurrent * 1000;

    return {
      current: Math.round(currentMA * 100) / 100,
      power: Math.round(powerMW * 100) / 100,
    };
  },
};
