import { useAppStore } from '../store/useAppStore';
import { useGameStore } from '../store/useGameStore';
import { TAP_TARGET_CLASS, FOCUS_RING_CLASS } from '../appConstants';
import { GameStatus } from '../types';
import Podium, { PodiumPlayer } from '../Podium';
import { formatPlayerLabel } from '../wordUtils';

export const SummaryScreen = () => {
    const { difficulty, setStatus } = useAppStore();
    const { players } = useGameStore();

    const sortedPlayers = [...players]
        .filter((player) => player.questionsAnswered > 0 || player.time > 0)
        .sort((left, right) => right.score - left.score || left.time - right.time);

    const podiumPlayers: PodiumPlayer[] = sortedPlayers.slice(0, 3).map((player) => ({
        id: player.id,
        name: formatPlayerLabel(player),
        points: player.score,
        time: player.time,
    }));

    const tablePlayers = sortedPlayers.slice(3);
    const tableStartRank = podiumPlayers.length + 1;

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-3 sm:p-6 lg:p-8">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl p-4 sm:p-6 lg:p-8 flex flex-col h-full max-h-[94dvh] border-t-[8px] border-emerald-500">
                <div className="mb-8 shrink-0 text-center">
                    <h2 className="text-3xl sm:text-4xl font-black text-[#181333] uppercase tracking-tighter">Amaiera</h2>
                    <p className="text-xs font-black text-[#4d3df7] uppercase tracking-widest mt-2">{difficulty} Maila</p>
                </div>

                <div className="mb-6 shrink-0 bg-[#f8fbff] rounded-[2rem] p-4 sm:p-6 border border-[#eff3fc]">
                    <Podium players={podiumPlayers} title="" ariaLabel="Podiuma" />
                </div>

                {tablePlayers.length > 0 && (
                    <div className="grow overflow-hidden rounded-2xl border border-[#eff3fc] shadow-sm bg-white mb-6 flex flex-col">
                        <div className="overflow-y-auto custom-scrollbar grow p-2">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 border-b border-[#eff3fc]">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] sm:text-xs font-black text-[#b6c2d1] uppercase tracking-widest">#</th>
                                        <th className="px-4 py-3 text-[10px] sm:text-xs font-black text-[#b6c2d1] uppercase tracking-widest">Jokalaria</th>
                                        <th className="px-4 py-3 text-[10px] sm:text-xs font-black text-[#b6c2d1] uppercase tracking-widest text-center">Puntuak</th>
                                        <th className="px-4 py-3 text-[10px] sm:text-xs font-black text-[#b6c2d1] uppercase tracking-widest text-right">Denbora</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#eff3fc]">
                                    {tablePlayers.map((player, index) => {
                                        return (
                                            <tr key={player.id} className="hover:bg-[#f8fbff] transition-colors">
                                                <td className="px-4 py-3 font-black text-[#181333]">{`${tableStartRank + index}.`}</td>
                                                <td className="px-4 py-3 font-bold text-[#181333] text-sm uppercase tracking-tight">
                                                    {formatPlayerLabel(player)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="bg-[#4d3df7] text-white px-2.5 py-1 rounded-lg font-black text-xs">{player.score}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs font-bold">{player.time.toFixed(1)}s</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!tablePlayers.length && <div className="grow" />}

                <div className="grid grid-cols-1 gap-3 mt-auto shrink-0 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setStatus(GameStatus.REVIEW)}
                        className={`w-full bg-white hover:bg-slate-50 text-[#181333] font-black px-5 py-4 rounded-xl shadow-sm text-sm uppercase tracking-widest border-2 border-[#eff3fc] transition-all ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                    >
                        Hitzak Errepasatu
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatus(GameStatus.SETUP)}
                        className={`w-full bg-[#4d3df7] hover:bg-indigo-600 text-white font-black px-5 py-4 rounded-xl shadow-lg text-sm uppercase tracking-widest transition-transform active:scale-95 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                    >
                        Joko Berria
                    </button>
                </div>
            </div>
        </div>
    );
};
