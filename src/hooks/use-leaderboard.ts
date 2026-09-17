import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchBoard, readBoard, type BoardEntry } from '@/lib/board';
import { useTodayReels } from '@/hooks/use-today-reels';

export type Leaderboard = {
  entries: BoardEntry[];
  /** True only before there is anything at all to draw. A cached board never waits. */
  loading: boolean;
  /** The last read failed and there is nothing cached to fall back on. */
  failed: boolean;
  refresh: () => void;
};

/**
 * You and your friends, for today. Read again every time the tab comes into
 * view, since the whole point of the screen is who moved while you were away.
 *
 * Your own row is raised to this device's count when that is higher. The
 * server only knows what has been synced, and a number that goes down when you
 * switch tabs reads as a bug.
 */
export function useLeaderboard(): Leaderboard {
  const [entries, setEntries] = useState<BoardEntry[]>(() => readBoard() ?? []);
  const [loading, setLoading] = useState(() => readBoard() === null);
  const [failed, setFailed] = useState(false);
  const reels = useTodayReels();

  const refresh = useCallback(() => {
    fetchBoard().then(
      (board) => {
        setEntries(board);
        setFailed(false);
        setLoading(false);
      },
      () => {
        setFailed(readBoard() === null);
        setLoading(false);
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const mine = entries.map((entry) =>
    entry.isMe && reels > entry.reels ? { ...entry, reels } : entry,
  );

  return {
    entries: [...mine].sort((a, b) => a.reels - b.reels),
    loading,
    failed,
    refresh,
  };
}
