import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, Sheet } from '@/components/ui';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { setPreferences } from '@/lib/profile';
import { t } from '@/i18n';

/**
 * A short list rather than a free number. Every one of these is a real day for
 * somebody, and a picker beats a keyboard for a setting nobody wants to think
 * about for long.
 */
const Limits = [100, 200, 300, 400, 600];

export function LimitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { profile } = useProfile();

  const [picked, setPicked] = useState(profile.dailyLimit);

  /**
   * Opening starts from what is saved, not from a choice that was never kept.
   * Adjusted while rendering rather than in an effect, which is what React
   * recommends for state that follows a prop.
   */
  const [wasOpen, setWasOpen] = useState(visible);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setPicked(profile.dailyLimit);
    }
  }

  const save = () => {
    setPreferences({ dailyLimit: picked });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.limitSheet.title')}>
      <Text style={styles.caption}>{t('settings.limitSheet.caption')}</Text>

      <View style={styles.list}>
        {Limits.map((limit) => (
          <Pressable
            key={limit}
            onPress={() => setPicked(limit)}
            accessibilityRole="button"
            accessibilityState={{ selected: picked === limit }}
            style={({ pressed }) => [
              styles.row,
              picked === limit && styles.rowOn,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.label}>{t('settings.limitSheet.reels', { reels: limit })}</Text>
            {picked === limit ? <Feather name="check" size={20} color={theme.accent} /> : null}
          </Pressable>
        ))}
      </View>

      <PrimaryButton label={t('settings.limitSheet.save')} onPress={save} />
    </Sheet>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    caption: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 21,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      marginTop: -Spacing.three,
    },
    list: {
      gap: Spacing.two,
    },
    row: {
      minHeight: MinTouch,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.three,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    rowOn: {
      borderColor: c.borderActive,
      backgroundColor: c.accentSoft,
    },
    pressed: {
      opacity: 0.8,
    },
    label: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
  });
