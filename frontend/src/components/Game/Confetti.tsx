import React, {useState, useEffect, useCallback, lazy, Suspense} from 'react';

// Lazy load react-confetti to reduce initial bundle size
const Confetti = lazy(() => import('react-confetti'));

const ConfettiComponent: React.FC = () => {
  const [done, setDone] = useState<boolean>(false);
  const [numberOfPieces, setNumberOfPieces] = useState<number>(200);

  const handleConfettiComplete = useCallback(() => {
    setDone(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNumberOfPieces(0);
    }, 7000);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (done) return null;
  return (
    <Suspense fallback={null}>
      <Confetti numberOfPieces={numberOfPieces} onConfettiComplete={handleConfettiComplete} />
    </Suspense>
  );
};

export default ConfettiComponent;
