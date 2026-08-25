/**
 * integrity.ts — Runtime input-integrity validation (PHY-002, PHY-003, PHY-004,
 * PHY-005, PHY-006, PHY-024).
 *
 * This module runs BEFORE buildGraph and catches structural violations that the
 * TypeScript type system cannot enforce at runtime (e.g. malformed adapter
 * output, stale persisted state, duplicate IDs).
 *
 * All checks return ValidationMessage[] — callers should treat any 'error'
 * severity result as blocking (skip graph construction and simulation).
 *
 * Public boundary: solveCircuit() in index.ts. This file is internal.
 */

import type { CircuitState, Component, ValidationMessage } from './types';

/** Valid component type discriminants. */
const VALID_COMPONENT_TYPES = new Set([
  'battery',
  'resistor',
  'variable_resistor',
  'switch',
  'ammeter',
  'voltmeter',
]);

// ─── Structural shape guards ────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * PHY-024 — Lightweight runtime shape check.
 * Verifies top-level structure before anything else runs.
 * Returns a message if the input is not usable, or null if it looks valid.
 */
function checkShapeIntegrity(state: unknown): ValidationMessage | null {
  if (state === null || typeof state !== 'object') {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: 'CircuitState must be an object.',
      componentIds: [],
    };
  }

  const s = state as Record<string, unknown>;

  if (!Array.isArray(s['components'])) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: 'CircuitState.components must be an array.',
      componentIds: [],
    };
  }

  if (!Array.isArray(s['wires'])) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: 'CircuitState.wires must be an array.',
      componentIds: [],
    };
  }

  return null;
}

/**
 * PHY-024 — Per-component shape check.
 * Returns a message if the component has a malformed structure.
 */
function checkComponentShape(comp: unknown, index: number): ValidationMessage | null {
  if (comp === null || typeof comp !== 'object') {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Component at index ${index} is not an object.`,
      componentIds: [],
    };
  }

  const c = comp as Record<string, unknown>;

  if (!isNonEmptyString(c['id'])) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Component at index ${index} has a missing or invalid id.`,
      componentIds: [],
    };
  }

  if (!VALID_COMPONENT_TYPES.has(c['type'] as string)) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Component '${c['id']}' has unknown type '${c['type']}'. Must be one of: ${[...VALID_COMPONENT_TYPES].join(', ')}.`,
      componentIds: [c['id'] as string],
    };
  }

  if (!Array.isArray(c['terminals']) || c['terminals'].length !== 2) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Component '${c['id']}' must have exactly 2 terminals.`,
      componentIds: [c['id'] as string],
    };
  }

  return null;
}

/**
 * PHY-024 — Per-wire shape check.
 */
