import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { Pricing } from '@/constants/placeholder';
import { useMemo } from 'react';
import { Fonts, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export const Plans = [
  { id: 'monthly', titleKey: 'paywall.monthly', price: Pricing.monthly, saving: false },
  { id: 'yearly', titleKey: 'paywall.yearly', price: Pricing.yearly, saving: true },
] as const;

export type PlanId = (typeof Plans)[number]['id'];

export function PlanPicker({ value, onChange }: { value: PlanId; onChange: (id: PlanId) => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.plans}>
      {Plans.map((plan) => (
        <Card
          key={plan.id}
          selected={value === plan.id}
          onPress={() => onChange(plan.id)}
          style={styles.plan}>
          <View style={styles.planHead}>
            <Text style={styles.planTitle}>{t(plan.titleKey)}</Text>
            {plan.saving ? <Badge label={t('paywall.saving')} /> : null}
          </View>
          <Text style={styles.price}>{plan.price}</Text>
        </Card>
      ))}
    </View>
  );
}

const perkKeys = ['lock', 'buyBack', 'history', 'friends'] as const;

export function PerkList() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.perks}>
      {perkKeys.map((key) => (
        <View key={key} style={styles.perk}>
          <View style={styles.dot} />
          <Text style={styles.perkLabel}>{t(`paywall.perks.${key}`)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Plain terms. The stores require them and hiding them gets the app pulled. */
export function PlanTerms() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Text style={styles.terms}>
      {t('paywall.terms', { days: Pricing.trialDays, price: Pricing.yearly })}
    </Text>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    plans: {
      flexDirection: 'row',
      gap: Spacing.two,
    },
    plan: {
      flex: 1,
      gap: Spacing.two,
    },
    planHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    planTitle: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    price: {
      color: c.text,
      fontSize: 30,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    perks: {
      gap: Spacing.three,
    },
    perk: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.accent,
    },
    perkLabel: {
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    terms: {
      color: c.textFaint,
      fontFamily: Fonts.regular,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      paddingHorizontal: Spacing.three,
    },
  });
