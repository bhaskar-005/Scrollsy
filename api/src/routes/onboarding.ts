import { Hono, type Context } from 'hono';

import { publicClient, userClient } from '../clients.ts';
import { UuidPattern, isOnboardingStep, tokenOf } from '../contract.ts';
import type { AppEnv } from '../env.ts';
import { failure, invalid, noContent, rateLimited, readBody } from '../http.ts';

/**
 * Onboarding progress, so a person resumes where they stopped and the funnel
 * shows where people leave. Works signed out, because the first step is the
 * sign in. With a token it acts as that person, which is what links the
 * install to their account.
 *
 * Limited per install id, the one identity that exists before an account does.
 */
function clientFor(c: Context<AppEnv>) {
  const authorization = c.req.header('Authorization');
  return authorization && tokenOf(authorization)
    ? userClient(c.env, authorization)
    : publicClient(c.env);
}

export const onboarding = new Hono<AppEnv>()
  .post('/progress', async (c) => {
    const body = await readBody(c);
    const installId = body?.installId;
    const step = body?.step;
    if (typeof installId !== 'string' || !UuidPattern.test(installId) || !isOnboardingStep(step)) {
      return invalid(c);
    }

    const { success } = await c.env.PUBLIC_LIMIT.limit({ key: `install:${installId}` });
    if (!success) {
      return rateLimited(c);
    }

    const { error } = await clientFor(c).rpc('record_onboarding_step', {
      p_install_id: installId,
      p_step: step,
    });
    return error ? failure(c, error) : noContent(c);
  })

  /** Where to pick up. `step` is null when this install and account are new. */
  .get('/progress', async (c) => {
    const installId = c.req.query('installId') ?? '';
    if (!UuidPattern.test(installId)) {
      return invalid(c);
    }

    const { success } = await c.env.PUBLIC_LIMIT.limit({ key: `install:${installId}` });
    if (!success) {
      return rateLimited(c);
    }

    const { data, error } = await clientFor(c).rpc('onboarding_resume', { p_install_id: installId });
    if (error) {
      return failure(c, error);
    }

    const row = ((data ?? []) as { step: string; completed: boolean }[])[0];
    return c.json({ step: row?.step ?? null, completed: row?.completed ?? false });
  });
