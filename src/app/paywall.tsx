import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconButton, PrimaryButton } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { Mascot } from '@/components/mascot';
import { PerkList, PlanPicker, PlanTerms, type PlanId } from '@/components/plans';
import { Pricing } from '@/constants/placeholder';
import { Fonts, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Screen 13. The modal every Pro row opens. */
export default function PaywallModal() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [plan, setPlan] = useState<PlanId>('yearly');

  /**
   * This route can also be opened cold, by a deep link or after a reload, and
   * then there is nothing to pop. Fall back to Home instead of firing an
   * unhandled GO_BACK.
   */
  const dismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  return (
    <Backdrop>
      <View style={styles.header}>
        <IconButton
          glyph={t('common.closeGlyph')}
          onPress={dismiss}
          accessibilityLabel={t('common.close')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Mascot stage="cooked" width={150} />
        <Text style={styles.headline}>{t('paywall.headline')}</Text>
        <PlanPicker value={plan} onChange={setPlan} />
        <PerkList />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={t('paywall.start', { days: Pricing.trialDays })} onPress={dismiss} />
        <PlanTerms />
      </View>
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingTop: Spacing.three,
    },
    content: {
      alignItems: 'center',
      gap: Spacing.four,
      paddingVertical: Spacing.four,
    },
    headline: {
      color: c.text,
      fontSize: 32,
      lineHeight: 38,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    footer: {
      gap: Spacing.two,
      paddingBottom: Spacing.four,
    },
  });
