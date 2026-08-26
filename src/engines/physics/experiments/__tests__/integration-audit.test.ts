import { describe, expect, it } from 'vitest';
import { solveCircuit } from '../../circuits';
import { verifySeriesParallelExperiment } from '../series-parallel';
import type {
  AmmeterComponent,
  BatteryComponent,
  CircuitState,
  ResistorComponent,
  VoltmeterComponent,
  Wire,
} from '../../circuits/types';

function battery(id: string, voltage: number): BatteryComponent {
  return {
    id,
    type: 'battery',
    voltage,
    terminals: [
      { id: `${id}:positive`, componentId: id, role: 'positive' },
      { id: `${id}:negative`, componentId: id, role: 'negative' },
    ],
  };
}

function resistor(id: string, resistance: number): ResistorComponent {
  return {
    id,
    type: 'resistor',
    resistance,
    terminals: [
      { id: `${id}:a`, componentId: id, role: 'a' },
      { id: `${id}:b`, componentId: id, role: 'b' },
    ],
  };
}

function ammeter(id: string): AmmeterComponent {
  return {
    id,
    type: 'ammeter',
    terminals: [
      { id: `${id}:in`, componentId: id, role: 'in' },
      { id: `${id}:out`, componentId: id, role: 'out' },
    ],
  };
}

function voltmeter(id: string): VoltmeterComponent {
  return {
    id,
    type: 'voltmeter',
    terminals: [
      { id: `${id}:positive`, componentId: id, role: 'positive' },
      { id: `${id}:negative`, componentId: id, role: 'negative' },
    ],
  };
}

function wire(id: string, sourceTerminalId: string, targetTerminalId: string): Wire {
  return { id, sourceTerminalId, targetTerminalId };
}

function simpleLoop(voltage: number, resistance: number): CircuitState {
  const b = battery('b', voltage);
  const r = resistor('r', resistance);
  return {
    components: [b, r],
    wires: [
      wire('w1', b.terminals[0].id, r.terminals[0].id),
      wire('w2', r.terminals[1].id, b.terminals[1].id),
    ],
  };
}

describe('independent integration audit', () => {
  it('preserves high-resistance current accuracy instead of letting numerical anchoring dominate', () => {
    const result = solveCircuit(simpleLoop(10, 1e12));
    expect(result.success).toBe(true);
    const current = result.branchData.find((branch) => branch.componentId === 'r')?.current;
    expect(current).toBeCloseTo(1e-11, 14);
  });

  it('remains deterministic when callers request instrument noise', () => {
    const state = simpleLoop(9, 220);
    const results = Array.from({ length: 5 }, () => solveCircuit(state, { noiseFraction: 0.015 }));
    for (const result of results.slice(1)) {
      expect(result).toEqual(results[0]);
    }
  });

  it('rejects a non-boolean switch state at the runtime boundary', () => {
    const state = {
      components: [{
        id: 's',
        type: 'switch',
        closed: 'yes',
        terminals: [
          { id: 's:a', componentId: 's', role: 'a' },
          { id: 's:b', componentId: 's', role: 'b' },
        ],
      }],
      wires: [],
    };
    const result = solveCircuit(state as unknown as CircuitState);
    expect(result.success).toBe(false);
    expect(result.validation.some((message) => message.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('requires the series-network voltmeter to span the complete resistor network', () => {
    const b = battery('b', 10);
    const r1 = resistor('r1', 100);
    const r2 = resistor('r2', 200);
    const a = ammeter('a');
    const v = voltmeter('v');
    const state: CircuitState = {
      components: [b, r1, r2, a, v],
      wires: [
        wire('w1', b.terminals[0].id, a.terminals[0].id),
        wire('w2', a.terminals[1].id, r1.terminals[0].id),
        wire('w3', r1.terminals[1].id, r2.terminals[0].id),
        wire('w4', r2.terminals[1].id, b.terminals[1].id),
        wire('wv1', v.terminals[0].id, r1.terminals[0].id),
        wire('wv2', v.terminals[1].id, r1.terminals[1].id),
      ],
    };
    const result = verifySeriesParallelExperiment(state);
    expect(result.usability).toBe('unusable');
    expect(result.issues).toContain('VOLTMETER_MISPLACED');
  });

  it('requires the parallel-network ammeter to measure total rather than one branch current', () => {
    const b = battery('b', 10);
    const r1 = resistor('r1', 100);
    const r2 = resistor('r2', 100);
    const a = ammeter('a');
    const v = voltmeter('v');
    const state: CircuitState = {
      components: [b, r1, r2, a, v],
      wires: [
        wire('w1', b.terminals[0].id, r1.terminals[0].id),
        wire('w2', b.terminals[0].id, r2.terminals[0].id),
        wire('w3', r1.terminals[1].id, a.terminals[0].id),
        wire('w4', a.terminals[1].id, b.terminals[1].id),
        wire('w5', r2.terminals[1].id, b.terminals[1].id),
        wire('wv1', v.terminals[0].id, b.terminals[0].id),
        wire('wv2', v.terminals[1].id, b.terminals[1].id),
      ],
    };
    const result = verifySeriesParallelExperiment(state);
    expect(result.usability).toBe('unusable');
    expect(result.issues).toContain('AMMETER_MISPLACED');
  });

  it('satisfies equivalent-resistance and power invariants for 200 generated series/parallel circuits', () => {
    let seed = 0x1234abcd;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    for (let caseIndex = 0; caseIndex < 200; caseIndex++) {
      const voltage = 0.01 + random() * 1000;
      const r1Value = 0.01 + random() * 1e6;
      const r2Value = 0.01 + random() * 1e6;
      const parallel = random() >= 0.5;
      const b = battery(`b${caseIndex}`, voltage);
      const r1 = resistor(`r${caseIndex}a`, r1Value);
      const r2 = resistor(`r${caseIndex}b`, r2Value);
      const wires = parallel
        ? [
            wire(`w${caseIndex}a`, b.terminals[0].id, r1.terminals[0].id),
            wire(`w${caseIndex}b`, b.terminals[0].id, r2.terminals[0].id),
            wire(`w${caseIndex}c`, r1.terminals[1].id, b.terminals[1].id),
            wire(`w${caseIndex}d`, r2.terminals[1].id, b.terminals[1].id),
          ]
        : [
            wire(`w${caseIndex}a`, b.terminals[0].id, r1.terminals[0].id),
            wire(`w${caseIndex}b`, r1.terminals[1].id, r2.terminals[0].id),
            wire(`w${caseIndex}c`, r2.terminals[1].id, b.terminals[1].id),
          ];
      const result = solveCircuit({ components: [b, r1, r2], wires });
      expect(result.success).toBe(true);

      const equivalentResistance = parallel
        ? 1 / (1 / r1Value + 1 / r2Value)
        : r1Value + r2Value;
      const expectedCurrent = voltage / equivalentResistance;
      const batteryData = result.branchData.find((branch) => branch.componentId === b.id)!;
      expect(batteryData.current).toBeCloseTo(expectedCurrent, 7);

      const dissipatedPower = result.branchData
        .filter((branch) => branch.type === 'resistor')
        .reduce((sum, branch) => sum + Math.abs(branch.voltage * branch.current), 0);
      expect(dissipatedPower).toBeCloseTo(voltage * expectedCurrent, 6);
      expect(result.branchData.every((branch) => (
        Number.isFinite(branch.voltage)
        && Number.isFinite(branch.current)
        && Number.isFinite(branch.power)
      ))).toBe(true);
    }
  });
});
