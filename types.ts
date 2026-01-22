
export interface WordData {
  id: string;
  hitza: string;
  sinonimoak: string[];
  isClass?: boolean;
}

export interface Player {
  id: number;
  name: string;
  score: number;
  time: number; // Seconds taken
}

export interface Question {
  wordData: WordData;
  correctAnswer: string;
  options: string[];
}

export enum GameStatus {
  SETUP = 'SETUP',
  INTERMISSION = 'INTERMISSION', // Between players
  PLAYING = 'PLAYING',
  SUMMARY = 'SUMMARY'
}
