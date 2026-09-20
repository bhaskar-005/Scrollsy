import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, Sheet } from '@/components/ui';
import { Mascot } from '@/components/mascot';
import {
  CounterSizes,
  CounterStyles,
  type CounterSize,
  type CounterStyle,
} from '@/constants/counter';
import { stageFor } from '@/constants/stages';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useTodayReels } from '@/hooks/use-today-reels';
import { setCounterSize, setCounterStyle } from '@/lib/counting';
import { counterSizeOf, counterStyleOf, setPreferences } from '@/lib/profile';
import { t } from '@/i18n';

/** Gradients run bottom to top, same as the glass card on notifications. */
const gradientStart = { x: 0, y: 1 };
const gradientEnd = { x: 0, y: 0 };

export function CounterSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { profile } = useProfile();
  const reels = useTodayReels();

  const [style, setStyle] = useState<CounterStyle>(() => counterStyleOf(profile));
  const [size, setSize] = useState<CounterSize>(() => counterSizeOf(profile));

  /**
   * Opening starts from what is saved, so a sheet closed without saving does
   * not keep showing the abandoned choice next time. Adjusted while rendering
   * rather than in an effect, which is what React recommends for state that
   * follows a prop.
   */
  const [wasOpen, setWasOpen] = useState(visible);
  if (visible !== wasOpen) {
    setWasOpen(visible);
    if (visible) {
      setStyle(counterStyleOf(profile));
      setSize(counterSizeOf(profile));
    }
  }

  const save = () => {
    setPreferences({ counterStyle: style, counterSize: size });
    /** The service draws the pill, and it is not reading the profile. Tell it. */
    setCounterStyle(style);
    setCounterSize(size);
    onClose();
  };

  /**
   * Each option wearing today's real count, so the choice is the actual thing.
   * He is in every one of them: the number alone is a statistic, and the number
   * with him on it is what people come back to look at.
   */
  const preview = (option: CounterStyle) => {
    const face = <Mascot stage={stageFor(reels)} width={24} />;

    if (option === 'outline') {
      return (
        <View style={[styles.shell, styles.outline]}>
          {face}
          <Text style={styles.outlineCount}>{reels}</Text>
        </View>
      );
    }
    if (option === 'glass') {
      /** The real one blurs the reel behind it. This is the wet rim over the top. */
      return (
        <LinearGradient
          colors={[theme.glassRimBottom, theme.glassRimTop]}
          start={gradientStart}
          end={gradientEnd}
          style={styles.glassShell}>
          <LinearGradient
            colors={[theme.glassBottom, theme.glassTop]}
            start={gradientStart}
            end={gradientEnd}
            style={[styles.shell, styles.glassFace]}>
            {face}
            <Text style={styles.plain}>{reels}</Text>
          </LinearGradient>
        </LinearGradient>
      );
    }
    if (option === 'plain' || option === 'mascot') {
      return (
        <View style={styles.shell}>
          {face}
          <Text style={styles.plain}>{reels}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.shell, styles.pill]}>
        {face}
        <Text style={styles.pillCount}>{reels}</Text>
      </View>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.counterSheet.title')}>
      <Text style={styles.caption}>{t('settings.counterSheet.caption')}</Text>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.counterSheet.styleLabel')}</Text>
        <View style={styles.styleRow}>
          {CounterStyles.map((option) => (
            <Pressable
              key={option}
              onPress={() => setStyle(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: style === option }}
              style={styles.styleOption}>
              <View style={styles.stagePreview}>{preview(option)}</View>
              <Text style={[styles.styleName, style === option && styles.styleNameOn]}>
                {t(`settings.counterSheet.styles.${option}`)}
              </Text>
              {/** The only mark of the choice, now that nothing is boxed. */}
              <View style={[styles.underline, style === option && styles.underlineOn]} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.counterSheet.sizeLabel')}</Text>
        <View style={styles.sizeRow}>
          {CounterSizes.map((option) => (
            <Pressable
              key={option}
              onPress={() => setSize(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: size === option }}
              style={[styles.sizeOption, size === option && styles.sizeOptionOn]}>
              <Text style={[styles.sizeName, size === option && styles.sizeNameOn]}>
                {t(`settings.counterSheet.sizes.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.hint}>{t('settings.counterSheet.dragHint')}</Text>

      <PrimaryButton label={t('settings.counterSheet.save')} onPress={save} />
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
      /** Pulls it up under the title rather than floating in the body gap. */
      marginTop: -Spacing.three,
    },
    block: {
      gap: Spacing.two,
    },
    blockLabel: {
      color: c.textSecondary,
      fontSize: 12,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    styleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    styleOption: {
      /** Two and a bit per row, for the five of them. */
      minWidth: 84,
      flexGrow: 1,
      flexBasis: '30%',
      gap: Spacing.one,
      alignItems: 'center',
      paddingVertical: Spacing.two,
    },
    /** Fixed height, so five different previews do not stagger the row. */
    stagePreview: {
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** What every preview shares. Him on the left, the number beside him. */
    shell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    plain: {
      color: c.text,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    pill: {
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
      borderRadius: Radius.pill,
      backgroundColor: c.accent,
    },
    pillCount: {
      color: c.onAccent,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    outline: {
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
      borderRadius: Radius.pill,
      borderWidth: 2,
      borderColor: c.accent,
    },
    outlineCount: {
      color: c.accent,
      fontSize: 17,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
    glassShell: {
      padding: 1,
      borderRadius: Radius.pill,
    },
    glassFace: {
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
      borderRadius: Radius.pill - 1,
    },
    /** A segmented row, because three sizes are a spectrum rather than a menu. */
    sizeRow: {
      flexDirection: 'row',
      gap: Spacing.one,
      padding: Spacing.one,
      borderRadius: Radius.pill,
      backgroundColor: c.backgroundElement,
    },
    sizeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.two,
      borderRadius: Radius.pill,
    },
    sizeOptionOn: {
      backgroundColor: c.accentSoft,
    },
    sizeName: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    sizeNameOn: {
      color: c.accent,
    },
    styleName: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    styleNameOn: {
      color: c.text,
    },
    underline: {
      height: 2,
      width: 20,
      borderRadius: Radius.pill,
      backgroundColor: 'transparent',
    },
    underlineOn: {
      backgroundColor: c.accent,
    },
    hint: {
      color: c.textFaint,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
