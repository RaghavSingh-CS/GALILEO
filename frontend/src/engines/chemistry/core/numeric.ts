export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/** Absorbs only IEEE-754 representation noise, not experimental uncertainty. */
export function floatingPointTolerance(a: number, b: number): number {
  return Number.EPSILON * 8 * Math.max(1, Math.abs(a), Math.abs(b));
}

export function isAtMostWithinFloatingPointTolerance(
  value: number,
  limit: number,
): boolean {
  return value <= limit || value - limit <= floatingPointTolerance(value, limit);
}

export function snapToBoundaryIfNumericallyEqual(
  value: number,
  boundary: number,
): number {
  return Math.abs(value - boundary) <= floatingPointTolerance(value, boundary)
    ? boundary
    : value;
}
