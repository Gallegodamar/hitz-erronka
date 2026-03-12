import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GameStatus } from './types';
import { useAppStore } from './store/useAppStore';
import { useWordsStore } from './store/useWordsStore';

// Screens
import { SetupScreen } from './screens/SetupScreen';
import { WordsManagerScreen } from './screens/WordsManagerScreen';
import { IntermissionScreen } from './screens/IntermissionScreen';
import { GameplayScreen } from './screens/GameplayScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { ReviewScreen } from './screens/ReviewScreen';

const PageWrapper = ({ children, keyId }: { children: ReactNode; keyId: string }) => (
  <motion.div
    key={keyId}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98 }}
    transition={{ duration: 0.25, ease: 'easeInOut' }}
    className="h-full w-full absolute inset-0"
  >
    {children}
  </motion.div>
);

const App = () => {
  const { status } = useAppStore();
  const { refreshWords } = useWordsStore();

  useEffect(() => {
    refreshWords();
  }, [refreshWords]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        {status === GameStatus.SETUP && <PageWrapper keyId="setup"><SetupScreen /></PageWrapper>}
        {status === GameStatus.WORDS_MANAGER && <PageWrapper keyId="words_manager"><WordsManagerScreen /></PageWrapper>}
        {status === GameStatus.INTERMISSION && <PageWrapper keyId="intermission"><IntermissionScreen /></PageWrapper>}
        {status === GameStatus.PLAYING && <PageWrapper keyId="playing"><GameplayScreen /></PageWrapper>}
        {status === GameStatus.SUMMARY && <PageWrapper keyId="summary"><SummaryScreen /></PageWrapper>}
        {status === GameStatus.ANALYTICS && <PageWrapper keyId="analytics"><AnalyticsScreen /></PageWrapper>}
        {status === GameStatus.REVIEW && <PageWrapper keyId="review"><ReviewScreen /></PageWrapper>}
      </AnimatePresence>
    </div>
  );
};

export default App;
