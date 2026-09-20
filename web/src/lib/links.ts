/**
 * Links into the app and the store. Pure, so they are tested on their own, see
 * test/links.test.ts.
 */

/** Must match the invite codes `create_invite` makes in the migration. */
export const InviteCodePattern = /^[0-9a-f]{12}$/;

/** The app's own URL scheme, from `scheme` in app.json. */
const AppScheme = 'scrollsy';

/**
 * The Play listing. With an invite code, it rides along as the install
 * referrer, so the app can still find the invite after a fresh install.
 */
export function playStoreUrl(androidPackage: string, inviteCode?: string): string {
  const url = new URL('https://play.google.com/store/apps/details');
  url.searchParams.set('id', androidPackage);
  if (inviteCode) {
    url.searchParams.set('referrer', `invite=${inviteCode}`);
  }
  return url.toString();
}

/**
 * One link that does the right thing on Android either way. Chrome opens the
 * app straight onto the invite when it is installed, and goes to the fallback,
 * the Play listing carrying the code, when it is not. A plain `scrollsy://`
 * link would do nothing at all for someone without the app.
 */
export function androidIntentUrl(androidPackage: string, inviteCode: string, fallbackUrl: string): string {
  return (
    `intent://invite/${inviteCode}#Intent;scheme=${AppScheme};package=${androidPackage};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
  );
}

export function isAndroid(userAgent: string | null): boolean {
  return /Android/i.test(userAgent ?? '');
}

/** What the invite page shows for a name. First name only, the way the app's podium does. */
export function inviterFirstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/**
 * The code out of an invite URL's path.
 *
 * One static page answers for every invite, so the code never reaches a server
 * and the page has to read it out of the address bar itself. Anything that is
 * not a real code comes back empty rather than being passed on to the API.
 */
export function inviteCodeFromPath(pathname: string): string {
  const found = pathname.match(/\/invite\/([^/?#]+)/)?.[1] ?? '';
  return InviteCodePattern.test(found) ? found : '';
}
