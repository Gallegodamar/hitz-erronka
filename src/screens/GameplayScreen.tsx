import { useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { useGameStore } from '../store/useGameStore';
import { FOCUS_RING_CLASS, TAP_TARGET_CLASS, QUESTIONS_PER_PLAYER } from '../appConstants';
import { GameStatus } from '../types';
import { useAnalyticsStore } from '../store/useAnalyticsStore';

const getOptionClassName = (isAnswered: boolean, isCorrectOption: boolean, isSelectedOption: boolean) => {
    const classes = [
        'group relative flex min-h-[92px] sm:min-h-[184px] w-full items-center justify-center rounded-[1.35rem] sm:rounded-[1.9rem] border-2 px-3 py-3 sm:px-6 sm:py-6 text-center shadow-[0_20px_40px_-28px_rgba(15,23,42,0.55)] transition-all duration-200',
    ];

    if (!isAnswered) {
        classes.push(
            'border-[#d9e4ff] bg-white text-[#14284b] hover:-translate-y-1 hover:border-[#7aa2ff] hover:bg-[#f9fbff] active:translate-y-0'
        );
        return classes.join(' ');
    }

    if (isCorrectOption) {
        classes.push('border-[#3fb68b] bg-[#e5fff2] text-[#0e5b3d]');
        return classes.join(' ');
    }

    if (isSelectedOption) {
        classes.push('border-[#ff8e7d] bg-[#fff0ec] text-[#9c3123]');
        return classes.join(' ');
    }

    classes.push('border-[#dfe7f0] bg-[#f4f7fb] text-[#7b8798]');
    return classes.join(' ');
};

export const GameplayScreen = () => {
    const { difficulty, setStatus } = useAppStore();
    const {
        players,
        questionPool,
        currentPlayerIndex,
        currentQuestionIndex,
        selectedAnswer,
        isAnswered,
        gameSessionId,
        submitAnswer,
        nextQuestion,
        finishPlayerTurn,
        finalizeGame
    } = useGameStore();
    const { finalizeGameEvents } = useAnalyticsStore();

    const currentQuestionIndexInPool = currentPlayerIndex * QUESTIONS_PER_PLAYER + currentQuestionIndex;
    const currentQuestion =
        currentQuestionIndexInPool >= 0 && currentQuestionIndexInPool < questionPool.length
            ? questionPool[currentQuestionIndexInPool]
            : null;
    const currentPlayer = players[currentPlayerIndex];

    const turnStartTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        turnStartTimeRef.current = Date.now();
    }, [currentPlayerIndex]);

    const handleAnswer = useCallback((answer: string) => {
        if (isAnswered || !currentQuestion || !currentPlayer) return;

        const isCorrect = answer === currentQuestion.correctAnswer;
        const playedAt = new Date().toISOString();
        const sId = gameSessionId ?? 'session-fallback';

        submitAnswer(answer,
            {
                sessionId: sId,
                learnerId: currentPlayer.id,
                playerName: currentPlayer.name,
                difficulty,
                word: currentQuestion.wordData.hitza,
                correctAnswer: currentQuestion.correctAnswer,
                selectedAnswer: answer,
                questionNumber: currentQuestionIndex + 1,
                isCorrect,
                playedAt,
            },
            !isCorrect ? {
                sessionId: sId,
                learnerId: currentPlayer.id,
                playerName: currentPlayer.name,
                difficulty,
                word: currentQuestion.wordData.hitza,
                correctAnswer: currentQuestion.correctAnswer,
                selectedAnswer: answer,
                questionNumber: currentQuestionIndex + 1,
                playedAt,
            } : undefined
        );
    }, [isAnswered, currentQuestion, currentPlayer, gameSessionId, submitAnswer, difficulty, currentQuestionIndex]);

    const handleNext = () => {
        if (currentQuestionIndex < QUESTIONS_PER_PLAYER - 1) {
            nextQuestion();
        } else {
            handleFinishTurn();
        }
    };

    const handleFinishTurn = () => {
        const endTime = Date.now();
        const realSeconds = (endTime - turnStartTimeRef.current) / 1000;

        const { isGameOver, updatedPlayers } = finishPlayerTurn(realSeconds);

        if (isGameOver && gameSessionId) {
            const state = useGameStore.getState();
            finalizeGame(updatedPlayers);
            void finalizeGameEvents({
                sessionId: gameSessionId,
                difficulty,
                players: updatedPlayers,
                questionEvents: state.questionEvents,
                failEvents: state.failEvents
            });
            setStatus(GameStatus.SUMMARY);
        } else {
            setStatus(GameStatus.INTERMISSION);
        }
    };

    if (!currentQuestion || !currentPlayer) return null;

    const progressPercent = ((currentQuestionIndex + (isAnswered ? 1 : 0)) / QUESTIONS_PER_PLAYER) * 100;
    const correctCount = currentPlayer.correctAnswers;
    const failedCount = Math.max(0, currentPlayer.questionsAnswered - currentPlayer.correctAnswers);

    return (
        <div className="relative flex h-[100dvh] w-full flex-col items-center overflow-hidden safe-pt safe-pb safe-px p-2 sm:p-6 lg:p-8 bg-[radial-gradient(circle_at_top_left,_#fff8d6_0%,_#f6faff_38%,_#e9f0ff_100%)]">

            {/* Ambient Background Effects */}
            <div className="absolute top-[-12%] left-[-6%] h-[38vw] w-[38vw] rounded-full bg-[#ffe59a]/65 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-18%] right-[-8%] h-[42vw] w-[42vw] rounded-full bg-[#bfd7ff]/75 blur-[140px] pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),transparent)] pointer-events-none" />

            <div className="z-10 w-full max-w-4xl pb-2 sm:pb-4">
                <div className="flex items-stretch gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1 rounded-[1.2rem] sm:rounded-2xl border border-[#d9e4ff] bg-[#fdfefe]/95 px-3 py-2.5 sm:px-4 sm:py-3 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.14em] sm:tracking-[0.16em] text-slate-500 shadow-[0_16px_35px_-28px_rgba(15,23,42,0.35)]">
                        <span className="mr-2 text-base leading-none">{currentPlayer.emoji}</span>
                        <span className="inline-block max-w-full truncate align-middle">{currentPlayer.name}</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleFinishTurn}
                        className={`shrink-0 rounded-[1.2rem] sm:rounded-2xl border border-[#ffb2a7] bg-[#ff6f61] px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black uppercase tracking-[0.14em] sm:tracking-[0.16em] text-white shadow-[0_18px_36px_-24px_rgba(239,68,68,0.55)] transition-transform hover:-translate-y-0.5 hover:bg-[#f95b4d] active:translate-y-0 sm:min-w-[200px] ${FOCUS_RING_CLASS}`}
                    >
                        <span className="sm:hidden">Utzi</span>
                        <span className="hidden sm:inline">Utzi Txanda</span>
                    </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:grid-cols-4 sm:gap-3">
                    <div className="rounded-[1.2rem] sm:rounded-2xl border border-white/70 bg-white/90 px-3 py-2.5 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] sm:tracking-[0.18em] text-slate-500 shadow-[0_16px_35px_-28px_rgba(37,99,235,0.55)] backdrop-blur">
                        <span className="mr-2 text-base text-[#1c46db]">{currentQuestionIndex + 1}</span>
                        / {QUESTIONS_PER_PLAYER}
                    </div>
                    <div className="rounded-[1.2rem] sm:rounded-2xl border border-[#d9e4ff] bg-[#eef4ff] px-3 py-2.5 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#3252b8] shadow-[0_16px_35px_-28px_rgba(37,99,235,0.45)]">
                        {difficulty}. maila
                    </div>
                    <div className="rounded-[1.2rem] sm:rounded-2xl border border-[#b8f0cf] bg-[#edfcf4] px-3 py-2.5 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] sm:tracking-[0.18em] text-[#18794e] shadow-[0_16px_35px_-28px_rgba(16,185,129,0.35)]">
                        <span className="mr-2 text-base text-[#0f8b58]">{correctCount}</span>
                        Ondo
                    </div>
                    <div className="rounded-[1.2rem] sm:rounded-2xl border border-[#ffc9bf] bg-[#fff1ee] px-3 py-2.5 sm:px-4 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] sm:tracking-[0.18em] text-[#c24131] shadow-[0_16px_35px_-28px_rgba(239,68,68,0.25)]">
                        <span className="mr-2 text-base text-[#e25543]">{failedCount}</span>
                        Huts
                    </div>
                </div>
            </div>

            {/* Main Game Card */}
            <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="z-10 flex min-h-0 w-full max-w-4xl grow flex-col overflow-hidden rounded-[2rem] sm:rounded-[2.75rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,248,255,0.98)_100%)] p-3 sm:p-8 lg:p-10 shadow-[0_34px_80px_-42px_rgba(37,99,235,0.5)] backdrop-blur-xl"
            >
                {/* Progress Bar Top */}
                <div className="absolute top-0 left-0 h-2 w-full bg-[#dfe7fb]">
                    <motion.div
                        className="h-full bg-[linear-gradient(90deg,#2d6df6_0%,#57b0ff_52%,#ffd76b_100%)] shadow-[0_0_18px_rgba(45,109,246,0.35)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    />
                </div>

                <div className="flex shrink-0 flex-col items-center justify-start pt-4 pb-3 text-center sm:flex-1 sm:justify-center sm:py-10">
                    <motion.p
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                        className="mb-3 rounded-full bg-[#edf3ff] px-4 py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-[0.18em] sm:tracking-[0.28em] text-[#4864b8]"
                    >
                        Hautatu sinonimo zuzena
                    </motion.p>
                    <motion.h3
                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                        className="max-w-3xl bg-[linear-gradient(transparent_58%,_#d9e5ff_58%)] px-3 py-2 text-[clamp(2.25rem,10.5vw,6.25rem)] font-black uppercase leading-[0.95] tracking-[-0.06em] text-[#12264d]"
                    >
                        {currentQuestion.wordData.hitza}
                    </motion.h3>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-2 sm:mt-auto sm:grid-cols-2 sm:gap-5">
                    {currentQuestion.options.map((option) => {
                        const isCorrectOption = option === currentQuestion.correctAnswer;
                        const isSelectedOption = option === selectedAnswer;

                        return (
                            <button
                                key={`${currentQuestion.id}-${option}`}
                                type="button"
                                disabled={isAnswered}
                                onClick={() => handleAnswer(option)}
                                className={`${getOptionClassName(isAnswered, isCorrectOption, isSelectedOption)} ${FOCUS_RING_CLASS}`}
                            >
                                <span className="text-center break-words text-[1.2rem] font-black uppercase leading-[0.92] tracking-[-0.04em] sm:text-[2.4rem]">
                                    {option}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 flex min-h-[72px] shrink-0 flex-col items-center justify-center sm:mt-8 sm:min-h-[96px]">
                    {isAnswered ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className={`w-full rounded-[1.4rem] sm:rounded-[1.75rem] bg-[linear-gradient(135deg,#255cf4_0%,#4fa8ff_100%)] px-5 py-3.5 sm:px-6 sm:py-5 text-sm sm:text-lg font-black uppercase tracking-[0.18em] text-white shadow-[0_24px_45px_-28px_rgba(37,92,244,0.65)] transition-transform hover:scale-[1.01] active:scale-[0.99] ${FOCUS_RING_CLASS}`}
                        >
                            {currentQuestionIndex < QUESTIONS_PER_PLAYER - 1 ? 'Hurrengoa' : 'Amaitu txanda'}
                        </button>
                    ) : (
                        <div className="flex h-full items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.16em] sm:tracking-[0.2em] text-slate-500 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)]">
                            <span className="h-2 w-2 rounded-full bg-[#2d6df6] animate-ping" />
                            Erantzunaren zain
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
