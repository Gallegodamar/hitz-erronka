import { Question, WordData, WordPerformance } from './types';
import { createStableId, getWordType, shuffleArray, uniqueNonEmptyStrings } from './wordUtils';

const buildDistractors = (word: WordData, pool: WordData[]): string[] => {
  const allTerms = uniqueNonEmptyStrings(
    pool.flatMap((entry) => [entry.hitza, ...entry.sinonimoak]).filter((term) => term.toLowerCase() !== word.hitza.toLowerCase())
  ).filter((term) => !word.sinonimoak.some((synonym) => synonym.toLowerCase() === term.toLowerCase()));

  const targetType = getWordType(word.hitza);
  const sameType = shuffleArray(allTerms.filter((term) => getWordType(term) === targetType));
  const fallback = shuffleArray(allTerms.filter((term) => getWordType(term) !== targetType));

  return [...sameType, ...fallback].slice(0, 3);
};

const buildQuestion = (word: WordData, pool: WordData[], priority: number): Question | null => {
  const synonyms = uniqueNonEmptyStrings(word.sinonimoak);
  if (synonyms.length === 0) return null;

  const correctAnswer = synonyms[Math.floor(Math.random() * synonyms.length)];
  const distractors = buildDistractors(word, pool);
  const options = shuffleArray(uniqueNonEmptyStrings([correctAnswer, ...distractors])).slice(0, 4);
  if (options.length < 2) return null;

  return {
    id: createStableId('question'),
    wordData: word,
    correctAnswer,
    options,
    priority,
  };
};

const rankWords = (words: WordData[], performanceMap: Map<string, WordPerformance>): Array<{ word: WordData; priority: number }> =>
  words
    .map((word) => {
      const stats = performanceMap.get(word.hitza.trim().toLowerCase());
      const priority = stats ? stats.priority : 2 + Math.random();
      return {
        word,
        priority,
      };
    })
    .sort((left, right) => right.priority - left.priority || left.word.hitza.localeCompare(right.word.hitza, 'eu'));

export const generateAdaptiveQuestionPool = (
  needed: number,
  poolSource: WordData[],
  performanceMap: Map<string, WordPerformance>
): Question[] => {
  if (needed <= 0 || poolSource.length === 0) return [];

  const uniqueWords = Array.from(new Map(poolSource.map((word) => [word.hitza.trim().toLowerCase(), word])).values());
  const rankedWords = rankWords(uniqueWords, performanceMap);
  const selectedWords: Array<{ word: WordData; priority: number }> = [];

  let cycle = 0;
  while (selectedWords.length < needed) {
    const cycleWords = rankedWords
      .map((entry) => ({
        word: entry.word,
        priority: entry.priority + Math.random() * 0.6 - cycle * 0.05,
      }))
      .sort((left, right) => right.priority - left.priority || Math.random() - 0.5);

    for (const entry of cycleWords) {
      selectedWords.push(entry);
      if (selectedWords.length >= needed) break;
    }
    cycle += 1;
  }

  return selectedWords
    .map((entry) => buildQuestion(entry.word, uniqueWords, entry.priority))
    .filter((question): question is Question => question !== null);
};

export const countRepeatedWords = (questions: Question[]): number => {
  const uniqueWords = new Set(questions.map((question) => question.wordData.hitza.trim().toLowerCase()));
  return questions.length - uniqueWords.size;
};
