import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Who someone is, decided here and nowhere else.
 *
 * Google proves the person owns the account, once, at sign in. After that this
 * Worker issues its own session tokens and verifies them on every request.
 * Nothing downstream re-checks: Postgres is handed an id it trusts, because
 * the only way to reach Postgres is through this file.
 *
 * Google is therefore only an identity provider, not the session. Swapping it,
 * or adding a second one, changes `verifyGoogleIdToken` and leaves the rest.
 */

/** Google's own keys, cached per isolate. `jose` refreshes them on its own. */
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** Both spellings Google uses for the issuer, depending on the client. */
const GoogleIssuers = ['https://accounts.google.com', 'accounts.google.com'];

/** Long enough to be worth caching, short enough that revoking bites. */
const AccessMinutes = 60;

/** How long a phone can be left alone and still resume without signing in. */
export const RefreshDays = 60;

export type GoogleIdentity = {
  /** Google's subject, stable for the life of the account. */
  sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

/**
 * Checks a Google ID token from the phone, and answers with who it names.
 *
 * The audience check is the part that matters: without it any valid Google
 * token, including one minted for an unrelated app, would sign someone in here.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<GoogleIdentity | null> {
  try {
    const { payload } = await jwtVerify(idToken, googleKeys, {
      issuer: GoogleIssuers,
      audience: clientId,
    });

    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) {
      return null;
    }

    const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
    return {
      sub,
      /** An unverified address is not proof of anything, so it is not kept. */
      email: payload.email_verified === true ? text(payload.email) : null,
      name: text(payload.name),
      picture: text(payload.picture),
    };
  } catch {
    // Expired, forged, or minted for another app.
    return null;
  }
}

const secretOf = (secret: string) => new TextEncoder().encode(secret);

/** Seconds since the epoch, which is what the app stores and compares against. */
export function accessExpiresAt(): number {
  return Math.floor(Date.now() / 1000) + AccessMinutes * 60;
}

/** A session token naming one account, signed by this Worker. */
export async function issueAccessToken(
  userId: string,
  secret: string,
  expiresAt: number,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretOf(secret));
}

/** The account a token names, or null if it does not verify. */
export async function readAccessToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretOf(secret));
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are random rather than signed, so the only way one works is
 * for its row to still be in the database. That is what makes signing out, and
 * rotation, actually end a session.
 */
export function newRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** What is stored for a refresh token. The token itself is never written down. */
export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function refreshExpiresAt(): Date {
  return new Date(Date.now() + RefreshDays * 24 * 60 * 60 * 1000);
}
