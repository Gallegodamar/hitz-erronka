import { useAppStore } from '../../store/useAppStore';
import { TAP_TARGET_CLASS, FOCUS_RING_CLASS } from '../../appConstants';

export const PlayerRoster = () => {
    const { setupPlayers, selectedPlayerIds, togglePlayerSelection } = useAppStore();

    return (
        <div className="grid grid-cols-1 gap-3 pb-2 md:grid-cols-2">
            {setupPlayers.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                    <button
                        key={player.id}
                        type="button"
                        onClick={() => togglePlayerSelection(player.id)}
                        className={`group relative flex min-h-[96px] items-center rounded-[1.5rem] border p-4 text-left transition-all sm:min-h-[108px] sm:p-5 ${TAP_TARGET_CLASS} ${isSelected ? 'border-transparent bg-[#eef4ff] shadow-[0_20px_35px_-28px_rgba(37,99,235,0.5)]' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                            } ${FOCUS_RING_CLASS}`}
                    >
                        <div className="flex w-full items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                                <span className="text-3xl leading-none sm:text-[2.15rem]">{player.emoji}</span>
                                <span className="block truncate text-base font-black uppercase tracking-tight text-[#181333] sm:text-lg">
                                    {player.name}
                                </span>
                            </div>

                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${isSelected ? 'border-[#bfd2ff] bg-white text-[#3559d4]' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                {isSelected ? '✓' : '+'}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};
