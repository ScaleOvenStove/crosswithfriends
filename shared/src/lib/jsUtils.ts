import React from 'react';

function toArr<T>(a: T[] | Record<string, T>): (T | undefined)[] {
  if (Array.isArray(a)) return a;
  const ret: (T | undefined)[] = [];
  Object.keys(a).forEach((i) => {
    ret[Number(i)] = a[i];
  });
  return ret;
}

function hasShape(obj: unknown, shape: unknown): boolean {
  if (typeof obj !== typeof shape) {
    return false;
  }
  if (typeof obj === 'object' && obj !== null && typeof shape === 'object' && shape !== null) {
    return Object.keys(shape).every((key) => {
      if ((obj as Record<string, unknown>)[key] === undefined) {
        return false;
      }
      return hasShape((obj as Record<string, unknown>)[key], (shape as Record<string, unknown>)[key]);
    });
  }
  return true;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const r = Number(`0x${hex.substring(1, 3)}`);
  const g = Number(`0x${hex.substring(3, 5)}`);
  const b = Number(`0x${hex.substring(5, 7)}`);
  return [r, g, b];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const [R, G, B] = [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0'));
  return `#${R}${G}${B}`;
};

export function colorAverage(hex1: string, hex2: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const r = r1 * (1 - weight) + r2 * weight;
  const g = g1 * (1 - weight) + g2 * weight;
  const b = b1 * (1 - weight) + b2 * weight;
  return rgbToHex(r, g, b);
}

// Add requestIdleCallback polyfill for environments that don't support it
if (typeof window !== 'undefined') {
  window.requestIdleCallback =
    window.requestIdleCallback ||
    function (callback: IdleRequestCallback): number {
      const start = Date.now();
      return setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining() {
            return Math.max(0, 50 - (Date.now() - start));
          },
        } as IdleDeadline);
      }, 1) as unknown as number;
    };

  window.cancelIdleCallback =
    window.cancelIdleCallback ||
    function (id: number): void {
      clearTimeout(id);
    };
}

const idleCallbacks: Record<string, number> = {};

function lazy(id: string, cbk: () => void, minWait = 0): void {
  if (typeof window === 'undefined') return; // Skip in non-browser environments

  if (idleCallbacks[id] && window.cancelIdleCallback) {
    window.cancelIdleCallback(idleCallbacks[id]);
  }

  if (!window.requestIdleCallback) return;

  const idleCallback = window.requestIdleCallback((deadline) => {
    if (deadline.didTimeout) return;
    setTimeout(() => {
      if (idleCallbacks[id] === idleCallback) {
        cbk();
      }
      // else callback was overridden
    }, minWait);
  });
  idleCallbacks[id] = idleCallback;
}

function rand_int(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rand_color(): string {
  let h = rand_int(1, 360);
  while ((h >= 50 && h <= 70) || (h >= 190 && h <= 210)) {
    // Avoid yellow and blue
    h = rand_int(1, 360);
  }
  const s = rand_int(40, 40);
  const l = rand_int(60, 80);
  return `hsl(${h},${s}%,${l}%)`;
}

function pure<P = Record<string, unknown>>(
  func: (props: P, context?: unknown) => React.ReactElement | null
): React.ComponentClass<P> {
  class PureComponentWrap extends React.PureComponent<P> {
    render(): React.ReactElement | null {
      return func(this.props, this.context);
    }
  }
  return PureComponentWrap;
}

function isAncestor(a: Element | null, b: Element | null): boolean {
  if (!b) return false;
  if (a === b) return true;
  return isAncestor(a, b.parentElement);
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;

  if (navigator.userAgent.match(/Tablet|iPad/i)) {
    return true;
  }
  if (
    navigator.userAgent.match(
      /Mobile|Windows Phone|Lumia|Android|webOS|iPhone|iPod|Blackberry|PlayBook|BB10|Opera Mini|\bCrMo\/|Opera Mobi/i
    )
  ) {
    return true;
  }
  return false;
}

// from https://jsfiddle.net/koldev/cW7W5/
function downloadBlob(data: BlobPart, fileName: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    console.warn('downloadBlob can only be used in browser environments');
    return;
  }

  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style.display = 'none';
  const blob = new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

export {hasShape, toArr, lazy, rand_int, rand_color, pure, isAncestor, isMobile, downloadBlob};
