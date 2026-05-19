export function copyPuzzleId(
  pid,
  clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
) {
  if (!pid || !clipboard?.writeText) return false;
  clipboard.writeText(String(pid));
  return true;
}
