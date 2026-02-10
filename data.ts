
import { WordData, DifficultyLevel } from './types';
import { LEVEL_1_PART_1 } from './data_l1_1';
import { LEVEL_1_PART_2 } from './data_l1_2';
import { LEVEL_1_PART_3 } from './data_l1_3';
import { LEVEL_2_PART_1 } from './data_l2_1';
import { LEVEL_2_PART_2 } from './data_l2_2';
import { LEVEL_2_PART_3 } from './data_l2_3';
import { LEVEL_3_PART_1 } from './data_l3_1';
import { LEVEL_3_PART_2 } from './data_l3_2';
import { LEVEL_3_PART_3 } from './data_l3_3';
import { LEVEL_4_PART_1 } from './data_l4_1';
import { LEVEL_4_PART_2 } from './data_l4_2';
import { LEVEL_4_PART_3 } from './data_l4_3';
import { LEVEL_4_PART_4 } from './data_l4_4';

export const LEVEL_1_DATA: WordData[] = [
  ...LEVEL_1_PART_1,
  ...LEVEL_1_PART_2,
  ...LEVEL_1_PART_3
];

export const LEVEL_2_DATA: WordData[] = [
  ...LEVEL_2_PART_1,
  ...LEVEL_2_PART_2,
  ...LEVEL_2_PART_3
];

export const LEVEL_3_DATA: WordData[] = [
  ...LEVEL_3_PART_1,
  ...LEVEL_3_PART_2,
  ...LEVEL_3_PART_3
];

export const LEVEL_4_DATA: WordData[] = [
  ...LEVEL_4_PART_1,
  ...LEVEL_4_PART_2,
  ...LEVEL_4_PART_3,
  ...LEVEL_4_PART_4
];

export const LEVEL_DATA: Record<DifficultyLevel, WordData[]> = {
  1: LEVEL_1_DATA,
  2: LEVEL_2_DATA,
  3: LEVEL_3_DATA,
  4: LEVEL_4_DATA
};

export { 
  LEVEL_1_PART_1, LEVEL_1_PART_2, LEVEL_1_PART_3, 
  LEVEL_2_PART_1, LEVEL_2_PART_2, LEVEL_2_PART_3,
  LEVEL_3_PART_1, LEVEL_3_PART_2, LEVEL_3_PART_3,
  LEVEL_4_PART_1, LEVEL_4_PART_2, LEVEL_4_PART_3, LEVEL_4_PART_4
};
