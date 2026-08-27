import type {
  ChemistryConfiguration,
  ChemistryState,
} from '../../core';
import {
  applyPreparationAction,
  createPreparation,
  derivePreparationResult,
} from '..';
import type {
  PreparationAction,
  PreparationActionResult,
  PreparationDefinition,
  PreparationResult,
  PreparationState,
} from '..';

export const OXALIC_ACID_DIHYDRATE_MATERIAL_ID = 'oxalic-acid-dihydrate';
export const OXALIC_ACID_PREPARATION_VESSEL_ID = 'oxalic-acid-volumetric-flask';

export const OXALIC_ACID_PREPARATION_SPEC = {
  targetMolarityMolPerL: 0.1,
  targetVolumeL: 0.250,
  molarMassGPerMol: 126,
  targetMassG: 3.15,
  massToleranceG: 0.01,
  volumeToleranceL: 0.001,
  /** GALILEO sandbox limit, not a claimed real flask maximum. */
  modeledCapacityL: 0.300,
} as const;

export const OXALIC_ACID_PREPARATION_CONFIGURATION: ChemistryConfiguration = {
  materials: {
    [OXALIC_ACID_DIHYDRATE_MATERIAL_ID]: {
      name: 'Oxalic acid dihydrate',
      molarMassGPerMol: OXALIC_ACID_PREPARATION_SPEC.molarMassGPerMol,
    },
  },
  apparatus: {
    [OXALIC_ACID_PREPARATION_VESSEL_ID]: {
      kind: 'volumetric-flask',
      capacityL: OXALIC_ACID_PREPARATION_SPEC.modeledCapacityL,
      supportsHeating: false,
    },
  },
};

export const OXALIC_ACID_PREPARATION_DEFINITION: PreparationDefinition = {
  preparationId: 'standard-oxalic-acid-dihydrate-0.1m-250ml',
  vesselId: OXALIC_ACID_PREPARATION_VESSEL_ID,
  targetMaterialId: OXALIC_ACID_DIHYDRATE_MATERIAL_ID,
  dissolutionMode: 'complete-on-mix',
  targetMassG: OXALIC_ACID_PREPARATION_SPEC.targetMassG,
  massToleranceG: OXALIC_ACID_PREPARATION_SPEC.massToleranceG,
  targetVolumeL: OXALIC_ACID_PREPARATION_SPEC.targetVolumeL,
  volumeToleranceL: OXALIC_ACID_PREPARATION_SPEC.volumeToleranceL,
};

function initialChemistryState(): ChemistryState {
  return {
    vessels: {
      [OXALIC_ACID_PREPARATION_VESSEL_ID]: {
        temperatureC: 25,
        contents: {
          volumeL: 0,
          dissolvedAmountsMol: {},
          undissolvedAmountsMol: {},
        },
      },
    },
  };
}

export function createOxalicAcidPreparation(): PreparationActionResult {
  return createPreparation(
    OXALIC_ACID_PREPARATION_DEFINITION,
    OXALIC_ACID_PREPARATION_CONFIGURATION,
    initialChemistryState(),
  );
}

export function applyOxalicAcidPreparationAction(
  state: PreparationState,
  action: PreparationAction,
): PreparationActionResult {
  return applyPreparationAction(
    OXALIC_ACID_PREPARATION_DEFINITION,
    OXALIC_ACID_PREPARATION_CONFIGURATION,
    state,
    action,
  );
}

export function deriveOxalicAcidPreparationResult(
  state: PreparationState,
): PreparationResult {
  return derivePreparationResult(
    OXALIC_ACID_PREPARATION_DEFINITION,
    OXALIC_ACID_PREPARATION_CONFIGURATION,
    state,
  );
}
