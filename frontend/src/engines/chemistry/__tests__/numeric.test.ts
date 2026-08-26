import { describe, expect, it } from 'vitest';
import {
  isFiniteNumber,
  isNonNegativeNumber,
  isPositiveNumber,
} from '../core/numeric';

describe('numeric guards', () => {
  it('accepts ordinary finite numbers', () => {
    expect(isFiniteNumber(-12.5)).toBe(true);
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(3.2)).toBe(true);
  });

  it('rejects non-numbers and non-finite numbers', () => {
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber('1')).toBe(false);
  });

  it('accepts zero and positive finite values as nonnegative', () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(-0)).toBe(true);
    expect(isNonNegativeNumber(0.25)).toBe(true);
  });

  it('rejects negative and non-finite values as nonnegative', () => {
    expect(isNonNegativeNumber(-Number.EPSILON)).toBe(false);
    expect(isNonNegativeNumber(Number.NaN)).toBe(false);
    expect(isNonNegativeNumber(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('accepts only finite values greater than zero as positive', () => {
    expect(isPositiveNumber(0.25)).toBe(true);
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
