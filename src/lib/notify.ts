import 'expo-sqlite/localStorage/install';

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { readProfile } from '@/lib/profile';
import { localDateKey } from '@/lib/usage-store';
import { t } from '@/i18n';

/**
 * The one notification this app sends, and the only thing that makes the daily
 * limit more than a line on a chart.
 *
 * It fires once on the day you cross the limit, never again that day, because
 * a counter that nags every reel gets its notifications switched off within an
 * hour and then it cannot say anything at all.
 */

/** Without this a notification that arrives while the app is open shows nothing. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** The day we last said something, so it is said once and not on every sync. */
const Key = 'notify.limitDay';
const ChannelId = 'limit';

let channelReady = false;

/** Android 8 and up drops a notification that has no channel. */
async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') {
    channelReady = true;
    return;
  }
  await Notifications.setNotificationChannelAsync(ChannelId, {
    name: t('notify.limit.channel'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/**
 * Says something once, the moment today's count passes the limit. Silent when
 * notifications are off, either here or in Android, so the switch in Settings
 * means what it says.
 */
export async function notifyLimitCrossed(reels: number): Promise<void> {
  const profile = readProfile();
  const limit = profile.dailyLimit;
  if (!profile.notificationsEnabled || limit <= 0 || reels < limit) {
    return;
  }

  const today = localDateKey();
  if (localStorage.getItem(Key) === today) {
    return;
  }

  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    return;
  }

  /** Written before sending, so a failure cannot turn into a loop of retries. */
  localStorage.setItem(Key, today);

  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notify.limit.title'),
      body: t('notify.limit.body', { reels, limit }),
    },
    /** Now, rather than on a schedule. */
    trigger: null,
  });
}
