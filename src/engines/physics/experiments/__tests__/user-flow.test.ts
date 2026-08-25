import { describe, it, expect } from 'vitest';
import { verifyOhmsLawExperiment } from '../ohms-law';
import type { CircuitState } from '../../circuits/types';

describe('User Flow E2E: Ohm\'s Law', () => {
  it('should rigorously follow the UI step-by-step user flow and reject malicious additions', () => {
    // Step 1: User drops a single battery on the empty canvas
    let state: CircuitState = {
      components: [
        {
          id: 'bat1',
          type: 'battery',
          voltage: 9,
          terminals: [
            { id: 'b_pos', componentId: 'bat1', role: 'positive' },
            { id: 'b_neg', componentId: 'bat1', role: 'negative' }
          ]
        }
      ],
      wires: []
    };

    let result = verifyOhmsLawExperiment(state);
    expect(result.usability).toBe('unusable');
    expect(result.issues).toContain('MISSING_RESISTOR');
    expect(result.issues).toContain('MISSING_AMMETER');
    expect(result.issues).toContain('MISSING_VOLTMETER');
    // Also extraneous because length < 4 but there are missing ones, wait extraneous is only if length > 4 or mismatch quantities.
    // It's 1 battery, 0 res, 0 amm, 0 volt, length = 1. Extraneous condition triggers because res.length !== 1.
    expect(result.issues).toContain('EXTRANEOUS_COMPONENTS');

    // Step 2: User adds 1 resistor but with a dangling wire (incomplete UI drag)
    state.components.push({
      id: 'res1',
      type: 'resistor',
      resistance: 100,
      terminals: [
        { id: 'r_a', componentId: 'res1', role: 'a' },
        { id: 'r_b', componentId: 'res1', role: 'b' }
      ]
    });
    state.wires.push({
      id: 'wire1',
      sourceTerminalId: 'b_pos',
      targetTerminalId: 'fake_dangling_terminal' // UI glitch
    });

    result = verifyOhmsLawExperiment(state);
    expect(result.usability).toBe('unusable');
    // The physics core's integrity check will return success: false due to DANGLING_WIRE
    // verifyOhmsLawExperiment calls solveCircuit which catches it and sets isNotClosed = true.
    expect(result.issues).toContain('CIRCUIT_NOT_CLOSED');

    // Step 3: User wires battery and resistor correctly but forgets ammeter/voltmeter
    state.wires = [
      { id: 'w1', sourceTerminalId: 'b_pos', targetTerminalId: 'r_a' },
      { id: 'w2', sourceTerminalId: 'b_neg', targetTerminalId: 'r_b' }
    ];
    result = verifyOhmsLawExperiment(state);
    expect(result.issues).toContain('MISSING_AMMETER');
    expect(result.issues).toContain('EXTRANEOUS_COMPONENTS'); // Because length is 2

    // Step 4: User correctly adds Ammeter and Voltmeter (Perfect configuration)
    state.components.push(
      {
        id: 'amm1',
        type: 'ammeter',
        terminals: [
          { id: 'a_in', componentId: 'amm1', role: 'in' },
          { id: 'a_out', componentId: 'amm1', role: 'out' }
        ]
      },
      {
        id: 'vol1',
        type: 'voltmeter',
        terminals: [
          { id: 'v_pos', componentId: 'vol1', role: 'positive' },
          { id: 'v_neg', componentId: 'vol1', role: 'negative' }
        ]
      }
    );
    // Wire battery positive -> ammeter in -> ammeter out -> resistor a -> resistor b -> battery negative
    // Wire voltmeter across resistor a and b
    state.wires = [
      { id: 'w1', sourceTerminalId: 'b_pos', targetTerminalId: 'a_in' },
      { id: 'w2', sourceTerminalId: 'a_out', targetTerminalId: 'r_a' },
      { id: 'w3', sourceTerminalId: 'r_b', targetTerminalId: 'b_neg' },
      { id: 'w4', sourceTerminalId: 'v_pos', targetTerminalId: 'r_a' },
      { id: 'w5', sourceTerminalId: 'v_neg', targetTerminalId: 'r_b' }
    ];

    result = verifyOhmsLawExperiment(state);
    expect(result.issues).toHaveLength(0);
    expect(result.usability).toBe('usable');
    expect(result.voltageReadingV).toBeCloseTo(9, 3);
    expect(result.currentReadingA).toBeCloseTo(0.09, 3);

    // Step 5: User maliciously adds a second battery in parallel to mess with the readings
    state.components.push({
      id: 'bat2',
      type: 'battery',
      voltage: 12,
      terminals: [
        { id: 'b2_pos', componentId: 'bat2', role: 'positive' },
        { id: 'b2_neg', componentId: 'bat2', role: 'negative' }
      ]
    });
    // Wire the malicious battery across the first one
    state.wires.push({ id: 'w6', sourceTerminalId: 'b2_pos', targetTerminalId: 'b_pos' });
    state.wires.push({ id: 'w7', sourceTerminalId: 'b2_neg', targetTerminalId: 'b_neg' });

    result = verifyOhmsLawExperiment(state);
    // The exploit is sealed! It should catch EXTRANEOUS_COMPONENTS.
    expect(result.issues).toContain('EXTRANEOUS_COMPONENTS');
    expect(result.usability).not.toBe('usable');
  });
});
