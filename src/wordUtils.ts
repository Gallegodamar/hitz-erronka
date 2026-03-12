import { DifficultyLevel, WordData, WordSource } from './types';

const WORD_KEY_CANDIDATES = ['hitza', 'word', 'term', 'name'];
const SYNONYM_KEY_CANDIDATES = ['sinonimoak', 'synonyms', 'sinonimoak_json', 'synonym_list'];
const LEVEL_KEY_CANDIDATES = ['difficulty', 'level', 'maila', 'zailtasuna'];
const ID_KEY_CANDIDATES = ['id', 'word_id', 'uuid'];

const PLACEHOLDER_TERM_PATTERNS: RegExp[] = [/^proba[_\s-]*hitza(?:[_\s-]*\d+)?$/i, /^test[_\s-]*word(?:[_\s-]*\d+)?$/i];

export const shuffleArray = <T,>(array: T[]): T[] => {
  const next = [...array];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

export const createStableId = (prefix = 'id'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

export const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return value.toString();
  return '';
};

export const toNumberValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const uniqueNonEmptyStrings = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const parseSynonyms = (value: unknown): string[] => {
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
      // Keep the separator fallback.
    }
  }

  return rawValue
    .split(/[;,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export const isPlaceholderTerm = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return PLACEHOLDER_TERM_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const parseDifficultyLevel = (value: unknown): DifficultyLevel | null => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 4) {
    return parsed as DifficultyLevel;
  }
  return null;
};

export const getFirstValue = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
};

const getFirstExistingKey = (row: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return key;
  }
  return null;
};

export const normalizeWord = (word: WordData): WordData | null => {
  const hitza = toStringValue(word.hitza);
  if (!hitza || isPlaceholderTerm(hitza)) return null;

  const level = parseDifficultyLevel(word.level);
  const sinonimoak = uniqueNonEmptyStrings(
    parseSynonyms(word.sinonimoak)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.toLowerCase() !== hitza.toLowerCase() && !isPlaceholderTerm(item))
  );

  if (sinonimoak.length === 0) return null;

  return {
    id: word.id,
    hitza,
    sinonimoak,
    level,
    source: word.source ?? 'local',
    remoteIdField: word.remoteIdField,
    remoteWordField: word.remoteWordField,
    remoteSynonymsField: word.remoteSynonymsField,
    remoteLevelField: word.remoteLevelField,
    remoteRow: word.remoteRow,
  };
};

export const normalizeWordRow = (
  row: Record<string, unknown>,
  index: number,
  source: WordSource = 'remote'
): WordData | null => {
  const wordField = getFirstExistingKey(row, WORD_KEY_CANDIDATES);
  const synonymField = getFirstExistingKey(row, SYNONYM_KEY_CANDIDATES);
  const levelField = getFirstExistingKey(row, LEVEL_KEY_CANDIDATES);
  const idField = getFirstExistingKey(row, ID_KEY_CANDIDATES);

  const hitza = toStringValue(getFirstValue(row, WORD_KEY_CANDIDATES));
  if (!hitza || isPlaceholderTerm(hitza)) return null;

  const sinonimoak = uniqueNonEmptyStrings(
    parseSynonyms(getFirstValue(row, SYNONYM_KEY_CANDIDATES))
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.toLowerCase() !== hitza.toLowerCase() && !isPlaceholderTerm(item))
  );
  if (sinonimoak.length === 0) return null;

  const rawId = getFirstValue(row, ID_KEY_CANDIDATES);
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? rawId : `${hitza}-${index}`;

  return {
    id,
    hitza,
    sinonimoak,
    level: parseDifficultyLevel(getFirstValue(row, LEVEL_KEY_CANDIDATES)),
    source,
    remoteIdField: idField ?? undefined,
    remoteWordField: wordField ?? undefined,
    remoteSynonymsField: synonymField ?? undefined,
    remoteLevelField: levelField ?? undefined,
    remoteRow: row,
  };
};

export const mergeWords = (...lists: WordData[][]): WordData[] => {
  const merged = new Map<string, WordData>();

  for (const list of lists) {
    for (const candidate of list) {
      const normalized = normalizeWord(candidate);
      if (!normalized) continue;

      const key = normalized.hitza.trim().toLowerCase();
      const current = merged.get(key);
      if (!current) {
        merged.set(key, normalized);
        continue;
      }

      const source = current.source === 'remote' || normalized.source === 'remote' ? 'remote' : normalized.source ?? current.source;
        merged.set(key, {
          ...current,
          id: current.source === 'remote' ? current.id : normalized.id,
          sinonimoak: uniqueNonEmptyStrings([...current.sinonimoak, ...normalized.sinonimoak]),
          level: current.level ?? normalized.level ?? null,
          source,
          remoteIdField: current.remoteIdField ?? normalized.remoteIdField,
          remoteWordField: current.remoteWordField ?? normalized.remoteWordField,
          remoteSynonymsField: current.remoteSynonymsField ?? normalized.remoteSynonymsField,
          remoteLevelField: current.remoteLevelField ?? normalized.remoteLevelField,
          remoteRow: current.remoteRow ?? normalized.remoteRow,
        });
      }
  }

  return Array.from(merged.values()).sort((left, right) => left.hitza.localeCompare(right.hitza, 'eu'));
};

export const getWordType = (word: string): string => {
  const normalized = word.toLowerCase().trim();
  if (normalized.endsWith('tu') || normalized.endsWith('du') || normalized.endsWith('ten') || normalized.endsWith('tzen')) return 'verb';
  if (normalized.endsWith('ak') || normalized.endsWith('ek')) return 'plural';
  if (normalized.endsWith('era') || normalized.endsWith('ura') || normalized.endsWith('tasun')) return 'abstract';
  return 'other';
};

export const sanitizePlayerName = (value: string, fallback: string): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  return trimmed.slice(0, 24);
};

export const formatPlayerLabel = (player: { emoji: string; name: string }): string => `${player.emoji} ${player.name}`.trim();
