import { useMemo, useState, FormEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWordsStore } from '../store/useWordsStore';
import { GameStatus, WordSaveFeedback, WordData } from '../types';
import { TAP_TARGET_CLASS, FOCUS_RING_CLASS } from '../appConstants';
import { uniqueNonEmptyStrings, parseSynonyms, isPlaceholderTerm, mergeWords } from '../wordUtils';

interface TextChangeEvent {
    target: { value: string };
}

const isFirstLevelWord = (word: WordData): boolean => (word.level ?? 1) === 1;
const WORDS_MANAGER_ACCESS_CODE = 'alta';

type WordMatchInfo = {
    rank: number;
    matchedSynonym: string | null;
    exactBy: 'word' | 'synonym' | null;
};

const NO_MATCH_RANK = 99;

const getWordMatchInfo = (query: string, word: WordData): WordMatchInfo => {
    const normalizedWord = word.hitza.toLowerCase();
    const normalizedSynonyms = word.sinonimoak.map((synonym) => synonym.toLowerCase());
    const exactSynonym = word.sinonimoak.find((synonym) => synonym.toLowerCase() === query) ?? null;
    const startsSynonym = word.sinonimoak.find((synonym) => synonym.toLowerCase().startsWith(query)) ?? null;
    const containsSynonym = word.sinonimoak.find((synonym) => synonym.toLowerCase().includes(query)) ?? null;

    if (normalizedWord === query) return { rank: 0, matchedSynonym: null, exactBy: 'word' };
    if (exactSynonym) return { rank: 1, matchedSynonym: exactSynonym, exactBy: 'synonym' };
    if (normalizedWord.startsWith(query)) return { rank: 2, matchedSynonym: null, exactBy: null };
    if (startsSynonym) return { rank: 3, matchedSynonym: startsSynonym, exactBy: null };
    if (normalizedWord.includes(query)) return { rank: 4, matchedSynonym: null, exactBy: null };
    if (containsSynonym) return { rank: 5, matchedSynonym: containsSynonym, exactBy: null };
    if (normalizedSynonyms.length > 0) return { rank: NO_MATCH_RANK, matchedSynonym: null, exactBy: null };
    return { rank: NO_MATCH_RANK, matchedSynonym: null, exactBy: null };
};

type SearchMatch = {
    word: WordData;
    rank: number;
    matchedSynonym: string | null;
    exactBy: 'word' | 'synonym' | null;
};

