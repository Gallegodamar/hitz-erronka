
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LEVEL_DATA } from './data';
import { WordData, Player, Question, GameStatus, DifficultyLevel } from './types';

const QUESTIONS_PER_PLAYER = 10;
const DICT_PAGE_SIZE = 20;

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

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
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  const [currentTurnPenalties, setCurrentTurnPenalties] = useState(0);
  const turnStartTimeRef = useRef<number>(0);

  // Dictionary pagination/filtering
  const [dictLevel, setDictLevel] = useState<DifficultyLevel>(1);
  const [dictPage, setDictPage] = useState(0);

  // Sync players array when numPlayers changes in SETUP
  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setPlayers(Array.from({ length: numPlayers }, (_, i) => ({ 
        id: i, 
        name: `Jokalaria ${i + 1}`, 
        score: 0, 
        time: 0 
      })));
    }
  }, [numPlayers, status]);

  const generatePool = (needed: number, level: DifficultyLevel) => {
    const poolSource = LEVEL_DATA[level];
    let gameData = [...poolSource];
    while (gameData.length < needed) {
      gameData = [...gameData, ...poolSource];
    }
    gameData = shuffleArray(gameData).slice(0, needed);
    const allWordsInPool = poolSource.flatMap(d => [d.hitza, ...d.sinonimoak]);

    return gameData.map((data) => {
      const correctAnswer = data.sinonimoak[Math.floor(Math.random() * data.sinonimoak.length)];
      const targetType = getWordType(data.hitza);
      let distractorsPool = allWordsInPool.filter(w => w !== data.hitza && !data.sinonimoak.includes(w));
      const sameTypeDistractors = distractorsPool.filter(w => getWordType(w) === targetType);
      const finalDistractorsSource = sameTypeDistractors.length >= 10 ? sameTypeDistractors : distractorsPool;
      const shuffledDistractors = shuffleArray(Array.from(new Set(finalDistractorsSource))).slice(0, 3);
      const options = shuffleArray([correctAnswer, ...shuffledDistractors]);
      return { wordData: data, correctAnswer, options };
    });
  };

  const startNewGame = useCallback(() => {
    const totalNeeded = players.length * QUESTIONS_PER_PLAYER;
    const newPool = generatePool(totalNeeded, difficulty);
    setQuestionPool(newPool);
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setStatus(GameStatus.INTERMISSION);
  }, [players.length, difficulty]);

  const startPlayerTurn = () => {
    turnStartTimeRef.current = Date.now();
    setCurrentTurnPenalties(0);
    setStatus(GameStatus.PLAYING);
    setCurrentQuestionIndex(0);
    setIsAnswered(false);
    setSelectedAnswer(null);
  };

  const handlePlayerNameChange = (id: number, name: string) => {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  };

  const handleAnswer = (answer: string) => {
    if (isAnswered) return;
    const poolIdx = (currentPlayerIndex * QUESTIONS_PER_PLAYER + currentQuestionIndex);
    const currentQuestion = poolIdx >= 0 && poolIdx < questionPool.length ? questionPool[poolIdx] : null;
    if (!currentQuestion) return;
    const isCorrect = answer === currentQuestion.correctAnswer;
    setSelectedAnswer(answer);
    setIsAnswered(true);
    if (isCorrect) {
      setPlayers(prev => prev.map((p, idx) => idx === currentPlayerIndex ? { ...p, score: p.score + 1 } : p));
    } else {
      setCurrentTurnPenalties(prev => prev + 10);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < QUESTIONS_PER_PLAYER - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
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
    setStatus(GameStatus.SUMMARY);
  };

  // Grouped dictionary by 20 words per page
  const dictGroups = useMemo(() => {
    const source = LEVEL_DATA[dictLevel];
    const groups = [];
    for (let i = 0; i < source.length; i += DICT_PAGE_SIZE) {
      groups.push(source.slice(i, i + DICT_PAGE_SIZE));
    }
    return groups;
  }, [dictLevel]);

  const playedWordData = useMemo(() => {
    return Array.from(new Map<string, WordData>(questionPool.map(q => [q.wordData.hitza, q.wordData])).values())
      .sort((a, b) => a.hitza.localeCompare(b.hitza));
  }, [questionPool]);

  if (status === GameStatus.DICTIONARY) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-2 bg-slate-900 overflow-hidden">
        <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col max-h-[95vh] border-2 border-white/20">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <button onClick={() => setStatus(GameStatus.SETUP)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase transition-all">
              ← Atzera
            </button>
            <div className="text-center">
              <h2 className="text-xl md:text-2xl font-black text-indigo-950 uppercase leading-none">Hiztegia</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">20ko taldeak</p>
            </div>
            <div className="w-16"></div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6 shrink-0 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            {([1, 2, 3, 4] as DifficultyLevel[]).map(d => (
              <button key={d} onClick={() => { setDictLevel(d); setDictPage(0); }} className={`py-2 rounded-xl font-black text-sm transition-all ${dictLevel === d ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {d}. Maila
              </button>
            ))}
          </div>

          <div className="grow overflow-y-auto pr-2 custom-scrollbar mb-6 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dictGroups[dictPage]?.map((word, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg uppercase">
                      #{dictPage * DICT_PAGE_SIZE + idx + 1}
                    </span>
                    <a href={`https://hiztegiak.elhuyar.eus/eu/${word.hitza}`} target="_blank" rel="noopener noreferrer" className="text-lg font-black text-slate-800 uppercase tracking-tight hover:underline decoration-indigo-300 underline-offset-2">
                      {word.hitza}
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {word.sinonimoak.map((s, si) => (
                      <a key={si} href={`https://hiztegiak.elhuyar.eus/eu/${s}`} target="_blank" rel="noopener noreferrer" className="bg-white text-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-50 font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                        {s}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 shrink-0">
            <button disabled={dictPage === 0} onClick={() => setDictPage(p => p - 1)} className="p-2 disabled:opacity-30 disabled:cursor-not-allowed bg-white rounded-xl shadow-sm">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Taldea</p>
              <p className="text-indigo-600 font-black text-sm">{dictPage + 1} / {Math.max(1, dictGroups.length)}</p>
            </div>
            <button disabled={dictPage >= dictGroups.length - 1} onClick={() => setDictPage(p => p + 1)} className="p-2 disabled:opacity-30 disabled:cursor-not-allowed bg-white rounded-xl shadow-sm">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === GameStatus.SETUP) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-2 bg-gradient-to-br from-indigo-800 via-indigo-950 to-black overflow-hidden">
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] border-2 border-white/20">
          <div className="text-center mb-6 shrink-0">
            <h1 className="text-3xl md:text-4xl font-black text-indigo-950 tracking-tighter uppercase leading-none">Sinonimoen Erronka</h1>
            <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Konfiguratu jokoa</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 shrink-0">
            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
               <label className="block text-xs font-black text-indigo-900 uppercase mb-3">Jokalariak: <span className="text-indigo-600 text-lg">{numPlayers}</span></label>
               <input type="range" min="1" max="10" value={numPlayers} onChange={(e) => setNumPlayers(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>
            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
               <label className="block text-xs font-black text-indigo-900 uppercase mb-3">Zailtasun Maila</label>
               <div className="grid grid-cols-4 gap-2 bg-white rounded-2xl p-1.5 border border-slate-200 font-black h-12">
                 {([1, 2, 3, 4] as DifficultyLevel[]).map(d => (
                   <button key={d} onClick={() => setDifficulty(d)} className={`rounded-xl transition-all text-sm ${difficulty === d ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                     {d}
                   </button>
                 ))}
               </div>
            </div>
          </div>
          <div className="grow overflow-y-auto pr-2 custom-scrollbar mb-6 min-h-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {players.map((p) => (
                <div key={p.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1">Jokalaria {p.id + 1}</label>
                  <input type="text" value={p.name} onChange={(e) => handlePlayerNameChange(p.id, e.target.value)} className="p-0 bg-transparent border-none focus:ring-0 font-bold text-slate-800 text-sm placeholder-slate-300" placeholder="Izena idatzi..." />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <button onClick={startNewGame} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl transition-all shadow-xl active:scale-95 text-xl uppercase tracking-widest">HASI JOKOA</button>
            <button onClick={() => setStatus(GameStatus.DICTIONARY)} className="w-full bg-slate-100 hover:bg-slate-200 text-indigo-600 font-black py-4 rounded-2xl transition-all text-sm uppercase tracking-widest border border-slate-200">IKUSI SINONIMOAK</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === GameStatus.INTERMISSION) {
    const player = players[currentPlayerIndex];
    return (
      <div className="h-screen flex flex-col items-center justify-center p-4 bg-slate-950 overflow-hidden">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center max-w-sm w-full border-b-[10px] border-indigo-600">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center text-4xl font-black mx-auto mb-6 shadow-lg">{currentPlayerIndex + 1}</div>
          <h2 className="text-3xl font-black text-slate-900 mb-1">{player.name}</h2>
          <p className="text-[10px] text-indigo-400 font-black mb-10 uppercase tracking-[0.3em]">{difficulty}. Maila • 10 Galdera</p>
          <button onClick={startPlayerTurn} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-6 rounded-2xl transition-all shadow-xl active:scale-95 text-xl">HASI TXANDA</button>
        </div>
      </div>
    );
  }

  if (status === GameStatus.PLAYING) {
    const poolIdx = (currentPlayerIndex * QUESTIONS_PER_PLAYER + currentQuestionIndex);
    const currentQuestion = poolIdx >= 0 && poolIdx < questionPool.length ? questionPool[poolIdx] : null;
    const currentPlayer = players[currentPlayerIndex];
    if (!currentQuestion) return null;

    return (
      <div className="h-screen flex flex-col items-center p-2 md:p-4 bg-slate-50 overflow-hidden">
        <div className="w-full max-w-4xl flex justify-between items-center mb-2 gap-2 shrink-0">
          <div className="flex items-center space-x-2">
             <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-lg uppercase tracking-tight">{currentPlayer.name}</div>
             <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2 shadow-sm">
               <span className="text-[8px] font-black text-rose-500 uppercase tracking-tighter leading-none">Zigorra:</span>
               <p className="text-xs text-rose-600 font-black">+{currentTurnPenalties}s</p>
             </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 flex items-center">
               <div className="text-center">
                  <p className="text-indigo-600 font-black text-xs">{currentQuestionIndex + 1}/10</p>
               </div>
            </div>
            <button onClick={forceFinishGame} className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-black px-3 py-1.5 rounded-xl transition-all text-[10px] uppercase">Amaitu</button>
          </div>
        </div>
        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-xl p-6 md:p-10 mb-2 border border-slate-100 relative overflow-hidden flex flex-col grow min-h-0">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
            <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${((currentQuestionIndex + (isAnswered ? 1 : 0)) / QUESTIONS_PER_PLAYER) * 100}%` }} />
          </div>
          <div className="text-center mb-6 shrink-0 mt-2">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Sinonimoa aukeratu</p>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 break-words leading-none uppercase tracking-tighter">{currentQuestion.wordData.hitza}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 grow min-h-0 overflow-hidden">
            {currentQuestion.options.map((opt, i) => {
              let buttonStyle = "p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 font-black text-lg md:text-2xl transition-all duration-200 flex items-center justify-center text-center h-full ";
              if (!isAnswered) buttonStyle += "bg-white border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 cursor-pointer shadow-sm active:translate-y-1";
              else {
                if (opt === currentQuestion.correctAnswer) buttonStyle += "bg-emerald-500 border-emerald-300 text-white shadow-lg scale-102 z-10";
                else if (opt === selectedAnswer) buttonStyle += "bg-rose-500 border-rose-300 text-white shadow-sm opacity-90";
                else buttonStyle += "bg-slate-50 border-slate-50 text-slate-300 grayscale";
              }
              return (
                <button key={i} disabled={isAnswered} onClick={() => handleAnswer(opt)} className={buttonStyle}>{opt}</button>
              );
            })}
          </div>
          <div className="mt-6 shrink-0 min-h-[4.5rem] flex items-center justify-center">
            {isAnswered ? (
               <button onClick={nextQuestion} className="bg-indigo-950 hover:bg-black text-white font-black py-4 px-12 rounded-2xl shadow-xl transition-all active:scale-95 text-lg uppercase tracking-widest">
                 {currentQuestionIndex < 9 ? "Hurrengoa" : "Txanda bukatu"}
               </button>
            ) : (
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                 <span className="w-2 h-2 bg-slate-200 rounded-full animate-pulse"></span>
                 Erantzunaren zain...
               </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === GameStatus.SUMMARY) {
    const sortedPlayers = [...players].filter(p => p.time > 0).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time - b.time;
      });

    return (
      <div className="h-screen flex flex-col items-center justify-center p-2 bg-indigo-950 overflow-hidden">
        <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-6 md:p-12 border border-white/10 text-center flex flex-col max-h-[95vh]">
          <div className="mb-8 shrink-0">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight uppercase leading-none">Sailkapena</h2>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mt-3">{difficulty}. Maila</p>
          </div>
          <div className="grow flex flex-col min-h-0 mb-8 overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-inner bg-slate-50">
            <div className="overflow-y-auto custom-scrollbar h-full">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase">Pos.</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase">Jokalaria</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase text-center">Pts</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase text-right">Denbora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {sortedPlayers.map((p, idx) => (
                    <tr key={p.id} className={idx === 0 ? "bg-amber-50" : "hover:bg-slate-50 transition-colors"}>
                      <td className="px-6 py-5 font-black text-2xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}</td>
                      <td className="px-6 py-5">
                        <span className="text-slate-800 text-sm md:text-base font-bold uppercase tracking-tight">{p.name}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl font-black text-xs shadow-md">{p.score}</span>
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-slate-500 text-xs md:text-sm">{p.time.toFixed(2)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => { setPlayers(players.map(p => ({...p, score: 0, time: 0}))); startNewGame(); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-base uppercase tracking-widest">BERRIRO JOKATU</button>
              <button onClick={() => setStatus(GameStatus.REVIEW)} className="flex-1 bg-white hover:bg-slate-50 text-indigo-600 font-black py-4 rounded-2xl shadow-md transition-all active:scale-95 text-sm uppercase tracking-widest border border-indigo-100">AGERTUTAKO HITZAK</button>
            </div>
            <button onClick={() => setStatus(GameStatus.SETUP)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl transition-all active:scale-95 text-sm uppercase tracking-widest">HASIERA</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === GameStatus.REVIEW) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-2 bg-slate-900 overflow-hidden">
        <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl p-6 md:p-8 flex flex-col max-h-[95vh] border-2 border-white/20">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <button onClick={() => setStatus(GameStatus.SUMMARY)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-black text-xs uppercase transition-all">
              ← Sailkapenera
            </button>
            <div className="text-center">
              <h2 className="text-xl md:text-2xl font-black text-indigo-950 uppercase leading-none">Agertutako Hitzak</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Partidako berrikuspena</p>
            </div>
            <div className="w-24"></div>
          </div>

          <div className="grow overflow-y-auto pr-2 custom-scrollbar min-h-0 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
              {playedWordData.map((data, idx) => (
                <div key={idx} className="bg-slate-50 p-5 rounded-3xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-black bg-white text-indigo-400 px-2 py-0.5 rounded-lg border border-indigo-50">#{idx + 1}</span>
                    <a href={`https://hiztegiak.elhuyar.eus/eu/${data.hitza}`} target="_blank" rel="noopener noreferrer" className="text-indigo-950 font-black text-xl hover:underline decoration-indigo-300 underline-offset-4 uppercase tracking-tighter">
                      {data.hitza}
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {data.sinonimoak.map((sin, sIdx) => (
                      <a key={sIdx} href={`https://hiztegiak.elhuyar.eus/eu/${sin}`} target="_blank" rel="noopener noreferrer" className="bg-white text-indigo-600 px-3 py-1.5 rounded-xl font-bold text-xs hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100">
                        {sin}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0 pt-2 border-t border-slate-100">
            <button onClick={() => setStatus(GameStatus.SUMMARY)} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg uppercase tracking-widest text-sm active:scale-95 transition-all">Sailkapenera Itzuli</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
