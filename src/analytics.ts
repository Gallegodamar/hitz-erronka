import { DIFFICULTY_LEVELS } from './appConstants';
import {
  AnalyticsSnapshot,
  AnalyticsSyncMode,
  DifficultyLevel,
  GameFailureEvent,
  Player,
  QuestionAnswerEvent,
  WordPerformance,
} from './types';

export interface DifficultyStat {
  level: DifficultyLevel;
  count: number;
  percent: number;
}

export interface WordInsight extends WordPerformance {
  percent: number;
}

export interface PlayerAnalyticsSummary {
  learnerId: string;
  playerName: string;
  games: number;
  avgScore: number;
  avgTime: number;
  totalFails: number;
  totalQuestions: number;
  accuracy: number;
  failRate: number;
  difficultyStats: DifficultyStat[];
  weakestWords: WordInsight[];
  masteredWords: number;
  needsReviewWords: number;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalPlayers: number;
  totalQuestions: number;
  totalFails: number;
  failRate: number;
  avgAccuracy: number;
  difficultyStats: DifficultyStat[];
  weakestWords: WordInsight[];
  masteredWords: number;
  needsReviewWords: number;
  playerStats: PlayerAnalyticsSummary[];
  recentSessions: AnalyticsSnapshot['sessions'];
  loadedAt: string | null;
  syncMode: AnalyticsSyncMode;
  lastRemoteSyncAt: string | null;
  remoteStatus: string | null;
}

