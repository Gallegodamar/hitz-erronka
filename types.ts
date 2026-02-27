
export interface WordData {
  id: string | number;
  hitza: string;
  sinonimoak: string[];
}

export interface Player {
  id: number;
  name: string;
  score: number;
  time: number;
}

export interface Question {
  wordData: WordData;
  correctAnswer: string;
  options: string[];
}

export type DifficultyLevel = 1 | 2 | 3 | 4;

export enum GameStatus {
  SETUP = 'SETUP',
  WORDS_MANAGER = 'WORDS_MANAGER',
  INTERMISSION = 'INTERMISSION',
  PLAYING = 'PLAYING',
  SUMMARY = 'SUMMARY',
  REVIEW = 'REVIEW'
}
