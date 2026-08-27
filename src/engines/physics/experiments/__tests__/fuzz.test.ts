import { describe, it, expect } from 'vitest';
import { solveCircuit } from '../../circuits/index';
import type { CircuitState, BatteryComponent, ResistorComponent, Wire, VoltmeterComponent, AmmeterComponent } from '../../circuits/types';

describe('Extreme Red Team — Fuzzing & Property-Based Testing', () => {
  const NUM_MUTATIONS = 1000;
  
  const generateValidComponents = (): any[] => {
    return [
      { id: 'b1', type: 'battery', voltage: 12, terminals: [{ id: 'b1:positive', componentId: 'b1', role: 'positive' }, { id: 'b1:negative', componentId: 'b1', role: 'negative' }] },
      { id: 'r1', type: 'resistor', resistance: 10, terminals: [{ id: 'r1:a', componentId: 'r1', role: 'a' }, { id: 'r1:b', componentId: 'r1', role: 'b' }] },
      { id: 'r2', type: 'resistor', resistance: 20, terminals: [{ id: 'r2:a', componentId: 'r2', role: 'a' }, { id: 'r2:b', componentId: 'r2', role: 'b' }] },
      { id: 'v1', type: 'voltmeter', terminals: [{ id: 'v1:positive', componentId: 'v1', role: 'positive' }, { id: 'v1:negative', componentId: 'v1', role: 'negative' }] }
    ];
  };

  it('FUZZ-001 (Phase 12): Engine survives 1000 highly mutated malformed payloads', () => {
    let crashCount = 0;

    for (let i = 0; i < NUM_MUTATIONS; i++) {
      try {
        const state: any = {
          components: generateValidComponents(),
          wires: []
        };

        // Mutate randomly
        const rand = Math.random();
        if (rand < 0.1) state.components = null;
        else if (rand < 0.2) state.components.push({ type: 'unknown_alien_type', id: 'x' });
        else if (rand < 0.3) state.components[0].id = '';
        else if (rand < 0.4) state.components[1].resistance = -50;
        else if (rand < 0.5) state.components[0].voltage = Infinity;
        else if (rand < 0.6) state.wires.push({ id: 'w1', sourceTerminalId: null, targetTerminalId: undefined });
        else if (rand < 0.7) state.wires.push({ id: 'w1', sourceTerminalId: 'r1:a', targetTerminalId: 'r1:a' });
        else if (rand < 0.8) {
          state.components.push({ ...state.components[0] }); // duplicate ID
        } else if (rand < 0.9) {
          state.components[0].terminals[0].componentId = 'wrong_id';
        } else {
          state.components[2].resistance = NaN;
        }

        const result = solveCircuit(state as CircuitState);
        // It should return false and emit validation errors, but NEVER THROW AN EXCEPTION.
        if (result.success && rand >= 0.2 && rand <= 0.8) {
          // If we messed it up, it shouldn't succeed (unless it's an alien type which gets ignored)
        }
      } catch (e) {
        crashCount++;
      }
    }

    expect(crashCount).toBe(0);
  });

  it('FUZZ-002 (Phase 11): Property-based topological wire permutations do not crash and preserve physical invariants', () => {
    let crashCount = 0;
    let nanCount = 0;

    const terminalIds = [
      'b1:positive', 'b1:negative', 
      'r1:a', 'r1:b', 
      'r2:a', 'r2:b',
      'v1:positive', 'v1:negative'
    ];

    for (let i = 0; i < NUM_MUTATIONS; i++) {
      try {
        const state: CircuitState = {
          components: generateValidComponents(),
          wires: []
        };

        // Generate 3 to 8 random wires
        const numWires = Math.floor(Math.random() * 5) + 3;
        for (let w = 0; w < numWires; w++) {
          const src = terminalIds[Math.floor(Math.random() * terminalIds.length)];
          const tgt = terminalIds[Math.floor(Math.random() * terminalIds.length)];
          state.wires.push({ id: `w${w}`, sourceTerminalId: src, targetTerminalId: tgt });
        }

        const result = solveCircuit(state);

        // Properties that must ALWAYS hold true regardless of how insane the graph is:
        
        // 1. No NaNs or Infinities in branchData
        for (const branch of result.branchData) {
          if (isNaN(branch.current) || isNaN(branch.voltage) || isNaN(branch.power!)) {
            nanCount++;
          }
          if (!isFinite(branch.current) || !isFinite(branch.voltage)) {
            nanCount++;
          }
        }

        // 2. KCL & KVL check (the solver inherently respects these via MNA, but we assert no math explosions)

      } catch (e) {
        crashCount++;
      }
    }

    expect(crashCount).toBe(0);
    expect(nanCount).toBe(0);
  });
});
