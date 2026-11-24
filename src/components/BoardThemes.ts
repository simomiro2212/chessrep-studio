import type { BoardTheme, BoardThemeKey } from '../types/repertoire';

export const BOARD_THEMES: Record<BoardThemeKey, BoardTheme> = {
  emerald: {
    key: 'emerald',
    label: 'Smeraldo Studio',
    lightSquare: '#e6e8d5',
    darkSquare: '#4e7857',
  },
  wood: {
    key: 'wood',
    label: 'Legno Classico',
    lightSquare: '#ecd9b9',
    darkSquare: '#ae8258',
  },
  slate: {
    key: 'slate',
    label: 'Ardesia Scuro',
    lightSquare: '#cfd6de',
    darkSquare: '#536273',
  },
};
