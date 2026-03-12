import { create } from 'zustand';
import { GameStatus, DifficultyLevel, SetupPlayerProfile } from '../types';
import { loadRoster, saveRoster } from '../storage';

interface AppState {
    status: GameStatus;
    difficulty: DifficultyLevel;
    setupPlayers: SetupPlayerProfile[];
    selectedPlayerIds: string[];

    setStatus: (status: GameStatus) => void;
    setDifficulty: (level: DifficultyLevel) => void;
    togglePlayerSelection: (id: string) => void;
    updatePlayerName: (id: string, name: string) => void;
    resetSetup: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    status: GameStatus.SETUP,
    difficulty: 1,
    setupPlayers: loadRoster(),
    selectedPlayerIds: [],

    setStatus: (status) => set({ status }),

    setDifficulty: (difficulty) => set({ difficulty }),

    togglePlayerSelection: (id) => set((state) => {
        const isSelected = state.selectedPlayerIds.includes(id);
        return {
            selectedPlayerIds: isSelected
                ? state.selectedPlayerIds.filter(pId => pId !== id)
                : [...state.selectedPlayerIds, id]
        };
    }),

    updatePlayerName: (id, name) => set((state) => {
        const updatedPlayers = state.setupPlayers.map(player =>
            player.id === id ? { ...player, name } : player
        );
        saveRoster(updatedPlayers);
        return { setupPlayers: updatedPlayers };
    }),

    resetSetup: () => set({
        status: GameStatus.SETUP,
        selectedPlayerIds: [],
    })
}));
