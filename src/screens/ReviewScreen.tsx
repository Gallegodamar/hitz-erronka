import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGameStore } from '../store/useGameStore';
import { useWordsStore } from '../store/useWordsStore';
import { TAP_TARGET_CLASS, FOCUS_RING_CLASS } from '../appConstants';
import { GameStatus } from '../types';
import { buildWordPerformanceMap } from '../analytics';
import { mergeWords } from '../wordUtils';

const getElhuyarUrl = (term: string) => `https://hiztegiak.elhuyar.eus/eu/${encodeURIComponent(term)}`;

export const ReviewScreen = () => {
    const { difficulty, setStatus } = useAppStore();
    const { lastSessionQuestionEvents, players } = useGameStore();
    const { baseWords, customWords } = useWordsStore();

    const allWords = useMemo(() => mergeWords(baseWords, customWords), [baseWords, customWords]);

    const reviewItems = useMemo(() => {
        const playerIdsStr = players.map((p) => String(p.id));
        const allItems = Array.from(buildWordPerformanceMap(lastSessionQuestionEvents, playerIdsStr, difficulty).values());

        return allItems
            .filter((item) => item.attempts > 0)
            .sort((a, b) => b.incorrect - a.incorrect || a.accuracy - b.accuracy)
            .map(item => {
                const wordData = allWords.find(w => w.hitza.toLowerCase() === item.word.toLowerCase());
                return {
                    ...item,
                    sinonimoak: wordData?.sinonimoak ?? []
                };
            });
    }, [lastSessionQuestionEvents, players, difficulty, allWords]);

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-3 sm:p-6 lg:p-8">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-4 sm:p-6 lg:p-8 flex flex-col h-full max-h-[94dvh]">
                <div className="mb-6 shrink-0 rounded-[1.75rem] border border-[#eff3fc] bg-[#f8fbff] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 text-center sm:text-left">
                            <h2 className="text-2xl sm:text-3xl font-black text-[#181333] uppercase">Hitzen Errepasoa</h2>
                            <p className="mt-2 text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Zailtasun handiena eman duten hitzak
                            </p>
                        </div>
                        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:min-w-[180px]">
                            <button
                                type="button"
                                onClick={() => setStatus(GameStatus.SUMMARY)}
                                className={`w-full rounded-[1.25rem] border border-[#dbe4ff] bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#4d3df7] shadow-sm transition-transform hover:bg-[#f5f8ff] active:scale-95 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                            >
                                Itzuli
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grow overflow-y-auto pr-1 custom-scrollbar min-h-0 mb-6 mt-2">
                    <div className="grid grid-cols-1 gap-3">
                        {reviewItems.map((item, index) => (
                            <article key={item.word} className="bg-[#f8fbff] p-4 rounded-2xl border border-[#eff3fc] flex flex-col gap-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-black bg-white text-[#4d3df7] px-2 py-1 rounded border border-[#eff3fc]">
                                            #{index + 1}
                                        </span>
                                        <a
                                            href={getElhuyarUrl(item.word)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`text-[#181333] font-black text-base uppercase underline-offset-2 hover:underline ${FOCUS_RING_CLASS} rounded-sm`}
                                        >
                                            {item.word}
                                        </a>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase">
                                        <span className="rounded-full bg-white px-2 py-1 text-slate-500 border border-slate-100">
                                            {item.attempts} saialdi
                                        </span>
                                        <span className="rounded-full bg-white px-2 py-1 text-[#ef4444] border border-rose-100">
                                            {item.incorrect} huts
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {item.sinonimoak.map((synonym) => (
                                        <a
                                            key={`${item.word}-${synonym}`}
                                            href={getElhuyarUrl(synonym)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`bg-white text-[#4d3df7] px-3 py-1.5 rounded-xl font-bold text-xs border border-[#eff3fc] underline-offset-2 transition-colors hover:bg-[#f5f8ff] hover:underline ${FOCUS_RING_CLASS}`}
                                        >
                                            {synonym}
                                        </a>
                                    ))}
                                </div>
                            </article>
                        ))}

                        {reviewItems.length === 0 && (
                            <div className="text-center p-8">
                                <p className="text-sm font-black text-[#b6c2d1] uppercase tracking-widest">Ez dago hitzik errepasatzeko</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
