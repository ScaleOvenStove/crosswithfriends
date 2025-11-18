import React, {useState, useEffect, useCallback} from 'react';
import Confetti from 'react-confetti';

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
  return <Confetti numberOfPieces={numberOfPieces} onConfettiComplete={handleConfettiComplete} />;
};

export default ConfettiComponent;
