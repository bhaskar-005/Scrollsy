import Feather from '@expo/vector-icons/Feather';
import { useMemo } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Toggle } from '@/components/ui';
import { Fonts, MinTouch, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Glyph = ComponentProps<typeof Feather>['name'];

/**
 * A titled block of rows. Settings is a long screen, so it reads as four short
 * lists rather than one endless one.
 */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <Card style={styles.groupCard}>{children}</Card>
    </View>
  );
}

type SettingsRowProps = {
  icon: Glyph;
  label: string;
  /** Sits on the right. Left off when the row carries a switch or only a pill. */
  value?: string;
  /** Marks the row as paid. Tapping it goes to the paywall rather than acting. */
  locked?: boolean;
  toggle?: { value: boolean; onValueChange: (next: boolean) => void };
  onPress?: () => void;
  /** Skips the hairline. Set on the last row of a group. */
  last?: boolean;
};

export function SettingsRow({
  icon,
  label,
  value,
  locked = false,
  toggle,
  onPress,
  last = false,
}: SettingsRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const body = (pressed: boolean) => (
    <View style={[styles.row, !last && styles.divided, pressed && styles.pressed]}>
      <View style={styles.iconSlot}>
        <Feather name={icon} size={19} color={theme.textSecondary} />
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      {locked ? <Badge label={t('common.pro')} style={styles.badge} /> : null}
      {value ? <Text style={styles.value}>{value}</Text> : null}

      {toggle ? (
        <Toggle
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          accessibilityLabel={label}
        />
      ) : null}

      {onPress || locked ? (
        <Feather name="chevron-right" size={19} color={theme.textFaint} />
      ) : null}
    </View>
  );

  if (!onPress && !locked) {
    return body(false);
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    group: {
      gap: Spacing.two,
    },
    groupTitle: {
      color: c.textFaint,
      fontSize: 13,
      fontFamily: Fonts.bold,
      fontWeight: '700',
      paddingLeft: Spacing.three,
    },
    /** The rows draw their own padding, so the card gives them none. */
    groupCard: {
      padding: 0,
      overflow: 'hidden',
    },
    row: {
      minHeight: MinTouch + 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      /** Same inset as the battle rows, so the two screens line up. */
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    divided: {
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    pressed: {
      backgroundColor: c.backgroundSelected,
    },
    /** No fill behind it. Fixed width so every label starts on the same line. */
    iconSlot: {
      width: 24,
      alignItems: 'center',
    },
    label: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    /** Badge ships flex-start, which parks it against the top of the row. */
    badge: {
      alignSelf: 'center',
    },
    value: {
      color: c.textSecondary,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
  });
