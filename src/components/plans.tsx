import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { Pricing } from '@/constants/placeholder';
import { useMemo } from 'react';
import { Fonts, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { yearlySaving, type Offer, type Plan } from '@/lib/purchases';
import { t } from '@/i18n';

export type PlanId = Plan;

const PlanOrder: PlanId[] = ['monthly', 'yearly'];

/**
 * What to show before the store has answered, and if it never does. Written
 * prices are a last resort: the price shown has to be the price charged, and
 * only the store knows that.
 */
const Written: Record<PlanId, string> = {
  monthly: Pricing.monthly,
  yearly: Pricing.yearly,
};

export function PlanPicker({
  value,
  onChange,
  offers,
}: {
  value: PlanId;
  onChange: (id: PlanId) => void;
  offers: Offer[];
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /** Only claimed when the store's own prices back it up. */
  const saving = yearlySaving(offers);

  return (
    <View style={styles.plans}>
      {PlanOrder.map((id) => (
        <Card
          key={id}
          selected={value === id}
          onPress={() => onChange(id)}
          style={styles.plan}>
          <View style={styles.planHead}>
            <Text style={styles.planTitle}>{t(`paywall.${id}`)}</Text>
            {id === 'yearly' && saving ? (
              <Badge label={t('paywall.saving', { percent: saving })} />
            ) : null}
          </View>
          <Text style={styles.price}>
            {offers.find((offer) => offer.plan === id)?.price ?? Written[id]}
          </Text>
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

/**
 * Plain terms. The stores require them and hiding them gets the app pulled.
 *
 * Every number comes from the offer the store returned, so the terms cannot
 * drift from what is actually charged. With no offer it falls back to the
 * written prices, which is the same thing the picker above shows.
 */
export function PlanTerms({ offer }: { offer: Offer | null }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const plan = offer?.plan ?? 'yearly';
  const price = offer?.price ?? Written[plan];
  const entry = offer ? offer.entry : { price: Pricing.entry, days: Pricing.entryDays };

  return (
    <Text style={styles.terms}>
      {entry
        ? t(`paywall.terms.${plan}`, { entry: entry.price, days: entry.days, price })
        : t(`paywall.termsPlain.${plan}`, { price })}
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
