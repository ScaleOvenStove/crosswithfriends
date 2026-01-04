let redirected = false;

export default (url, message) => {
  if (redirected) return;
  redirected = true;
  if (message) alert(message);
  window.location.replace(url);
};

// Export a function to reset the redirected state (for testing)
export function resetRedirectState() {
  redirected = false;
}
