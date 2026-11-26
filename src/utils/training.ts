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
  options?: {
    lineIds?: string[] | null;
    shuffleOrder?: boolean;
  }
): TrainingLine[] {
  const lines = extractLines(opening);
  let filtered = lines;

  if (options?.lineIds && options.lineIds.length > 0) {
    const idSet = new Set(options.lineIds);
    const matches = lines.filter((l) => idSet.has(l.id));
    if (matches.length > 0) {
      filtered = matches;
    }
  }

  return options?.shuffleOrder ? shuffleArray(filtered) : filtered;
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
