import 'expo-sqlite/localStorage/install';

/**
 * Light or dark, when someone has picked one. Kept on the device only: it is a
 * property of this phone, not of the account, and a person who prefers dark on
 * their phone at night does not want that carried to a tablet.
 *
 * Until they pick, `system` means whatever the phone itself is set to.
 */

export type Appearance = 'system' | 'light' | 'dark';

const Key = 'appearance';

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readAppearance(): Appearance {
  const stored = localStorage.getItem(Key);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function setAppearance(value: Appearance): void {
  if (value === 'system') {
    localStorage.removeItem(Key);
  } else {
    localStorage.setItem(Key, value);
  }
  listeners.forEach((listener) => listener());
}
