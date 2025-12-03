import confetti from 'canvas-confetti';
import React, {useEffect, useRef} from 'react';

const ConfettiComponent: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiInstanceRef = useRef<ReturnType<typeof confetti.create> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Create confetti instance bound to our canvas
    confettiInstanceRef.current = confetti.create(canvas, {
      resize: true,
      useWorker: true,
    });

    // Set initial canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Launch confetti with similar settings to react-confetti (200 pieces)
    const particleCount = 200;
    const spread = 70;

    // Launch confetti from multiple positions for better coverage
    const myConfetti = confettiInstanceRef.current;
    myConfetti({
      particleCount: Math.floor(particleCount / 4),
      angle: 60,
      spread: spread,
      origin: {x: 0},
    });
    myConfetti({
      particleCount: Math.floor(particleCount / 4),
      angle: 120,
      spread: spread,
      origin: {x: 1},
    });
    myConfetti({
      particleCount: Math.floor(particleCount / 2),
      spread: spread,
      origin: {y: 0.6},
    });

    // Handle window resize
    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    const cleanup = (): void => {
      window.removeEventListener('resize', handleResize);
      // Clear the canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      confettiInstanceRef.current = null;
    };

    return cleanup;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
};

export default ConfettiComponent;
