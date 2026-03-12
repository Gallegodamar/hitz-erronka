import { DifficultyLevel, WordData } from './types';

// Static fallback data is intentionally empty. The app now works local-first
// by caching remote words and teacher-created local words in the browser.
export const LEVEL_1_DATA: WordData[] = [];
export const LEVEL_2_DATA: WordData[] = [];
export const LEVEL_3_DATA: WordData[] = [];
export const LEVEL_4_DATA: WordData[] = [];

export const LEVEL_DATA: Record<DifficultyLevel, WordData[]> = {
  1: LEVEL_1_DATA,
  2: LEVEL_2_DATA,
  3: LEVEL_3_DATA,
  4: LEVEL_4_DATA,
};
