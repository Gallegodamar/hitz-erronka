
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured, wordsTable } from './supabaseClient';
import { WordData, Player, Question, GameStatus, DifficultyLevel } from './types';
import Podium, { PodiumPlayer } from './Podium';

const QUESTIONS_PER_PLAYER = 10;
const MAX_PLAYERS = 10;
const focusRingClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
const tapTargetClass = 'min-h-[44px]';
const WORD_KEY_CANDIDATES = ['hitza', 'word', 'term', 'name'];
const SYNONYM_KEY_CANDIDATES = ['sinonimoak', 'synonyms', 'sinonimoak_json', 'synonym_list'];
const LEVEL_KEY_CANDIDATES = ['difficulty', 'level', 'maila', 'zailtasuna'];
const ID_KEY_CANDIDATES = ['id', 'word_id', 'uuid'];
const PLAYER_FIRST_NAMES = ['Justina', 'Jordi', 'Javier', 'Arantxa', 'Dana', 'Haizea', 'David', 'Unai', 'Jon', 'Mertxe'];
const PLAYER_LAST_NAMES = [
  'Ohoin',
  'Mazala',
  'Oski',
  'Karan',
  'Alproja',
  'Uraza',
  'Abao',
  'Dema',
  'Fitsik',
  'Bolu',
  'Elai',
  'Enara',
  'Jite',
  'Apukoa',
  'Txera',
  'Lili',
  'Tato',
];
const PLAYER_EMOJIS = [
  '\u{1F600}',
  '\u{1F60E}',
  '\u{1F920}',
  '\u{1F916}',
  '\u{1F98A}',
  '\u{1F43C}',
  '\u{1F419}',
  '\u{26A1}',
  '\u{1F525}',
  '\u{1F680}',
  '\u{1F984}',
  '\u{1F43A}',
  '\u{1F981}',
  '\u{1F47E}',
  '\u{1F31F}',
  '\u{1F308}',
  '\u{1F4A5}',
  '\u{1F389}',
  '\u{1F9E0}',
  '\u{1F47D}',
];
interface SupabaseWordData extends WordData {
  level: DifficultyLevel | null;
}

interface WordSaveFeedback {
  type: 'success' | 'error';
  message: string;
}

interface DbErrorLike {
  code?: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
}

type MatchType = 'hitza' | 'sinonimoa';
type SaveMode = 'insert' | 'update';

interface LevelOneMatch {
  word: SupabaseWordData;
  matchType: MatchType;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const generateSetupPlayers = (): Player[] => {
  const shuffledFirstNames = shuffleArray(PLAYER_FIRST_NAMES);
  const shuffledLastNames = shuffleArray(PLAYER_LAST_NAMES);
  const shuffledEmojis = shuffleArray(PLAYER_EMOJIS);

  return Array.from({ length: MAX_PLAYERS }, (_, i) => ({
    id: i,
    name: `${shuffledEmojis[i]} ${shuffledFirstNames[i]} ${shuffledLastNames[i]}`,
    score: 0,
    time: 0,
  }));
};

const getWordType = (word: string): string => {
  const normalized = word.toLowerCase().trim();
  if (normalized.endsWith('tu') || normalized.endsWith('du') || normalized.endsWith('ten') || normalized.endsWith('tzen')) return 'verb';
  if (normalized.endsWith('ak') || normalized.endsWith('ek')) return 'plural';
  if (normalized.endsWith('era') || normalized.endsWith('ura') || normalized.endsWith('tasun')) return 'abstract';
  return 'other';
};

const getFirstValue = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return value.toString();
  return '';
};

const parseSynonyms = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toStringValue(item)).filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  const rawValue = value.trim();
  if (!rawValue) return [];

  if (rawValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => toStringValue(item)).filter(Boolean);
      }
    } catch {
      // Fall back to separator-based parsing.
    }
  }

  return rawValue.split(/[;,|\n]/).map((item) => item.trim()).filter(Boolean);
};

