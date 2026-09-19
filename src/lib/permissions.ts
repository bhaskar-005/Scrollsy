import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import AppAccess from '@/modules/app-access/src/AppAccessModule';
import ReelCounter from '@/modules/reel-counter/src/ReelCounterModule';

/**
 * The permissions the counter needs, and the only file that knows how Android
 * hands them out.
 *
 * Two of the three cannot be asked for with a dialog. Usage access and drawing
 * over other apps are granted on their own Settings pages, so the app sends
 * you there and reads the answer back when you return, rather than taking a
 * tap as a yes. Notifications are a real prompt, so that one is asked outright.
 */

export type AccessId = 'screenTime' | 'overlay' | 'counting';

const packageName = Constants.expoConfig?.android?.package;

/** Which Settings page grants each one. */
const Pages: Record<AccessId, IntentLauncher.ActivityAction> = {
  screenTime: IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS,
  overlay: IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION,
  counting: IntentLauncher.ActivityAction.ACCESSIBILITY_SETTINGS,
};

/**
 * Whether this build can read the two special accesses at all. False on the
 * web, and in any build made before the native module existed, where every
 * answer below is a no rather than a guess.
 */
export const accessReadable = Platform.OS === 'android' && AppAccess !== null;

/** What Android says right now. Cheap enough to call on every app resume. */
export function hasAccess(id: AccessId): boolean {
  if (id === 'counting') {
    return ReelCounter?.isCounting() ?? false;
  }
  if (!AppAccess) {
    return false;
  }
  return id === 'screenTime' ? AppAccess.hasUsageAccess() : AppAccess.hasOverlay();
}

/**
 * Opens the Settings page for one access and answers with what it is after
 * they come back. The promise waits for the return trip, so the answer is the
 * state they left Settings in, not the state they arrived with.
 */
export async function requestAccess(id: AccessId): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    await IntentLauncher.startActivityAsync(Pages[id], {
      /**
       * Lands on this app's own toggle rather than the whole list. Only the
       * overlay page takes it, the usage access list ignores it on some
       * phones and refuses to open on others.
       */
      ...(id === 'overlay' && packageName ? { data: `package:${packageName}` } : {}),
    });
  } catch {
    // No Settings page for it on this phone. The check below still stands.
  }

  return hasAccess(id);
}

/** Whether notifications are allowed, without asking for anything. */
export async function hasNotifications(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Asks for notifications. Android only shows its prompt once ever, so once it
 * has been refused the only way left is the app's own notification settings.
 */
export async function requestNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  if (current.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  }

  if (Platform.OS === 'android' && packageName) {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
        { extra: { 'android.provider.extra.APP_PACKAGE': packageName } },
      );
    } catch {
      // Nothing to open. Falls through to the read below, which says no.
    }
  }

  return hasNotifications();
}
