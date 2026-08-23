import { describe, expect, it } from 'vitest';
import type {
  ChemistryMessage,
  CoreAction,
  CoreActionResult,
} from '../core';

function actionType(action: CoreAction): CoreAction['type'] {
  return action.type;
}

describe('core contracts', () => {
  it('provides distinct generic action discriminants without behavior', () => {
    const actions: CoreAction[] = [
      {
        type: 'add-material',
        targetApparatusId: 'flask',
        materialId: 'sample',
        quantity: { kind: 'mass', massG: 1.575 },
      },
      {
        type: 'transfer-liquid',
        sourceApparatusId: 'beaker',
        targetApparatusId: 'flask',
        volumeL: 0.1,
      },
      { type: 'mix', apparatusId: 'flask' },
      { type: 'heat', apparatusId: 'flask', targetTemperatureC: 55 },
    ];

    expect(actions.map(actionType)).toEqual([
      'add-material',
      'transfer-liquid',
      'mix',
      'heat',
    ]);
  });

  it('represents outcome and messages without UI presentation data', () => {
    const message: ChemistryMessage = {
      code: 'EXAMPLE_WARNING',
      severity: 'warning',
      message: 'A domain warning.',
      apparatusIds: ['flask'],
      materialIds: ['sample'],
    };
    const result: CoreActionResult = {
      outcome: 'WARNING',
      state: { vessels: {} },
      messages: [message],
    };

    expect(result.outcome).toBe('WARNING');
    expect(result.messages[0]).toEqual(message);
  });
});
