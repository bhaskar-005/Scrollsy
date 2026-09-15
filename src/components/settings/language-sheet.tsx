import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, Sheet } from '@/components/ui';
import { Languages } from '@/constants/placeholder';
import { Fonts, MinTouch, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [picked, setPicked] = useState<string>(Languages[0].id);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.languageSheet.title')}>
      <Text style={styles.caption}>{t('settings.languageSheet.caption')}</Text>

      <View style={styles.list}>
        {Languages.map((language) => (
          <Pressable
            key={language.id}
            onPress={() => setPicked(language.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: picked === language.id }}
            style={({ pressed }) => [
              styles.row,
              picked === language.id && styles.rowOn,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.label}>{language.label}</Text>
            {picked === language.id ? (
              <Feather name="check" size={20} color={theme.accent} />
            ) : null}
          </Pressable>
        ))}
      </View>

      <PrimaryButton label={t('settings.languageSheet.done')} onPress={onClose} />
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
