import { useAppStore } from '../store/useAppStore';
import { useGameStore } from '../store/useGameStore';
import { FOCUS_RING_CLASS, TAP_TARGET_CLASS, QUESTIONS_PER_PLAYER } from '../appConstants';
import { GameStatus } from '../types';
import { formatPlayerLabel } from '../wordUtils';

export const IntermissionScreen = () => {
    const { difficulty, setStatus } = useAppStore();
    const { players, currentPlayerIndex, startPlayerTurn } = useGameStore();

    const player = players[currentPlayerIndex];
    if (!player) return null;

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-4 sm:p-6 lg:p-8">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-2xl text-center max-w-md w-full border-b-[6px] border-[#4d3df7]">
                <div className="w-16 h-16 bg-[#f8fbff] text-[#4d3df7] border-[#eff3fc] border-2 rounded-2xl flex items-center justify-center text-3xl font-black mx-auto mb-6 shadow-sm">
                    {currentPlayerIndex + 1}
                </div>

                <h2 className="text-3xl font-black text-[#181333] mb-1">
                    {formatPlayerLabel(player)}
                </h2>

                <p className="text-xs text-[#b6c2d1] font-black mb-8 uppercase tracking-[0.2em]">
                    {difficulty} MAILA · {QUESTIONS_PER_PLAYER} GALDERA
                </p>

                <button
                    type="button"
                    onClick={() => {
                        startPlayerTurn();
                        setStatus(GameStatus.PLAYING);
                    }}
                    className={`w-full bg-[#4d3df7] hover:bg-indigo-600 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-95 text-sm uppercase tracking-widest ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                >
                    Hasi Txanda
                </button>
            </div>
        </div>
    );
};
