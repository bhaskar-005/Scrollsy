import { StyleSheet, Text, View } from "react-native";

import type { Stage } from "@/constants/stages";
import { Fonts, Overlay, Radius, Spacing } from "@/constants/theme";
import { t, type TranslationKey } from "@/i18n";

/**
 * What he has to say about it, in a bubble over his head.
 *
 * Four lines a stage rather than one, because the same sentence every time
 * stops being read after a day and this screen is meant to be opened again
 * tomorrow. Which of the four shows is worked out from the count itself, so it
 * holds still while nothing is happening and turns over as the number climbs.
 */
const Lines: Record<Stage, TranslationKey[]> = {
  fresh: [
    "home.thoughts.fresh.a",
    "home.thoughts.fresh.b",
    "home.thoughts.fresh.c",
    "home.thoughts.fresh.d",
  ],
  buzzed: [
    "home.thoughts.buzzed.a",
    "home.thoughts.buzzed.b",
    "home.thoughts.buzzed.c",
    "home.thoughts.buzzed.d",
  ],
  dizzy: [
    "home.thoughts.dizzy.a",
    "home.thoughts.dizzy.b",
    "home.thoughts.dizzy.c",
    "home.thoughts.dizzy.d",
  ],
  fried: [
    "home.thoughts.fried.a",
    "home.thoughts.fried.b",
    "home.thoughts.fried.c",
    "home.thoughts.fried.d",
  ],
  cooked: [
    "home.thoughts.cooked.a",
    "home.thoughts.cooked.b",
    "home.thoughts.cooked.c",
    "home.thoughts.cooked.d",
  ],
};

/** How many reels pass before he says the next thing. */
const ReelsPerLine = 25;

export function Thought({ stage, reels }: { stage: Stage; reels: number }) {
  const lines = Lines[stage];
  const line = lines[Math.floor(reels / ReelsPerLine) % lines.length];

  return (
    <View style={styles.thought}>
      <View style={styles.bubble}>
        <Text style={styles.line}>{t(line)}</Text>
      </View>
      {/** A square turned on its point, half hidden behind the bubble above it. */}
      <View style={styles.tail} />
    </View>
  );
}

/**
 * Fixed rather than themed, like the art plate on a sheet. See `Overlay`.
 */
const styles = StyleSheet.create({
  thought: {
    alignItems: "center",
  },
  bubble: {
    maxWidth: 260,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Overlay.bubble,
    borderWidth: 1,
    borderColor: Overlay.bubbleEdge,
  },
  line: {
    color: Overlay.bubbleText,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    textAlign: "center",
  },
  tail: {
    width: 12,
    height: 12,
    marginTop: -7,
    transform: [{ rotate: "45deg" }],
    backgroundColor: Overlay.bubble,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Overlay.bubbleEdge,
  },
});
