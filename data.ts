
import { WordData, DifficultyLevel } from './types';
import { LEVEL_1_DATA } from './data_l1';
import { LEVEL_2_DATA } from './data_l2';
import { LEVEL_3_DATA } from './data_l3';
import { LEVEL_4_DATA } from './data_l4';

export const LEVEL_DATA: Record<DifficultyLevel, WordData[]> = {
  1: LEVEL_1_DATA,
  2: LEVEL_2_DATA,
  3: LEVEL_3_DATA,
  4: LEVEL_4_DATA
};

// Re-exportamos para compatibilidad
export { LEVEL_1_DATA, LEVEL_2_DATA, LEVEL_3_DATA, LEVEL_4_DATA };
