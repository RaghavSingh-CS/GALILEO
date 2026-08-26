import type { SimulationEngine, SimulationResult } from "../../types";
import {
  applyOxalicAcidPreparationAction,
  createOxalicAcidPreparation,
  OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  OXALIC_ACID_PREPARATION_SPEC,
} from "../preparation/named/oxalic-acid";

import {
  createOxalicAcidTitration,
  prepareOxalicAcidTitrationAliquot,
  addOxalicAcidTitrationAcid,
  heatOxalicAcidTitration,
  startOxalicAcidTitration,
  applyOxalicAcidTitrationDelivery,
  deriveOxalicAcidTitrationResult,
} from "../permanganate/named/oxalic-acid";

function buildOxalicAcidTrial(volumeAdded: number, flaskTemperature: number) {
  let preparation = createOxalicAcidPreparation().state;

  preparation = applyOxalicAcidPreparationAction(preparation, {
    type: "add-material",
    materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
    measuredMassG: OXALIC_ACID_PREPARATION_SPEC.targetMassG,
  }).state;

  preparation = applyOxalicAcidPreparationAction(preparation, {
    type: "add-external-solvent-volume",
    volumeL: 0.1,
  }).state;

  preparation = applyOxalicAcidPreparationAction(preparation, { type: "mix" }).state;

  preparation = applyOxalicAcidPreparationAction(preparation, {
    type: "add-external-solvent-volume",
    volumeL: OXALIC_ACID_PREPARATION_SPEC.targetVolumeL - 0.1,
  }).state;

  preparation = applyOxalicAcidPreparationAction(preparation, {
    type: "complete-preparation",
  }).state;

  let trial = createOxalicAcidTitration(preparation).state;
  trial = prepareOxalicAcidTitrationAliquot(trial).state;
  trial = addOxalicAcidTitrationAcid(trial).state;
  
  trial = heatOxalicAcidTitration(trial, flaskTemperature).state;

  trial = startOxalicAcidTitration(trial, 1.2).state;

  if (volumeAdded > 0) {
    trial = applyOxalicAcidTitrationDelivery(trial, volumeAdded).state;
  }

  return deriveOxalicAcidTitrationResult(trial);
}

export const oxalicAcidEngine: SimulationEngine = {
  outputColumns: [
    { key: "colorIntensity", label: "Permanganate Color", unit: "" },
    { key: "volAdded", label: "Vol Titrant Added", unit: "mL" },
    { key: "totalVol", label: "Total Solution Vol", unit: "mL" },
  ],

  compute(inputs: Record<string, number>, options?: { noiseFraction?: number }): SimulationResult {
    void options;
    const volAdded = inputs.volumeAdded ?? 0;
    const flaskTemperature = inputs.flaskTemperature ?? 55;
    const aliquotVolume = inputs.aliquotVolume ?? 10;
    
    // We assume 3.15g dissolved in 250mL -> 0.1M standard
    // M1V1 / n1 = M2V2 / n2
    // 2 moles KMnO4 reacts with 5 moles Oxalic Acid
    // KMnO4 (titrant) = M1, Oxalic (aliquot) = M2
    const mOxalic = 0.1;
    const vOxalic = aliquotVolume; // mL
    const mPermanganate = 0.02; // Typical real concentration is ~0.02M
    
    // Equivalence volume
    const molesOxalic = mOxalic * (vOxalic / 1000);
    const molesPermanganateRequired = molesOxalic * (2/5);
    const equivalenceVolume = (molesPermanganateRequired / mPermanganate) * 1000;
    
    // Since our backend relies on the spec values, we can query the result:
    const chemResult = buildOxalicAcidTrial(volAdded, flaskTemperature);
    
    const isNearEquivalence = Math.abs(volAdded - equivalenceVolume) < 3.0;
    const isNeutralized = volAdded >= equivalenceVolume;
    
    // Determine color intensity (0 = colorless, 1 = deep purple/pink)
    // Permanganate color discharges if reaction runs.
    let colorIntensity = 0;
    // If temp too low, reaction is slow/fails and leaves color.
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
    
    const observedVolAdded = Math.max(0, volAdded);
    
    return {
      colorIntensity: Math.max(0, Math.min(1, colorIntensity)),
      volAdded: Math.round(observedVolAdded * 100) / 100,
      totalVol: Math.round((aliquotVolume + 5 + observedVolAdded) * 100) / 100, // Aliquot + 5mL acid + titrant
      equivalenceVolume,
      isNearEquivalence,
      isNeutralized
    };
  },
};
