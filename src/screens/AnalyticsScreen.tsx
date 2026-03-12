import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAnalyticsStore } from '../store/useAnalyticsStore';
import { loadAnalyticsSnapshot } from '../storage';
import { buildAnalyticsSummary } from '../analytics';
import { TAP_TARGET_CLASS, FOCUS_RING_CLASS } from '../appConstants';
import { GameStatus } from '../types';

export const AnalyticsScreen = () => {
    const { setStatus } = useAppStore();
    const { snapshot, syncMode } = useAnalyticsStore();

    const analyticsSummary = useMemo(() => buildAnalyticsSummary(snapshot), [snapshot]);
    const hasAnalyticsData = analyticsSummary.totalSessions > 0 || analyticsSummary.totalQuestions > 0;

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-3 sm:p-6 lg:p-8">
            <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl p-4 sm:p-6 lg:p-8 flex flex-col h-full max-h-[94dvh]">

                <div className="mb-6 shrink-0 rounded-[1.75rem] border border-[#eff3fc] bg-[#f8fbff] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 text-center sm:text-left">
                            <h2 className="text-2xl sm:text-3xl font-black text-[#181333] uppercase">Analitikak</h2>
                            <p className="mt-2 text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Estatistikak eta errendimendua
                            </p>
                        </div>

                        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:min-w-[280px] sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setStatus(GameStatus.SETUP)}
                                className={`w-full rounded-[1.25rem] border border-[#dbe4ff] bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#4d3df7] shadow-sm transition-transform hover:bg-[#f5f8ff] active:scale-95 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                            >
                                Itzuli
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const freshSnapshot = loadAnalyticsSnapshot(syncMode);
                                    useAnalyticsStore.setState({ snapshot: freshSnapshot });
                                }}
                                className={`w-full rounded-[1.25rem] bg-[#4d3df7] px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-lg transition-transform hover:bg-indigo-600 active:scale-95 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                            >
                                Berritu
                            </button>
                        </div>
                    </div>
                </div>

                {!hasAnalyticsData ? (
                    <div className="grow flex items-center justify-center text-center">
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                            Ez dago saiorik gordeta
                        </p>
                    </div>
                ) : (
                    <div className="grow overflow-y-auto custom-scrollbar pr-1 min-h-0 space-y-4">
                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4 xl:grid-cols-4">
                            <div className="bg-[#f8fbff] border border-[#eff3fc] rounded-2xl p-4 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sesioak</p>
                                <p className="text-2xl font-black text-[#4d3df7]">{analyticsSummary.totalSessions}</p>
                            </div>
                            <div className="bg-[#f8fbff] border border-[#eff3fc] rounded-2xl p-4 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ikasleak</p>
                                <p className="text-2xl font-black text-[#4d3df7]">{analyticsSummary.totalPlayers}</p>
                            </div>
                            <div className="bg-[#f8fbff] border border-[#eff3fc] rounded-2xl p-4 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Galderak</p>
                                <p className="text-2xl font-black text-[#4d3df7]">{analyticsSummary.totalQuestions}</p>
                            </div>
                            <div className="bg-[#f8fbff] border border-[#eff3fc] rounded-2xl p-4 text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asmatze</p>
                                <p className="text-2xl font-black text-[#10b981]">{analyticsSummary.avgAccuracy.toFixed(0)}%</p>
                            </div>
                        </div>

                        {/* Players */}
                        <div className="bg-white border border-[#eff3fc] rounded-2xl p-0">
                            <div className="p-4 border-b border-[#eff3fc] bg-[#f8fbff] rounded-t-2xl">
                                <h3 className="text-xs font-black text-[#181333] uppercase tracking-widest">Ikasleak</h3>
                            </div>
                            <div className="divide-y divide-[#eff3fc]">
                                {analyticsSummary.playerStats.length > 0 ? (
                                    analyticsSummary.playerStats.map((player) => (
                                        <article key={player.learnerId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 bg-white hover:bg-slate-50 transition-colors">
                                            <div className="flex flex-col">
                                                <h4 className="text-sm font-black text-[#181333] uppercase leading-none">{player.playerName}</h4>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">{player.games} Joko</span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Puntuak</span>
                                                    <span className="text-sm font-black text-[#181333]">{player.avgScore.toFixed(1)}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">Asmatze</span>
                                                    <span className="text-sm font-black text-[#10b981]">{player.accuracy.toFixed(0)}%</span>
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <p className="text-xs font-bold text-slate-400 uppercase p-4 text-center">Ez dago ikasleen informaziorik</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
