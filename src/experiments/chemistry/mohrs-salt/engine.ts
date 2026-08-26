import type { SimulationEngine, SimulationResult } from "../../types";
import {
  MOHRS_SALT_PREPARATION_SPEC,
  applyMohrsSaltPreparationAction,
  createMohrsSaltPreparation,
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID
} from "../preparation/named/mohrs-salt";

import {
  addMohrsSaltTitrationAcid,
  applyMohrsSaltTitrationDelivery,
  createMohrsSaltTitration,
  deriveMohrsSaltTitrationResult,
  prepareMohrsSaltTitrationAliquot,
  startMohrsSaltTitration,
} from "../permanganate/named/mohrs-salt";

function gaussianNoise(mean: number, stddevFraction: number): number {
  if (stddevFraction <= 0) return mean;
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddevFraction;
}

function buildMohrsSaltTrial(volumeAdded: number) {
  let preparation = createMohrsSaltPreparation().state;

  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "add-material",
    materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
    measuredMassG: MOHRS_SALT_PREPARATION_SPEC.targetMassG,
  }).state;

  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "add-external-solvent-volume",
    volumeL: 0.1,
  }).state;

  preparation = applyMohrsSaltPreparationAction(preparation, { type: "mix" }).state;

  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "acidify-with-dilute-sulfuric-acid",
  }).state;

  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "add-external-solvent-volume",
    volumeL: MOHRS_SALT_PREPARATION_SPEC.targetVolumeL - 0.1,
  }).state;

  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "complete-preparation",
  }).state;

  let trial = createMohrsSaltTitration(preparation).state;
  trial = prepareMohrsSaltTitrationAliquot(trial).state;
  trial = addMohrsSaltTitrationAcid(trial).state;
  trial = startMohrsSaltTitration(trial, 1.2).state;

  if (volumeAdded > 0) {
    trial = applyMohrsSaltTitrationDelivery(trial, volumeAdded).state;
  }

  return deriveMohrsSaltTitrationResult(trial);
}

export const mohrsSaltEngine: SimulationEngine = {
  outputColumns: [
    { key: "colorIntensity", label: "Permanganate Color", unit: "" },
    { key: "volAdded", label: "Vol Titrant Added", unit: "mL" },
    { key: "totalVol", label: "Total Solution Vol", unit: "mL" },
  ],

  compute(inputs: Record<string, number>, options?: { noiseFraction?: number }): SimulationResult {
    const volAdded = inputs.volumeAdded ?? 0;
    const aliquotVolume = inputs.aliquotVolume ?? 10;

    // We assume 4.90g dissolved in 250mL -> 0.05M standard
    // 1 mole KMnO4 reacts with 5 moles Mohr's Salt (Fe2+)
    // KMnO4 (titrant) = M1, Mohr's (aliquot) = M2
    const mMohrs = 0.05;
    const vMohrs = aliquotVolume; // mL
    const mPermanganate = 0.02; // Typical real concentration is ~0.02M
    
    // Equivalence volume
    const molesMohrs = mMohrs * (vMohrs / 1000);
    const molesPermanganateRequired = molesMohrs * (1/5);
    const equivalenceVolume = (molesPermanganateRequired / mPermanganate) * 1000;
    
    // Validate engine state natively
    const chemResult = buildMohrsSaltTrial(volAdded);
    
    const isNearEquivalence = Math.abs(volAdded - equivalenceVolume) < 3.0;
    const isNeutralized = volAdded >= equivalenceVolume;
    
    // Determine color intensity (0 = colorless, 1 = deep purple/pink)
    let colorIntensity = 0;
    if (!chemResult.reactionSupported && volAdded > 0) {
        colorIntensity = Math.min(1.0, volAdded / 5);
    } else {
        if (volAdded >= equivalenceVolume) {
            // Excess permanganate
            const excess = volAdded - equivalenceVolume;
            colorIntensity = Math.min(1.0, excess / 5.0);
        } else {
            colorIntensity = 0;
        }
    }
    
    const observedVolAdded = Math.max(0, gaussianNoise(volAdded, options?.noiseFraction ?? 0));

    return {
      colorIntensity: Math.max(0, Math.min(1, colorIntensity)),
      volAdded: Math.round(observedVolAdded * 100) / 100,
      totalVol: Math.round((aliquotVolume + 5 + observedVolAdded) * 100) / 100,
      equivalenceVolume,
      isNearEquivalence,
      isNeutralized
    };
  },
};
