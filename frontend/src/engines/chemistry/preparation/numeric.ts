const MAX_DECIMAL_SCALE = 1_000_000_000_000;

function measurementScale(tolerance: number): number {
  let scale = 1;
  while (!Number.isInteger(tolerance * scale) && scale < MAX_DECIMAL_SCALE) {
    scale *= 10;
  }
  return scale;
}

function canonicalizeScaledMeasurement(value: number): number {
  const nearestInteger = Math.round(value);
  const representationNoise = Number.EPSILON * 8 * Math.max(1, Math.abs(value));
  return Math.abs(value - nearestInteger) <= representationNoise
    ? nearestInteger
    : value;
}

/**
 * Compares physical measurements at the decimal resolution expressed by the
 * configured tolerance. This does not use the core IEEE arithmetic tolerance.
 */
export function isWithinExperimentalTolerance(
  actual: number,
  target: number,
  tolerance: number,
): boolean {
  if (!Number.isFinite(actual)
    || !Number.isFinite(target)
    || !Number.isFinite(tolerance)
    || tolerance < 0) {
    return false;
  }
  if (tolerance === 0) {
    return actual === target;
  }

  const scale = measurementScale(tolerance);
  const scaledActual = canonicalizeScaledMeasurement(actual * scale);
  const scaledTarget = canonicalizeScaledMeasurement(target * scale);
  const scaledTolerance = canonicalizeScaledMeasurement(tolerance * scale);
  return Math.abs(scaledActual - scaledTarget) <= scaledTolerance;
}
