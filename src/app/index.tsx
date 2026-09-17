import { Redirect } from 'expo-router';

import { resumeHref } from '@/lib/onboarding';

/** Wherever this install left onboarding, or Home once it is done. */
export default function Index() {
  return <Redirect href={resumeHref()} />;
}
