// Remembers which chat panes (puzzle info, players) the user has collapsed.
//
// Choices are kept per layout: collapsing the puzzle info on a phone, where the
// chat shares the screen with the keyboard, says nothing about whether you want
// it collapsed in the desktop sidebar. Until the user picks, mobile starts
// collapsed (the panes otherwise push the messages off screen) and desktop
// starts expanded.

export const COLLAPSE_PREFS_KEY = 'chat_collapsed_panes';

const layoutOf = (mobile) => (mobile ? 'mobile' : 'desktop');

// Reading window.localStorage itself throws when site data is blocked, so it
// is resolved inside the callers' try blocks rather than as a default param.
const resolveStorage = (storage) => {
  if (storage !== undefined) return storage;
  return typeof window === 'undefined' ? null : window.localStorage;
};

export function readCollapsePrefs(storage) {
  try {
    const parsed = JSON.parse(resolveStorage(storage)?.getItem(COLLAPSE_PREFS_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isPaneCollapsed(prefs, pane, mobile) {
  const stored = prefs?.[layoutOf(mobile)]?.[pane];
  return typeof stored === 'boolean' ? stored : !!mobile;
}

// Returns the new prefs object; persisting is best-effort (private mode,
// quota) since losing the choice only means the default comes back.
export function setPaneCollapsed(prefs, pane, mobile, collapsed, storage) {
  const layout = layoutOf(mobile);
  const next = {...prefs, [layout]: {...prefs?.[layout], [pane]: collapsed}};
  try {
    resolveStorage(storage)?.setItem(COLLAPSE_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
