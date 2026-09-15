import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Badge } from '@/components/ui';
import { Pricing } from '@/constants/placeholder';
import { useMemo } from 'react';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/**
 * The paid plan is never more than one tap away. This row carries the price
 * and sits on every tab.
 */
export function ProRow({ label }: { label: string }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={() => router.push('/paywall')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Badge label={t('common.pro')} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.price}>{Pricing.entry}</Text>
      <Text style={styles.chevron}>{t('common.chevron')}</Text>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      minHeight: MinTouch + 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.borderActive,
      backgroundColor: c.accentSoft,
    },
    label: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    price: {
      color: c.text,
      fontSize: 15,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    chevron: {
      color: c.textSecondary,
      fontSize: 20,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.85,
    },
  });
