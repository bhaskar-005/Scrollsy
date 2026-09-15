import Feather from '@expo/vector-icons/Feather';
import MaskedView from '@react-native-masked-view/masked-view';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { GhostButton } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { CounterSheet } from '@/components/settings/counter-sheet';
import { FeedbackSheet } from '@/components/settings/feedback-sheet';
import { LanguageSheet } from '@/components/settings/language-sheet';
import { ProUpsell } from '@/components/settings/pro-upsell';
import { SettingsGroup, SettingsRow } from '@/components/settings/settings-row';
import { WidgetSheet } from '@/components/settings/widget-sheet';
import { Account, CounterPrefs, Languages, Profile } from '@/constants/placeholder';
import { Legal } from '@/constants/legal';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
type OpenSheet = 'counter' | 'widget' | 'language' | 'feedback' | null;

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const scheme = useColorScheme();

  const [sheet, setSheet] = useState<OpenSheet>(null);
  /**
   * Local only. Making this actually repaint the app needs a scheme that is
   * stored rather than read off the system, which is stage 2 work.
   */
  const [dark, setDark] = useState(scheme === 'dark');

  const initial = Account.name.trim().charAt(0).toUpperCase();
  const version = Constants.expoConfig?.version;

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
          <View style={styles.account}>
            <View style={styles.avatar}>
              <Text style={styles.initial}>{initial}</Text>
            </View>
            <View style={styles.accountText}>
              <Text style={styles.name} numberOfLines={1}>
                {Account.name}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {Account.email}
              </Text>
              <Text style={styles.provider}>{t('settings.signedIn')}</Text>
            </View>
          </View>

          <ProUpsell />

          <SettingsGroup title={t('settings.groups.counter')}>
            <SettingsRow
              icon="circle"
              label={t('settings.rows.counterStyle')}
              value={t(`settings.counterSheet.styles.${CounterPrefs.style}`)}
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
              value={Account.premium ? String(Profile.dailyLimit) : undefined}
              locked={!Account.premium}
              onPress={Account.premium ? () => {} : undefined}
            />
            <SettingsRow
              icon="bell"
              label={t('settings.rows.notifications')}
              value={t('common.on')}
              onPress={() => {}}
            />
            <SettingsRow
              icon="clock"
              label={t('settings.rows.screenTime')}
              value={Profile.screenTimeConnected ? t('common.connected') : t('common.off')}
              onPress={() => {}}
            />
            <SettingsRow
              icon="moon"
              label={t('settings.rows.darkMode')}
              toggle={{ value: dark, onValueChange: setDark }}
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
            <SettingsRow
              icon="rotate-ccw"
              label={t('settings.rows.replayOnboarding')}
              onPress={() => router.push('/onboarding/welcome')}
              last
            />
          </SettingsGroup>

          <GhostButton label={t('settings.logOut')} onPress={() => {}} />

          {/** Null off a bare config, so there is nothing to show rather than a blank. */}
          {version ? (
            <Text style={styles.version}>{t('settings.version', { version })}</Text>
          ) : null}
        </ScrollView>
      </MaskedView>

      <CounterSheet visible={sheet === 'counter'} onClose={() => setSheet(null)} />
      <WidgetSheet visible={sheet === 'widget'} onClose={() => setSheet(null)} />
      <LanguageSheet visible={sheet === 'language'} onClose={() => setSheet(null)} />
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
      backgroundColor: c.accent,
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
    version: {
      color: c.textFaint,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
