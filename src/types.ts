export type DifficultyLevel = 1 | 2 | 3 | 4;

export type WordSource = 'remote' | 'cache' | 'local';
export type AnalyticsSyncMode = 'local-only' | 'local-with-remote-backup';

export interface WordData {
  id: string | number;
  hitza: string;
  sinonimoak: string[];
  level?: DifficultyLevel | null;
  source?: WordSource;
  remoteIdField?: string;
  remoteWordField?: string;
  remoteSynonymsField?: string;
  remoteLevelField?: string;
  remoteRow?: Record<string, unknown>;
}

export interface SetupPlayerProfile {
  id: string;
  name: string;
  emoji: string;
  slot: number;
}

export interface Player extends SetupPlayerProfile {
  score: number;
  time: number;
  questionsAnswered: number;
  correctAnswers: number;
}

export interface Question {
  id: string;
  wordData: WordData;
  correctAnswer: string;
  options: string[];
  priority: number;
}

export interface GameFailureEvent {
  sessionId: string;
  learnerId: string;
  playerName: string;
  difficulty: DifficultyLevel;
  word: string;
  correctAnswer: string;
  selectedAnswer: string;
  questionNumber: number;
  playedAt: string;
}

export interface QuestionAnswerEvent {
  sessionId: string;
  learnerId: string;
  playerName: string;
  difficulty: DifficultyLevel;
  word: string;
  correctAnswer: string;
  selectedAnswer: string;
  questionNumber: number;
  isCorrect: boolean;
  playedAt: string;
}

export interface AnalyticsSessionRow {
  sessionId: string;
  playedAt: string;
  difficulty: DifficultyLevel | null;
  playersCount: number;
  totalQuestions: number;
  failedAnswers: number;
  completedRounds: number;
  deviceId: string;
  source: 'local';
}

export interface AnalyticsPlayerResultRow {
  sessionId: string;
  learnerId: string;
  playerName: string;
  difficulty: DifficultyLevel | null;
  score: number;
  timeSeconds: number;
  questionsAnswered: number;
  failedCount: number;
  accuracy: number;
}

export interface AnalyticsFailEventRow {
  sessionId: string;
  learnerId: string;
  playerName: string;
  difficulty: DifficultyLevel | null;
  word: string;
  playedAt: string;
}

export interface AnalyticsSyncState {
  mode: AnalyticsSyncMode;
  lastRemoteSyncAt: string | null;
  remoteStatus: string | null;
}

export interface AnalyticsSnapshot {
  sessions: AnalyticsSessionRow[];
  playerResults: AnalyticsPlayerResultRow[];
  failEvents: AnalyticsFailEventRow[];
  questionEvents: QuestionAnswerEvent[];
  loadedAt: string;
  sync: AnalyticsSyncState;
}

export interface WordSaveFeedback {
  type: 'success' | 'error';
  message: string;
}

export interface DbErrorLike {
  code?: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export interface WordPerformance {
  word: string;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  lastSeenAt: string | null;
  priority: number;
}

export enum GameStatus {
  SETUP = 'SETUP',
  WORDS_MANAGER = 'WORDS_MANAGER',
  INTERMISSION = 'INTERMISSION',
  PLAYING = 'PLAYING',
  SUMMARY = 'SUMMARY',
  ANALYTICS = 'ANALYTICS',
  REVIEW = 'REVIEW',
}
