import { describe, expect, it } from 'vitest';
import { getMolarConcentration } from '../core';
import type { MixtureState } from '../core';

describe('getMolarConcentration', () => {
  it('derives concentration from dissolved amount and bulk liquid volume', () => {
    const contents: MixtureState = {
      volumeL: 0.1,
      dissolvedAmountsMol: { material: 0.01 },
      undissolvedAmountsMol: {},
    };
    expect(getMolarConcentration(contents, 'material')).toBeCloseTo(0.1, 15);
  });

  it('treats a missing material as zero when liquid exists', () => {
    const contents: MixtureState = {
      volumeL: 0.1,
      dissolvedAmountsMol: {},
      undissolvedAmountsMol: { material: 1 },
    };
    expect(getMolarConcentration(contents, 'material')).toBe(0);
  });

  it('returns null rather than infinity when liquid volume is zero', () => {
    const contents: MixtureState = {
      volumeL: 0,
      dissolvedAmountsMol: { material: 0.01 },
      undissolvedAmountsMol: {},
    };
    expect(getMolarConcentration(contents, 'material')).toBeNull();
  });

  it('does not round or mutate contents', () => {
    const contents: MixtureState = {
      volumeL: 0.3,
      dissolvedAmountsMol: { material: 0.1 },
      undissolvedAmountsMol: {},
    };
    const before = JSON.stringify(contents);
    expect(getMolarConcentration(contents, 'material')).toBe(0.1 / 0.3);
    expect(JSON.stringify(contents)).toBe(before);
  });
});
