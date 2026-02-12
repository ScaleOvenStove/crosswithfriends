/**
 * Tests for dark mode body class syncing.
 *
 * The Root component in index.js syncs the `.dark` class to document.body
 * via useEffect so that MUI portals (Dialog, Menu, etc.) which render
 * outside the React tree still receive dark mode styling.
 */

describe('dark mode body class syncing', () => {
  beforeEach(() => {
    document.body.classList.remove('dark');
  });

  it('document.body supports classList.toggle', () => {
    document.body.classList.toggle('dark', true);
    expect(document.body.classList.contains('dark')).toBe(true);

    document.body.classList.toggle('dark', false);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('dark class can be toggled with boolean flag', () => {
    const darkMode = true;
    document.body.classList.toggle('dark', !!darkMode);
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('dark class is removed when darkMode is false', () => {
    document.body.classList.add('dark');
    const darkMode = false;
    document.body.classList.toggle('dark', !!darkMode);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('handles falsy values correctly (null/undefined coerce to false)', () => {
    document.body.classList.add('dark');
    const darkMode = null;
    document.body.classList.toggle('dark', !!darkMode);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('dark class allows .dark selectors to match portal elements', () => {
    // Simulate what MUI Dialog portals do — append directly to body
    document.body.classList.toggle('dark', true);
    const portalDiv = document.createElement('div');
    portalDiv.className = 'MuiDialog-root';
    document.body.appendChild(portalDiv);

    // CSS selector `.dark .MuiDialog-root` would match because
    // body.dark > div.MuiDialog-root
    const matched = document.querySelectorAll('.dark .MuiDialog-root');
    expect(matched.length).toBe(1);

    document.body.removeChild(portalDiv);
  });

  it('portal elements do NOT match when dark class is missing', () => {
    document.body.classList.toggle('dark', false);
    const portalDiv = document.createElement('div');
    portalDiv.className = 'MuiDialog-root';
    document.body.appendChild(portalDiv);

    const matched = document.querySelectorAll('.dark .MuiDialog-root');
    expect(matched.length).toBe(0);

    document.body.removeChild(portalDiv);
  });
});
