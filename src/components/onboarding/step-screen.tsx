import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { Backdrop } from '@/components/backdrop';
import { GhostButton } from '@/components/ui';
import { StepProgress } from '@/components/onboarding/step-progress';
import { useMemo } from 'react';
import { MinTouch, type Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type StepScreenProps = {
  /** 1 through 6. Drives the progress bar. */
  step: number;
  /** Jumps straight to the paywall. Left out where there is nothing to skip. */
  onSkip?: () => void;
  children: ReactNode;
  footer: ReactNode;
};

export function StepScreen({ step, onSkip, children, footer }: StepScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Backdrop>
      <View style={styles.header}>
        <StepProgress step={step} />
        {onSkip ? <GhostButton label={t('common.skip')} onPress={onSkip} compact /> : null}
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>{footer}</View>
    </Backdrop>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingTop: Spacing.three,
      minHeight: MinTouch,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      gap: Spacing.four,
    },
    footer: {
      gap: Spacing.two,
      paddingBottom: Spacing.four,
    },
  });
