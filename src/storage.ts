import { MAX_PLAYERS, PLAYER_EMOJIS, PLAYER_FIRST_NAMES, PLAYER_LAST_NAMES } from './appConstants';
import {
  AnalyticsSnapshot,
  AnalyticsSyncMode,
  SetupPlayerProfile,
  WordData,
} from './types';
import { createStableId, mergeWords, sanitizePlayerName, shuffleArray } from './wordUtils';

const STORAGE_KEYS = {
  analytics: 'sinonimoak.analytics.v2',
  customWords: 'sinonimoak.customWords.v2',
  deviceId: 'sinonimoak.deviceId.v2',
  roster: 'sinonimoak.roster.v3',
  wordsCache: 'sinonimoak.wordsCache.v2',
} as const;

type WordsCacheRecord = {
  savedAt: string;
  words: WordData[];
};

const canUseStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readJson = <T,>(key: string): T | null => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore persistence issues and keep the app usable.
  }
};

const createDefaultRoster = (): SetupPlayerProfile[] => {
  const firstNames = shuffleArray(PLAYER_FIRST_NAMES);
  const lastNames = shuffleArray(PLAYER_LAST_NAMES);
  const emojis = shuffleArray(PLAYER_EMOJIS);

  return Array.from({ length: MAX_PLAYERS }, (_, index) => ({
    id: createStableId('learner'),
    name: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
    emoji: emojis[index % emojis.length],
    slot: index,
  }));
};

const normalizeRoster = (value: SetupPlayerProfile[] | null): SetupPlayerProfile[] => {
  if (!Array.isArray(value)) return createDefaultRoster();

  const next = value
    .filter((item): item is SetupPlayerProfile => Boolean(item) && typeof item.id === 'string')
    .slice(0, MAX_PLAYERS)
    .map((player, index) => ({
      id: player.id,
      emoji: typeof player.emoji === 'string' && player.emoji.trim() ? player.emoji : PLAYER_EMOJIS[index % PLAYER_EMOJIS.length],
      name: sanitizePlayerName(player.name, `Ikaslea ${index + 1}`),
      slot: Number.isInteger(player.slot) ? player.slot : index,
    }));

  while (next.length < MAX_PLAYERS) {
    const defaults = createDefaultRoster()[next.length];
    next.push(defaults);
  }

  return next.sort((left, right) => left.slot - right.slot);
};

export const createEmptyAnalyticsSnapshot = (mode: AnalyticsSyncMode = 'local-only'): AnalyticsSnapshot => ({
  sessions: [],
  playerResults: [],
  failEvents: [],
  questionEvents: [],
  loadedAt: new Date(0).toISOString(),
  sync: {
    mode,
    lastRemoteSyncAt: null,
    remoteStatus: null,
  },
});

export const getOrCreateDeviceId = (): string => {
  const stored = readJson<string>(STORAGE_KEYS.deviceId);
  if (stored && typeof stored === 'string') return stored;

  const deviceId = createStableId('device');
  writeJson(STORAGE_KEYS.deviceId, deviceId);
  return deviceId;
};

export const loadRoster = (): SetupPlayerProfile[] => normalizeRoster(readJson<SetupPlayerProfile[]>(STORAGE_KEYS.roster));

export const saveRoster = (roster: SetupPlayerProfile[]): void => {
  writeJson(STORAGE_KEYS.roster, normalizeRoster(roster));
};

export const loadWordsCache = (): WordsCacheRecord | null => {
  const parsed = readJson<WordsCacheRecord>(STORAGE_KEYS.wordsCache);
  if (!parsed || !Array.isArray(parsed.words) || typeof parsed.savedAt !== 'string') return null;

  return {
    savedAt: parsed.savedAt,
    words: mergeWords(parsed.words),
  };
};

export const saveWordsCache = (words: WordData[]): void => {
  writeJson(STORAGE_KEYS.wordsCache, {
    savedAt: new Date().toISOString(),
    words: mergeWords(words),
  } satisfies WordsCacheRecord);
};

export const loadCustomWords = (): WordData[] => {
  const parsed = readJson<WordData[]>(STORAGE_KEYS.customWords);
  return Array.isArray(parsed) ? mergeWords(parsed) : [];
};

export const saveCustomWords = (words: WordData[]): void => {
  writeJson(STORAGE_KEYS.customWords, mergeWords(words));
};

export const loadAnalyticsSnapshot = (mode: AnalyticsSyncMode = 'local-only'): AnalyticsSnapshot => {
  const parsed = readJson<AnalyticsSnapshot>(STORAGE_KEYS.analytics);
  if (!parsed) return createEmptyAnalyticsSnapshot(mode);

  const snapshot = createEmptyAnalyticsSnapshot(parsed.sync?.mode ?? mode);
  return {
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : snapshot.sessions,
    playerResults: Array.isArray(parsed.playerResults) ? parsed.playerResults : snapshot.playerResults,
    failEvents: Array.isArray(parsed.failEvents) ? parsed.failEvents : snapshot.failEvents,
    questionEvents: Array.isArray(parsed.questionEvents) ? parsed.questionEvents : snapshot.questionEvents,
    loadedAt: typeof parsed.loadedAt === 'string' ? parsed.loadedAt : snapshot.loadedAt,
    sync: {
      mode: parsed.sync?.mode ?? mode,
      lastRemoteSyncAt: parsed.sync?.lastRemoteSyncAt ?? null,
      remoteStatus: parsed.sync?.remoteStatus ?? null,
    },
  };
};

export const saveAnalyticsSnapshot = (snapshot: AnalyticsSnapshot): void => {
  writeJson(STORAGE_KEYS.analytics, snapshot);
};
