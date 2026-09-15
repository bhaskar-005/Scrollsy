import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, Sheet } from '@/components/ui';
import { Mascot } from '@/components/mascot';
import { Today } from '@/constants/placeholder';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** Art, not layout. The home screen is a drawing, so it carries its own numbers. */
const PhoneWidth = 208;
const PhoneHeight = 250;
/** Enough of a grid under the widget to read as a home screen. */
const AppSlots = 8;

export function WidgetSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.widgetSheet.title')}>
      <Text style={styles.caption}>{t('settings.widgetSheet.caption')}</Text>

      <View style={styles.stage}>
        <View style={styles.phone}>
          <View style={styles.island} />

          {/** The widget itself, sitting where it would sit on a real home screen. */}
          <View style={styles.widget}>
            <Mascot stage={Today.stage} width={46} />
            <View style={styles.widgetText}>
              <Text style={styles.widgetCount}>{Today.reels}</Text>
              <Text style={styles.widgetLabel}>{t('settings.widgetSheet.previewLabel')}</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {Array.from({ length: AppSlots }, (_, slot) => (
              <View key={slot} style={styles.app} />
            ))}
          </View>
        </View>
      </View>

      <PrimaryButton label={t('settings.widgetSheet.add')} onPress={onClose} />
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
    stage: {
      alignItems: 'center',
    },
    phone: {
      width: PhoneWidth,
      height: PhoneHeight,
      alignItems: 'center',
      gap: Spacing.three,
      paddingTop: Spacing.two,
      paddingHorizontal: Spacing.three,
      /** Only the top corners round, the handset runs off the bottom. */
      borderTopLeftRadius: Radius.sheet,
      borderTopRightRadius: Radius.sheet,
      borderWidth: 6,
      borderBottomWidth: 0,
      borderColor: c.backgroundElement,
      backgroundColor: c.backgroundSelected,
    },
    island: {
      width: 56,
      height: 16,
      borderRadius: Radius.pill,
      backgroundColor: c.backgroundElement,
    },
    widget: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      padding: Spacing.three,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.borderActive,
      backgroundColor: c.accentSoft,
    },
    widgetText: {
      gap: 1,
    },
    widgetCount: {
      color: c.text,
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: -0.5,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    widgetLabel: {
      color: c.textSecondary,
      fontSize: 12,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
    },
    grid: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.three,
    },
    /** Four across, so the row reads as an app grid rather than a list. */
    app: {
      width: '22%',
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: c.track,
    },
  });
