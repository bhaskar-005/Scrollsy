import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Headline, PrimaryButton, Sheet } from '@/components/ui';
import { StepScreen } from '@/components/onboarding/step-screen';
import { Legal } from '@/constants/legal';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/**
 * Asked one at a time. Each one sends you out to a different Android settings
 * page, so a single Allow button for both would be a lie.
 */
const permissions = [
  {
    id: 'screenTime',
    titleKey: 'onboarding.permission.screenTimeTitle',
    bodyKey: 'onboarding.permission.screenTimeBody',
    whyKey: 'onboarding.permission.whyScreenTime',
  },
  {
    id: 'overlay',
    titleKey: 'onboarding.permission.overlayTitle',
    bodyKey: 'onboarding.permission.overlayBody',
    whyKey: 'onboarding.permission.whyOverlay',
  },
] as const;

export default function PermissionScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** Stage 1 has nothing to ask, so Allow just marks the row done. */
  const [granted, setGranted] = useState<string[]>([]);
  const [whyOpen, setWhyOpen] = useState(false);

  /** Only the first row you have not done yet is live. The rest wait their turn. */
  const activeIndex = permissions.findIndex((p) => !granted.includes(p.id));

  return (
    <StepScreen
      step={3}
      footer={
        <PrimaryButton
          label={t('onboarding.permission.next')}
          onPress={() => router.push('/onboarding/notifications')}
        />
      }>
      <Headline>{t('onboarding.permission.headline')}</Headline>

      <Card>
        <View style={styles.rows}>
          {permissions.map((permission, index) => {
            const done = granted.includes(permission.id);
            const waiting = !done && index !== activeIndex;

            return (
              <View key={permission.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, waiting && styles.dim]}>
                    {t(permission.titleKey)}
                  </Text>
                  <Text style={[styles.rowBody, waiting && styles.dim]}>
                    {t(permission.bodyKey)}
                  </Text>
                </View>

                {done ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark-sharp" size={24} color={theme.accent} />
                  </View>
                ) : (
                  <PrimaryButton
                    size="small"
                    disabled={waiting}
                    label={t('onboarding.permission.allow')}
                    onPress={() => setGranted((current) => [...current, permission.id])}
                  />
                )}
              </View>
            );
          })}
        </View>
      </Card>

      <Pressable onPress={() => setWhyOpen(true)} accessibilityRole="button">
        {({ pressed }) => (
          <View style={[styles.whyPill, pressed && styles.pressed]}>
            <View style={styles.whyBadge}>
              <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
            </View>
            <Text style={styles.whyLabel}>{t('onboarding.permission.why')}</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
          </View>
        )}
      </Pressable>

      <Sheet
        visible={whyOpen}
        onClose={() => setWhyOpen(false)}
        title={t('onboarding.permission.whyHeadline')}
        hero={
          <Image
            source={require('@/assets/mascot/permission.png')}
            style={styles.heroArt}
            contentFit="contain"
            transition={200}
          />
        }>
        <View style={styles.reasons}>
          {permissions.map((permission) => (
            <View key={permission.id} style={styles.reason}>
              <Ionicons
                name="sparkles"
                size={16}
                color={theme.accent}
                style={styles.reasonGlyph}
              />
              <View style={styles.reasonText}>
                <Text style={styles.reasonTitle}>{t(permission.titleKey)}</Text>
                <Text style={styles.reasonBody}>{t(permission.whyKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.quiet}>
          <Text style={styles.quietLine}>{t('onboarding.permission.whyPrivate')}</Text>
          <Text style={styles.quietLine}>{t('onboarding.permission.whyRevoke')}</Text>
        </View>

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(Legal.privacy)}
          accessibilityRole="link">
          {({ pressed }) => (
            <View style={[styles.policyRow, pressed && styles.pressed]}>
              <View style={styles.whyBadge}>
                <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
              </View>
              <Text style={styles.policyLabel}>
                {t('onboarding.permission.whyConcerns')}{' '}
                <Text style={styles.policyLink}>{t('onboarding.permission.whyPolicy')}</Text>
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
            </View>
          )}
        </Pressable>
      </Sheet>
    </StepScreen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    rows: {
      gap: Spacing.four,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      minHeight: MinTouch,
    },
    rowText: {
      flex: 1,
      gap: Spacing.one,
    },
    rowTitle: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    rowBody: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
    /** A row that is not its turn yet fades back rather than disappearing. */
    dim: {
      opacity: 0.4,
    },
    check: {
      width: MinTouch,
      height: MinTouch,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    whyPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      minHeight: MinTouch + 8,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      backgroundColor: c.backgroundElement,
      borderWidth: 1,
      borderColor: c.border,
    },
    whyBadge: {
      width: 32,
      height: 32,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    whyLabel: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },

    /** Sits on the pale plate at the top of the why sheet. */
    heroArt: {
      width: 200,
      height: 207,
      marginTop: Spacing.five,
      marginBottom: Spacing.three,
    },
    reasons: {
      gap: Spacing.three,
    },
    reason: {
      flexDirection: 'row',
      gap: Spacing.three,
    },
    /** Nudged down onto the first line of type rather than above it. */
    reasonGlyph: {
      marginTop: 3,
    },
    reasonText: {
      flex: 1,
      gap: Spacing.half,
    },
    reasonTitle: {
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    reasonBody: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
    quiet: {
      gap: Spacing.one,
    },
    quietLine: {
      color: c.textFaint,
      fontSize: 13,
      lineHeight: 19,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
    policyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      minHeight: MinTouch + 8,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      backgroundColor: c.background,
    },
    policyLabel: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    policyLink: {
      color: c.accent,
      textDecorationLine: 'underline',
    },
    pressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
  });
