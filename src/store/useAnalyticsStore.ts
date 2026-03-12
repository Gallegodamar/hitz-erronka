import { create } from 'zustand';
import { AnalyticsSnapshot, AnalyticsSyncMode, DifficultyLevel, GameFailureEvent, Player, QuestionAnswerEvent } from '../types';
import { getOrCreateDeviceId, loadAnalyticsSnapshot, saveAnalyticsSnapshot } from '../storage';
import { isSupabaseConfigured } from '../supabaseClient';
import { recordCompletedGame } from '../analytics';
import { saveAnalyticsRemotely } from '../remoteAnalytics';

const syncMode: AnalyticsSyncMode = isSupabaseConfigured ? 'local-with-remote-backup' : 'local-only';
const deviceId = getOrCreateDeviceId();

interface AnalyticsState {
    snapshot: AnalyticsSnapshot;
    deviceId: string;
    syncMode: AnalyticsSyncMode;

    finalizeGameEvents: (params: {
        sessionId: string;
        difficulty: DifficultyLevel;
        players: Player[];
        questionEvents: QuestionAnswerEvent[];
        failEvents: GameFailureEvent[];
    }) => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
    snapshot: loadAnalyticsSnapshot(syncMode),
    deviceId,
    syncMode,

    finalizeGameEvents: async ({ sessionId, difficulty, players, questionEvents, failEvents }) => {
        const { deviceId, syncMode } = get();

        set((state) => {
            const updatedSnapshot = recordCompletedGame(state.snapshot, {
                sessionId,
                deviceId,
                difficulty,
                players,
                questionEvents,
                failEvents,
                syncMode,
            });
            saveAnalyticsSnapshot(updatedSnapshot);
            return { snapshot: updatedSnapshot };
        });

        if (isSupabaseConfigured) {
            const result = await saveAnalyticsRemotely({
                sessionId,
                deviceId,
                difficulty,
                players,
                questionEvents,
                failEvents,
            });

            set((state) => {
                const nextSnapshot = {
                    ...state.snapshot,
                    loadedAt: new Date().toISOString(),
                    sync: {
                        ...state.snapshot.sync,
                        mode: syncMode,
                        lastRemoteSyncAt: result.ok ? result.syncedAt : state.snapshot.sync.lastRemoteSyncAt,
                        remoteStatus: result.message,
                    },
                };
                saveAnalyticsSnapshot(nextSnapshot);
                return { snapshot: nextSnapshot };
            });
        }
    }
}));
