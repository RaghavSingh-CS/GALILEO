const MAX_DECIMAL_SCALE = 1_000_000_000_000;

function measurementScale(tolerance: number): number {
  let scale = 1;
  while (!Number.isInteger(tolerance * scale) && scale < MAX_DECIMAL_SCALE) {
    scale *= 10;
  }
  return scale;
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
  return Math.abs(actual * scale - target * scale) <= tolerance * scale;
}
