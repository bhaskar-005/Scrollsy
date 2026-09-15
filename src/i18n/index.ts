/**
 * Every string a person can read lives in `locales/*.json`, never in a screen.
 * Add a key there, then pull it through `t()`.
 */
import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';

import en from '@/i18n/locales/en.json';

const i18n = new I18n({ en });

i18n.defaultLocale = 'en';
i18n.locale = getLocales()[0]?.languageCode ?? 'en';
/** A key missing from a translation falls back to English rather than breaking. */
i18n.enableFallback = true;

type Join<K, P> = K extends string
  ? P extends string
    ? P extends ''
      ? K
      : `${K}.${P}`
    : never
  : never;

type Paths<T> = T extends string
  ? ''
  : { [K in keyof T & string]: Join<K, Paths<T[K]>> }[keyof T & string];

/** Dot path into en.json, so a typo is a compile error rather than a blank label. */
export type TranslationKey = Paths<typeof en>;

export function t(key: TranslationKey, options?: TranslateOptions): string {
  return i18n.t(key, options);
}

export default i18n;
