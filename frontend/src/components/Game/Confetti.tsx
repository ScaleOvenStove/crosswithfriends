import React, {useState, useEffect} from 'react';
import Confetti from 'react-confetti';

const ConfettiComponent: React.FC = () => {
  const [done, setDone] = useState<boolean>(false);
  const [numberOfPieces, setNumberOfPieces] = useState<number>(200);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNumberOfPieces(0);
    }, 7000);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  if (done) return null;
  return <Confetti numberOfPieces={numberOfPieces} onConfettiComplete={() => setDone(true)} />;
};

export default ConfettiComponent;
