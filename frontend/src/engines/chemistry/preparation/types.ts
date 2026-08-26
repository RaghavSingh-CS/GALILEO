import type {
  ActionOutcome,
  ApparatusId,
  ChemistryMessage,
  ChemistryState,
  MaterialId,
} from '../core';

export interface PreparationDefinition {
  readonly preparationId: string;
  readonly vesselId: ApparatusId;
  readonly targetMaterialId: MaterialId;
  /** Bounded preparation behavior; this is not a universal solubility model. */
  readonly dissolutionMode: 'unsupported' | 'complete-on-mix';
  readonly targetMassG: number;
  readonly massToleranceG: number;
  readonly targetVolumeL: number;
  readonly volumeToleranceL: number;
}

export type PreparationLifecycle = 'in-progress' | 'complete';

export interface PreparationState {
  readonly chemistryState: ChemistryState;
  readonly lifecycle: PreparationLifecycle;
  /** Procedural history; scientific inventory remains molar amounts in ChemistryState. */
  readonly measuredMassesG: Readonly<Record<MaterialId, number>>;
}

export type PreparationAction =
  | {
      readonly type: 'add-material';
      readonly materialId: MaterialId;
      readonly measuredMassG: number;
    }
  | {
      /** Adds bulk solvent from a reservoir outside the modeled apparatus system. */
      readonly type: 'add-external-solvent-volume';
      readonly volumeL: number;
    }
  | { readonly type: 'mix' }
  | { readonly type: 'complete-preparation' };

export type PreparationMessageCode =
  | 'INVALID_PREPARATION_DEFINITION'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_STATE'
  | 'PREPARATION_ALREADY_COMPLETE'
  | 'INVALID_SOLVENT_VOLUME'
  | 'DESTINATION_CAPACITY_EXCEEDED'
  | 'DISSOLUTION_UNSUPPORTED'
  | 'SOLVENT_REQUIRED'
  | 'INVALID_RESULTING_STATE';

export interface PreparationActionResult {
  readonly outcome: ActionOutcome;
  readonly state: PreparationState;
  readonly messages: readonly ChemistryMessage[];
}

export type PreparationValidity =
  | 'in-progress'
  | 'on-target'
  | 'off-target'
  | 'unusable';

export type PreparationIssueCode =
  | 'WRONG_MATERIAL_PRESENT'
  | 'ZERO_VOLUME'
  | 'TARGET_MATERIAL_UNDISSOLVED'
  | 'TARGET_MATERIAL_MISSING'
  | 'MASS_OFF_TARGET'
  | 'VOLUME_OFF_TARGET'
  | 'INVALID_INPUT';

export interface PreparationResult {
  readonly validity: PreparationValidity;
  readonly issues: readonly PreparationIssueCode[];
  readonly actualConcentrationMolPerL: number | null;
  readonly actualMassEquivalentG: number | null;
  readonly actualVolumeL: number | null;
}
