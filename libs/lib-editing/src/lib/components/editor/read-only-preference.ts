/**
 * An editor's choice to read rather than edit, remembered per browser.
 *
 * Storage can be missing (server render), blocked (private windows, some
 * privacy settings) or full, and none of that should stop the editor opening:
 * a read that fails reads as "not chosen", and a write that fails keeps the
 * choice for this page only.
 */
export const READ_ONLY_STORAGE_KEY = 'editor:read-only';

export const readReadOnlyPreference = (): boolean => {
  try {
    return window.localStorage.getItem(READ_ONLY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeReadOnlyPreference = (readOnly: boolean) => {
  try {
    if (readOnly) {
      window.localStorage.setItem(READ_ONLY_STORAGE_KEY, 'true');
    } else {
      window.localStorage.removeItem(READ_ONLY_STORAGE_KEY);
    }
  } catch {
    // Remembered for this page only.
  }
};
