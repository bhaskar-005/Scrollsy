import Feather from '@expo/vector-icons/Feather';
import MaskedView from '@react-native-masked-view/masked-view';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GhostButton } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { CounterSheet } from '@/components/settings/counter-sheet';
import { FeedbackSheet } from '@/components/settings/feedback-sheet';
import { LanguageSheet } from '@/components/settings/language-sheet';
import { LimitSheet } from '@/components/settings/limit-sheet';
import { ProUpsell } from '@/components/settings/pro-upsell';
import { SettingsGroup, SettingsRow } from '@/components/settings/settings-row';
import { WidgetSheet } from '@/components/settings/widget-sheet';
import { Languages } from '@/constants/placeholder';
import { Legal } from '@/constants/legal';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useAccess } from '@/hooks/use-access';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePremium } from '@/hooks/use-premium';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { api, signOut } from '@/lib/api';
import { setAppearance } from '@/lib/appearance';
import { forgetGoogleAccount } from '@/lib/google';
import { resetOnboarding } from '@/lib/onboarding';
import { requestNotifications } from '@/lib/permissions';
import { counterStyleOf, refreshProfile, setPreferences } from '@/lib/profile';
import { forgetCustomer, restore } from '@/lib/purchases';
import { syncUsage } from '@/lib/sync';
import { clearUsage } from '@/lib/usage-store';
import { t } from '@/i18n';

/** How much of the scroll dissolves into the header on the way up. */
const FadeHeight = 30;

/**
 * Channels for the mask, not colours. Solid keeps the pixel, clear drops it.
 * A real mask rather than a gradient in the page colour, because the haze sits
 * behind this and there is no one colour to fade into.
 */
const Mask = {
  solid: '#000000',
  clear: 'transparent',
} as const;

