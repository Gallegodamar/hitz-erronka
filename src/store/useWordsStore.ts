import { create } from 'zustand';
import { WordData, DifficultyLevel, WordSaveFeedback } from '../types';
import {
    loadCustomWords,
    loadWordsCache,
    saveCustomWords,
    saveWordsCache,
} from '../storage';
import { ensureAnalyticsIdentity, isSupabaseConfigured, supabase, wordsTable } from '../supabaseClient';
import { normalizeWordRow, mergeWords, createStableId, uniqueNonEmptyStrings } from '../wordUtils';

type WordsMode = 'loading' | 'remote' | 'cache' | 'local';

interface WordsState {
    baseWords: WordData[];
    customWords: WordData[];
    isWordsLoading: boolean;
    wordsMode: WordsMode;
    wordsNotice: string | null;
    wordSyncStatus: string | null;
    lastWordsSyncAt: string | null;

    // actions
    refreshWords: () => Promise<void>;
    syncWordToSupabase: (word: WordData, existingRemoteWord: WordData | null) => Promise<{ ok: boolean; message: string }>;
    replaceLocalWord: (word: WordData, previousWordKey?: string | null) => void;
    deleteLocalWord: (wordKey: string) => void;
    deleteWordFromSupabase: (existingRemoteWord: WordData | null) => Promise<{ ok: boolean; message: string }>;
}

type RemoteWordPayload = Record<string, string | number | boolean | string[]>;

const buildBaseRemotePayloads = (word: WordData): RemoteWordPayload[] => {
    const synonyms = uniqueNonEmptyStrings(word.sinonimoak);
    const synonymsText = synonyms.join(', ');
    const difficulty = word.level ?? 1;

    return [
        { hitza: word.hitza, sinonimoak: synonyms, difficulty },
        { hitza: word.hitza, sinonimoak: synonymsText, difficulty },
        { hitza: word.hitza, sinonimoak: synonyms, level: difficulty },
        { hitza: word.hitza, sinonimoak: synonymsText, level: difficulty },
        { word: word.hitza, synonyms: synonyms, difficulty },
        { word: word.hitza, synonyms: synonymsText, difficulty },
        { word: word.hitza, synonyms: synonyms, level: difficulty },
        { word: word.hitza, synonyms: synonymsText, level: difficulty },
        { hitza: word.hitza, synonyms: synonyms, difficulty },
        { hitza: word.hitza, synonyms: synonymsText, difficulty },
        { word: word.hitza, sinonimoak: synonyms, difficulty },
        { word: word.hitza, sinonimoak: synonymsText, difficulty },
        { hitza: word.hitza, sinonimoak: synonyms },
        { hitza: word.hitza, sinonimoak: synonymsText },
        { word: word.hitza, synonyms: synonyms },
        { word: word.hitza, synonyms: synonymsText },
    ];
};

const toTemplateSynonymsValue = (templateValue: unknown, synonyms: string[], synonymsText: string): string | string[] => {
    if (Array.isArray(templateValue)) return synonyms;
    return synonymsText;
};

const buildTemplateInsertPayload = (word: WordData, schemaReference: WordData): RemoteWordPayload | null => {
    if (!schemaReference.remoteRow || !schemaReference.remoteWordField || !schemaReference.remoteSynonymsField) {
        return null;
    }

    const payload = { ...schemaReference.remoteRow } as Record<string, unknown>;
    const synonyms = uniqueNonEmptyStrings(word.sinonimoak);
    const synonymsText = synonyms.join(', ');
    const wordField = schemaReference.remoteWordField;
    const synonymsField = schemaReference.remoteSynonymsField;
    const levelField = schemaReference.remoteLevelField;
    const idField = schemaReference.remoteIdField;

    if (idField) {
        delete payload[idField];
    }

    payload[wordField] = word.hitza;
    payload[synonymsField] = toTemplateSynonymsValue(payload[synonymsField], synonyms, synonymsText);

    if (levelField) {
        payload[levelField] = word.level ?? 1;
    }

    if ('search_text' in payload) {
        payload.search_text = `${word.hitza} ${synonyms.join(' ')}`.toLowerCase();
    }

    if ('source_id' in payload && (payload.source_id === null || payload.source_id === undefined || payload.source_id === '')) {
        payload.source_id = createStableId('manual');
    }

    if ('active' in payload && (payload.active === null || payload.active === undefined)) {
        payload.active = true;
    }

    return payload as RemoteWordPayload;
};

