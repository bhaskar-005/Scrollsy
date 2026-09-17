import { api } from '@/lib/api';

/** What a message can be about. Matches the check constraint on `feedback`. */
export const FeedbackTopics = ['bug', 'idea', 'billing', 'other'] as const;

export type FeedbackTopic = (typeof FeedbackTopics)[number];

/** The longest message the column takes, so the sheet stops before the server does. */
export const MaxFeedback = 4000;

/** Sent straight away rather than queued. A person is watching the button. */
export async function sendFeedback(topic: FeedbackTopic, message: string): Promise<void> {
  await api('/feedback', {
    method: 'POST',
    body: { topic, message: message.trim().slice(0, MaxFeedback) },
  });
}
