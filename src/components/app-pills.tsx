import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppUsage } from '@/constants/apps';
import { AppBrand, Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const iconStart = { x: 0, y: 0 };
const iconEnd = { x: 1, y: 1 };

/**
 * Where today's reels came from, as one pill under the count.
 *
 * The big number says how bad it was. This says where it happened, which is
 * the part people recognise themselves in. Deliberately small and quiet: the
 * count above it is the thing on this screen, and the button below it is the
 * thing to press.
 *
 * Nothing counted yet means nothing to show, so it draws no empty shell.
 */
export function AppPills({ apps }: { apps: AppUsage[] }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (apps.length === 0) {
    return null;
  }

  return (
    <View style={styles.pill}>
      {apps.map((app, index) => (
        <View key={app.icon} style={styles.slot}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <LinearGradient
            colors={AppBrand[app.icon]}
            start={iconStart}
            end={iconEnd}
            style={styles.icon}>
            <FontAwesome6 name={app.icon} brand size={13} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.count}>{app.reels}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignSelf: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.two,
      borderRadius: Radius.pill,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    slot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.two,
    },
    /** A hairline between apps, rather than a gap that reads as two pills. */
    divider: {
      width: 1,
      height: 18,
      marginRight: Spacing.two,
      backgroundColor: c.border,
    },
    icon: {
      width: 24,
      height: 24,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    count: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
  });
