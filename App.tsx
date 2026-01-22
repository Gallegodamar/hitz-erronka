
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SYNONYMS_DATA } from './data';
import { WordData, Player, Question, GameStatus } from './types';

const QUESTIONS_PER_PLAYER = 10;

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const ALL_POSSIBLE_WORDS = Array.from(
  new Set([
    ...SYNONYMS_DATA.map(d => d.hitza),
    ...SYNONYMS_DATA.flatMap(d => d.sinonimoak)
  ])
);

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.SETUP);
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
  
  // Accumulated penalties for current player
  const [currentTurnPenalties, setCurrentTurnPenalties] = useState(0);
  const turnStartTimeRef = useRef<number>(0);

  // Update players list when numPlayers changes in Setup
  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setPlayers(Array.from({ length: numPlayers }, (_, i) => ({ id: i, name: `Jokalaria ${i + 1}`, score: 0, time: 0 })));
    }
  }, [numPlayers, status]);

  const generatePool = (needed: number) => {
    let baseData = [...SYNONYMS_DATA];
    // If we need more questions than we have, duplicate the pool
    while (baseData.length < needed) {
      baseData = [...baseData, ...SYNONYMS_DATA];
    }
    
    const shuffledData = shuffleArray(baseData);
    return shuffledData.slice(0, needed).map((data) => {
      const correctAnswer = data.sinonimoak[Math.floor(Math.random() * data.sinonimoak.length)];
      const distractorsPool = ALL_POSSIBLE_WORDS.filter(
        w => w !== data.hitza && !data.sinonimoak.includes(w)
      );
      const shuffledDistractors = shuffleArray(distractorsPool).slice(0, 3);
      const options = shuffleArray([correctAnswer, ...shuffledDistractors]);
      return { wordData: data, correctAnswer, options };
    });
  };

  const startNewGame = useCallback(() => {
    const totalNeeded = numPlayers * QUESTIONS_PER_PLAYER;
    const newPool = generatePool(totalNeeded);
    setQuestionPool(newPool);
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setPlayers(prev => prev.map(p => ({ ...p, score: 0, time: 0 })));
    setStatus(GameStatus.INTERMISSION);
  }, [numPlayers]);

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
      setFeedback({ 
        isCorrect: false, 
        message: `Okerra. Erantzun zuzena: ${currentQuestion.correctAnswer}`,
        penaltyApplied: true 
      });
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
    // If middle of a turn, record time so far
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-600 via-blue-700 to-indigo-900">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-2xl border-4 border-white/20">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black text-indigo-950 mb-4 tracking-tight">Sinonimoen Erronka</h1>
            <p className="text-slate-500 font-medium">Hiztegia lantzeko joko sekuentziala</p>
          </div>
          
          <div className="mb-10 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <label className="block text-sm font-black text-indigo-900 uppercase tracking-widest mb-4">Jokalari kopurua: <span className="text-indigo-600 text-xl ml-2">{numPlayers}</span></label>
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={numPlayers} 
              onChange={(e) => setNumPlayers(parseInt(e.target.value))}
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 max-h-[35vh] overflow-y-auto pr-2 custom-scrollbar">
            {players.map((p) => (
              <div key={p.id} className="flex flex-col bg-white p-4 rounded-2xl border-2 border-slate-50 shadow-sm focus-within:border-indigo-300 transition-all">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1">Jokalaria {p.id + 1}</label>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => handlePlayerNameChange(p.id, e.target.value)}
                  className="p-1 bg-transparent border-none focus:ring-0 font-bold text-slate-800"
                  placeholder="Izena idatzi..."
                />
              </div>
            ))}
          </div>
          
          <button
            onClick={startNewGame}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-6 rounded-3xl transition-all shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98] text-xl uppercase tracking-widest"
          >
            Hasiera eman
          </button>
        </div>
      </div>
    );
  }

  if (status === GameStatus.INTERMISSION) {
    const player = players[currentPlayerIndex];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-md w-full border-b-[12px] border-indigo-600">
          <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-4xl font-black mx-auto mb-8 shadow-inner">
            {currentPlayerIndex + 1}
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-3">{player.name}</h2>
          <div className="space-y-4 mb-10">
            <p className="text-slate-500 font-medium">Prest al zaude?</p>
            <div className="bg-rose-50 text-rose-600 text-xs font-black py-2 px-4 rounded-full inline-block">
               ADI: HUTSEGITEN BADUZU +10s ZIGORRA!
            </div>
          </div>
          <button
            onClick={startPlayerTurn}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-6 rounded-2xl transition-all shadow-xl active:scale-95 text-xl"
          >
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
      <div className="min-h-screen flex flex-col items-center p-4 bg-slate-50">
        <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4 mt-6">
          <div className="flex items-center space-x-4">
             <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xl font-black shadow-xl">
               {currentPlayer.name}
             </div>
             <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
               <p className="text-[10px] text-slate-400 font-bold uppercase">Zigorrak</p>
               <p className="text-rose-600 font-black">+{currentTurnPenalties}s</p>
             </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-white px-8 py-3 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
               <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase text-center">Galdera</p>
                  <p className="text-indigo-600 font-black text-2xl">{currentQuestionIndex + 1} / 10</p>
               </div>
               <div className="w-px h-10 bg-slate-100"></div>
               <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase text-center">Txanda</p>
                  <p className="text-slate-800 font-black text-2xl">{currentPlayerIndex + 1} / {players.length}</p>
               </div>
            </div>
            <button 
              onClick={forceFinishGame}
              className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-black p-4 rounded-2xl transition-all text-xs uppercase tracking-tighter"
            >
              Bukatutzat eman
            </button>
          </div>
        </div>

        <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-10 md:p-16 mb-8 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-4 bg-slate-100">
            <div 
              className="h-full bg-indigo-600 transition-all duration-700 ease-out" 
              style={{ width: `${((currentQuestionIndex + (isAnswered ? 1 : 0)) / QUESTIONS_PER_PLAYER) * 100}%` }}
            />
          </div>

          <div className="text-center mb-14">
            <div className="inline-block bg-indigo-50 text-indigo-700 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6">
              Sinonimoa asmatu:
            </div>
            <h3 className="text-6xl md:text-7xl font-black text-slate-900 break-words leading-none">
              {currentQuestion.wordData.hitza}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentQuestion.options.map((opt, i) => {
              let buttonStyle = "p-6 rounded-[2rem] border-4 font-bold text-xl transition-all duration-300 flex items-center justify-center text-center h-28 ";
              
              if (!isAnswered) {
                buttonStyle += "bg-white border-slate-50 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 cursor-pointer shadow-sm hover:-translate-y-1";
              } else {
                if (opt === currentQuestion.correctAnswer) {
                  buttonStyle += "bg-emerald-500 border-emerald-300 text-white shadow-2xl scale-105 z-10";
                } else if (opt === selectedAnswer) {
                  buttonStyle += "bg-rose-500 border-rose-300 text-white shadow-lg opacity-90";
                } else {
                  buttonStyle += "bg-slate-50 border-slate-50 text-slate-300 grayscale-[0.8]";
                }
              }

              return (
                <button
                  key={i}
                  disabled={isAnswered}
                  onClick={() => handleAnswer(opt)}
                  className={buttonStyle}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className="mt-14 flex flex-col items-center animate-in fade-in slide-in-from-bottom-6 duration-500">
               <div className={`mb-8 text-center font-black text-3xl flex items-center gap-4 ${feedback?.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {feedback?.message}
                 {feedback?.penaltyApplied && (
                   <span className="bg-rose-100 text-rose-700 text-sm px-3 py-1 rounded-lg animate-pulse">
                     +10s
                   </span>
                 )}
               </div>
               <button 
                 onClick={nextQuestion}
                 className="bg-indigo-950 hover:bg-black text-white font-black py-6 px-16 rounded-[1.5rem] shadow-2xl transition-all active:scale-95 text-2xl flex items-center gap-4 group"
               >
                 {currentQuestionIndex < 9 ? "Hurrengoa" : "Txanda bukatu"}
                 <svg className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
               </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === GameStatus.SUMMARY) {
    const sortedPlayers = [...players]
      .filter(p => p.time > 0) // Only show those who played
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time;
      });

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-indigo-950">
        <div className="bg-white w-full max-w-5xl rounded-[3.5rem] shadow-2xl p-10 md:p-20 border border-white/10 text-center relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
          
          <div className="mb-14 relative">
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 mb-4 tracking-tighter">Sailkapen Orokorra</h2>
            <div className="h-2.5 w-32 bg-indigo-600 mx-auto rounded-full"></div>
          </div>

          {sortedPlayers.length === 0 ? (
            <div className="py-20 text-slate-400 font-bold text-xl italic">Ez da jokalaririk amaitu.</div>
          ) : (
            <div className="mb-14 overflow-hidden rounded-[2.5rem] border-2 border-slate-50 shadow-xl bg-white">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Postua</th>
                    <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">Jokalaria</th>
                    <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Puntuak</th>
                    <th className="px-10 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Denbora (Totala)</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-50">
                  {sortedPlayers.map((p, idx) => (
                    <tr key={p.id} className={`${idx === 0 ? "bg-amber-50/40" : "hover:bg-slate-50/30"} transition-colors group`}>
                      <td className="px-10 py-7 whitespace-nowrap font-black text-2xl">
                         {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
                      </td>
                      <td className="px-10 py-7 font-black text-slate-800 text-xl group-hover:text-indigo-600 transition-colors">{p.name}</td>
                      <td className="px-10 py-7 text-center">
                        <span className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-xl shadow-lg shadow-indigo-200">
                          {p.score}
                        </span>
                      </td>
                      <td className="px-10 py-7 text-right font-mono font-black text-slate-600 text-xl">
                        {p.time.toFixed(2)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-6 relative">
            <button
              onClick={startNewGame}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 px-10 rounded-[1.5rem] shadow-2xl shadow-indigo-500/30 transition-all active:scale-95 text-2xl uppercase tracking-widest"
            >
              Berriro Jokatu
            </button>
            <button
              onClick={() => setStatus(GameStatus.SETUP)}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-6 px-10 rounded-[1.5rem] transition-all active:scale-95 text-2xl uppercase tracking-widest"
            >
              Hasierara
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
