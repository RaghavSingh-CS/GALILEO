import type { SimulationEngine, SimulationResult } from "../../types";
import {
  applyOxalicAcidPreparationAction,
  createOxalicAcidPreparation,
  OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  OXALIC_ACID_PREPARATION_SPEC,
} from "../preparation/named/oxalic-acid";
import {
  addOxalicAcidTitrationAcid,
  applyOxalicAcidTitrationDelivery,
  completeOxalicAcidTitration,
  createOxalicAcidTitration,
  deriveOxalicAcidTitrationResult,
  heatOxalicAcidTitration,
  OXALIC_ACID_TITRATION_SPEC,
  prepareOxalicAcidTitrationAliquot,
  startOxalicAcidTitration,
} from "../permanganate/named/oxalic-acid";

function buildOxalicAcidTrial(volumeAdded: number, flaskTemperature: number) {
  let preparation = createOxalicAcidPreparation().state;
  preparation = applyOxalicAcidPreparationAction(preparation, {
    type: "add-material",
    materialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
    measuredMassG: OXALIC_ACID_PREPARATION_SPEC.targetMassG,
  }).state;
  preparation = applyOxalicAcidPreparationAction(preparation, { type: "add-external-solvent-volume", volumeL: 0.1 }).state;
  preparation = applyOxalicAcidPreparationAction(preparation, { type: "mix" }).state;
  preparation = applyOxalicAcidPreparationAction(preparation, {
    type: "add-external-solvent-volume",
    volumeL: OXALIC_ACID_PREPARATION_SPEC.targetVolumeL - 0.1,
  }).state;
  preparation = applyOxalicAcidPreparationAction(preparation, { type: "complete-preparation" }).state;

  let trial = createOxalicAcidTitration(preparation).state;
  trial = prepareOxalicAcidTitrationAliquot(trial).state;
  trial = addOxalicAcidTitrationAcid(trial).state;
  trial = heatOxalicAcidTitration(trial, flaskTemperature).state;
  trial = startOxalicAcidTitration(trial, 1.2).state;
  if (volumeAdded > 0) trial = applyOxalicAcidTitrationDelivery(trial, volumeAdded).state;
  trial = completeOxalicAcidTitration(trial).state;
  return deriveOxalicAcidTitrationResult(trial);
}

const equivalenceVolumeMl = (
  OXALIC_ACID_TITRATION_SPEC.nominalStandardMolarityMolPerL
  * (OXALIC_ACID_TITRATION_SPEC.aliquotVolumeMl / 1000)
  * OXALIC_ACID_TITRATION_SPEC.permanganatePerReactiveOxalateRatio
  / OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL
) * 1000;

const endpointVolumeMl = equivalenceVolumeMl + (
  OXALIC_ACID_TITRATION_SPEC.endpointExcessAllowanceMol
  / OXALIC_ACID_TITRATION_SPEC.actualTitrantMolarityMolPerL
) * 1000;

export const oxalicAcidEngine: SimulationEngine = {
  outputColumns: [
    { key: "colorIntensity", label: "Permanganate Color", unit: "" },
    { key: "volAdded", label: "Vol Titrant Added", unit: "mL" },
    { key: "totalVol", label: "Total Solution Vol", unit: "mL" },
  ],

  compute(inputs: Record<string, number>, options?: { noiseFraction?: number }): SimulationResult {
    void options;
    const result = buildOxalicAcidTrial(inputs.volumeAdded ?? 0, inputs.flaskTemperature ?? 55);
    const assessment = result.permanganateAssessment?.trialAssessment ?? null;
    const excessMol = result.permanganateAssessment?.excessPermanganateMol ?? 0;
    const colorIntensity = assessment === "endpoint"
      ? 0.15
      : assessment === "overshot"
        ? Math.min(1, 0.15 + excessMol / OXALIC_ACID_TITRATION_SPEC.endpointExcessAllowanceMol * 0.15)
        : 0;

    return {
      colorIntensity,
      volAdded: Math.round(result.deliveredVolumeMl * 100) / 100,
      totalVol: Math.round((OXALIC_ACID_TITRATION_SPEC.aliquotVolumeMl + 5 + result.deliveredVolumeMl) * 100) / 100,
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