const computePriority = (attempts: number, correct: number, incorrect: number, lastSeenAt: string | null): number => {
  const accuracy = attempts > 0 ? (correct * 100) / attempts : 0;
  const inaccuracyPenalty = attempts > 0 ? ((100 - accuracy) / 100) * 4 : 2;
  const daysSinceSeen = lastSeenAt ? Math.max(0, (Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000) : 7;
  const spacingBonus = Math.min(daysSinceSeen / 7, 2);
  return incorrect * 6 + inaccuracyPenalty + spacingBonus + (attempts === 0 ? 2 : 0);
};

const classifyWord = (attempts: number, accuracy: number, incorrect: number): 'mastered' | 'review' | 'neutral' => {
  if (attempts >= 3 && accuracy >= 80) return 'mastered';
  if (attempts >= 2 && (accuracy < 60 || incorrect >= 2)) return 'review';
  return 'neutral';
};

const createDifficultyStats = (counts: Record<DifficultyLevel, number>, total: number): DifficultyStat[] =>
  DIFFICULTY_LEVELS.map((level) => ({
    level,
    count: counts[level],
    percent: total > 0 ? (counts[level] * 100) / total : 0,
  }));

export const buildWordPerformanceMap = (
  questionEvents: QuestionAnswerEvent[],
  learnerIds: string[] = [],
  difficulty?: DifficultyLevel
): Map<string, WordPerformance> => {
  const learnerFilter = learnerIds.length > 0 ? new Set(learnerIds) : null;
  const byWord = new Map<
    string,
    {
      attempts: number;
      correct: number;
      incorrect: number;
      lastSeenAt: string | null;
      word: string;
    }
  >();

  for (const event of questionEvents) {
    if (learnerFilter && !learnerFilter.has(event.learnerId)) continue;
    if (difficulty && event.difficulty !== difficulty) continue;

    const key = event.word.trim().toLowerCase();
    if (!key) continue;

    const current = byWord.get(key) ?? {
      attempts: 0,
      correct: 0,
      incorrect: 0,
      lastSeenAt: null,
      word: event.word.trim(),
    };

    current.attempts += 1;
    current.correct += event.isCorrect ? 1 : 0;
    current.incorrect += event.isCorrect ? 0 : 1;
    current.lastSeenAt = event.playedAt;
    byWord.set(key, current);
  }

  return new Map(
    Array.from(byWord.entries()).map(([key, value]) => {
      const accuracy = value.attempts > 0 ? (value.correct * 100) / value.attempts : 0;
      return [
        key,
        {
          word: value.word,
          attempts: value.attempts,
          correct: value.correct,
          incorrect: value.incorrect,
          accuracy,
          lastSeenAt: value.lastSeenAt,
          priority: computePriority(value.attempts, value.correct, value.incorrect, value.lastSeenAt),
        },
      ];
    })
  );
};

export const recordCompletedGame = (
  snapshot: AnalyticsSnapshot,
  params: {
    sessionId: string;
    deviceId: string;
    difficulty: DifficultyLevel;
    players: Player[];
    questionEvents: QuestionAnswerEvent[];
    failEvents: GameFailureEvent[];
    syncMode: AnalyticsSyncMode;
  }
): AnalyticsSnapshot => {
  const { sessionId, deviceId, difficulty, players, questionEvents, failEvents, syncMode } = params;

  const nextSessions = snapshot.sessions.filter((session) => session.sessionId !== sessionId);
  nextSessions.unshift({
    sessionId,
    playedAt: new Date().toISOString(),
    difficulty,
    playersCount: players.length,
    totalQuestions: questionEvents.length,
    failedAnswers: failEvents.length,
    completedRounds: players.filter((player) => player.questionsAnswered > 0).length,
    deviceId,
    source: 'local',
  });

  const failCountByLearner = new Map<string, number>();
  for (const event of failEvents) {
    failCountByLearner.set(event.learnerId, (failCountByLearner.get(event.learnerId) ?? 0) + 1);
  }

  const nextPlayerResults = snapshot.playerResults.filter((row) => row.sessionId !== sessionId);
  nextPlayerResults.unshift(
    ...players.map((player) => ({
      sessionId,
      learnerId: player.id,
      playerName: player.name,
      difficulty,
      score: player.score,
      timeSeconds: Number(player.time.toFixed(3)),
      questionsAnswered: player.questionsAnswered,
      failedCount: failCountByLearner.get(player.id) ?? 0,
      accuracy: player.questionsAnswered > 0 ? (player.correctAnswers * 100) / player.questionsAnswered : 0,
    }))
  );

  const nextFailEvents = [
    ...snapshot.failEvents.filter((event) => event.sessionId !== sessionId),
    ...failEvents.map((event) => ({
      sessionId: event.sessionId,
      learnerId: event.learnerId,
      playerName: event.playerName,
      difficulty: event.difficulty,
      word: event.word,
      playedAt: event.playedAt,
    })),
  ];

  const nextQuestionEvents = [
    ...snapshot.questionEvents.filter((event) => event.sessionId !== sessionId),
    ...questionEvents,
  ];

  return {
    sessions: nextSessions.sort((left, right) => right.playedAt.localeCompare(left.playedAt)),
    playerResults: nextPlayerResults.sort((left, right) => right.sessionId.localeCompare(left.sessionId)),
    failEvents: nextFailEvents.sort((left, right) => right.playedAt.localeCompare(left.playedAt)),
    questionEvents: nextQuestionEvents.sort((left, right) => right.playedAt.localeCompare(left.playedAt)),
    loadedAt: new Date().toISOString(),
    sync: {
      ...snapshot.sync,
      mode: syncMode,
    },
  };
};

export const buildAnalyticsSummary = (snapshot: AnalyticsSnapshot): AnalyticsSummary => {
  const totalSessions = snapshot.sessions.length;
  const totalQuestions =
    snapshot.questionEvents.length > 0
      ? snapshot.questionEvents.length
      : snapshot.playerResults.reduce((sum, row) => sum + row.questionsAnswered, 0);
  const totalFails =
    snapshot.questionEvents.length > 0
      ? snapshot.questionEvents.filter((event) => !event.isCorrect).length
      : snapshot.failEvents.length;
  const failRate = totalQuestions > 0 ? (totalFails * 100) / totalQuestions : 0;
  const avgAccuracy = totalQuestions > 0 ? ((totalQuestions - totalFails) * 100) / totalQuestions : 0;

  const sessionDifficultyCounts: Record<DifficultyLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const session of snapshot.sessions) {
    if (!session.difficulty) continue;
    sessionDifficultyCounts[session.difficulty] += 1;
  }

  const globalPerformance = buildWordPerformanceMap(snapshot.questionEvents);
  const weakestWords = Array.from(globalPerformance.values())
    .sort((left, right) => right.priority - left.priority || right.incorrect - left.incorrect || left.accuracy - right.accuracy)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      percent: totalFails > 0 ? (item.incorrect * 100) / totalFails : 0,
    }));

  let masteredWords = 0;
  let needsReviewWords = 0;
  for (const word of globalPerformance.values()) {
    const bucket = classifyWord(word.attempts, word.accuracy, word.incorrect);
    if (bucket === 'mastered') masteredWords += 1;
    if (bucket === 'review') needsReviewWords += 1;
  }

  const learners = new Map<
    string,
    {
      learnerId: string;
      playerName: string;
      games: number;
      totalScore: number;
      totalTime: number;
      totalFails: number;
      totalQuestions: number;
      difficultyCounts: Record<DifficultyLevel, number>;
    }
  >();

  for (const row of snapshot.playerResults) {
    const current = learners.get(row.learnerId) ?? {
      learnerId: row.learnerId,
      playerName: row.playerName,
      games: 0,
      totalScore: 0,
      totalTime: 0,
      totalFails: 0,
      totalQuestions: 0,
      difficultyCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
    };

    current.games += 1;
    current.totalScore += row.score;
    current.totalTime += row.timeSeconds;
    current.totalFails += row.failedCount;
    current.totalQuestions += row.questionsAnswered;
    if (row.difficulty) current.difficultyCounts[row.difficulty] += 1;
    learners.set(row.learnerId, current);
  }

  const playerStats = Array.from(learners.values())
    .map((learner) => {
      const wordPerformance = Array.from(buildWordPerformanceMap(snapshot.questionEvents, [learner.learnerId]).values())
        .sort((left, right) => right.priority - left.priority || right.incorrect - left.incorrect || left.accuracy - right.accuracy)
        .slice(0, 5)
        .map((item) => ({
          ...item,
          percent: learner.totalFails > 0 ? (item.incorrect * 100) / learner.totalFails : 0,
        }));

      let playerMastered = 0;
      let playerNeedsReview = 0;
      for (const item of buildWordPerformanceMap(snapshot.questionEvents, [learner.learnerId]).values()) {
        const bucket = classifyWord(item.attempts, item.accuracy, item.incorrect);
        if (bucket === 'mastered') playerMastered += 1;
        if (bucket === 'review') playerNeedsReview += 1;
      }

      const accuracy = learner.totalQuestions > 0 ? ((learner.totalQuestions - learner.totalFails) * 100) / learner.totalQuestions : 0;
      return {
        learnerId: learner.learnerId,
        playerName: learner.playerName,
        games: learner.games,
        avgScore: learner.games > 0 ? learner.totalScore / learner.games : 0,
        avgTime: learner.games > 0 ? learner.totalTime / learner.games : 0,
        totalFails: learner.totalFails,
        totalQuestions: learner.totalQuestions,
        accuracy,
        failRate: learner.totalQuestions > 0 ? (learner.totalFails * 100) / learner.totalQuestions : 0,
        difficultyStats: createDifficultyStats(learner.difficultyCounts, learner.games),
        weakestWords: wordPerformance,
        masteredWords: playerMastered,
        needsReviewWords: playerNeedsReview,
      };
    })
    .sort((left, right) => right.needsReviewWords - left.needsReviewWords || left.playerName.localeCompare(right.playerName, 'eu'));

  return {
    totalSessions,
    totalPlayers: learners.size,
    totalQuestions,
    totalFails,
    failRate,
    avgAccuracy,
    difficultyStats: createDifficultyStats(sessionDifficultyCounts, totalSessions),
    weakestWords,
    masteredWords,
    needsReviewWords,
    playerStats,
    recentSessions: [...snapshot.sessions].slice(0, 8),
    loadedAt: snapshot.loadedAt,
    syncMode: snapshot.sync.mode,
    lastRemoteSyncAt: snapshot.sync.lastRemoteSyncAt,
    remoteStatus: snapshot.sync.remoteStatus,
  };
};
