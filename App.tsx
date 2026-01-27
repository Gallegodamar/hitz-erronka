
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { LEVEL_1_DATA, EXTENDED_DATA } from './data';
import { WordData, Player, Question, GameStatus, DifficultyLevel } from './types';

const QUESTIONS_PER_PLAYER = 10;

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Heuristic to get word "type" based on common Basque suffixes
const getWordType = (word: string): string => {
  const normalized = word.toLowerCase().trim();
  if (normalized.endsWith('tu') || normalized.endsWith('du') || normalized.endsWith('ten') || normalized.endsWith('tzen')) return 'verb';
  if (normalized.endsWith('ak') || normalized.endsWith('ek')) return 'plural';
  if (normalized.endsWith('era') || normalized.endsWith('ura') || normalized.endsWith('tasun')) return 'abstract';
  return 'other';
};

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.SETUP);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(1);
  const [numPlayers, setNumPlayers] = useState(2);
  const [players, setPlayers] = useState<Player[]>(
    Array.from({ length: 2 }, (_, i) => ({ id: i, name: `Jokalaria ${i + 1}`, score: 0, time: 0 }))
  );
  
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; penaltyApplied: boolean } | null>(null);
  
  const [currentTurnPenalties, setCurrentTurnPenalties] = useState(0);
  const turnStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setPlayers(Array.from({ length: numPlayers }, (_, i) => ({ id: i, name: `Jokalaria ${i + 1}`, score: 0, time: 0 })));
    }
  }, [numPlayers, status]);

  const generatePool = (needed: number, level: DifficultyLevel) => {
    let poolSource: WordData[] = [];
    if (level === 1) {
      poolSource = [...LEVEL_1_DATA];
    } else {
      // Split 972 entries into 3 blocks of 324
      const start = (level - 2) * 324;
      const end = start + 324;
      poolSource = EXTENDED_DATA.slice(start, end);
    }

    // Ensure we have enough unique questions or recycle if necessary
    let gameData = [...poolSource];
    while (gameData.length < needed) {
      gameData = [...gameData, ...poolSource];
    }
    gameData = shuffleArray(gameData).slice(0, needed);

    // Get all words in this level for distractors
    const allWordsInPool = poolSource.flatMap(d => [d.hitza, ...d.sinonimoak]);

    return gameData.map((data) => {
      const correctAnswer = data.sinonimoak[Math.floor(Math.random() * data.sinonimoak.length)];
      const targetType = getWordType(data.hitza);
      
      // Filter distractors by same "type" if possible
      let distractorsPool = allWordsInPool.filter(w => 
        w !== data.hitza && 
        !data.sinonimoak.includes(w)
      );

      const sameTypeDistractors = distractorsPool.filter(w => getWordType(w) === targetType);
      
      // If we don't have enough same-type distractors, use the general pool
      const finalDistractorsSource = sameTypeDistractors.length >= 10 ? sameTypeDistractors : distractorsPool;
      
      const shuffledDistractors = shuffleArray(Array.from(new Set(finalDistractorsSource))).slice(0, 3);
      const options = shuffleArray([correctAnswer, ...shuffledDistractors]);

      return { wordData: data, correctAnswer, options };
    });
  };

  const startNewGame = useCallback(() => {
    const totalNeeded = numPlayers * QUESTIONS_PER_PLAYER;
    const newPool = generatePool(totalNeeded, difficulty);
    setQuestionPool(newPool);
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setPlayers(prev => prev.map(p => ({ ...p, score: 0, time: 0 })));
    setStatus(GameStatus.INTERMISSION);
  }, [numPlayers, difficulty]);

  const startPlayerTurn = () => {
    turnStartTimeRef.current = Date.now();
    setCurrentTurnPenalties(0);
    setStatus(GameStatus.PLAYING);
    setCurrentQuestionIndex(0);
    setIsAnswered(false);
    setSelectedAnswer(null);
    setFeedback(null);
  };

  const handlePlayerNameChange = (id: number, name: string) => {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  };

  const handleAnswer = (answer: string) => {
    if (isAnswered) return;
    const poolIdx = (currentPlayerIndex * QUESTIONS_PER_PLAYER + currentQuestionIndex);
    const currentQuestion = questionPool[poolIdx];
    const isCorrect = answer === currentQuestion.correctAnswer;
    setSelectedAnswer(answer);
    setIsAnswered(true);
    if (isCorrect) {
      setPlayers(prev => prev.map((p, idx) => idx === currentPlayerIndex ? { ...p, score: p.score + 1 } : p));
      setFeedback({ isCorrect: true, message: "Oso ondo! Zuzena da.", penaltyApplied: false });
    } else {
      setCurrentTurnPenalties(prev => prev + 10);
      setFeedback({ isCorrect: false, message: `Okerra. Zuzena: ${currentQuestion.correctAnswer}`, penaltyApplied: true });
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < QUESTIONS_PER_PLAYER - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
      setFeedback(null);
    } else {
      finishPlayerTurn();
    }
  };

  const finishPlayerTurn = () => {
    const endTime = Date.now();
    const realSeconds = (endTime - turnStartTimeRef.current) / 1000;
    const totalSecondsWithPenalty = realSeconds + currentTurnPenalties;
    setPlayers(prev => prev.map((p, idx) => idx === currentPlayerIndex ? { ...p, time: totalSecondsWithPenalty } : p));
    if (currentPlayerIndex < players.length - 1) {
      setCurrentPlayerIndex(prev => prev + 1);
      setStatus(GameStatus.INTERMISSION);
    } else {
      setStatus(GameStatus.SUMMARY);
    }
  };

  const forceFinishGame = () => {
    if (status === GameStatus.PLAYING) {
      const endTime = Date.now();
      const realSeconds = (endTime - turnStartTimeRef.current) / 1000;
      const totalSecondsWithPenalty = realSeconds + currentTurnPenalties;
      setPlayers(prev => prev.map((p, idx) => idx === currentPlayerIndex ? { ...p, time: totalSecondsWithPenalty } : p));
    }
    setStatus(GameStatus.SUMMARY);
  };

  if (status === GameStatus.SETUP) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-2 bg-gradient-to-br from-indigo-800 via-indigo-950 to-black overflow-hidden">
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-2xl w-full max-w-xl flex flex-col max-h-full border-2 border-white/20">
          <div className="text-center mb-3 shrink-0">
            <h1 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tighter">Sinonimoen Erronka</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Hiztegiaren erronka handiena</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
               <label className="block text-[10px] font-black text-indigo-900 uppercase mb-2">Jokalariak: <span className="text-indigo-600 text-base">{numPlayers}</span></label>
               <input type="range" min="1" max="10" value={numPlayers} onChange={(e) => setNumPlayers(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
               <label className="block text-[10px] font-black text-indigo-900 uppercase mb-2">Jokoaren Maila</label>
               <div className="flex bg-white rounded-lg p-1 border border-slate-200 text-[10px] font-black h-8">
                 {([1, 2, 3, 4] as DifficultyLevel[]).map(d => (
                   <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 rounded-md transition-all ${difficulty === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>
                     {d}
                   </button>
                 ))}
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 overflow-y-auto pr-1 shrink min-h-0 custom-scrollbar">
            {players.map((p) => (
              <div key={p.id} className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col">
                <label className="text-[8px] font-black text-slate-400 uppercase">Jokalaria {p.id + 1}</label>
                <input type="text" value={p.name} onChange={(e) => handlePlayerNameChange(p.id, e.target.value)} className="p-0 bg-transparent border-none focus:ring-0 font-bold text-slate-800 text-xs" />
              </div>
            ))}
          </div>
          
          <button onClick={startNewGame} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg active:scale-95 text-base uppercase tracking-widest shrink-0">
            HASI JOKOA
          </button>
        </div>
      </div>
    );
  }

  if (status === GameStatus.INTERMISSION) {
    const player = players[currentPlayerIndex];
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4 bg-slate-950 overflow-hidden">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full border-b-[8px] border-indigo-600">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
            {currentPlayerIndex + 1}
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">{player.name}</h2>
          <p className="text-[10px] text-indigo-400 font-black mb-6 uppercase tracking-widest">{difficulty}. Maila</p>
          <div className="space-y-2 mb-8">
            <p className="text-slate-500 text-sm font-medium italic">Prest? 10 galdera datoz...</p>
          </div>
          <button onClick={startPlayerTurn} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-xl active:scale-95 text-lg">
            HASI NIRE TXANDA
          </button>
        </div>
      </div>
    );
  }

  if (status === GameStatus.PLAYING) {
    const poolIdx = (currentPlayerIndex * QUESTIONS_PER_PLAYER + currentQuestionIndex);
    const currentQuestion = questionPool[poolIdx];
    const currentPlayer = players[currentPlayerIndex];

    return (
      <div className="h-screen flex flex-col items-center p-2 md:p-4 bg-slate-50 overflow-hidden">
        <div className="w-full max-w-4xl flex justify-between items-center mb-3 gap-2 shrink-0">
          <div className="flex items-center space-x-2">
             <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-md">
               {currentPlayer.name}
             </div>
             <div className="bg-white px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1">
               <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">Zigorra:</span>
               <p className="text-[8px] text-rose-600 font-black">+{currentTurnPenalties}s</p>
             </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="bg-white px-4 py-1.5 rounded-xl border border-slate-200 flex items-center gap-3">
               <div className="text-center">
                  <p className="text-[7px] text-slate-400 font-black uppercase leading-none">Galdera</p>
                  <p className="text-indigo-600 font-black text-xs">{currentQuestionIndex + 1}/10</p>
               </div>
               <div className="w-px h-5 bg-slate-100"></div>
               <div className="text-center">
                  <p className="text-[7px] text-slate-400 font-black uppercase leading-none">Maila</p>
                  <p className="text-slate-800 font-black text-[10px]">{difficulty}</p>
               </div>
            </div>
            <button onClick={forceFinishGame} className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-black px-2 py-1.5 rounded-xl transition-all text-[8px] uppercase">
              Amaitu
            </button>
          </div>
        </div>

        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-xl p-5 md:p-10 mb-2 border border-slate-100 relative overflow-hidden flex flex-col grow min-h-0">
          <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
            <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${((currentQuestionIndex + (isAnswered ? 1 : 0)) / QUESTIONS_PER_PLAYER) * 100}%` }} />
          </div>

          <div className="text-center mb-6 shrink-0 mt-4">
            <h3 className="text-4xl md:text-5xl font-black text-slate-900 break-words leading-none">
              {currentQuestion.wordData.hitza}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 grow overflow-y-auto pr-1 custom-scrollbar">
            {currentQuestion.options.map((opt, i) => {
              let buttonStyle = "p-4 rounded-2xl border-2 font-bold text-lg transition-all duration-200 flex items-center justify-center text-center min-h-[4rem] ";
              if (!isAnswered) buttonStyle += "bg-white border-slate-50 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 cursor-pointer shadow-sm active:translate-y-0.5";
              else {
                if (opt === currentQuestion.correctAnswer) buttonStyle += "bg-emerald-500 border-emerald-300 text-white shadow-lg scale-102 z-10";
                else if (opt === selectedAnswer) buttonStyle += "bg-rose-500 border-rose-300 text-white shadow-sm opacity-90";
                else buttonStyle += "bg-slate-50 border-slate-50 text-slate-300 grayscale-[0.8]";
              }
              return (
                <button key={i} disabled={isAnswered} onClick={() => handleAnswer(opt)} className={buttonStyle}>
                  {opt}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className="mt-6 flex flex-col items-center shrink-0">
               <div className={`mb-3 text-center font-black text-lg flex items-center gap-2 ${feedback?.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {feedback?.message}
                 {feedback?.penaltyApplied && <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded italic">+10s</span>}
               </div>
               <button onClick={nextQuestion} className="bg-indigo-950 hover:bg-black text-white font-black py-4 px-10 rounded-2xl shadow-lg transition-all active:scale-95 text-lg flex items-center gap-2">
                 {currentQuestionIndex < 9 ? "Hurrengoa" : "Txanda bukatu"}
               </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === GameStatus.SUMMARY) {
    const sortedPlayers = [...players]
      .filter(p => p.time > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time;
      });

    return (
      <div className="h-screen flex flex-col items-center justify-center p-2 bg-indigo-950 overflow-hidden">
        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 md:p-10 border border-white/10 text-center flex flex-col max-h-full">
          <div className="mb-4 shrink-0">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Emaitzak</h2>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{difficulty}. Maila</p>
            <div className="h-1.5 w-16 bg-indigo-600 mx-auto rounded-full mt-1"></div>
          </div>

          {sortedPlayers.length === 0 ? (
            <div className="py-10 text-slate-400 font-bold italic">Ez da emaitzarik gordetu.</div>
          ) : (
            <div className="mb-6 overflow-y-auto rounded-2xl border border-slate-100 shadow-inner bg-slate-50 grow min-h-0 custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase">Pos.</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase">Izena</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase text-center">Pts</th>
                    <th className="px-4 py-2 text-[9px] font-black text-slate-500 uppercase text-right">Denb.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sortedPlayers.map((p, idx) => (
                    <tr key={p.id} className={idx === 0 ? "bg-amber-50" : ""}>
                      <td className="px-4 py-3 font-black text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 text-sm">{p.name}</td>
                      <td className="px-4 py-3 text-center"><span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-black text-xs">{p.score}</span></td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-500 text-xs">{p.time.toFixed(2)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button onClick={startNewGame} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-widest">
              BERRIRO
            </button>
            <button onClick={() => setStatus(GameStatus.SETUP)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-xl transition-all active:scale-95 text-sm uppercase tracking-widest">
              HASIERARA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Analytics />
    </>
  );
};

export default App;
