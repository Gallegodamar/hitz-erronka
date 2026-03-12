import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const wordsTable = import.meta.env.VITE_SUPABASE_WORDS_TABLE || 'words';
export const gameSessionsTable = import.meta.env.VITE_SUPABASE_GAME_SESSIONS_TABLE || 'game_sessions';
export const gamePlayerResultsTable =
  import.meta.env.VITE_SUPABASE_GAME_PLAYER_RESULTS_TABLE || 'game_player_results';
export const gameFailEventsTable = import.meta.env.VITE_SUPABASE_GAME_FAIL_EVENTS_TABLE || 'game_fail_events';
export const gameQuestionEventsTable =
  import.meta.env.VITE_SUPABASE_GAME_QUESTION_EVENTS_TABLE || 'game_question_events';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    })
  : null;

export const ensureAnalyticsIdentity = async (): Promise<{ ok: boolean; message: string }> => {
  if (!supabase || !isSupabaseConfigured) {
    return {
      ok: false,
      message: 'Supabase no esta configurado.',
    };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (session) {
    return {
      ok: true,
      message: 'Sesion anonima disponible.',
    };
  }

  if (sessionError) {
    return {
      ok: false,
      message: sessionError.message,
    };
  }

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    message: 'Sesion anonima creada.',
  };
};