const parseDifficultyLevel = (value: unknown): DifficultyLevel | null => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 4) {
    return parsed as DifficultyLevel;
  }
  return null;
};

const isRowLevelSecurityError = (error: DbErrorLike | null): boolean => {
  if (!error) return false;
  if (error.code === '42501') return true;

  const joinedMessage = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return joinedMessage.includes('row-level security') || joinedMessage.includes('rls');
};

const normalizeWordRow = (row: Record<string, unknown>, index: number): SupabaseWordData | null => {
  const hitza = toStringValue(getFirstValue(row, WORD_KEY_CANDIDATES));
  if (!hitza) return null;

  const normalizedSynonyms = Array.from(
    new Set(
      parseSynonyms(getFirstValue(row, SYNONYM_KEY_CANDIDATES))
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.toLowerCase() !== hitza.toLowerCase())
    )
  );
  if (normalizedSynonyms.length === 0) return null;

  const rawId = getFirstValue(row, ID_KEY_CANDIDATES);
  const id: string | number = typeof rawId === 'string' || typeof rawId === 'number' ? rawId : `${hitza}-${index}`;
  const level = parseDifficultyLevel(getFirstValue(row, LEVEL_KEY_CANDIDATES));

  return {
    id,
    hitza,
    sinonimoak: normalizedSynonyms,
    level,
  };
};

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.SETUP);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(1);
  const [setupPlayers, setSetupPlayers] = useState<Player[]>(() => generateSetupPlayers());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  const [currentTurnPenalties, setCurrentTurnPenalties] = useState(0);
  const turnStartTimeRef = useRef<number>(0);
  const [supabaseWords, setSupabaseWords] = useState<SupabaseWordData[]>([]);
  const [isWordsLoading, setIsWordsLoading] = useState(true);
  const [wordsError, setWordsError] = useState<string | null>(null);
  const [newWordInput, setNewWordInput] = useState('');
  const [newSynonymsInput, setNewSynonymsInput] = useState('');
  const [isSavingWord, setIsSavingWord] = useState(false);
  const [wordSaveFeedback, setWordSaveFeedback] = useState<WordSaveFeedback | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>('insert');
  const [selectedMatchId, setSelectedMatchId] = useState<string | number | null>(null);

  useEffect(() => {
    if (status === GameStatus.SETUP) {
      setSetupPlayers(generateSetupPlayers());
      setSelectedPlayerIds([]);
    }
  }, [status]);

  const loadWordsFromSupabase = useCallback(async () => {
    setIsWordsLoading(true);
    setWordsError(null);

    if (!isSupabaseConfigured || !supabase) {
      setSupabaseWords([]);
      setWordsError('Supabase ez dago konfiguratuta. Gehitu VITE_SUPABASE_URL eta VITE_SUPABASE_ANON_KEY.');
      setIsWordsLoading(false);
      return;
    }

    const { data, error } = await supabase.from(wordsTable).select('*');
    if (error) {
      setSupabaseWords([]);
      setWordsError(`Supabase errorea: ${error.message}`);
      setIsWordsLoading(false);
      return;
    }

    const normalizedWords = (data ?? [])
      .map((row, index) => normalizeWordRow(row as Record<string, unknown>, index))
      .filter((row): row is SupabaseWordData => row !== null);

    if (normalizedWords.length === 0) {
      setSupabaseWords([]);
      setWordsError(
        `Taulak ez du hitz baliorik: "${wordsTable}". Itxaroten diren eremuak: hitza/word, sinonimoak/synonyms eta (aukeran) level.`
      );
      setIsWordsLoading(false);
      return;
    }

    setSupabaseWords(normalizedWords);
    setIsWordsLoading(false);
  }, []);

  useEffect(() => {
    void loadWordsFromSupabase();
  }, [loadWordsFromSupabase]);

  const hasLeveledWords = useMemo(() => supabaseWords.some((word) => word.level !== null), [supabaseWords]);

  const availableWordsForDifficulty = useMemo(() => {
    const difficultyWords = supabaseWords.filter((word) => word.level === difficulty).map(({ level, ...wordData }) => wordData);
    if (difficultyWords.length > 0) return difficultyWords;

    if (!hasLeveledWords) {
      return supabaseWords.map(({ level, ...wordData }) => wordData);
    }

    return [];
  }, [difficulty, hasLeveledWords, supabaseWords]);

  const selectedPlayersForGame = useMemo(
    () =>
      selectedPlayerIds
        .map((id) => setupPlayers.find((player) => player.id === id))
        .filter((player): player is Player => Boolean(player))
        .map((player) => ({ ...player, score: 0, time: 0 })),
    [selectedPlayerIds, setupPlayers]
  );

  const canStartGame =
    selectedPlayersForGame.length > 0 && !isWordsLoading && !wordsError && availableWordsForDifficulty.length > 0;

  const togglePlayerSelection = useCallback((id: number) => {
    setSelectedPlayerIds((prev) => (prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]));
  }, []);

  const normalizedNewWord = newWordInput.trim().toLowerCase();

  const levelOneMatches = useMemo(() => {
    if (!normalizedNewWord) return [];

    const matches: LevelOneMatch[] = [];
    for (const word of supabaseWords) {
      if (word.level !== 1) continue;

      const isMainMatch = word.hitza.toLowerCase() === normalizedNewWord;
      const isSynonymMatch = word.sinonimoak.some((sinonimoa) => sinonimoa.toLowerCase() === normalizedNewWord);
      if (!isMainMatch && !isSynonymMatch) continue;

      matches.push({
        word,
        matchType: isMainMatch ? 'hitza' : 'sinonimoa',
      });
    }

    return matches;
  }, [normalizedNewWord, supabaseWords]);

  useEffect(() => {
    if (levelOneMatches.length === 0) {
      setSelectedMatchId(null);
      setSaveMode('insert');
      return;
    }

    const selectedStillExists = selectedMatchId !== null && levelOneMatches.some((match) => match.word.id === selectedMatchId);
    if (!selectedStillExists) {
      setSelectedMatchId(levelOneMatches[0].word.id);
      setSaveMode('update');
    }
  }, [levelOneMatches, selectedMatchId]);

  const selectedMatch = useMemo(() => {
    if (levelOneMatches.length === 0) return null;
    return levelOneMatches.find((match) => match.word.id === selectedMatchId) ?? levelOneMatches[0];
  }, [levelOneMatches, selectedMatchId]);

  const handleSaveLevelOneWord = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setWordSaveFeedback(null);

      const hitza = newWordInput.trim();
      const normalizedSynonyms = Array.from(
        new Set(
          parseSynonyms(newSynonymsInput)
            .map((item) => item.trim())
            .filter((item) => item.length > 0 && item.toLowerCase() !== hitza.toLowerCase())
        )
      );

      if (!hitza) {
        setWordSaveFeedback({ type: 'error', message: 'Hitza derrigorrezkoa da.' });
        return;
      }

      if (normalizedSynonyms.length === 0) {
        setWordSaveFeedback({ type: 'error', message: 'Gutxienez sinonimo bat gehitu behar duzu.' });
        return;
      }

      if (!supabase || !isSupabaseConfigured) {
        setWordSaveFeedback({
          type: 'error',
          message: 'Supabase ez dago konfiguratuta. Ezin da hitz berria gorde.',
        });
        return;
      }

      if (saveMode === 'update' && !selectedMatch) {
        setWordSaveFeedback({
          type: 'error',
          message: 'Eguneratzeko sarrera bat aukeratu behar duzu beheko zerrendan.',
        });
        return;
      }

      const searchText = `${hitza} ${normalizedSynonyms.join(' ')}`.toLowerCase();
      setIsSavingWord(true);
      let lastInsertError: DbErrorLike | null = null;
      let wasSaved = false;
      let successMessage = 'Hitz berria Maila 1ean gorde da.';

      if (saveMode === 'update' && selectedMatch) {
        const existingWord = selectedMatch.word;
        const mergedSynonyms = Array.from(
          new Set(
            [...existingWord.sinonimoak, hitza, ...normalizedSynonyms]
              .map((item) => item.trim())
              .filter((item) => item.length > 0 && item.toLowerCase() !== existingWord.hitza.toLowerCase())
          )
        );

        if (mergedSynonyms.length === 0) {
          setWordSaveFeedback({ type: 'error', message: 'Eguneratzeko sinonimo baliorik ez dago.' });
          setIsSavingWord(false);
          return;
        }

        const updatePayloadVariants: Record<string, unknown>[] = [
          {
            sinonimoak: mergedSynonyms,
            level: 1,
            search_text: `${existingWord.hitza} ${mergedSynonyms.join(' ')}`.toLowerCase(),
          },
          {
            sinonimoak: mergedSynonyms,
          },
        ];

        for (const payload of updatePayloadVariants) {
          const { error } = await supabase.from(wordsTable).update(payload).eq('id', existingWord.id);
          if (!error) {
            wasSaved = true;
            successMessage = 'Lehendik zegoen sarrera eguneratu da.';
            break;
          }
          lastInsertError = error;
        }
      } else {
        const basePayload: Record<string, unknown> = {
          hitza,
          sinonimoak: normalizedSynonyms,
          level: 1,
          active: true,
          part: 1,
          search_text: searchText,
        };
        const payloadVariants: Record<string, unknown>[] = [
          {
            ...basePayload,
            source_id: `manual-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          },
          {
            ...basePayload,
            source_id: Date.now(),
          },
        ];

        for (const payload of payloadVariants) {
          const { error } = await supabase.from(wordsTable).insert(payload);
          if (!error) {
            wasSaved = true;
            break;
          }
          lastInsertError = error;
        }
      }

      if (wasSaved) {
        setWordSaveFeedback({ type: 'success', message: successMessage });
        setNewWordInput('');
        setNewSynonymsInput('');
        setSaveMode('insert');
        setSelectedMatchId(null);
        await loadWordsFromSupabase();
      } else {
        if (isRowLevelSecurityError(lastInsertError)) {
          setWordSaveFeedback({
            type: 'error',
            message: `RLS blokeoa: ${wordsTable} taulan INSERT policy bat sortu behar duzu Maila 1eko hitzak gordetzeko.`,
          });
        } else if (lastInsertError?.code === '23505') {
          setWordSaveFeedback({
            type: 'error',
            message: `Datu bikoiztua: ${wordsTable} taulako gako bakarrarekin gatazka dago. Saiatu beste hitz batekin edo berrikusi unique constraint-ak.`,
          });
        } else {
          setWordSaveFeedback({ type: 'error', message: `Errorea: ${lastInsertError?.message ?? 'Ezin izan da hitza gorde.'}` });
        }
      }

      setIsSavingWord(false);
    },
    [loadWordsFromSupabase, newSynonymsInput, newWordInput, saveMode, selectedMatch]
  );

  const generatePool = (needed: number, poolSource: WordData[]) => {
    if (poolSource.length === 0) return [];

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
    if (!canStartGame) return;
    if (selectedPlayersForGame.length === 0) return;

    const totalNeeded = selectedPlayersForGame.length * QUESTIONS_PER_PLAYER;
    const newPool = generatePool(totalNeeded, availableWordsForDifficulty);
    if (newPool.length === 0) {
      return;
    }

    setPlayers(selectedPlayersForGame);
    setQuestionPool(newPool);
    setCurrentPlayerIndex(0);
    setCurrentQuestionIndex(0);
    setStatus(GameStatus.INTERMISSION);
  }, [canStartGame, availableWordsForDifficulty, selectedPlayersForGame]);

  const startPlayerTurn = () => {
    turnStartTimeRef.current = Date.now();
    setCurrentTurnPenalties(0);
    setStatus(GameStatus.PLAYING);
    setCurrentQuestionIndex(0);
    setIsAnswered(false);
    setSelectedAnswer(null);
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

  const playedWordData = useMemo(() => {
    return Array.from(new Map<string, WordData>(questionPool.map(q => [q.wordData.hitza, q.wordData])).values())
      .sort((a, b) => a.hitza.localeCompare(b.hitza));
  }, [questionPool]);

  if (status === GameStatus.SETUP) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-950 to-black overflow-hidden safe-pt safe-pb safe-px">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl flex flex-col h-full max-h-[90dvh] md:max-h-[85vh] border-2 border-white/20 p-6 mx-4">
          <div className="text-center mb-4 shrink-0 relative">
            <h1 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tighter uppercase leading-none">Sinonimoen Erronka</h1>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Konfiguratu jokoa</p>
            <button
              aria-label="Ezarpenak"
              onClick={() => {
                setWordSaveFeedback(null);
                setSaveMode('insert');
                setSelectedMatchId(null);
                setStatus(GameStatus.WORDS_MANAGER);
              }}
              className={`absolute top-0 right-0 h-11 w-11 rounded-xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700 active:scale-95 ${focusRingClass}`}
            >
              <span className="text-2xl font-black leading-none" aria-hidden="true">+</span>
            </button>
          </div>
          
          <div className="flex flex-col gap-4 mb-4 shrink-0">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <label className="flex justify-between text-xs font-black text-indigo-900 uppercase mb-2">
                 Jokalariak: <span className="text-indigo-600 text-base">{selectedPlayerIds.length}</span>
               </label>
             </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <label className="block text-xs font-black text-indigo-900 uppercase mb-2">Zailtasun Maila</label>
               <div className="grid grid-cols-4 gap-2 h-10">
                 {([1, 2, 3, 4] as DifficultyLevel[]).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`rounded-xl transition-all text-sm font-black ${tapTargetClass} ${focusRingClass} ${difficulty === d ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100'}`}>
                      {d}
                    </button>
                 ))}
                </div>
             </div>
           </div>

            <div className="grow overflow-y-auto pr-1 custom-scrollbar mb-4 min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
               {setupPlayers.map((p) => {
                 const isSelected = selectedPlayerIds.includes(p.id);
                 const selectedOrder = selectedPlayerIds.indexOf(p.id) + 1;
                 return (
                   <button
                     type="button"
                     key={p.id}
                     onClick={() => togglePlayerSelection(p.id)}
                     className={`p-2.5 rounded-xl border flex flex-col transition-all text-left ${focusRingClass} ${isSelected ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-slate-50 border-slate-100'}`}
                   >
                     <div className="flex items-center justify-between gap-2 mb-0.5">
                       <span className={`text-xs font-black uppercase ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`}>
                         {isSelected ? `Txanda ${selectedOrder}` : 'Aukeratu'}
                       </span>
                       <span className={`h-6 min-w-6 px-2 rounded-full text-[10px] font-black flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                         {isSelected ? selectedOrder : '+'}
                       </span>
                     </div>
                     <span className="p-1 font-bold text-slate-800 text-base">{p.name}</span>
                   </button>
                 );
               })}
              </div>
            </div>

           <button
             onClick={startNewGame}
             disabled={!canStartGame}
             className={`w-full text-white font-black py-4 rounded-2xl transition-all shadow-lg text-lg uppercase tracking-widest shrink-0 ${tapTargetClass} ${focusRingClass} ${canStartGame ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'}`}
           >
             {isWordsLoading ? 'KARGATZEN...' : selectedPlayersForGame.length === 0 ? 'AUKERATU JOKALARIAK' : 'HASI JOKOA'}
           </button>
         </div>
       </div>
      );
    }

  if (status === GameStatus.WORDS_MANAGER) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden safe-pt safe-pb safe-px p-4">
        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col h-full max-h-[90dvh]">
          <div className="mb-6 shrink-0 flex items-center justify-between gap-3">
            <h2 className="text-xl md:text-2xl font-black text-indigo-950 uppercase">Sinonimoak Gehitu</h2>
            <button
              onClick={() => setStatus(GameStatus.SETUP)}
              className={`bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-black text-xs uppercase ${tapTargetClass} ${focusRingClass}`}
            >
              Itzuli
            </button>
          </div>

          <p className="text-xs font-bold text-slate-500 mb-6">
            Hemen gehitutako hitzak automatikoki {wordsTable} taulan gordeko dira, <span className="text-indigo-700">Maila 1</span> gisa.
          </p>

          <form onSubmit={handleSaveLevelOneWord} className="flex flex-col gap-4 grow min-h-0">
            <div className="flex flex-col gap-2">
              <label htmlFor="new-word" className="text-xs font-black text-indigo-900 uppercase">
                Hitza
              </label>
              <input
                id="new-word"
                type="text"
                value={newWordInput}
                onChange={(event) => setNewWordInput(event.target.value)}
                placeholder="Adib.: azkar"
                className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-bold text-slate-800 ${focusRingClass}`}
              />
            </div>

            <div className="flex flex-col gap-2 grow min-h-0">
              <label htmlFor="new-synonyms" className="text-xs font-black text-indigo-900 uppercase">
                Sinonimoak
              </label>
              <textarea
                id="new-synonyms"
                value={newSynonymsInput}
                onChange={(event) => setNewSynonymsInput(event.target.value)}
                placeholder="Adib.: bizkor, arin, laster"
                rows={6}
                className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-800 resize-none ${focusRingClass}`}
              />
              <p className="text-xs font-bold text-slate-400">Bereizi sinonimoak koma, puntu eta koma edo barra erabiliz.</p>
            </div>

            {wordSaveFeedback && (
              <p className={`text-xs font-black ${wordSaveFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {wordSaveFeedback.message}
              </p>
            )}

            {wordsError && <p className="text-xs font-black text-rose-600">Kontuz: {wordsError}</p>}

            {newWordInput.trim() && !wordsError && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
                <p className="text-xs font-black text-indigo-900 uppercase">Maila 1 Egiaztapena</p>

                {isWordsLoading && <p className="text-xs font-bold text-slate-500">Basea egiaztatzen...</p>}

                {!isWordsLoading && levelOneMatches.length === 0 && (
                  <p className="text-xs font-bold text-emerald-600">Ez da kointzidentziarik aurkitu. Sarrera berria gorde daiteke.</p>
                )}

                {!isWordsLoading && levelOneMatches.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-amber-700">
                      Hitz hau dagoeneko ageri da Maila 1ean. Aukeratu: lehendik dagoena eguneratu edo berria sortu.
                    </p>

                    <div className="flex flex-col gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                      {levelOneMatches.map((match) => {
                        const isSelected = selectedMatch?.word.id === match.word.id;
                        return (
                          <div
                            key={`${match.word.id}-${match.matchType}`}
                            className={`rounded-xl border p-2 ${isSelected ? 'border-indigo-300 bg-white' : 'border-slate-200 bg-white/70'}`}
                          >
                            <p className="text-xs font-black text-slate-700">
                              {match.matchType === 'hitza' ? 'Hitz nagusia' : 'Sinonimo gisa'}: {match.word.hitza}
                            </p>
                            <p className="text-xs font-bold text-slate-500 truncate">{match.word.sinonimoak.join(', ')}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMatchId(match.word.id);
                                setSaveMode('update');
                                setWordSaveFeedback(null);
                              }}
                              className={`mt-2 w-full rounded-lg py-2 text-xs font-black uppercase ${focusRingClass} ${isSelected && saveMode === 'update' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-100'}`}
                            >
                              Modificar existente
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSaveMode('insert');
                        setWordSaveFeedback(null);
                      }}
                      className={`w-full rounded-lg py-2 text-xs font-black uppercase ${focusRingClass} ${saveMode === 'insert' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-100'}`}
                    >
                      Anadir nuevo igualmente
                    </button>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSavingWord}
              className={`w-full text-white font-black py-3.5 rounded-xl text-sm uppercase tracking-widest ${tapTargetClass} ${focusRingClass} ${isSavingWord ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
            >
              {isSavingWord ? 'GORDETZEN...' : saveMode === 'update' && selectedMatch ? 'Modificar existente' : 'Gorde Maila 1ean'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (status === GameStatus.INTERMISSION) {
    const player = players[currentPlayerIndex];
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden safe-pt safe-pb safe-px p-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full border-b-[8px] border-indigo-600">
          <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4 shadow-lg">{currentPlayerIndex + 1}</div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">{player.name}</h2>
          <p className="text-xs text-indigo-400 font-black mb-8 uppercase tracking-[0.2em]">{difficulty}. Maila - 10 Galdera</p>
          <button onClick={startPlayerTurn} className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest ${tapTargetClass} ${focusRingClass}`}>HASI TXANDA</button>
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
      <div className="h-[100dvh] w-full flex flex-col items-center bg-slate-50 overflow-hidden safe-pt safe-pb safe-px p-4">
        <div className="w-full max-w-2xl flex justify-between items-center mb-4 gap-2 shrink-0">
          <div className="flex items-center space-x-2">
             <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-md uppercase">{currentPlayer.name}</div>
             <div className="bg-white px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-2 shadow-sm">
               <span className="text-xs font-black text-rose-500 uppercase leading-none">+{currentTurnPenalties}s</span>
             </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-indigo-600 font-black text-xs">
              {currentQuestionIndex + 1}/10
            </div>
            <button onClick={finishPlayerTurn} className={`bg-rose-50 text-rose-700 font-black px-3 py-2 rounded-lg text-xs uppercase ${tapTargetClass} ${focusRingClass}`}>Amaitu</button>
          </div>
        </div>

        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-xl p-6 mb-4 border border-slate-100 relative overflow-hidden flex flex-col grow min-h-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
            <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${((currentQuestionIndex + (isAnswered ? 1 : 0)) / QUESTIONS_PER_PLAYER) * 100}%` }} />
          </div>
          
          <div className="text-center my-6 shrink-0">
            <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Sinonimoa aukeratu</p>
            <h3 className="text-3xl md:text-5xl font-black text-slate-900 break-words leading-tight uppercase tracking-tighter">{currentQuestion.wordData.hitza}</h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5 grow min-h-0">
            {currentQuestion.options.map((opt, i) => {
              let buttonStyle = `w-full rounded-2xl border-2 font-black text-base md:text-xl transition-all duration-200 flex items-center justify-center text-center p-4 min-h-[56px] ${focusRingClass} `;
              if (!isAnswered) buttonStyle += "bg-white border-slate-50 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 shadow-sm active:translate-y-1";
              else {
                if (opt === currentQuestion.correctAnswer) buttonStyle += "bg-emerald-500 border-emerald-300 text-white shadow-lg";
                else if (opt === selectedAnswer) buttonStyle += "bg-rose-500 border-rose-300 text-white opacity-90";
                else buttonStyle += "bg-slate-50 border-slate-50 text-slate-300 grayscale opacity-40";
              }
              return (
                <button key={i} disabled={isAnswered} onClick={() => handleAnswer(opt)} className={buttonStyle}>{opt}</button>
              );
            })}
          </div>

          <div className="mt-6 shrink-0 h-14 flex items-center justify-center">
            {isAnswered ? (
               <button onClick={nextQuestion} className={`w-full bg-indigo-950 text-white font-black py-3 rounded-2xl shadow-lg active:scale-95 text-base uppercase tracking-widest ${tapTargetClass} ${focusRingClass}`}>
                 {currentQuestionIndex < 9 ? "Hurrengoa" : "Txanda bukatu"}
               </button>
            ) : (
               <div className="flex items-center gap-2 text-xs font-black text-slate-300 uppercase tracking-widest">
                 <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full animate-pulse"></span>
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
    const podiumPlayers: PodiumPlayer[] = sortedPlayers.slice(0, 3).map((player) => ({
      id: player.id,
      name: player.name,
      points: player.score,
    }));
    const tablePlayers = sortedPlayers.slice(3);
    const tableStartRank = podiumPlayers.length + 1;

    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-indigo-950 overflow-hidden safe-pt safe-pb safe-px p-4">
        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 md:p-8 flex flex-col h-full max-h-[90dvh]">
          <div className="mb-6 shrink-0 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase">Sailkapena</h2>
            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mt-1">{difficulty}. Maila</p>
          </div>

          <div className="mb-4 shrink-0">
            <Podium
              players={podiumPlayers}
              title="Podioa"
              ariaLabel="Podioa, hiru jokalari onenak"
            />
          </div>
          
          <div className="grow overflow-hidden rounded-2xl border border-slate-100 shadow-inner bg-slate-50 mb-6 flex flex-col">
            <div className="overflow-y-auto custom-scrollbar grow">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">P.</th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase">Jokalaria</th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase text-center">Pts</th>
                    <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase text-right">Denb.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {tablePlayers.length > 0 ? (
                    tablePlayers.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3.5 font-black text-lg">{`${tableStartRank + idx}.`}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-800 text-sm uppercase tracking-tight">{p.name}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg font-black text-xs">{p.score}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-500 text-xs">{p.time.toFixed(1)}s</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                        Podioan daude jokalari guztiak
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={startNewGame} className={`bg-indigo-600 text-white font-black py-3 rounded-xl shadow-md text-xs uppercase tracking-widest ${tapTargetClass} ${focusRingClass}`}>BERRIRO</button>
              <button onClick={() => setStatus(GameStatus.REVIEW)} className={`bg-white text-indigo-600 font-black py-3 rounded-xl shadow-sm text-xs uppercase tracking-widest border border-indigo-100 ${tapTargetClass} ${focusRingClass}`}>HITZAK</button>
            </div>
            <button onClick={() => setStatus(GameStatus.SETUP)} className={`w-full bg-slate-100 text-slate-600 font-black py-3 rounded-xl text-xs uppercase tracking-widest ${tapTargetClass} ${focusRingClass}`}>HASIERA</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === GameStatus.REVIEW) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-900 overflow-hidden safe-pt safe-pb safe-px p-4">
        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 flex flex-col h-full max-h-[90dvh]">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <button onClick={() => setStatus(GameStatus.SUMMARY)} className={`bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-black text-xs uppercase ${tapTargetClass} ${focusRingClass}`}>
              Atzera
            </button>
            <h2 className="text-lg font-black text-indigo-950 uppercase">Agertutako Hitzak</h2>
            <div className="w-12"></div>
          </div>

          <div className="grow overflow-y-auto pr-1 custom-scrollbar min-h-0 mb-6">
            <div className="grid grid-cols-1 gap-2">
              {playedWordData.map((data, idx) => (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-indigo-50 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-white text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-50">#{idx + 1}</span>
                    <a href={`https://hiztegiak.elhuyar.eus/eu/${data.hitza}`} target="_blank" rel="noopener noreferrer" className={`text-indigo-950 font-black text-sm uppercase underline-offset-2 hover:underline ${focusRingClass} rounded-sm`}>
                      {data.hitza}
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.sinonimoak.map((sin, sIdx) => (
                      <span key={sIdx} className="bg-white text-indigo-600 px-2 py-1 rounded-lg font-bold text-xs border border-indigo-100">
                        {sin}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <button onClick={() => setStatus(GameStatus.SUMMARY)} className={`w-full bg-indigo-600 text-white font-black py-3.5 rounded-xl shadow-lg uppercase tracking-widest text-xs shrink-0 ${tapTargetClass} ${focusRingClass}`}>Itzuli</button>
        </div>
      </div>
    );
  }

  return null;
};

export default App;



