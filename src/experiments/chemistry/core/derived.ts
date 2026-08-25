import type { MaterialId, MixtureState } from './types';

export function getMolarConcentration(
  contents: MixtureState,
  materialId: MaterialId,
): number | null {
  if (contents.volumeL === 0) {
    return null;
  }

  return (contents.dissolvedAmountsMol[materialId] ?? 0) / contents.volumeL;
}
