// localStorage access that never throws.
//
// Reading the `localStorage` global itself throws a SecurityError when the
// browser blocks site data (third-party embeds, "block all cookies",
// some privacy modes), so a `localStorage && ...` guard is not enough: the
// guard is what throws. On the render path that blanks the whole app
// (Sentry JAVASCRIPT-REACT-75). These helpers degrade to "nothing stored".

export function getStoredItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStoredItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
