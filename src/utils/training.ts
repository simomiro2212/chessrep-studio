import type {
  OpeningRepertoire,
  ShuffleColorFilter,
  TrainingLine,
} from '../types/repertoire';
import { extractLines } from './tree';

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTargetedQueue(
  opening: OpeningRepertoire,
  specificLineId?: string | null
): TrainingLine[] {
  const lines = extractLines(opening);
  if (specificLineId) {
    const match = lines.find((l) => l.id === specificLineId);
    return match ? [match] : lines;
  }
  return lines;
}

export function buildShuffleQueue(
  openings: OpeningRepertoire[],
  filter: ShuffleColorFilter
): TrainingLine[] {
  const matchingOpenings = openings.filter((op) => {
    if (filter === 'both') return true;
    return op.color === filter;
  });

  const allLines = matchingOpenings.flatMap((op) => extractLines(op));
  return shuffleArray(allLines);
}
