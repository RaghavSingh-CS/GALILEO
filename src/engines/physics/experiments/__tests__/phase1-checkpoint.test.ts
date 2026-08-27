import { describe, expect, it } from 'vitest';
import { solveCircuit } from '../../circuits';
import type { CircuitState, Terminal } from '../../circuits/types';
import { verifyOhmsLawExperiment } from '../ohms-law';
import { verifySeriesParallelExperiment } from '../series-parallel';

function terminals(
  componentId: string,
  firstRole: string,
  secondRole: string,
): [Terminal, Terminal] {
  return [
    { id: `${componentId}:${firstRole}`, componentId, role: firstRole },
    { id: `${componentId}:${secondRole}`, componentId, role: secondRole },
  ];
}

function singleLoop(voltage: number, resistance: number): CircuitState {
  return {
    components: [
      {
        id: 'battery',
        type: 'battery',
        terminals: terminals('battery', 'positive', 'negative'),
        voltage,
      },
      {
        id: 'resistor',
        type: 'resistor',
        terminals: terminals('resistor', 'a', 'b'),
        resistance,
      },
    ],
    wires: [
      {
        id: 'wire-positive',
        sourceTerminalId: 'battery:positive',
        targetTerminalId: 'resistor:a',
      },
      {
        id: 'wire-negative',
        sourceTerminalId: 'resistor:b',
        targetTerminalId: 'battery:negative',
      },
    ],
  };
}

function everyNumericOutputIsFinite(state: CircuitState): boolean {
  const result = solveCircuit(state);
  return result.readings.every(reading => Number.isFinite(reading.value))
    && result.branchData.every(branch => (
      Number.isFinite(branch.voltage)
      && Number.isFinite(branch.current)
      && (branch.power === undefined || Number.isFinite(branch.power))
    ));
}

describe('Phase 1 checkpoint — independent Physics red team', () => {
  it.each([
    [1e308, 1e-308],
    [1, 1e-320],
    [1e-300, 1e300],
  ])('never reports successful non-finite outputs for V=%s and R=%s', (voltage, resistance) => {
    const state = singleLoop(voltage, resistance);
    const result = solveCircuit(state);

    expect(result.success ? everyNumericOutputIsFinite(state) : true).toBe(true);
  });

  it.each([null, undefined, {}, { components: null, wires: [] }])(
    'contains malformed runtime payloads at both public verifier boundaries: %j',
    malformedState => {
      expect(verifyOhmsLawExperiment(malformedState as CircuitState)).toEqual({
        usability: 'unusable',
        issues: ['INVALID_CIRCUIT'],
        voltageReadingV: null,
        currentReadingA: null,
      });
      expect(verifySeriesParallelExperiment(malformedState as CircuitState)).toEqual({
        usability: 'unusable',
        configuration: 'unknown',
        issues: ['INVALID_CIRCUIT'],
        equivalentResistanceOhms: null,
        totalVoltageV: null,
        totalCurrentA: null,
      });
    },
  );

  it('reports a complete Ohm apparatus set with unfinished wiring as in-progress', () => {
    const state: CircuitState = {
      components: [
        { id: 'battery', type: 'battery', terminals: terminals('battery', 'positive', 'negative'), voltage: 5 },
        { id: 'resistor', type: 'resistor', terminals: terminals('resistor', 'a', 'b'), resistance: 100 },
        { id: 'ammeter', type: 'ammeter', terminals: terminals('ammeter', 'in', 'out') },
        { id: 'voltmeter', type: 'voltmeter', terminals: terminals('voltmeter', 'positive', 'negative') },
      ],
      wires: [],
    };

    const result = verifyOhmsLawExperiment(state);

    expect(result.usability).toBe('in-progress');
    expect(result.issues).toContain('CIRCUIT_NOT_CLOSED');
    expect(result.voltageReadingV).toBeNull();
    expect(result.currentReadingA).toBeNull();
  });

  it('reports a complete series/parallel apparatus set with unfinished wiring as in-progress', () => {
    const state: CircuitState = {
      components: [
        { id: 'battery', type: 'battery', terminals: terminals('battery', 'positive', 'negative'), voltage: 5 },
        { id: 'resistor-1', type: 'resistor', terminals: terminals('resistor-1', 'a', 'b'), resistance: 100 },
        { id: 'resistor-2', type: 'resistor', terminals: terminals('resistor-2', 'a', 'b'), resistance: 200 },
        { id: 'ammeter', type: 'ammeter', terminals: terminals('ammeter', 'in', 'out') },
        { id: 'voltmeter', type: 'voltmeter', terminals: terminals('voltmeter', 'positive', 'negative') },
      ],
      wires: [],
    };

    const result = verifySeriesParallelExperiment(state);

    expect(result.usability).toBe('in-progress');
    expect(result.configuration).toBe('unknown');
    expect(result.issues).toContain('CIRCUIT_NOT_CLOSED');
    expect(result.equivalentResistanceOhms).toBeNull();
  });

  it('returns byte-for-byte deterministic results across repeated extreme-but-solvable calls', () => {
    const state = singleLoop(1e-120, 1e120);
    const baseline = solveCircuit(state);

    expect(baseline.success).toBe(true);
    for (let iteration = 0; iteration < 100; iteration += 1) {
      expect(solveCircuit(state)).toEqual(baseline);
    }
  });
});