const buildSchemaAwareRemotePayloads = (word: WordData, existingRemoteWord: WordData | null): RemoteWordPayload[] => {
    const synonyms = uniqueNonEmptyStrings(word.sinonimoak);
    const synonymsText = synonyms.join(', ');
    const difficulty = word.level ?? 1;
    const schemaPayloads: RemoteWordPayload[] = [];

    if (existingRemoteWord?.remoteWordField && existingRemoteWord.remoteSynonymsField) {
        const wordField = existingRemoteWord.remoteWordField;
        const synonymsField = existingRemoteWord.remoteSynonymsField;
        const levelField = existingRemoteWord.remoteLevelField;

        schemaPayloads.push(
            {
                [wordField]: word.hitza,
                [synonymsField]: synonyms,
                ...(levelField ? { [levelField]: difficulty } : {}),
            },
            {
                [wordField]: word.hitza,
                [synonymsField]: synonymsText,
                ...(levelField ? { [levelField]: difficulty } : {}),
            },
            {
                [wordField]: word.hitza,
                [synonymsField]: synonyms,
            },
            {
                [wordField]: word.hitza,
                [synonymsField]: synonymsText,
            }
        );
    }

    return dedupeRemotePayloads([...schemaPayloads, ...buildBaseRemotePayloads(word)]);
};

const isAuthRelatedRemoteError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('unauthorized')
        || normalized.includes('jwt')
        || normalized.includes('permission denied')
        || normalized.includes('row-level security')
        || normalized.includes('rls')
        || normalized.includes('not allowed')
        || normalized.includes('authenticated');
};

const dedupeRemotePayloads = (payloads: RemoteWordPayload[]): RemoteWordPayload[] => {
    const seen = new Set<string>();
    const next: RemoteWordPayload[] = [];

    for (const payload of payloads) {
        const key = JSON.stringify(payload);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(payload);
    }

    return next;
};

const buildInsertRemotePayloads = (word: WordData, schemaReference: WordData | null): RemoteWordPayload[] => {
    const sourceId = createStableId('manual');
    const searchText = `${word.hitza} ${uniqueNonEmptyStrings(word.sinonimoak).join(' ')}`.toLowerCase();
    const templatePayload = schemaReference ? buildTemplateInsertPayload(word, schemaReference) : null;
    const basePayloads = schemaReference
        ? dedupeRemotePayloads([
            ...(templatePayload ? [templatePayload] : []),
            ...buildSchemaAwareRemotePayloads(word, schemaReference),
        ])
        : buildBaseRemotePayloads(word);

    return dedupeRemotePayloads([
        ...basePayloads,
        ...basePayloads.map((payload) => ({ ...payload, source_id: sourceId })),
        ...basePayloads.map((payload) => ({ ...payload, active: true, part: 1 })),
        ...basePayloads.map((payload) => ({ ...payload, search_text: searchText })),
        ...basePayloads.map((payload) => ({ ...payload, active: true, part: 1, search_text: searchText })),
        ...basePayloads.map((payload) => ({ ...payload, source_id: sourceId, active: true, part: 1, search_text: searchText })),
    ]);
};

const tryRemotePayloads = async (
    payloads: RemoteWordPayload[],
    mutator: (payload: RemoteWordPayload) => Promise<{ error: { message: string } | null }>
): Promise<{ ok: boolean; message: string }> => {
    let lastErrorMessage = 'Unknown remote error.';

    for (const payload of payloads) {
        const { error } = await mutator(payload);
        if (!error) {
            return { ok: true, message: 'Synced with Supabase.' };
        }
        lastErrorMessage = error.message;
        if (isAuthRelatedRemoteError(error.message)) {
            break;
        }
    }

    return { ok: false, message: lastErrorMessage };
};

const replaceCustomWord = (words: WordData[], nextWord: WordData, previousWordKey?: string | null): WordData[] => {
    const previousKey = previousWordKey?.trim().toLowerCase() ?? null;
    const nextKey = nextWord.hitza.trim().toLowerCase();

    return mergeWords(
        words.filter((word) => {
            const wordKey = word.hitza.trim().toLowerCase();
            return wordKey !== nextKey && wordKey !== previousKey;
        }),
        [nextWord]
    );
};

const removeCustomWord = (words: WordData[], wordKey: string): WordData[] =>
    mergeWords(words.filter((word) => word.hitza.trim().toLowerCase() !== wordKey.trim().toLowerCase()));

