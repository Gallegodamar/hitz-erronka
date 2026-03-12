import {
  gameFailEventsTable,
  gamePlayerResultsTable,
  gameQuestionEventsTable,
  gameSessionsTable,
  ensureAnalyticsIdentity,
  isSupabaseConfigured,
  supabase,
} from './supabaseClient';
import { DbErrorLike, DifficultyLevel, GameFailureEvent, Player, QuestionAnswerEvent } from './types';

export interface RemoteAnalyticsSyncResult {
  ok: boolean;
  message: string;
  syncedAt: string | null;
}

const toDbError = (error: unknown): DbErrorLike | null => {
  if (!error || typeof error !== 'object') return null;
  if (!('message' in error) || typeof error.message !== 'string') return null;
  return error as DbErrorLike;
};

export const isMissingTableError = (error: DbErrorLike | null): boolean => {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;

  const joined = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return joined.includes('does not exist') || joined.includes('not found');
};

export const isRowLevelSecurityError = (error: DbErrorLike | null): boolean => {
  if (!error) return false;
  if (error.code === '42501') return true;

  const joined = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return joined.includes('row-level security') || joined.includes('rls');
};

export const saveAnalyticsRemotely = async (params: {
  sessionId: string;
  deviceId: string;
  difficulty: DifficultyLevel;
  players: Player[];
  questionEvents: QuestionAnswerEvent[];
  failEvents: GameFailureEvent[];
}): Promise<RemoteAnalyticsSyncResult> => {
  if (!supabase || !isSupabaseConfigured) {
    return {
      ok: false,
      message: 'Backup remoto desactivado: Supabase no esta configurado.',
      syncedAt: null,
    };
  }

  const identity = await ensureAnalyticsIdentity();
  if (!identity.ok) {
    return {
      ok: false,
      message: `Backup remoto desactivado: ${identity.message}`,
      syncedAt: null,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      message: `No se pudo resolver la identidad anonima para sincronizar: ${userError?.message ?? 'sin usuario'}.`,
      syncedAt: null,
    };
  }

  const playedAt = new Date().toISOString();
  const failedCountByLearner = new Map<string, number>();
  for (const event of params.failEvents) {
    failedCountByLearner.set(event.learnerId, (failedCountByLearner.get(event.learnerId) ?? 0) + 1);
  }

  const sessionRow = {
    session_id: params.sessionId,
    owner_id: user.id,
    device_id: params.deviceId,
    played_at: playedAt,
    difficulty: params.difficulty,
    players_count: params.players.length,
    total_questions: params.questionEvents.length,
    failed_answers: params.failEvents.length,
    completed_rounds: params.players.filter((player) => player.questionsAnswered > 0).length,
  };

  const { error: sessionError } = await supabase.from(gameSessionsTable).insert(sessionRow);
  if (sessionError) {
    const dbError = toDbError(sessionError);
    const prefix = isRowLevelSecurityError(dbError)
      ? 'RLS bloquea la tabla de sesiones.'
      : isMissingTableError(dbError)
        ? `Falta la tabla remota ${gameSessionsTable}.`
        : 'Fallo al guardar la sesion remota.';

    return {
      ok: false,
      message: `${prefix} ${dbError?.message ?? ''}`.trim(),
      syncedAt: null,
    };
  }

  const playerRows = params.players.map((player, index) => ({
    session_id: params.sessionId,
    owner_id: user.id,
    device_id: params.deviceId,
    learner_id: player.id,
    player_name: player.name,
    player_order: index + 1,
    difficulty: params.difficulty,
    score: player.score,
    time_seconds: Number(player.time.toFixed(3)),
    questions_answered: player.questionsAnswered,
    failed_count: failedCountByLearner.get(player.id) ?? 0,
    accuracy: player.questionsAnswered > 0 ? (player.correctAnswers * 100) / player.questionsAnswered : 0,
    played_at: playedAt,
  }));

  if (playerRows.length > 0) {
    const { error: playerError } = await supabase.from(gamePlayerResultsTable).insert(playerRows);
    if (playerError) {
      return {
        ok: false,
        message: `La sesion se guardo, pero no los resultados de jugador: ${playerError.message}`,
        syncedAt: null,
      };
    }
  }

  if (params.failEvents.length > 0) {
    const failRows = params.failEvents.map((event) => ({
      session_id: event.sessionId,
      owner_id: user.id,
      device_id: params.deviceId,
      learner_id: event.learnerId,
      player_name: event.playerName,
      difficulty: event.difficulty,
      word: event.word,
      correct_answer: event.correctAnswer,
      selected_answer: event.selectedAnswer,
      question_number: event.questionNumber,
      played_at: event.playedAt,
    }));

    const { error: failError } = await supabase.from(gameFailEventsTable).insert(failRows);
    if (failError) {
      return {
        ok: false,
        message: `La sesion se guardo, pero no los fallos: ${failError.message}`,
        syncedAt: null,
      };
    }
  }

  if (params.questionEvents.length > 0) {
    const questionRows = params.questionEvents.map((event) => ({
      session_id: event.sessionId,
      owner_id: user.id,
      device_id: params.deviceId,
      learner_id: event.learnerId,
      player_name: event.playerName,
      difficulty: event.difficulty,
      word: event.word,
      correct_answer: event.correctAnswer,
      selected_answer: event.selectedAnswer,
      question_number: event.questionNumber,
      is_correct: event.isCorrect,
      played_at: event.playedAt,
    }));

    const { error: questionError } = await supabase.from(gameQuestionEventsTable).insert(questionRows);
    if (questionError) {
      const dbError = toDbError(questionError);
      if (!isMissingTableError(dbError)) {
        return {
          ok: false,
          message: `La sesion se guardo, pero no el detalle de respuestas: ${questionError.message}`,
          syncedAt: null,
        };
      }
    }
  }

  return {
    ok: true,
    message: 'Backup remoto sincronizado.',
    syncedAt: playedAt,
  };
};
