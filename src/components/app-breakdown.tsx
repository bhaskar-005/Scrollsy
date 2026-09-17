import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { AppUsage } from '@/constants/apps';
import { AppBrand, Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const iconStart = { x: 0, y: 0 };
const iconEnd = { x: 1, y: 1 };

/** Which apps made up a count, most reels first. Same row shape wherever it shows up. */
export function AppBreakdownCard({ title, apps }: { title: string; apps: AppUsage[] }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {apps.length === 0 ? <Text style={styles.empty}>{t('stats.nothingCounted')}</Text> : null}

      {apps.map((app, index) => (
        <View key={app.name} style={[styles.row, index < apps.length - 1 && styles.rowDivided]}>
          <LinearGradient
            colors={AppBrand[app.icon]}
            start={iconStart}
            end={iconEnd}
            style={styles.icon}>
            <FontAwesome6 name={app.icon} brand size={16} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.name} numberOfLines={1}>
            {app.name}
          </Text>
          <Text style={styles.count}>{app.reels}</Text>
        </View>
      ))}
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      gap: Spacing.two,
    },
    title: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    empty: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.medium,
      fontWeight: '500',
      paddingVertical: Spacing.one,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingVertical: Spacing.two,
    },
    rowDivided: {
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    name: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    count: {
      color: c.text,
      fontSize: 16,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
    },
  });
