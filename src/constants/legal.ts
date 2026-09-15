/**
 * Where the legal pages live. Both are placeholders. The stores reject a login
 * screen whose terms and privacy links go nowhere, so these have to point at
 * real published pages before the first submission.
 */
export const Legal = {
  terms: 'https://example.com/terms',
  privacy: 'https://example.com/privacy',
  /** Where the rate row sends people. Placeholder until the listing is live. */
  store: 'https://play.google.com/store/apps/details?id=com.scrollsy.app',
} as const;
