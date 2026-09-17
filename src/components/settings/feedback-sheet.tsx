import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, Sheet } from '@/components/ui';
import { Fonts, Radius, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FeedbackTopics, MaxFeedback, sendFeedback, type FeedbackTopic } from '@/lib/feedback';
import { t } from '@/i18n';

/** Room for a few lines without turning the sheet into a page. */
const BoxHeight = 104;

export function FeedbackSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [topic, setTopic] = useState<FeedbackTopic>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    setMessage('');
    setFailed(false);
    onClose();
  };

  const send = async () => {
    setSending(true);
    setFailed(false);
    try {
      await sendFeedback(topic, message);
      close();
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title={t('settings.feedbackSheet.title')}>
      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.feedbackSheet.topicLabel')}</Text>

        {/** Chips rather than a dropdown, so every choice is one tap away. */}
        <View style={styles.chips}>
          {FeedbackTopics.map((option) => (
            <Pressable
              key={option}
              onPress={() => setTopic(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: topic === option }}
              style={({ pressed }) => [
                styles.chip,
                topic === option && styles.chipOn,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipLabel, topic === option && styles.chipLabelOn]}>
                {t(`settings.feedbackSheet.topics.${option}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('settings.feedbackSheet.messageLabel')}</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={MaxFeedback}
          textAlignVertical="top"
          placeholder={t('settings.feedbackSheet.placeholder')}
          placeholderTextColor={theme.textFaint}
          style={styles.box}
        />
      </View>

      {failed ? <Text style={styles.failed}>{t('settings.feedbackSheet.failed')}</Text> : null}

      <PrimaryButton
        label={sending ? t('settings.feedbackSheet.sending') : t('settings.feedbackSheet.send')}
        onPress={() => void send()}
        disabled={sending || message.trim().length === 0}
      />
    </Sheet>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
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
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    chip: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chipOn: {
      borderColor: c.borderActive,
      backgroundColor: c.accentSoft,
    },
    chipLabel: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.bold,
      fontWeight: '700',
    },
    chipLabelOn: {
      color: c.text,
    },
    pressed: {
      opacity: 0.8,
    },
    failed: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: Fonts.semiBold,
      fontWeight: '600',
      textAlign: 'center',
    },
    box: {
      minHeight: BoxHeight,
      padding: Spacing.three,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      color: c.text,
      fontSize: 15,
      lineHeight: 21,
      fontFamily: Fonts.medium,
      fontWeight: '500',
    },
  });
