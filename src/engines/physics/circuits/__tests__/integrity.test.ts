import { describe, it, expect } from 'vitest';
import { validateIntegrity } from '../integrity';
import type { CircuitState, BatteryComponent, ResistorComponent, Wire } from '../types';

/**
 * Tests for integrity.ts — Runtime input-integrity validation.
 * Covers: PHY-002 (duplicate component IDs), PHY-003 (duplicate terminal IDs),
 * PHY-004 (terminal ownership), PHY-005 (duplicate wires), PHY-006 (self-wires),
 * PHY-024 (structural shape validation).
 */
describe('Integrity Validator', () => {
  const makeBattery = (id: string): BatteryComponent => ({
    id, type: 'battery', voltage: 9,
    terminals: [
      { id: `${id}:positive`, componentId: id, role: 'positive' },
      { id: `${id}:negative`, componentId: id, role: 'negative' }
    ]
  });

  const makeResistor = (id: string): ResistorComponent => ({
    id, type: 'resistor', resistance: 100,
    terminals: [
      { id: `${id}:a`, componentId: id, role: 'a' },
      { id: `${id}:b`, componentId: id, role: 'b' }
    ]
  });

  const makeWire = (id: string, src: string, tgt: string): Wire => ({
    id, sourceTerminalId: src, targetTerminalId: tgt
  });

  const validState = (): CircuitState => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    return {
      components: [b1, r1],
      wires: [
        makeWire('w1', 'b1:positive', 'r1:a'),
        makeWire('w2', 'r1:b', 'b1:negative')
      ]
    };
  };

  // ── PHY-024: Structural shape ─────────────────────────────────────────────

  it('PHY-024: returns MALFORMED_INPUT for null input', () => {
    const messages = validateIntegrity(null);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].ruleId).toBe('MALFORMED_INPUT');
    expect(messages[0].severity).toBe('error');
  });

  it('PHY-024: returns MALFORMED_INPUT for non-object input', () => {
    const messages = validateIntegrity('a string');
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: returns MALFORMED_INPUT when components is missing', () => {
    const messages = validateIntegrity({ wires: [] });
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: returns MALFORMED_INPUT when wires is missing', () => {
    const messages = validateIntegrity({ components: [] });
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: returns MALFORMED_INPUT for component with unknown type', () => {
    const state = validState();
    (state.components[0] as unknown as Record<string, unknown>)['type'] = 'laser_cannon';
    const messages = validateIntegrity(state);
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: returns MALFORMED_INPUT for component with empty string ID', () => {
    const state = validState();
    (state.components[0] as unknown as Record<string, unknown>)['id'] = '';
    const messages = validateIntegrity(state);
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: returns MALFORMED_INPUT for component with wrong terminal count', () => {
    const state = validState();
    (state.components[0] as unknown as Record<string, unknown>)['terminals'] = []; // empty
    const messages = validateIntegrity(state);
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: returns MALFORMED_INPUT for wire with empty sourceTerminalId', () => {
    const state = validState();
    (state.wires[0] as unknown as Record<string, unknown>)['sourceTerminalId'] = '';
    const messages = validateIntegrity(state);
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-024: valid input passes shape check with no MALFORMED_INPUT', () => {
    const messages = validateIntegrity(validState());
    expect(messages.filter(m => m.ruleId === 'MALFORMED_INPUT').length).toBe(0);
  });

  // ── PHY-002: Duplicate component IDs ─────────────────────────────────────

  it('PHY-002: duplicate component IDs returns DUPLICATE_COMPONENT_ID error', () => {
    const b1 = makeBattery('b1');
    const b1Dup = makeBattery('b1'); // same id
    const state: CircuitState = { components: [b1, b1Dup], wires: [] };

    const messages = validateIntegrity(state);
    const msg = messages.find(m => m.ruleId === 'DUPLICATE_COMPONENT_ID');
    expect(msg).toBeDefined();
    expect(msg!.severity).toBe('error');
    expect(msg!.componentIds).toContain('b1');
  });

  it('PHY-002: unique component IDs produce no DUPLICATE_COMPONENT_ID', () => {
    const messages = validateIntegrity(validState());
    expect(messages.filter(m => m.ruleId === 'DUPLICATE_COMPONENT_ID').length).toBe(0);
  });

  // ── PHY-003: Duplicate terminal IDs ──────────────────────────────────────

  it('PHY-003: duplicate terminal ID across components returns DUPLICATE_TERMINAL_ID error', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    // Make r1's terminal share an ID with b1's terminal
    r1.terminals[0] = { id: 'b1:positive', componentId: 'r1', role: 'a' };

    const state: CircuitState = { components: [b1, r1], wires: [] };
    const messages = validateIntegrity(state);

    const msg = messages.find(m => m.ruleId === 'DUPLICATE_TERMINAL_ID');
    expect(msg).toBeDefined();
    expect(msg!.severity).toBe('error');
    expect(msg!.componentIds).toContain('r1');
    expect(msg!.componentIds).toContain('b1');
  });

  it('PHY-003: unique terminal IDs produce no DUPLICATE_TERMINAL_ID', () => {
    const messages = validateIntegrity(validState());
    expect(messages.filter(m => m.ruleId === 'DUPLICATE_TERMINAL_ID').length).toBe(0);
  });

  // ── PHY-004: Terminal ownership ───────────────────────────────────────────

  it('PHY-004: terminal.componentId mismatch returns TERMINAL_OWNERSHIP_MISMATCH error', () => {
    const b1 = makeBattery('b1');
    const r1 = makeResistor('r1');
    // Terminal claims it belongs to b1, but is on r1
    r1.terminals[0] = { id: 'r1:a', componentId: 'b1', role: 'a' }; // wrong componentId

    const state: CircuitState = { components: [b1, r1], wires: [] };
    const messages = validateIntegrity(state);

    const msg = messages.find(m => m.ruleId === 'TERMINAL_OWNERSHIP_MISMATCH');
    expect(msg).toBeDefined();
    expect(msg!.severity).toBe('error');
    expect(msg!.componentIds).toContain('r1');
  });

  it('PHY-004: valid terminal ownership produces no TERMINAL_OWNERSHIP_MISMATCH', () => {
    const messages = validateIntegrity(validState());
    expect(messages.filter(m => m.ruleId === 'TERMINAL_OWNERSHIP_MISMATCH').length).toBe(0);
  });

  // ── PHY-005: Duplicate wire IDs ───────────────────────────────────────────

  it('PHY-005: duplicate wire ID returns DUPLICATE_WIRE_ID error', () => {
    const state = validState();
    // Add a second wire with the same ID
    state.wires.push(makeWire('w1', 'b1:positive', 'r1:b')); // same ID as w1

    const messages = validateIntegrity(state);
    const msg = messages.find(m => m.ruleId === 'DUPLICATE_WIRE_ID');
    expect(msg).toBeDefined();
    expect(msg!.severity).toBe('error');
    expect(msg!.message).toContain('w1');
  });

  it('PHY-005: duplicate unordered endpoint pair returns DUPLICATE_WIRE_ENDPOINTS error', () => {
    const state = validState();
    // w1 connects b1:positive -> r1:a; add another with same endpoints reversed
    state.wires.push(makeWire('w99', 'r1:a', 'b1:positive'));

    const messages = validateIntegrity(state);
    const msg = messages.find(m => m.ruleId === 'DUPLICATE_WIRE_ENDPOINTS');
    expect(msg).toBeDefined();
    expect(msg!.severity).toBe('error');
    expect(msg!.message).toContain('w99');
    expect(msg!.message).toContain('w1');
  });

  it('PHY-005: unique wires produce no duplicate wire messages', () => {
    const messages = validateIntegrity(validState());
    expect(messages.filter(m => m.ruleId === 'DUPLICATE_WIRE_ID').length).toBe(0);
    expect(messages.filter(m => m.ruleId === 'DUPLICATE_WIRE_ENDPOINTS').length).toBe(0);
  });

  // ── PHY-006: Self-wires ───────────────────────────────────────────────────

  it('PHY-006: self-wire returns SELF_WIRE error', () => {
    const state = validState();
    state.wires.push(makeWire('self', 'b1:positive', 'b1:positive')); // same source and target

    const messages = validateIntegrity(state);
    const msg = messages.find(m => m.ruleId === 'SELF_WIRE');
    expect(msg).toBeDefined();
    expect(msg!.severity).toBe('error');
    expect(msg!.message).toContain('self');
    expect(msg!.message).toContain('b1:positive');
  });

  it('PHY-006: no self-wires produces no SELF_WIRE message', () => {
    const messages = validateIntegrity(validState());
    expect(messages.filter(m => m.ruleId === 'SELF_WIRE').length).toBe(0);
  });

  // ── Combined: valid circuit has zero integrity messages ───────────────────

  it('valid circuit passes all integrity checks with no messages', () => {
    const messages = validateIntegrity(validState());
    expect(messages.length).toBe(0);
  });

  // ── PHY-004/PHY-024: Null terminal crash fix ──────────────────────────────

  it('PHY-024: terminals:[null,null] returns MALFORMED_INPUT, does not throw', () => {
    const state = {
      components: [{
        id: 'r1', type: 'resistor', resistance: 100,
        terminals: [null, null]
      }],
      wires: []
    };
    expect(() => validateIntegrity(state)).not.toThrow();
    const messages = validateIntegrity(state);
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
    expect(messages.every(m => m.severity === 'error')).toBe(true);
  });

  it('PHY-024: terminals:[42,"string"] returns MALFORMED_INPUT, does not throw', () => {
    const state = {
      components: [{
        id: 'r1', type: 'resistor', resistance: 100,
        terminals: [42, 'string']
      }],
      wires: []
    };
    expect(() => validateIntegrity(state)).not.toThrow();
    const messages = validateIntegrity(state);
    expect(messages.some(m => m.ruleId === 'MALFORMED_INPUT')).toBe(true);
  });

  it('PHY-004: battery with wrong terminal roles returns INVALID_TERMINAL_ROLE', () => {
    const state = {
      components: [{
        id: 'b1', type: 'battery', voltage: 9,
        terminals: [
          { id: 'b1:a', componentId: 'b1', role: 'a' },       // wrong: should be 'positive'
          { id: 'b1:b', componentId: 'b1', role: 'b' }        // wrong: should be 'negative'
        ]
      }],
      wires: []
    };
    const messages = validateIntegrity(state);
    const roleErrors = messages.filter(m => m.ruleId === 'INVALID_TERMINAL_ROLE');
    expect(roleErrors.length).toBe(2);
    expect(roleErrors[0].severity).toBe('error');
    expect(roleErrors[0].message).toContain('positive');
    expect(roleErrors[1].message).toContain('negative');
  });

  it('PHY-004: ammeter with correct in/out roles passes role check', () => {
    const state: CircuitState = {
      components: [{
        id: 'a1', type: 'ammeter',
        terminals: [
          { id: 'a1:in', componentId: 'a1', role: 'in' },
          { id: 'a1:out', componentId: 'a1', role: 'out' }
        ]
      }],
      wires: []
    };
    const messages = validateIntegrity(state);
    expect(messages.filter(m => m.ruleId === 'INVALID_TERMINAL_ROLE').length).toBe(0);
  });

  it('PHY-004: voltmeter with wrong roles returns INVALID_TERMINAL_ROLE', () => {
    const state = {
      components: [{
        id: 'v1', type: 'voltmeter',
        terminals: [
          { id: 'v1:in', componentId: 'v1', role: 'in' },     // wrong: should be 'positive'
          { id: 'v1:out', componentId: 'v1', role: 'out' }    // wrong: should be 'negative'
        ]
      }],
      wires: []
    };
    const messages = validateIntegrity(state);
    expect(messages.filter(m => m.ruleId === 'INVALID_TERMINAL_ROLE').length).toBe(2);
  });
});

