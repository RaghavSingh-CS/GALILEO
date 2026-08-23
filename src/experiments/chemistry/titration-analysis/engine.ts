import type { SimulationEngine, SimulationResult } from "../../types";
import { useSettingsStore } from "@/stores/settings";

function gaussianNoise(mean: number, stddevFraction: number): number {
  if (stddevFraction <= 0) return mean;
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddevFraction;
}

export const titrationEngine: SimulationEngine = {
  outputColumns: [
    { key: "ph", label: "Sensor pH", unit: "pH" },
    { key: "volAdded", label: "Vol Titrant Added", unit: "mL" },
    { key: "totalVol", label: "Total Solution Vol", unit: "mL" },
  ],

  compute(inputs: Record<string, number>): SimulationResult {
    const volAdded = inputs.volumeAdded ?? 0;
    const vBase = inputs.analyteVolume ?? 25; // mL of 0.1M base
    const mBase = 0.1; // M
    const mAcid = 0.1; // M

    const molesBaseInitial = (vBase / 1000) * mBase;
    const molesAcidAdded = (volAdded / 1000) * mAcid;
    const totalVolumeL = (vBase + volAdded) / 1000;

    let computedPH = 7.0;

    if (molesAcidAdded < molesBaseInitial) {
      // Excess base present
      const excessMolesOH = molesBaseInitial - molesAcidAdded;
      const concOH = excessMolesOH / totalVolumeL;
      const pOH = -Math.log10(Math.max(1e-14, concOH));
      computedPH = 14 - pOH;
    } else if (Math.abs(molesAcidAdded - molesBaseInitial) < 1e-6) {
      // Perfect neutral equivalence point
      computedPH = 7.0;
    } else {
      // Excess acid present
      const excessMolesH = molesAcidAdded - molesBaseInitial;
      const concH = excessMolesH / totalVolumeL;
      computedPH = -Math.log10(Math.max(1e-14, concH));
    }

    const noiseFraction = useSettingsStore.getState().getNoiseFraction();
    const noisyPH = gaussianNoise(computedPH, noiseFraction * 1.5);
    const clampedPH = Math.max(1.0, Math.min(13.8, noisyPH));

    return {
      ph: Math.round(clampedPH * 100) / 100,
      volAdded: Math.round(volAdded * 100) / 100,
      totalVol: Math.round((vBase + volAdded) * 100) / 100,
    };
  },
};
