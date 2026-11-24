import type { Square } from 'chess.js';

export type RepertoireColor = 'white' | 'black';

export interface MoveNode {
  id: string;
  parentId: string | null;
  san: string | null;
  uci: string | null;
  from: Square | null;
  to: Square | null;
  fen: string;
  ply: number;
  color: 'w' | 'b' | null;
  comment: string;
  lineName?: string;
  childrenIds: string[];
}

export interface OpeningRepertoire {
  id: string;
  name: string;
  folder: string;
  eco?: string;
  description?: string;
  color: RepertoireColor;
  rootId: string;
  nodes: Record<string, MoveNode>;
  createdAt: string;
  updatedAt: string;
}

export interface RepertoireDatabase {
  version: 1;
  exportedAt: string;
  openings: OpeningRepertoire[];
}

export interface TrainingLine {
  id: string; // leaf node id
  openingId: string;
  openingName: string;
  folder: string;
  color: RepertoireColor;
  lineName: string;
  moves: MoveNode[]; // from ply 1 to leaf
  commentCount: number;
}

export type AppMode = 'editor' | 'training';
export type TrainingSubMode = 'targeted' | 'shuffle';
export type ShuffleColorFilter = 'both' | 'white' | 'black';

export type BoardThemeKey = 'emerald' | 'wood' | 'slate';

export interface BoardTheme {
  key: BoardThemeKey;
  label: string;
  lightSquare: string;
  darkSquare: string;
}
