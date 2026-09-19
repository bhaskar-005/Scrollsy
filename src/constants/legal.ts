/**
 * Where the legal pages live. Both are served by the site in `web/`, so they
 * ship and change with the rest of it rather than living somewhere nobody
 * remembers to update.
 *
 * The stores reject a login screen whose terms and privacy links go nowhere,
 * and Play removes an app that uses an Accessibility Service without saying
 * what it is for, which the privacy page does.
 */
/**
 * Typed as an absolute URL, because expo-router's typed routes only accept a
 * link out of the app when it can see a scheme in the type.
 */
type ExternalUrl = `https://${string}`;

const configured = process.env.EXPO_PUBLIC_SITE_URL;
const site: ExternalUrl = configured?.startsWith('https://')
  ? (configured as ExternalUrl)
  : 'https://scrollsy.app';

export const Legal = {
  terms: `${site}/terms`,
  privacy: `${site}/privacy`,
  /** Where the rate row sends people. Live once the listing is published. */
  store: 'https://play.google.com/store/apps/details?id=com.scrollsy.app',
} as const;
