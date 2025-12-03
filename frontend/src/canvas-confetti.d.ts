declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    ticks?: number;
    origin?: {
      x?: number;
      y?: number;
    };
    colors?: string[];
    shapes?: Array<'square' | 'circle'>;
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface CreateOptions {
    resize?: boolean;
    useWorker?: boolean;
  }

  type ConfettiFunction = (options?: ConfettiOptions) => Promise<null> | null;

  interface Confetti {
    (options?: ConfettiOptions): Promise<null> | null;
    create: (canvas: HTMLCanvasElement, options?: CreateOptions) => ConfettiFunction;
    reset: () => void;
  }

  const confetti: Confetti;
  export default confetti;
}
