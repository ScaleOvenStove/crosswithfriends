const defaultClipboard = () => (typeof navigator !== 'undefined' ? navigator.clipboard : undefined);

// Clipboard writes reject when the browser withholds permission (Safari
// outside a fresh user gesture, embedded frames, privacy settings). Resolve
// to false instead so callers don't leak an unhandled rejection
// (Sentry JAVASCRIPT-REACT-2S) and can skip their "copied" feedback.
export async function copyText(text, clipboard = defaultClipboard()) {
  if (!text || !clipboard?.writeText) return false;
  try {
    await clipboard.writeText(String(text));
    return true;
  } catch (_e) {
    return false;
  }
}

export async function copyPuzzleId(pid, clipboard = defaultClipboard()) {
  return copyText(pid, clipboard);
}