export const useWordsStore = create<WordsState>((set, get) => ({
    baseWords: [],
    customWords: loadCustomWords(),
    isWordsLoading: true,
    wordsMode: 'loading',
    wordsNotice: null,
    wordSyncStatus: null,
    lastWordsSyncAt: loadWordsCache()?.savedAt ?? null,

    refreshWords: async () => {
        set({ isWordsLoading: true });
        const { customWords } = get();

        const cachedRecord = loadWordsCache();
        if (cachedRecord) {
            set({
                baseWords: cachedRecord.words.map((w) => ({ ...w, source: 'cache' })),
                wordsMode: 'cache',
                wordsNotice: 'Usando local cache whilst checking Supabase.',
                wordSyncStatus: 'Cache local cargada mientras se comprueba Supabase.',
                lastWordsSyncAt: cachedRecord.savedAt,
            });
        }

        if (!supabase || !isSupabaseConfigured) {
            const hasCustom = customWords.length > 0;
            const hasCached = Boolean(cachedRecord && cachedRecord.words.length > 0);
            set({
                wordsMode: hasCached ? 'cache' : 'local',
                wordsNotice: hasCached
                    ? 'Supabase missing. Using local cache.'
                    : hasCustom
                        ? 'Supabase missing. Using local words.'
                        : 'No remote or local words found.',
                wordSyncStatus: hasCached || hasCustom
                    ? 'Modo local activo. No se esta sincronizando con Supabase.'
                    : 'No hay datos remotos ni locales disponibles.',
                isWordsLoading: false
            });
            return;
        }

        const { data, error } = await supabase.from(wordsTable).select('*');
        if (error) {
            const hasFallback = Boolean(cachedRecord && cachedRecord.words.length > 0) || customWords.length > 0;
            set({
                wordsMode: cachedRecord && cachedRecord.words.length > 0 ? 'cache' : 'local',
                wordsNotice: hasFallback
                    ? `Could not sync: ${error.message}. Local mode maintained.`
                    : `Failed to load words: ${error.message}.`,
                wordSyncStatus: hasFallback
                    ? `Sincronizacion remota fallida. Se mantiene modo local: ${error.message}`
                    : `No se pudieron cargar palabras remotas: ${error.message}`,
                isWordsLoading: false
            });
            return;
        }

        const normalizedWords = (data ?? [])
            .map((row, index) => normalizeWordRow(row as Record<string, unknown>, index, 'remote'))
            .filter((w): w is WordData => w !== null);

        if (normalizedWords.length === 0) {
            set({
                wordsMode: cachedRecord && cachedRecord.words.length > 0 ? 'cache' : 'local',
                wordsNotice: 'Supabase returned empty. Staying local.',
                wordSyncStatus: 'Supabase ha respondido sin palabras validas. Se mantiene modo local.',
                isWordsLoading: false
            });
            return;
        }

        set({
            baseWords: normalizedWords,
            wordsMode: 'remote',
            wordsNotice: customWords.length > 0
                ? 'Synced with Supabase. Local customizations active.'
                : 'Synced with Supabase.',
            wordSyncStatus: `Sincronizado con Supabase (${wordsTable}).`,
            lastWordsSyncAt: new Date().toISOString(),
            isWordsLoading: false
        });
        saveWordsCache(normalizedWords);
    },

    syncWordToSupabase: async (word, existingRemoteWord) => {
        if (!supabase || !isSupabaseConfigured) {
            const message = 'Saved locally. Supabase unavailable.';
            set({ wordSyncStatus: 'Guardado solo en este dispositivo. Supabase no esta disponible.' });
            return { ok: false, message };
        }
        const client = supabase;
        const schemaReference = existingRemoteWord ?? get().baseWords.find((candidate) => candidate.source === 'remote') ?? null;

        if (existingRemoteWord) {
            const filterField = existingRemoteWord.remoteIdField ?? existingRemoteWord.remoteWordField ?? 'id';
            const filterValue = existingRemoteWord.remoteIdField ? existingRemoteWord.id : existingRemoteWord.hitza;
            let result = await tryRemotePayloads(
                buildSchemaAwareRemotePayloads(word, existingRemoteWord),
                async (payload) => {
                    const { error } = await client.from(wordsTable).update(payload).eq(filterField, filterValue);
                    return { error };
                }
            );

            if (!result.ok && isAuthRelatedRemoteError(result.message)) {
                const identity = await ensureAnalyticsIdentity();
                if (!identity.ok) {
                    const message = `Saved locally. Remote auth error: ${identity.message}`;
                    set({ wordSyncStatus: `No se pudo autenticar en Supabase (${wordsTable}): ${identity.message}` });
                    return { ok: false, message };
                }

                result = await tryRemotePayloads(
                    buildSchemaAwareRemotePayloads(word, existingRemoteWord),
                    async (payload) => {
                        const { error } = await client.from(wordsTable).update(payload).eq(filterField, filterValue);
                        return { error };
                    }
                );
            }

            if (result.ok) {
                set({ wordSyncStatus: `Palabra actualizada en Supabase (${wordsTable}).` });
                await get().refreshWords();
                return { ok: true, message: 'Synced with Supabase.' };
            }
            set({ wordSyncStatus: `No se pudo actualizar en Supabase (${wordsTable}): ${result.message}` });
            return { ok: false, message: `Saved locally. Remote error: ${result.message}` };
        }

        let result = await tryRemotePayloads(
            buildInsertRemotePayloads(word, schemaReference),
            async (payload) => {
                const { error } = await client.from(wordsTable).insert(payload);
                return { error };
            }
        );

        if (!result.ok && isAuthRelatedRemoteError(result.message)) {
            const identity = await ensureAnalyticsIdentity();
            if (!identity.ok) {
                const message = `Saved locally. Remote auth error: ${identity.message}`;
                set({ wordSyncStatus: `No se pudo autenticar en Supabase (${wordsTable}): ${identity.message}` });
                return { ok: false, message };
            }

            result = await tryRemotePayloads(
                buildInsertRemotePayloads(word, schemaReference),
                async (payload) => {
                    const { error } = await client.from(wordsTable).insert(payload);
                    return { error };
                }
            );
        }

        if (result.ok) {
            set({ wordSyncStatus: `Palabra creada en Supabase (${wordsTable}).` });
            await get().refreshWords();
            return { ok: true, message: 'Saved and synced with Supabase.' };
        }
        set({ wordSyncStatus: `No se pudo crear en Supabase (${wordsTable}): ${result.message}` });
        return { ok: false, message: `Saved locally. Remote insert error: ${result.message}` };
    },

    replaceLocalWord: (word, previousWordKey = null) => {
        set((state) => {
            const newCustomWords = replaceCustomWord(state.customWords, word, previousWordKey);
            saveCustomWords(newCustomWords);
            return { customWords: newCustomWords };
        });
    },

    deleteLocalWord: (wordKey) => {
        set((state) => {
            const nextCustomWords = removeCustomWord(state.customWords, wordKey);
            saveCustomWords(nextCustomWords);
            return { customWords: nextCustomWords };
        });
    },

    deleteWordFromSupabase: async (existingRemoteWord) => {
        if (!existingRemoteWord) {
            return { ok: true, message: 'Local only word removed.' };
        }

        if (!supabase || !isSupabaseConfigured) {
            const message = 'Supabase unavailable.';
            set({ wordSyncStatus: `No se pudo borrar en Supabase (${wordsTable}): ${message}` });
            return { ok: false, message };
        }

        const client = supabase;
        const filterField = existingRemoteWord.remoteIdField ?? existingRemoteWord.remoteWordField ?? 'id';
        const filterValue = existingRemoteWord.remoteIdField ? existingRemoteWord.id : existingRemoteWord.hitza;

        let { error } = await client.from(wordsTable).delete().eq(filterField, filterValue);

        if (error && isAuthRelatedRemoteError(error.message)) {
            const identity = await ensureAnalyticsIdentity();
            if (!identity.ok) {
                const message = `Remote auth error: ${identity.message}`;
                set({ wordSyncStatus: `No se pudo autenticar en Supabase (${wordsTable}): ${identity.message}` });
                return { ok: false, message };
            }

            const retried = await client.from(wordsTable).delete().eq(filterField, filterValue);
            error = retried.error;
        }

        if (error) {
            set({ wordSyncStatus: `No se pudo borrar en Supabase (${wordsTable}): ${error.message}` });
            return { ok: false, message: error.message };
        }

        set({ wordSyncStatus: `Palabra borrada en Supabase (${wordsTable}).` });
        await get().refreshWords();
        return { ok: true, message: 'Deleted from Supabase.' };
    }
}));
