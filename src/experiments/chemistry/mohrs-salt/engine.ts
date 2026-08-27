import type { SimulationEngine, SimulationResult } from "../../types";
import {
  applyMohrsSaltPreparationAction,
  createMohrsSaltPreparation,
  MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
  MOHRS_SALT_PREPARATION_SPEC,
} from "../preparation/named/mohrs-salt";
import {
  addMohrsSaltTitrationAcid,
  applyMohrsSaltTitrationDelivery,
  completeMohrsSaltTitration,
  createMohrsSaltTitration,
  deriveMohrsSaltTitrationResult,
  MOHRS_SALT_TITRATION_SPEC,
  prepareMohrsSaltTitrationAliquot,
  startMohrsSaltTitration,
} from "../permanganate/named/mohrs-salt";

function buildMohrsSaltTrial(volumeAdded: number) {
  let preparation = createMohrsSaltPreparation().state;
  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "add-material",
    materialId: MOHRS_SALT_HEXAHYDRATE_MATERIAL_ID,
    measuredMassG: MOHRS_SALT_PREPARATION_SPEC.targetMassG,
  }).state;
  preparation = applyMohrsSaltPreparationAction(preparation, { type: "add-external-solvent-volume", volumeL: 0.1 }).state;
  preparation = applyMohrsSaltPreparationAction(preparation, { type: "mix" }).state;
  preparation = applyMohrsSaltPreparationAction(preparation, { type: "acidify-with-dilute-sulfuric-acid" }).state;
  preparation = applyMohrsSaltPreparationAction(preparation, {
    type: "add-external-solvent-volume",
    volumeL: MOHRS_SALT_PREPARATION_SPEC.targetVolumeL - 0.1,
  }).state;
  preparation = applyMohrsSaltPreparationAction(preparation, { type: "complete-preparation" }).state;

  let trial = createMohrsSaltTitration(preparation).state;
  trial = prepareMohrsSaltTitrationAliquot(trial).state;
  trial = addMohrsSaltTitrationAcid(trial).state;
  trial = startMohrsSaltTitration(trial, 1.2).state;
  if (volumeAdded > 0) trial = applyMohrsSaltTitrationDelivery(trial, volumeAdded).state;
  trial = completeMohrsSaltTitration(trial).state;
  return deriveMohrsSaltTitrationResult(trial);
}

const equivalenceVolumeMl = (
  MOHRS_SALT_TITRATION_SPEC.nominalStandardMolarityMolPerL
  * (MOHRS_SALT_TITRATION_SPEC.aliquotVolumeMl / 1000)
  * MOHRS_SALT_TITRATION_SPEC.permanganateToReactiveIronRatio
  / MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL
) * 1000;

const endpointVolumeMl = equivalenceVolumeMl + (
  MOHRS_SALT_TITRATION_SPEC.endpointExcessAllowanceMol
  / MOHRS_SALT_TITRATION_SPEC.actualTitrantMolarityMolPerL
) * 1000;

export const mohrsSaltEngine: SimulationEngine = {
  outputColumns: [
    { key: "colorIntensity", label: "Permanganate Color", unit: "" },
    { key: "volAdded", label: "Vol Titrant Added", unit: "mL" },
    { key: "totalVol", label: "Total Solution Vol", unit: "mL" },
  ],

  compute(inputs: Record<string, number>, options?: { noiseFraction?: number }): SimulationResult {
    void options;
    const result = buildMohrsSaltTrial(inputs.volumeAdded ?? 0);
    const assessment = result.permanganateAssessment?.trialAssessment ?? null;
    const excessMol = result.permanganateAssessment?.excessPermanganateMol ?? 0;
    const colorIntensity = assessment === "endpoint"
      ? 0.15
      : assessment === "overshot"
        ? Math.min(1, 0.15 + excessMol / MOHRS_SALT_TITRATION_SPEC.endpointExcessAllowanceMol * 0.15)
        : 0;

    return {
      colorIntensity,
      volAdded: Math.round(result.deliveredVolumeMl * 100) / 100,
      totalVol: Math.round((MOHRS_SALT_TITRATION_SPEC.aliquotVolumeMl + 5 + result.deliveredVolumeMl) * 100) / 100,
      equivalenceVolume: equivalenceVolumeMl,
      endpointVolume: endpointVolumeMl,
      actualTitrantMolarity: result.actualTitrantMolarityMolPerL,
      calculatedTitrantMolarity: result.calculatedTitrantMolarityMolPerL,
      reactionSupported: result.reactionSupported,
      assessment,
      usability: result.usability,
      issueCodes: [...result.issues],
      isNearEquivalence: assessment === "before-endpoint" && result.deliveredVolumeMl >= equivalenceVolumeMl - 3,
      isNeutralized: result.permanganateAssessment?.equivalenceSatisfied ?? false,
      canCapture: result.reactionSupported,
      canSweep: result.reactionSupported && assessment !== "endpoint" && assessment !== "overshot",
    };
  },
};