function checkWireShape(wire: unknown, index: number): ValidationMessage | null {
  if (wire === null || typeof wire !== 'object') {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Wire at index ${index} is not an object.`,
      componentIds: [],
    };
  }

  const w = wire as Record<string, unknown>;

  if (!isNonEmptyString(w['id'])) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Wire at index ${index} has a missing or invalid id.`,
      componentIds: [],
    };
  }

  if (!isNonEmptyString(w['sourceTerminalId'])) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Wire '${w['id']}' has a missing or invalid sourceTerminalId.`,
      componentIds: [],
    };
  }

  if (!isNonEmptyString(w['targetTerminalId'])) {
    return {
      ruleId: 'MALFORMED_INPUT',
      severity: 'error',
      message: `Wire '${w['id']}' has a missing or invalid targetTerminalId.`,
      componentIds: [],
    };
  }

  return null;
}

// ─── Semantic integrity checks ──────────────────────────────────────────────

/**
 * PHY-002 — Unique component IDs.
 */
function checkDuplicateComponentIds(components: Component[]): ValidationMessage[] {
  const seen = new Map<string, number>(); // id → first-seen index
  const messages: ValidationMessage[] = [];

  for (const comp of components) {
    if (seen.has(comp.id)) {
      messages.push({
        ruleId: 'DUPLICATE_COMPONENT_ID',
        severity: 'error',
        message: `Duplicate component ID '${comp.id}'. Component IDs must be globally unique.`,
        componentIds: [comp.id],
      });
    } else {
      seen.set(comp.id, 1);
    }
  }

  return messages;
}

/**
 * PHY-003 — Globally unique terminal IDs across all components.
 */
function checkDuplicateTerminalIds(components: Component[]): ValidationMessage[] {
  const seen = new Map<string, string>(); // terminalId → componentId
  const messages: ValidationMessage[] = [];

  for (const comp of components) {
    for (const term of comp.terminals) {
      if (seen.has(term.id)) {
        const firstOwner = seen.get(term.id)!;
        messages.push({
          ruleId: 'DUPLICATE_TERMINAL_ID',
          severity: 'error',
          message: `Duplicate terminal ID '${term.id}' found in component '${comp.id}' (first seen in '${firstOwner}'). Terminal IDs must be globally unique.`,
          componentIds: [comp.id, firstOwner],
        });
      } else {
        seen.set(term.id, comp.id);
      }
    }
  }

  return messages;
}

/**
 * PHY-004 — Terminal ownership cross-validation.
 * Each terminal's componentId must match the component that owns it.
 */
function checkTerminalOwnership(components: Component[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const comp of components) {
    for (const term of comp.terminals) {
      if (!isNonEmptyString(term.id)) {
        messages.push({
          ruleId: 'MALFORMED_TERMINAL',
          severity: 'error',
          message: `A terminal in component '${comp.id}' has a missing or invalid id.`,
          componentIds: [comp.id],
        });
        continue;
      }

      if (!isNonEmptyString(term.role)) {
        messages.push({
          ruleId: 'MALFORMED_TERMINAL',
          severity: 'error',
          message: `Terminal '${term.id}' in component '${comp.id}' has a missing or invalid role.`,
          componentIds: [comp.id],
        });
      }

      if (term.componentId !== comp.id) {
        messages.push({
          ruleId: 'TERMINAL_OWNERSHIP_MISMATCH',
          severity: 'error',
          message: `Terminal '${term.id}' declares componentId '${term.componentId}' but is owned by component '${comp.id}'.`,
          componentIds: [comp.id],
        });
      }
    }
  }

  return messages;
}

/**
 * PHY-005 — Duplicate wire IDs and duplicate unordered endpoint pairs.
 */
function checkDuplicateWires(state: CircuitState): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // Duplicate wire IDs
  const seenWireIds = new Map<string, number>();
  for (const wire of state.wires) {
    if (seenWireIds.has(wire.id)) {
      messages.push({
        ruleId: 'DUPLICATE_WIRE_ID',
        severity: 'error',
        message: `Duplicate wire ID '${wire.id}'. Wire IDs must be unique.`,
        componentIds: [],
      });
    } else {
      seenWireIds.set(wire.id, 1);
    }
  }

  // Duplicate unordered endpoint pairs
  const seenEndpointPairs = new Map<string, string>(); // canonical key → wire id
  for (const wire of state.wires) {
    // Canonical key: sort the two endpoint IDs so order doesn't matter
    const key = [wire.sourceTerminalId, wire.targetTerminalId].sort().join('|||');
    if (seenEndpointPairs.has(key)) {
      const firstWireId = seenEndpointPairs.get(key)!;
      messages.push({
        ruleId: 'DUPLICATE_WIRE_ENDPOINTS',
        severity: 'error',
        message: `Wire '${wire.id}' has the same endpoints as wire '${firstWireId}'. Duplicate wires add no electrical meaning.`,
        componentIds: [],
      });
    } else {
      seenEndpointPairs.set(key, wire.id);
    }
  }

  return messages;
}

/**
 * PHY-006 — Self-wires: a wire whose source and target are the same terminal.
 */
function checkSelfWires(state: CircuitState): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const wire of state.wires) {
    if (wire.sourceTerminalId === wire.targetTerminalId) {
      messages.push({
        ruleId: 'SELF_WIRE',
        severity: 'error',
        message: `Wire '${wire.id}' connects terminal '${wire.sourceTerminalId}' to itself. Self-wires are not allowed.`,
        componentIds: [],
      });
    }
  }

  return messages;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Runs all input-integrity checks on a CircuitState.
 *
 * Call this before buildGraph. If any returned message has severity 'error',
 * the caller should skip graph construction and simulation.
 *
 * Accepts `unknown` so it can safely be called with untrusted runtime data.
 */
export function validateIntegrity(state: unknown): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // 1. Top-level shape (PHY-024)
  const shapeError = checkShapeIntegrity(state);
  if (shapeError) {
    return [shapeError]; // Can't proceed further without a valid shape
  }

  const s = state as CircuitState;

  // 2. Per-component shape (PHY-024)
  for (let i = 0; i < s.components.length; i++) {
    const msg = checkComponentShape(s.components[i], i);
    if (msg) messages.push(msg);
  }

  // 3. Per-wire shape (PHY-024)
  for (let i = 0; i < s.wires.length; i++) {
    const msg = checkWireShape(s.wires[i], i);
    if (msg) messages.push(msg);
  }

  // If shape errors exist, semantic checks would produce noise — return early
  if (messages.length > 0) return messages;

  // 4. Duplicate component IDs (PHY-002)
  messages.push(...checkDuplicateComponentIds(s.components));

  // 5. Duplicate terminal IDs (PHY-003)
  messages.push(...checkDuplicateTerminalIds(s.components));

  // 6. Terminal ownership (PHY-004)
  messages.push(...checkTerminalOwnership(s.components));

  // 7. Duplicate wires / duplicate endpoint pairs (PHY-005)
  messages.push(...checkDuplicateWires(s));

  // 8. Self-wires (PHY-006)
  messages.push(...checkSelfWires(s));

  return messages;
}
