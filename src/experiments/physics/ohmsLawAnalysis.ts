import type { Observation } from "@/experiments/types";

export interface AnalysisResult {
  label1: string;
  val1: string;
  label2: string;
  val2: string;
  summary: string;
}

export function analyzeOhmsLaw(observations: Observation[], expectedResistance: number): AnalysisResult | null {
  if (observations.length < 2) return null;

  // Validate that resistance was held constant across the observation series
  const firstR = observations[0].inputs.resistance;
  for (const obs of observations) {
    if (obs.inputs.resistance !== firstR) {
      return {
        label1: "Error",
        val1: "Variable R",
        label2: "Advice",
        val2: "Keep R const",
        summary: "Analysis failed: Resistance was not held constant.",
      };
    }
  }

  const n = observations.length;
  let sumV = 0;
  let sumI = 0;
  let sumVI = 0;
  let sumV2 = 0;
  
  for (const obs of observations) {
    const V = obs.inputs.voltage ?? 0;
    const I_A = (obs.outputs.current ?? 0) / 1000; // mA to A
    sumV += V;
    sumI += I_A;
    sumVI += V * I_A;
    sumV2 += V * V;
  }
  
  const denom = n * sumV2 - sumV * sumV;
  if (denom === 0) return null;
  
  const slope_conductance = (n * sumVI - sumV * sumI) / denom;
  const calculatedR = slope_conductance > 0 ? 1 / slope_conductance : 0;
  const setR = expectedResistance > 0 ? expectedResistance : (firstR || 100);
  const errorPct = setR > 0 ? Math.abs((calculatedR - setR) / setR) * 100 : 0;

  return {
    label1: "Calculated Slope R",
    val1: `${calculatedR.toFixed(1)} Ω`,
    label2: "Experimental Error",
    val2: `${errorPct.toFixed(2)}%`,
    summary: `Verified Ohm's Law linearity. Computed R = ${calculatedR.toFixed(1)} Ω (${errorPct.toFixed(2)}% error vs set R = ${setR} Ω).`,
  };
}