/** Which sheet is up. Only ever one, so they share a slot rather than a flag each. */
type OpenSheet = 'counter' | 'widget' | 'language' | 'feedback' | 'limit' | null;

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scheme = useColorScheme();
  const { profile, signedIn } = useProfile();
  const premium = usePremium();
  const access = useAccess();

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [leaving, setLeaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const initial = profile.name.trim().charAt(0).toUpperCase();
  const version = Constants.expoConfig?.version;

  /**
   * Pushes whatever this device still owes first, so the count lands on the
   * account that earned it, then takes the account off the phone entirely.
   */
  const leave = async (deleteAccount: boolean) => {
    setLeaving(true);
    try {
      if (deleteAccount) {
        await api('/me', { method: 'DELETE' });
      } else {
        await syncUsage();
      }
    } catch {
      // Offline, or already gone. Signing out locally still has to happen.
    }

    await signOut();
    await forgetGoogleAccount();
    await forgetCustomer();
    await clearUsage();
    resetOnboarding();
    setLeaving(false);
    router.replace('/onboarding/welcome');
  };

  /**
   * Turning notifications on asks Android and keeps its answer, so a refusal
   * leaves the switch off rather than showing an on switch that sends nothing.
   */
  const allowNotifications = async (wanted: boolean) => {
    setPreferences({ notificationsEnabled: wanted ? await requestNotifications() : false });
  };

  /** Asks the store what this account owns, for someone sure they already paid. */
  const bringBackPlan = async () => {
    if (restoring) {
      return;
    }
    setRestoring(true);
    const found = await restore();
    setRestoring(false);

    if (found) {
      void refreshProfile(true);
    }
    Alert.alert(found ? t('paywall.restored') : t('paywall.nothingToRestore'));
  };

  const confirmDelete = () => {
    Alert.alert(t('settings.deleteAccount.title'), t('settings.deleteAccount.body'), [
      { text: t('settings.deleteAccount.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccount.confirm'),
        style: 'destructive',
        onPress: () => void leave(true),
      },
    ]);
  };

  return (
    <Backdrop>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Feather name="arrow-left" size={21} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
        {/** Balances the back button, so the title sits dead centre. */}
        <View style={styles.back} />
      </View>

      <MaskedView
        style={styles.scroller}
        maskElement={
          <View style={styles.mask}>
            <LinearGradient colors={[Mask.clear, Mask.solid]} style={styles.maskFade} />
            <View style={styles.maskBody} />
          </View>
        }>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {signedIn ? (
            <View style={styles.account}>
              <View style={styles.avatar}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.photo} contentFit="cover" />
                ) : (
                  <Text style={styles.initial}>{initial}</Text>
                )}
              </View>
              <View style={styles.accountText}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.name || t('settings.noName')}
                </Text>
                {profile.email ? (
                  <Text style={styles.email} numberOfLines={1}>
                    {profile.email}
                  </Text>
                ) : null}
                <Text style={styles.provider}>{t('settings.signedIn')}</Text>
              </View>
            </View>
          ) : (
            /** Signed out has one job, and it is the same one onboarding opens with. */
            <Pressable
              onPress={() => router.push('/onboarding/welcome')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
              <View style={styles.avatar}>
                <Feather name="user" size={22} color={theme.onAccent} />
              </View>
              <View style={styles.accountText}>
                <Text style={styles.name}>{t('settings.signedOut')}</Text>
                <Text style={styles.email}>{t('settings.signInPrompt')}</Text>
              </View>
              <Feather name="chevron-right" size={19} color={theme.textFaint} />
            </Pressable>
          )}

          <ProUpsell />

          <SettingsGroup title={t('settings.groups.counter')}>
            <SettingsRow
              icon="circle"
              label={t('settings.rows.counterStyle')}
              value={t(`settings.counterSheet.styles.${counterStyleOf(profile)}`)}
              onPress={() => setSheet('counter')}
            />
            <SettingsRow
              icon="grid"
              label={t('settings.rows.widget')}
              onPress={() => setSheet('widget')}
              last
            />
          </SettingsGroup>

          <SettingsGroup title={t('settings.groups.friends')}>
            <SettingsRow
              icon="zap"
              label={t('settings.rows.friends')}
              onPress={() => router.push('/battle')}
              last
            />
          </SettingsGroup>

          <SettingsGroup title={t('settings.groups.app')}>
            {/** The number is the paid half, so free sees the pill instead of it. */}
            <SettingsRow
              icon="sliders"
              label={t('settings.rows.dailyLimit')}
              value={premium ? String(profile.dailyLimit) : undefined}
              locked={!premium}
              onPress={premium ? () => setSheet('limit') : () => router.push('/paywall')}
            />
            {/** Turning it on asks Android, so the switch lands where Android left it. */}
            <SettingsRow
              icon="bell"
              label={t('settings.rows.notifications')}
              toggle={{
                value: profile.notificationsEnabled,
                onValueChange: (next) => void allowNotifications(next),
              }}
            />
            {/** The one that makes the number move, so it reads first. */}
            <SettingsRow
              icon="activity"
              label={t('settings.rows.counting')}
              value={access.counting ? t('common.connected') : t('common.off')}
              onPress={() => router.push('/onboarding/permission')}
            />
            <SettingsRow
              icon="clock"
              label={t('settings.rows.screenTime')}
              value={access.screenTime ? t('common.connected') : t('common.off')}
              onPress={() => router.push('/onboarding/permission')}
            />
            <SettingsRow
              icon="moon"
              label={t('settings.rows.darkMode')}
              toggle={{
                value: scheme === 'dark',
                onValueChange: (next) => setAppearance(next ? 'dark' : 'light'),
              }}
            />
            <SettingsRow
              icon="globe"
              label={t('settings.rows.language')}
              value={Languages[0].label}
              onPress={() => setSheet('language')}
              last
            />
          </SettingsGroup>

          <SettingsGroup title={t('settings.groups.support')}>
            <SettingsRow
              icon="message-square"
              label={t('settings.rows.feedback')}
              onPress={() => setSheet('feedback')}
            />
            <SettingsRow
              icon="star"
              label={t('settings.rows.rate')}
              onPress={() => Linking.openURL(Legal.store)}
            />
            {/** Play hands a subscription back on its own. This is for when it did not. */}
            <SettingsRow
              icon="refresh-ccw"
              label={t('settings.rows.restore')}
              value={restoring ? t('paywall.purchasing') : undefined}
              onPress={() => void bringBackPlan()}
            />
            <SettingsRow
              icon="rotate-ccw"
              label={t('settings.rows.replayOnboarding')}
              onPress={() => router.push('/onboarding/welcome')}
              last
            />
          </SettingsGroup>

          {signedIn ? (
            <View style={styles.leaving}>
              <GhostButton
                label={t('settings.logOut')}
                onPress={() => {
                  if (!leaving) {
                    void leave(false);
                  }
                }}
              />
              {/** Play requires a way to delete the account from inside the app. */}
              <Pressable
                onPress={confirmDelete}
                disabled={leaving}
                accessibilityRole="button"
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.delete}>{t('settings.deleteAccount.row')}</Text>
              </Pressable>
            </View>
          ) : null}

          {/** Null off a bare config, so there is nothing to show rather than a blank. */}
          {version ? (
            <Text style={styles.version}>{t('settings.version', { version })}</Text>
          ) : null}
        </ScrollView>
      </MaskedView>

      <CounterSheet visible={sheet === 'counter'} onClose={() => setSheet(null)} />
      <WidgetSheet visible={sheet === 'widget'} onClose={() => setSheet(null)} />
      <LanguageSheet visible={sheet === 'language'} onClose={() => setSheet(null)} />
      <LimitSheet visible={sheet === 'limit'} onClose={() => setSheet(null)} />
      <FeedbackSheet visible={sheet === 'feedback'} onClose={() => setSheet(null)} />
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: Spacing.two,
    },
    back: {
      width: MinTouch,
      height: MinTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      textAlign: 'center',
      color: c.text,
      fontSize: 18,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    scroller: {
      flex: 1,
    },
    mask: {
      flex: 1,
      backgroundColor: Mask.clear,
    },
    maskFade: {
      height: FadeHeight,
    },
    maskBody: {
      flex: 1,
      backgroundColor: Mask.solid,
    },
    content: {
      gap: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.six,
    },
    account: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      padding: Spacing.three,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: c.accent,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    initial: {
      color: c.onAccent,
      fontSize: 22,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    accountText: {
      flex: 1,
      gap: 1,
    },
    name: {
      color: c.text,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    email: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
    provider: {
      color: c.textFaint,
      fontSize: 12,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.75,
    },
    leaving: {
      gap: Spacing.two,
      alignItems: 'center',
    },
    /** Quiet on purpose. It is not a thing to nudge anyone toward. */
    delete: {
      color: c.textFaint,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.four,
    },
    version: {
      color: c.textFaint,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
