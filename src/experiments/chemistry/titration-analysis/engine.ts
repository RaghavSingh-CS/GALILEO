import type { SimulationEngine, SimulationResult } from "../../types";
import { useSettingsStore } from "@/stores/settings";
import {
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  MOHRS_SALT_PREPARATION_SPEC,
  applyMohrsSaltPreparationAction,
  createMohrsSaltPreparation,
} from "../preparation/named";

import {
  MOHRS_SALT_TITRATION_SPEC,
  addMohrsSaltTitrationAcid,
  applyMohrsSaltTitrationDelivery,
  createMohrsSaltTitration,
  deriveMohrsSaltTitrationResult,
  prepareMohrsSaltTitrationAliquot,
  startMohrsSaltTitration,
} from "../permanganate/named";

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

function computePHFromStoichiometry(volumeAdded: number): number {
  const volAdded = Math.max(0, volumeAdded);
  const vBase = MOHRS_SALT_PREPARATION_SPEC.targetVolumeL * 1000;
  const mBase = MOHRS_SALT_PREPARATION_SPEC.targetMolarityMolPerL;
  const mAcid = MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL;

  const molesBaseInitial = (vBase / 1000) * mBase;
  const molesAcidAdded = (volAdded / 1000) * mAcid;
  const totalVolumeL = (vBase + volAdded) / 1000;

  let computedPH = 7.0;

  if (molesAcidAdded < molesBaseInitial) {
    const excessMolesOH = molesBaseInitial - molesAcidAdded;
    const concOH = excessMolesOH / totalVolumeL;
    const pOH = -Math.log10(Math.max(1e-14, concOH));
    computedPH = 14 - pOH;
  } else if (Math.abs(molesAcidAdded - molesBaseInitial) < 1e-6) {
    computedPH = 7.0;
  } else {
    const excessMolesH = molesAcidAdded - molesBaseInitial;
    const concH = excessMolesH / totalVolumeL;
    computedPH = -Math.log10(Math.max(1e-14, concH));
  }

  return computedPH;
}

export const titrationEngine: SimulationEngine = {
  outputColumns: [
    { key: "ph", label: "Sensor pH", unit: "pH" },
    { key: "volAdded", label: "Vol Titrant Added", unit: "mL" },
    { key: "totalVol", label: "Total Solution Vol", unit: "mL" },
  ],

  compute(inputs: Record<string, number>): SimulationResult {
    const volAdded = inputs.volumeAdded ?? 0;
    const analyteVolume = inputs.analyteVolume ?? MOHRS_SALT_PREPARATION_SPEC.targetVolumeL * 1000;

    const chemResult = buildMohrsSaltTrial(volAdded);
    const stoichiometricPH = computePHFromStoichiometry(volAdded);
    const noiseFraction = useSettingsStore.getState().getNoiseFraction();
    const chemistryBias = chemResult.usability === "usable" ? 0.15 : 0.0;
    const noisyPH = gaussianNoise(stoichiometricPH + chemistryBias, noiseFraction * 1.5);
    const clampedPH = Math.max(1.0, Math.min(13.8, noisyPH));

    return {
      ph: Math.round(clampedPH * 100) / 100,
      volAdded: Math.round(volAdded * 100) / 100,
      totalVol: Math.round((analyteVolume + volAdded) * 100) / 100,
    };
  },
};