export const WordsManagerScreen = () => {
    const { setStatus } = useAppStore();
    const {
        baseWords,
        customWords,
        replaceLocalWord,
        deleteLocalWord,
        deleteWordFromSupabase,
        syncWordToSupabase,
        isWordsLoading
    } = useWordsStore();

    const [newWordInput, setNewWordInput] = useState('');
    const [newSynonymsInput, setNewSynonymsInput] = useState('');
    const [wordSaveFeedback, setWordSaveFeedback] = useState<WordSaveFeedback | null>(null);
    const [isSavingWord, setIsSavingWord] = useState(false);
    const [isDeletingWord, setIsDeletingWord] = useState(false);
    const [editingWordKey, setEditingWordKey] = useState<string | null>(null);
    const [accessCodeInput, setAccessCodeInput] = useState('');
    const [isAccessGranted, setIsAccessGranted] = useState(false);
    const [accessError, setAccessError] = useState('');

    const allWords = useMemo(() => mergeWords(baseWords, customWords), [baseWords, customWords]);
    const normalizedNewWord = newWordInput.trim().toLowerCase();
    const matchingWords = useMemo<SearchMatch[]>(() => {
        if (normalizedNewWord.length < 2) return [];

        return allWords
            .filter((word) => isFirstLevelWord(word))
            .map((word) => ({
                word,
                ...getWordMatchInfo(normalizedNewWord, word),
            }))
            .filter((match) => match.rank < NO_MATCH_RANK)
            .sort((left, right) =>
                left.rank - right.rank
                || left.word.hitza.localeCompare(right.word.hitza, 'eu')
            );
    }, [allWords, normalizedNewWord]);
    const exactFirstLevelMatch = useMemo(
        () => matchingWords.find((match) => match.exactBy !== null) ?? null,
        [matchingWords, normalizedNewWord]
    );
    const searchResults = useMemo(
        () => exactFirstLevelMatch ? [exactFirstLevelMatch] : matchingWords.slice(0, 3),
        [exactFirstLevelMatch, matchingWords]
    );
    const editingWord = useMemo(
        () => editingWordKey
            ? allWords.find((word) => isFirstLevelWord(word) && word.hitza.toLowerCase() === editingWordKey) ?? null
            : null,
        [allWords, editingWordKey]
    );
    const activeExistingWord = editingWord ?? exactFirstLevelMatch?.word ?? null;
    const isEditingExistingWord = Boolean(editingWord);

    const loadWordForEditing = (word: WordData) => {
        setEditingWordKey(word.hitza.toLowerCase());
        setNewWordInput(word.hitza);
        setNewSynonymsInput(word.sinonimoak.join(', '));
        setWordSaveFeedback(null);
    };

    const resetEditor = (clearFeedback = true) => {
        setEditingWordKey(null);
        setNewWordInput('');
        setNewSynonymsInput('');
        if (clearFeedback) {
            setWordSaveFeedback(null);
        }
    };

    const handleSaveLevelOneWord = async (e: FormEvent) => {
        e.preventDefault();

        if (!normalizedNewWord) {
            setWordSaveFeedback({ type: 'error', message: 'Idatzi hitza lehenik.' });
            return;
        }

        if (isPlaceholderTerm(normalizedNewWord)) {
            setWordSaveFeedback({ type: 'error', message: 'Hitzak karaktere baliogabeak ditu.' });
            return;
        }

        const validSynonyms = parseSynonyms(newSynonymsInput).filter(s => s.toLowerCase() !== normalizedNewWord);

        if (validSynonyms.length === 0) {
            setWordSaveFeedback({ type: 'error', message: 'Idatzi gutxienez sinonimo bat.' });
            return;
        }

        setIsSavingWord(true);
        setWordSaveFeedback(null);

        try {
            const existingMatch = editingWord
                ?? matchingWords.find((match) => match.exactBy !== null)?.word
                ?? null;
            const existingWordKey = existingMatch?.hitza.toLowerCase() ?? null;
            const typedWordIsExistingSynonym = Boolean(
                existingMatch
                && existingWordKey !== normalizedNewWord
                && existingMatch.sinonimoak.some((synonym) => synonym.toLowerCase() === normalizedNewWord)
            );
            const normalizedSynonymDraft = uniqueNonEmptyStrings([
                ...validSynonyms,
                ...(typedWordIsExistingSynonym ? [normalizedNewWord] : []),
            ]).filter((synonym) => synonym.toLowerCase() !== (existingMatch?.hitza.toLowerCase() ?? normalizedNewWord));

            const finalWord: WordData = existingMatch
                ? {
                    ...existingMatch,
                    hitza: existingMatch.hitza,
                    sinonimoak: editingWord
                        ? normalizedSynonymDraft
                        : uniqueNonEmptyStrings([...existingMatch.sinonimoak, ...normalizedSynonymDraft]),
                    level: 1,
                    source: 'local',
                }
                : {
                    id: `local-word-${Date.now()}`,
                    hitza: normalizedNewWord,
                    sinonimoak: uniqueNonEmptyStrings(validSynonyms),
                    level: 1,
                    source: 'local',
                };

            replaceLocalWord(finalWord, existingMatch?.hitza ?? null);

            const existingRemoteWord = existingMatch?.source === 'remote' ? existingMatch : null;
            const syncResult = await syncWordToSupabase(finalWord, existingRemoteWord);

            setWordSaveFeedback({
                type: syncResult.ok ? 'success' : 'error',
                message: syncResult.ok
                    ? editingWord
                        ? 'Hitza eguneratu da!'
                        : existingMatch
                            ? 'Sinonimoak gehitu dira!'
                            : 'Ondo gorde da!'
                    : `Gailuan gordeta. ${syncResult.message}`,
            });

            setEditingWordKey(null);
            setNewWordInput('');
            setNewSynonymsInput('');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setWordSaveFeedback({ type: 'error', message: `Errorea: ${msg}` });
        } finally {
            setIsSavingWord(false);
        }
    };

    const handleDeleteWord = async () => {
        const targetWord = activeExistingWord;
        if (!targetWord || !isFirstLevelWord(targetWord)) return;

        setIsDeletingWord(true);
        setWordSaveFeedback(null);

        try {
            const remoteTarget = targetWord.source === 'remote' ? targetWord : null;
            const remoteResult = await deleteWordFromSupabase(remoteTarget);

            if (!remoteResult.ok) {
                setWordSaveFeedback({
                    type: 'error',
                    message: `Ez da ezabatu. ${remoteResult.message}`,
                });
                return;
            }

            deleteLocalWord(targetWord.hitza);

            setWordSaveFeedback({
                type: 'success',
                message: 'Hitza ezabatu da!',
            });

            resetEditor(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setWordSaveFeedback({ type: 'error', message: `Errorea: ${msg}` });
        } finally {
            setIsDeletingWord(false);
        }
    };

    const handleAccessSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (accessCodeInput.trim().toLowerCase() === WORDS_MANAGER_ACCESS_CODE) {
            setIsAccessGranted(true);
            setAccessError('');
            setAccessCodeInput('');
            return;
        }

        setAccessError('Gako okerra.');
    };

    if (!isAccessGranted) {
        return (
            <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-2 sm:p-4 lg:p-8">
                <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-4 sm:p-6 flex flex-col gap-4">
                        <div className="rounded-[1.5rem] border border-[#eff3fc] bg-[#f8fbff] p-4 text-center">
                            <h2 className="text-xl sm:text-2xl font-black text-[#181333] uppercase">Sarbide Babestua</h2>
                            <p className="mt-2 text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.18em]">
                            Hitzen kudeatzailean sartzeko pasahitza behar da
                            </p>
                        </div>

                    <form onSubmit={handleAccessSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="words-manager-access" className="text-xs font-black text-[#181333] uppercase tracking-widest pl-1">
                                Pasahitza
                            </label>
                            <input
                                id="words-manager-access"
                                type="password"
                                value={accessCodeInput}
                                onChange={(event: TextChangeEvent) => {
                                    setAccessCodeInput(event.target.value);
                                    if (accessError) setAccessError('');
                                }}
                                placeholder="Idatzi pasahitza"
                                aria-invalid={accessError ? 'true' : 'false'}
                                className={`w-full rounded-[1.35rem] border border-[#eff3fc] bg-[#f8fbff] hover:bg-white focus:bg-white px-4 py-3.5 text-base font-bold text-[#181333] transition-colors ${FOCUS_RING_CLASS}`}
                            />
                        </div>

                        <div className="min-h-[24px] flex items-center justify-center">
                            {accessError && (
                                <p className="text-center text-xs font-black uppercase tracking-widest text-[#ef4444]">
                                    {accessError}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setStatus(GameStatus.SETUP)}
                                className={`w-full rounded-[1.15rem] border border-[#eff3fc] bg-white px-4 py-4 text-sm font-black uppercase tracking-widest text-[#181333] shadow-sm transition-transform hover:bg-slate-50 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                            >
                                Itzuli
                            </button>
                            <button
                                type="submit"
                                className={`w-full rounded-[1.15rem] bg-[#4d3df7] px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-transform hover:bg-indigo-600 active:scale-95 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                            >
                                Sartu
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-[#181333] overflow-hidden safe-pt safe-pb safe-px p-2 sm:p-4 lg:p-8">
            <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl p-3 sm:p-5 lg:p-6 flex flex-col h-full max-h-[96dvh] overflow-hidden">
                <div className="mb-4 shrink-0 rounded-[1.5rem] border border-[#eff3fc] bg-[#f8fbff] p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 text-center sm:text-left">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#181333] uppercase">Hitzen Kudeatzailea</h2>
                            <p className="mt-1.5 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.18em]">
                                Gehitu, editatu edo ezabatu 1. mailako hitzak
                            </p>
                        </div>
                        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:min-w-[170px]">
                            <button
                                type="button"
                                onClick={() => setStatus(GameStatus.SETUP)}
                                className={`w-full rounded-[1.1rem] border border-[#dbe4ff] bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#4d3df7] shadow-sm transition-transform hover:bg-[#f5f8ff] active:scale-95 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                            >
                                Itzuli
                            </button>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSaveLevelOneWord} className="grow min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                    <div className="flex min-h-full flex-col gap-4">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
                            <section className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="new-word" className="text-xs font-black text-[#181333] uppercase tracking-widest pl-1">
                                        Hitza
                                    </label>
                                    <input
                                        id="new-word"
                                        type="text"
                                        value={newWordInput}
                                        onChange={(event: TextChangeEvent) => setNewWordInput(event.target.value)}
                                        placeholder="Adibidea: azkar"
                                        className={`w-full rounded-[1.35rem] border border-[#eff3fc] bg-[#f8fbff] hover:bg-white focus:bg-white px-4 py-3.5 text-base font-bold text-[#181333] transition-colors ${FOCUS_RING_CLASS}`}
                                    />
                                </div>

                                <div className="rounded-[1.35rem] border border-[#eff3fc] bg-[#f8fbff] px-4 py-4 shadow-sm">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#181333]">
                                            Maila 1 bilaketa
                                        </p>
                                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                            {normalizedNewWord.length < 2 ? 'Idatzi 2 letra' : isWordsLoading ? 'Bilatzen...' : `${matchingWords.length} emaitza`}
                                        </span>
                                    </div>

                                    <div className="mt-3">
                                        {normalizedNewWord.length < 2 ? (
                                            <p className="text-xs font-bold text-slate-500">
                                                Hasi hitza idazten 1. mailako emaitzak ikusteko.
                                            </p>
                                        ) : isWordsLoading ? (
                                            <p className="text-xs font-bold text-slate-500">
                                                Hitzak kargatzen ari dira.
                                            </p>
                                        ) : searchResults.length > 0 ? (
                                            <div className="flex flex-col gap-2">
                                                {searchResults.map((match) => {
                                                    const isExact = match.exactBy !== null;
                                                    const isLoaded = editingWordKey === match.word.hitza.toLowerCase();

                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => loadWordForEditing(match.word)}
                                                            key={`${match.word.id}-${match.word.hitza}`}
                                                            className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${isExact ? 'border-[#93c5fd] bg-[#eff6ff]' : 'border-[#eff3fc] bg-white hover:bg-[#f8fbff]'} ${FOCUS_RING_CLASS}`}
                                                        >
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                    <div className="min-w-0">
                                                                        <span className="block text-sm font-black uppercase text-[#181333]">
                                                                            {match.word.hitza}
                                                                        </span>
                                                                        <p className="mt-2 text-xs font-bold text-slate-500">
                                                                            {match.word.sinonimoak.slice(0, 5).join(', ')}
                                                                        </p>
                                                                        {match.matchedSynonym && (
                                                                            <p className="mt-2 text-[11px] font-bold text-slate-400">
                                                                                Bat dator: {match.matchedSynonym}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {isExact && (
                                                                            <span className="rounded-full bg-[#dbeafe] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#1d4ed8]">
                                                                                {match.exactBy === 'synonym' ? 'Sinonimoa' : 'Badago'}
                                                                            </span>
                                                                        )}
                                                                        {isLoaded && (
                                                                            <span className="rounded-full bg-[#dcfce7] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#15803d]">
                                                                                Editatzen
                                                                            </span>
                                                                        )}
                                                                        {!isLoaded && (
                                                                            <span className="rounded-full border border-[#dbeafe] bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#1d4ed8]">
                                                                                Editatu
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs font-bold text-slate-500">
                                                Ez da antzeko hitzik aurkitu 1. mailan.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="flex flex-col gap-3">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="new-synonyms" className="text-xs font-black text-[#181333] uppercase tracking-widest pl-1">
                                        Sinonimoak
                                    </label>
                                    <textarea
                                        id="new-synonyms"
                                        value={newSynonymsInput}
                                        onChange={(event: TextChangeEvent) => setNewSynonymsInput(event.target.value)}
                                        placeholder="Adibidea: bizkor, arin, laster"
                                        className={`min-h-[180px] rounded-[1.35rem] border border-[#eff3fc] bg-[#f8fbff] hover:bg-white focus:bg-white px-4 py-4 text-sm font-bold text-[#181333] resize-none transition-colors xl:min-h-[360px] ${FOCUS_RING_CLASS}`}
                                    />
                                </div>

                                {activeExistingWord && (
                                    <div className="rounded-[1.35rem] border border-[#eff3fc] bg-[#f8fbff] px-4 py-4 text-center">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#181333]">
                                            {isEditingExistingWord ? 'Edizio modua' : 'Lehendik dagoen hitza'}
                                        </p>
                                        <p className="mt-2 text-xs font-bold text-slate-500">
                                            {activeExistingWord.hitza} - 1. maila
                                        </p>
                                    </div>
                                )}
                            </section>
                        </div>

                        <div className="min-h-[24px] flex items-center justify-center px-2">
                            {wordSaveFeedback && (
                                <p className={`text-center text-xs font-black uppercase tracking-widest ${wordSaveFeedback.type === 'success' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                    {wordSaveFeedback.message}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {isEditingExistingWord && (
                                <button
                                    type="button"
                                    onClick={resetEditor}
                                    className={`w-full rounded-[1.15rem] border border-[#eff3fc] bg-white px-4 py-4 text-sm font-black uppercase tracking-widest text-[#181333] shadow-sm transition-transform hover:bg-slate-50 ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS}`}
                                >
                                    Ezeztatu Edizioa
                                </button>
                            )}

                            {activeExistingWord && (
                                <button
                                    type="button"
                                    onClick={handleDeleteWord}
                                    disabled={isDeletingWord || isSavingWord}
                                    className={`w-full rounded-[1.15rem] px-4 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-transform ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS} ${isDeletingWord || isSavingWord ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600 active:scale-95'}`}
                                >
                                    {isDeletingWord ? 'Ezabatzen...' : 'Ezabatu Hitza'}
                                </button>
                            )}

                            <button
                                type="submit"
                                disabled={isSavingWord || isDeletingWord}
                                className={`w-full ${activeExistingWord ? 'sm:col-span-2 xl:col-span-1' : 'sm:col-span-2 xl:col-span-3'} text-white font-black px-5 py-4 sm:py-5 rounded-[1.15rem] transition-transform shadow-lg text-sm sm:text-base uppercase tracking-widest ${TAP_TARGET_CLASS} ${FOCUS_RING_CLASS} ${isSavingWord || isDeletingWord ? 'bg-slate-300 cursor-not-allowed' : 'bg-[#4d3df7] hover:bg-indigo-600 active:scale-95'
                                    }`}
                            >
                                {isSavingWord ? 'Gordetzen...' : activeExistingWord ? 'Gorde Aldaketak' : 'Gorde Hitza'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
