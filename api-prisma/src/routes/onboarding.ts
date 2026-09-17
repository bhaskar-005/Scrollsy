import { Hono } from 'hono';

import { UuidPattern, isOnboardingStep, tokenOf } from '../contract.ts';
import { verifiedCaller } from '../auth.ts';
import type { AppEnv } from '../env.ts';
import { invalid, noContent, rateLimited, readBody } from '../http.ts';
import { furthestOf, mayWriteProgress, mergeProgress } from '../rules.ts';

/**
 * Onboarding progress, which starts before there is an account, so these routes
 * take a token when there is one and work without it when there is not.
 */
async function callerOf(c: { req: { header(name: string): string | undefined }; env: AppEnv['Bindings'] }) {
  const token = tokenOf(c.req.header('Authorization'));
  return token ? ((await verifiedCaller(c.env, token))?.userId ?? null) : null;
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

    const userId = await callerOf(c);
    const [existing] = await c.var.store.progress(installId, null);

    /** An install that belongs to an account is only theirs to move. */
    if (!mayWriteProgress(existing ?? null, userId)) {
      return noContent(c);
    }

    await c.var.store.writeProgress(installId, mergeProgress(existing ?? null, step, userId, new Date()));
    return noContent(c);
  })

  /** Where to pick up. `step` is null when this install and account are both new. */
  .get('/progress', async (c) => {
    const installId = c.req.query('installId') ?? '';
    if (!UuidPattern.test(installId)) {
      return invalid(c);
    }

    const { success } = await c.env.PUBLIC_LIMIT.limit({ key: `install:${installId}` });
    if (!success) {
      return rateLimited(c);
    }

    const rows = await c.var.store.progress(installId, await callerOf(c));
    const furthest = furthestOf(rows);
    return c.json({ step: furthest?.step ?? null, completed: furthest?.completed ?? false });
  });
