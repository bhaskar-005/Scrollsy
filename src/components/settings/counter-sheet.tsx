import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, CountPill, PrimaryButton, Sheet } from '@/components/ui';
import { Mascot } from '@/components/mascot';
import { CounterStyles, type CounterStyle } from '@/constants/counter';
import { stageFor } from '@/constants/stages';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useTodayReels } from '@/hooks/use-today-reels';
import { counterStyleOf, setPreferences } from '@/lib/profile';
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
    }
  }

  const save = () => {
    setPreferences({ counterStyle: style });
    onClose();
  };

  /** Each option wearing today's real count, so the choice is the actual thing. */
  const preview = (option: CounterStyle) => {
    if (option === 'pill') {
      return <CountPill count={reels} size="compact" />;
    }
    if (option === 'mascot') {
      return (
        <View style={styles.mascotPreview}>
          <Mascot stage={stageFor(reels)} width={22} />
          <Text style={styles.plain}>{reels}</Text>
        </View>
      );
    }
    if (option === 'outline') {
      return (
        <View style={styles.outline}>
          <Text style={styles.outlineCount}>{reels}</Text>
        </View>
      );
    }
    if (option === 'glass') {
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
            style={styles.glassFace}>
            <Text style={styles.plain}>{reels}</Text>
          </LinearGradient>
        </LinearGradient>
      );
    }
    return <Text style={styles.plain}>{reels}</Text>;
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('settings.counterSheet.title')}>
      <Text style={styles.caption}>{t('settings.counterSheet.caption')}</Text>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.counterSheet.styleLabel')}</Text>
        <View style={styles.styleRow}>
          {CounterStyles.map((option) => (
            <Card
              key={option}
              selected={style === option}
              onPress={() => setStyle(option)}
              style={styles.styleCard}>
              <View style={styles.stagePreview}>{preview(option)}</View>
              <Text style={styles.styleName}>{t(`settings.counterSheet.styles.${option}`)}</Text>
            </Card>
          ))}
        </View>
      </View>

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
    styleCard: {
      /** Two and a bit per row, now that there are five to fit. */
      minWidth: 84,
      flexGrow: 1,
      flexBasis: '30%',
      gap: Spacing.two,
      alignItems: 'center',
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.two,
    },
    /** Fixed height, so five different previews do not stagger the cards. */
    stagePreview: {
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotPreview: {
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
    outline: {
      paddingHorizontal: Spacing.three,
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
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      borderRadius: Radius.pill - 1,
    },
    styleName: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
  });
