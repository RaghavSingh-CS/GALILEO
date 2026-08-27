import type { SimulationResult } from "../types";

export function nextTitrationSweepVolume(currentVolumeMl: number, flowRateMlPerS: number, endpointVolumeMl: number): number {
  const proposed = Math.round((currentVolumeMl + flowRateMlPerS * 2) * 100) / 100;
  return Number.isFinite(endpointVolumeMl) && currentVolumeMl < endpointVolumeMl && proposed > endpointVolumeMl
    ? endpointVolumeMl
    : proposed;
}

export function shouldStopTitrationSweep(result: SimulationResult): boolean {
  return result.assessment === "endpoint"
    || result.assessment === "overshot"
    || result.reactionSupported === false
    || result.canSweep === false;
}
