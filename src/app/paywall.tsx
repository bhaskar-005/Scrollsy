import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconButton, PrimaryButton } from '@/components/ui';
import { Backdrop } from '@/components/backdrop';
import { Mascot } from '@/components/mascot';
import { PerkList, PlanPicker, PlanTerms, type PlanId } from '@/components/plans';
import { Pricing } from '@/constants/placeholder';
import { Fonts, Spacing, type Palette } from '@/constants/theme';
import { useOffers } from '@/hooks/use-offers';
import { useTheme } from '@/hooks/use-theme';
import { refreshProfile } from '@/lib/profile';
import { buy, restore, type PurchaseResult } from '@/lib/purchases';
import { t } from '@/i18n';

/** What the screen has to say after an attempt. Only one at a time. */
type Notice = 'failed' | 'unavailable' | 'restored' | 'nothingToRestore' | null;

/** Screen 13. The modal every Pro row opens. */
export default function PaywallModal() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [plan, setPlan] = useState<PlanId>('yearly');
  /** The store's own prices, in the buyer's currency. Written ones show until they land. */
  const offers = useOffers(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);


  const selected = offers.find((offer) => offer.plan === plan) ?? null;

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

  /** Google's sheet does the charging. This only reacts to what it says. */
  const start = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    const result: PurchaseResult = await buy(plan);
    setBusy(false);

    if (result === 'bought') {
      /** The webhook is writing the durable answer. This asks for it early. */
      void refreshProfile(true);
      dismiss();
      return;
    }
    if (result === 'cancelled') {
      return;
    }
    setNotice(result === 'unavailable' ? 'unavailable' : 'failed');
  };

  const bringBack = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNotice(null);
    const found = await restore();
    setBusy(false);

    setNotice(found ? 'restored' : 'nothingToRestore');
    if (found) {
      void refreshProfile(true);
    }
  };

  const price =
    selected?.entry?.price ?? selected?.price ?? (plan === 'yearly' ? Pricing.entry : Pricing.monthly);

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
        <PlanPicker value={plan} onChange={setPlan} offers={offers} />
        <PerkList />
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={busy ? t('paywall.purchasing') : t('paywall.start', { price })}
          onPress={() => void start()}
          disabled={busy}
        />

        {notice ? <Text style={styles.notice}>{t(`paywall.${notice}`)}</Text> : null}

        <PlanTerms offer={selected} />

        {/** Quiet, and last. For the person who already paid and is looking at this anyway. */}
        <Pressable
          onPress={() => void bringBack()}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.restore}>{t('paywall.restore')}</Text>
        </Pressable>
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
    notice: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
    },
    restore: {
      color: c.textFaint,
      fontSize: 13,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
      paddingVertical: Spacing.two,
    },
    pressed: {
      opacity: 0.75,
    },
  });
