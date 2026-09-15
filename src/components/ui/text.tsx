import { StyleSheet, Text, type TextStyle } from 'react-native';

import { useMemo } from 'react';
import { Fonts, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Small quiet line that sits above a headline. */
export function Eyebrow({ children, style }: { children: string; style?: TextStyle }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

/** The one big deadpan line. Every onboarding step has exactly one. */
export function Headline({ children, style }: { children: string; style?: TextStyle }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return <Text style={[styles.headline, style]}>{children}</Text>;
}

/** One short supporting line. Never a paragraph. */
export function Caption({ children, style }: { children: string; style?: TextStyle }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return <Text style={[styles.caption, style]}>{children}</Text>;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    eyebrow: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: Fonts.bold,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    headline: {
      color: c.text,
      fontSize: 34,
      lineHeight: 40,
      fontFamily: Fonts.extraBold,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    caption: {
      color: c.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
  });
