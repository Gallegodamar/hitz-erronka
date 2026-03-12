import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWordsStore } from '../store/useWordsStore';
import { useAnalyticsStore } from '../store/useAnalyticsStore';
import { DIFFICULTY_LEVELS, FOCUS_RING_CLASS, QUESTIONS_PER_PLAYER, TAP_TARGET_CLASS } from '../appConstants';
import { GameStatus } from '../types';
import { createStableId, mergeWords } from '../wordUtils';
import { generateAdaptiveQuestionPool } from '../gameEngine';
import { buildWordPerformanceMap } from '../analytics';
import { useGameStore } from '../store/useGameStore';
import { PlayerRoster } from '../components/players/PlayerRoster';

export const SetupScreen = () => {
    const { status, setStatus, difficulty, setDifficulty, setupPlayers, selectedPlayerIds } = useAppStore();
    const { setGameData } = useGameStore();
    const { baseWords, customWords, isWordsLoading } = useWordsStore();
    const { snapshot } = useAnalyticsStore();

    const allWords = useMemo(() => mergeWords(baseWords, customWords), [baseWords, customWords]);
    const hasLeveledWords = useMemo(() => allWords.some((w) => w.level !== null && w.level !== undefined), [allWords]);

    const availableWordsForDifficulty = useMemo(() => {
        if (!hasLeveledWords) return allWords;
        const exactMatches = allWords.filter((w) => w.level === difficulty);
        const genericWords = allWords.filter((w) => w.level === null || w.level === undefined);
        return mergeWords(exactMatches, genericWords);
    }, [allWords, difficulty, hasLeveledWords]);

    const selectedPlayersForGame = useMemo(() =>
        selectedPlayerIds
            .map((id) => setupPlayers.find((p) => p.id === id))
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
            .map((p) => ({ ...p, score: 0, time: 0, questionsAnswered: 0, correctAnswers: 0 })),
        [selectedPlayerIds, setupPlayers]
    );

    const selectedLearnerPerformance = useMemo(
        () => buildWordPerformanceMap(snapshot.questionEvents, selectedPlayerIds, difficulty),
        [snapshot.questionEvents, difficulty, selectedPlayerIds]
    );

    const canStartGame = selectedPlayersForGame.length > 0 && !isWordsLoading && availableWordsForDifficulty.length > 0;

    const startNewGame = useCallback(() => {
        if (!canStartGame) return;
        const totalNeeded = selectedPlayersForGame.length * QUESTIONS_PER_PLAYER;
        const nextPool = generateAdaptiveQuestionPool(totalNeeded, availableWordsForDifficulty, selectedLearnerPerformance);

        if (nextPool.length === 0) return;

        setGameData({
            players: selectedPlayersForGame,
            questionPool: nextPool,
            gameSessionId: createStableId('session')
        });

        setStatus(GameStatus.INTERMISSION);
    }, [canStartGame, selectedPlayersForGame, availableWordsForDifficulty, selectedLearnerPerformance, setGameData, setStatus]);

    if (status !== GameStatus.SETUP) return null;

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-3 sm:p-6 lg:p-8">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl flex flex-col h-full max-h-[94dvh] p-4 sm:p-6 lg:p-8">

                <div className="mb-5 shrink-0 rounded-[1.75rem] border border-[#eff3fc] bg-[#f8fbff] p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 text-left">
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#181333] uppercase">
                                Sinonimoen Erronka
                            </h1>
                        </div>

                        <div className="flex shrink-0 justify-end">
                            <button
                                type="button"
                                title="Hitzak Kudeatu"
                                onClick={() => setStatus(GameStatus.WORDS_MANAGER)}
                                className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-[#4d3df7] text-white shadow-lg transition-transform hover:bg-indigo-600 active:scale-95 sm:h-16 sm:w-16 ${FOCUS_RING_CLASS}`}
                            >
                                <span className="text-[2rem] font-black leading-none sm:text-[2.25rem]">+</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Jokalariak Count */}
                <div className="flex items-center justify-between bg-[#f8fbff] rounded-2xl p-4 sm:p-5 mb-4 shrink-0 border border-[#eff3fc]">
                    <span className="text-xs sm:text-sm font-black text-[#181333] uppercase tracking-widest">Jokalariak:</span>
                    <span className="text-xl sm:text-2xl font-black text-[#4d3df7]">{selectedPlayerIds.length}</span>
                </div>

                {/* Zailtasun Maila */}
                <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 mb-5 shrink-0 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-3">
                    <span className="text-[11px] sm:text-xs font-black text-[#181333] uppercase tracking-widest">
                        Zailtasun Maila
                    </span>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {DIFFICULTY_LEVELS.map((level) => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setDifficulty(level)}
                                className={`rounded-2xl px-3 py-3 text-sm sm:text-base font-black transition-all ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS} ${difficulty === level ? 'bg-[#4d3df7] text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                                    }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Roster */}
                <div className="grow overflow-y-auto min-h-0 mb-4 px-1 custom-scrollbar">
                    <PlayerRoster />
                </div>

                {/* Action Button */}
                <button
                    type="button"
                    onClick={startNewGame}
                    disabled={!canStartGame}
                    className={`w-full text-white font-black px-5 py-4 sm:py-5 rounded-[1.35rem] transition-all text-sm sm:text-base uppercase tracking-widest shrink-0 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS} ${canStartGame ? 'bg-[#4d3df7] text-white shadow-lg active:scale-95 hover:bg-indigo-600' : 'bg-slate-200 cursor-not-allowed text-slate-400'
                        }`}
                >
                    {isWordsLoading ? 'Kargatzen...' : canStartGame ? 'Hasi Jokoa' : 'Aukeratu Jokalariak'}
                </button>
            </div>
        </div>
    );
};
