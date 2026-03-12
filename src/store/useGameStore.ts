import { create } from 'zustand';
import { Player, Question, QuestionAnswerEvent, GameFailureEvent } from '../types';

interface GameState {
    players: Player[];
    questionPool: Question[];
    currentPlayerIndex: number;
    currentQuestionIndex: number;
    selectedAnswer: string | null;
    isAnswered: boolean;
    currentTurnPenalties: number;
    gameSessionId: string | null;
    questionEvents: QuestionAnswerEvent[];
    failEvents: GameFailureEvent[];
    lastSessionQuestionEvents: QuestionAnswerEvent[];
    lastSessionFailEvents: GameFailureEvent[];

    setGameData: (data: { players: Player[], questionPool: Question[], gameSessionId: string }) => void;
    startPlayerTurn: () => void;
    submitAnswer: (answer: string, event: QuestionAnswerEvent, failEvent?: GameFailureEvent) => void;
    nextQuestion: () => void;
    finishPlayerTurn: (realSeconds: number) => { isGameOver: boolean, updatedPlayers: Player[] };
    finalizeGame: (updatedPlayers: Player[]) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    players: [],
    questionPool: [],
    currentPlayerIndex: 0,
    currentQuestionIndex: 0,
    selectedAnswer: null,
    isAnswered: false,
    currentTurnPenalties: 0,
    gameSessionId: null,
    questionEvents: [],
    failEvents: [],
    lastSessionQuestionEvents: [],
    lastSessionFailEvents: [],

    setGameData: ({ players, questionPool, gameSessionId }) => set({
        players,
        questionPool,
        gameSessionId,
        currentPlayerIndex: 0,
        currentQuestionIndex: 0,
        selectedAnswer: null,
        isAnswered: false,
        currentTurnPenalties: 0,
        questionEvents: [],
        failEvents: [],
        lastSessionQuestionEvents: [],
        lastSessionFailEvents: []
    }),

    startPlayerTurn: () => set({
        currentTurnPenalties: 0,
        currentQuestionIndex: 0,
        selectedAnswer: null,
        isAnswered: false,
    }),

    submitAnswer: (answer, event, failEvent) => set((state) => {
        if (state.isAnswered) return state;

        const isCorrect = event.isCorrect;
        const updPlayers = state.players.map((player, idx) =>
            idx === state.currentPlayerIndex
                ? {
                    ...player,
                    score: player.score + (isCorrect ? 1 : 0),
                    questionsAnswered: player.questionsAnswered + 1,
                    correctAnswers: player.correctAnswers + (isCorrect ? 1 : 0)
                }
                : player
        );

        return {
            selectedAnswer: answer,
            isAnswered: true,
            players: updPlayers,
            questionEvents: [...state.questionEvents, event],
            failEvents: failEvent ? [...state.failEvents, failEvent] : state.failEvents,
            currentTurnPenalties: state.currentTurnPenalties + (isCorrect ? 0 : 10)
        };
    }),

    nextQuestion: () => {
        const state = get();
        set({
            currentQuestionIndex: state.currentQuestionIndex + 1,
            selectedAnswer: null,
            isAnswered: false,
        });
    },

    finishPlayerTurn: (realSeconds) => {
        const state = get();
        const totalSecondsWithPenalty = realSeconds + state.currentTurnPenalties;

        const updatedPlayers = state.players.map((p, i) =>
            i === state.currentPlayerIndex
                ? { ...p, time: Number(totalSecondsWithPenalty.toFixed(3)) }
                : p
        );

        const isGameOver = state.currentPlayerIndex >= updatedPlayers.length - 1;

        set({ players: updatedPlayers });

        if (!isGameOver) {
            set({ currentPlayerIndex: state.currentPlayerIndex + 1 });
        }

        return { isGameOver, updatedPlayers };
    },

    finalizeGame: (updatedPlayers) => {
        const state = get();
        set({
            lastSessionQuestionEvents: [...state.questionEvents],
            lastSessionFailEvents: [...state.failEvents],
            gameSessionId: null,
            questionEvents: [],
            failEvents: []
        });
    }
}));
