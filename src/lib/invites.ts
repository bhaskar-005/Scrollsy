import 'expo-sqlite/localStorage/install';

import * as Application from 'expo-application';

import { ApiError, api, apiConfigured, isSignedIn } from '@/lib/api';

/**
 * An invite arrives from the website's link, which can be long before there is
 * an account to accept it with. The code waits on the device until there is.
 */

/** Twelve hex characters, the codes `create_invite` makes in the migration. */
const CodePattern = /^[0-9a-f]{12}$/;

const Key = 'invite.pending';

/** Set once the Play referrer has been read, so it is never asked for twice. */
const ClaimedKey = 'invite.referrerClaimed';

/**
 * Where an invite link points. The website in /web serves it, works out
 * whether the phone has the app, and sends it either into the app or to the
 * Play listing carrying the code.
 */
const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://scrollsy.pages.dev';

/**
 * A live invite link for the person signed in. The server reuses one code
 * until it is close to expiring, so a link already in a group chat keeps
 * working rather than being replaced every time this is called.
 */
export async function createInviteLink(): Promise<string> {
  const { code } = await api<{ code: string }>('/invites', { method: 'POST' });
  return `${siteUrl}/invite/${code}`;
}

/** Keeps a code from a link. Returns whether it was one. */
export function savePendingInvite(code: string): boolean {
  if (!CodePattern.test(code)) {
    return false;
  }
  localStorage.setItem(Key, code);
  return true;
}

export function pendingInvite(): string | null {
  const code = localStorage.getItem(Key);
  return code && CodePattern.test(code) ? code : null;
}

/**
 * Accepts a waiting invite, once there is a session to accept it with. Called
 * at launch and when a link arrives.
 *
 * The code is kept when the failure is worth another try, and dropped when the
 * answer will never change. A full friend list is one of those, and right now
 * that is silent: telling someone their friend list is full, and selling them
 * the plan that lifts it, still needs a screen. See docs/checklist.md.
 */
export async function acceptPendingInvite(): Promise<void> {
  const code = pendingInvite();
  if (!code || !apiConfigured || !isSignedIn()) {
    return;
  }

  try {
    await api(`/invites/${code}/accept`, { method: 'POST' });
    localStorage.removeItem(Key);
  } catch (error) {
    const worthRetrying =
      !(error instanceof ApiError) || error.status === 401 || error.status === 429 || error.status >= 500;
    if (!worthRetrying) {
      localStorage.removeItem(Key);
    }
  }
}

/**
 * The invite of someone who had no app to open.
 *
 * Tapping an invite without Scrollsy installed goes to Play rather than into
 * the app, so the code cannot arrive as a link. It rides along as the install
 * referrer instead, which the website puts there, and Play hands it back the
 * first time the app runs. Without this the invite is lost at exactly the
 * moment it worked, and the person who installed lands in nobody's battle.
 *
 * Asked once and never again, because the answer cannot change and reaching
 * Play's service is a real call. A code already waiting wins: it came from a
 * link opened just now, which is fresher than how this phone was installed.
 */
export async function claimInstallReferrer(): Promise<void> {
  if (localStorage.getItem(ClaimedKey) === 'true' || pendingInvite()) {
    return;
  }

  let referrer = '';
  try {
    referrer = await Application.getInstallReferrerAsync();
  } catch {
    /**
     * Sideloaded, a development build, or Play had nothing to say. None of
     * those can start working later, so the question is closed either way.
     */
    localStorage.setItem(ClaimedKey, 'true');
    return;
  }

  localStorage.setItem(ClaimedKey, 'true');

  /** `invite=<code>` among whatever else Play tacked on, so it is parsed, not matched. */
  const code = new URLSearchParams(referrer).get('invite');
  if (code) {
    savePendingInvite(code);
  }
}
