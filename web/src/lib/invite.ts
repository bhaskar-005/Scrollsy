import { env } from 'cloudflare:workers';

import { InviteCodePattern } from './links';

export type Inviter = { name: string; avatarUrl: string | null };

/**
 * Three outcomes, not two, so an outage never tells someone their friend's
 * link has run out when it has not.
 */
export type InviteLookup =
  | { status: 'found'; inviter: Inviter }
  | { status: 'missing' }
  | { status: 'unavailable' };

/**
 * Asks the API who sent an invite, Worker to Worker through the service
 * binding, so the call never leaves Cloudflare. Locally, run the API's own
 * `npm run dev` alongside this site's and Wrangler connects the two.
 */
export async function lookUpInvite(code: string): Promise<InviteLookup> {
  if (!InviteCodePattern.test(code)) {
    return { status: 'missing' };
  }

  const url = `${env.API_URL}/invites/${code}`;
  try {
    const response = await env.API.fetch(url);
    if (response.status === 404) {
      return { status: 'missing' };
    }
    if (!response.ok) {
      return { status: 'unavailable' };
    }
    return { status: 'found', inviter: (await response.json()) as Inviter };
  } catch {
    return { status: 'unavailable' };
  }
}
