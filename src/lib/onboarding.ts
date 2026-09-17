import 'expo-sqlite/localStorage/install';

import { randomUUID } from 'expo-crypto';
import type { Href } from 'expo-router';

import { ApiError, api, apiConfigured, isSignedIn } from '@/lib/api';

/**
 * Onboarding progress. Written on the device first, so launch resumes at once
 * and works offline, then sent to the server, so a person resumes on a new
 * phone and the team can see which step people leave at.
 *
 * Keyed by an install id, because the first step is signing in and there is no
 * account yet to key it on.
 */

/** In order. Must match `onboarding_step_rank` in the migration. */
export const OnboardingSteps = [
  'welcome',
  'concept',
  'permission',
  'notifications',
  'friends',
  'paywall',
  'done',
] as const;

export type OnboardingStep = (typeof OnboardingSteps)[number];

const Keys = {
  install: 'install.id',
  furthest: 'onboarding.furthest',
  unsent: 'onboarding.unsent',
} as const;

const Screens: Record<OnboardingStep, Href> = {
  welcome: '/onboarding/welcome',
  concept: '/onboarding/concept',
  permission: '/onboarding/permission',
  notifications: '/onboarding/notifications',
  friends: '/onboarding/friends',
  paywall: '/onboarding/paywall',
  done: '/home',
};

const rank = (step: OnboardingStep) => OnboardingSteps.indexOf(step);

function isStep(value: string | null): value is OnboardingStep {
  return value !== null && (OnboardingSteps as readonly string[]).includes(value);
}

/** Random, made once per install, never shown. Knowing it is what lets a caller write its progress. */
export function installId(): string {
  let id = localStorage.getItem(Keys.install);
  if (!id) {
    id = randomUUID();
    localStorage.setItem(Keys.install, id);
  }
  return id;
}

function furthestStep(): OnboardingStep | null {
  const step = localStorage.getItem(Keys.furthest);
  return isStep(step) ? step : null;
}

function raiseFurthest(step: OnboardingStep) {
  const furthest = furthestStep();
  if (!furthest || rank(step) > rank(furthest)) {
    localStorage.setItem(Keys.furthest, step);
  }
}

/** Whether this install has been all the way through onboarding. */
export function isOnboarded(): boolean {
  return furthestStep() === 'done';
}

/** Where launch should open: the furthest step this install reached, or Home once it is done. */
export function resumeHref(): Href {
  return Screens[furthestStep() ?? 'welcome'];
}

/**
 * Records reaching a step. The furthest step only moves forward, so replaying
 * onboarding from Settings never sends a finished person back through it.
 */
export function recordStep(step: OnboardingStep): void {
  raiseFurthest(step);
  localStorage.setItem(Keys.unsent, step);
  void flushOnboarding();
}

/**
 * Sends this install back to the start, for a sign out or a deleted account.
 * The install id stays, so the funnel still counts this phone as one person
 * rather than two.
 */
export function resetOnboarding(): void {
  localStorage.removeItem(Keys.furthest);
  localStorage.removeItem(Keys.unsent);
}

let sending = false;

/**
 * Sends the latest unsent step, only the latest, since the server keeps the
 * furthest step itself. A step taken offline goes out on the next call, which
 * launch makes too. Steps passed through while offline still count toward how
 * far this install got, but lose their own first reached time.
 */
export async function flushOnboarding(): Promise<void> {
  const step = localStorage.getItem(Keys.unsent);
  if (!apiConfigured || sending || !isStep(step)) {
    return;
  }

  sending = true;
  let sent = false;
  try {
    await api('/onboarding/progress', {
      method: 'POST',
      body: { installId: installId(), step },
      authenticated: isSignedIn(),
    });
    sent = true;
  } catch (error) {
    // A 400 can never succeed, so stop retrying it. Anything else waits for the next call.
    sent = error instanceof ApiError && error.status === 400;
  } finally {
    sending = false;
  }

  if (sent && localStorage.getItem(Keys.unsent) === step) {
    localStorage.removeItem(Keys.unsent);
  } else if (sent) {
    // A newer step arrived while this one was in flight. Send that too.
    void flushOnboarding();
  }
}

/**
 * For a signed in person on a phone that has no progress of its own, takes how
 * far their account got on any other phone, so they pick up there rather than
 * starting over. Used at launch, so it shapes the next screen opened.
 */
export async function pullOnboardingProgress(): Promise<void> {
  if (!apiConfigured || !isSignedIn() || furthestStep() === 'done') {
    return;
  }

  try {
    const remote = await api<{ step: string | null; completed: boolean }>(
      `/onboarding/progress?installId=${installId()}`,
    );
    const step = remote.completed ? 'done' : remote.step;
    if (isStep(step)) {
      raiseFurthest(step);
    }
  } catch {
    // Offline. The device's own progress stands.
  }
}
