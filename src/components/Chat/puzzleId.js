export async function copyPuzzleId(
  pid,
  clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
) {
  if (!pid || !clipboard?.writeText) return false;
  try {
    await clipboard.writeText(String(pid));
    return true;
  } catch (_e) {
    return false;
  }
}
