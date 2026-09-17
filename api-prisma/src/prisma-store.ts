import type { Db } from './db.ts';
import { FreeFriendCap } from './rules.ts';
import type { OnboardingRow, PreferencePatch, UsageRow } from './rules.ts';
import type { AcceptOutcome, BoardMember, InviterRecord, ProfileRecord, Store, SubscriptionState } from './store.ts';

/** `@db.Date` columns are whole days. Build them at UTC midnight so no timezone shifts one. */
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);
const asDateKey = (date: Date) => date.toISOString().slice(0, 10);

const profileFields = {
  id: true,
  displayName: true,
  avatarUrl: true,
  dailyLimit: true,
  counterStyle: true,
  counterPositionX: true,
  counterPositionY: true,
  notificationsEnabled: true,
  screenTimeGranted: true,
  overlayGranted: true,
  premium: true,
  subscriptionStatus: true,
  subscriptionExpiresAt: true,
  inviteCode: true,
  inviteExpiresAt: true,
} as const;

export function prismaStore(db: Db): Store {
  return {
    async profile(userId) {
      return db.profile.findUnique({ where: { id: userId }, select: profileFields });
    },

    async updatePreferences(userId, patch: PreferencePatch) {
      return db.profile.update({ where: { id: userId }, data: patch, select: profileFields });
    },

    async addUsage(userId, rows: UsageRow[]) {
      /** Additive, so a retried sync adds rather than overwrites, and all of it lands or none does. */
      await db.$transaction(
        rows.map((row) =>
          db.dailyUsage.upsert({
            where: {
              userId_usageDate_appKey: { userId, usageDate: asDate(row.date), appKey: row.app },
            },
            create: { userId, usageDate: asDate(row.date), appKey: row.app, reels: row.reels },
            update: { reels: { increment: row.reels } },
          }),
        ),
      );
    },

    async usageRange(userId, from, to) {
      const rows = await db.dailyUsage.findMany({
        where: { userId, usageDate: { gte: asDate(from), lte: asDate(to) } },
        select: { usageDate: true, appKey: true, reels: true },
        orderBy: { usageDate: 'asc' },
      });
      return rows.map((row) => ({ date: asDateKey(row.usageDate), app: row.appKey, reels: row.reels }));
    },

    async board(userId, date): Promise<BoardMember[]> {
      const friends = await db.friendship.findMany({ where: { userId }, select: { friendId: true } });
      const ids = [userId, ...friends.map((friend) => friend.friendId)];

      /**
       * Two reads rather than the one the database function did. Prisma has no
       * way to express that join with a per person sum, and raw SQL here would
       * be the other backend with extra steps.
       */
      const [people, totals] = await Promise.all([
        db.profile.findMany({
          where: { id: { in: ids } },
          select: { id: true, displayName: true, avatarUrl: true, premium: true },
        }),
        db.dailyUsage.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, usageDate: asDate(date) },
          _sum: { reels: true },
        }),
      ]);

      const reelsByUser = new Map(totals.map((total) => [total.userId, total._sum.reels ?? 0]));
      return people.map((person) => ({
        id: person.id,
        name: person.displayName,
        avatarUrl: person.avatarUrl,
        premium: person.premium,
        reels: reelsByUser.get(person.id) ?? 0,
      }));
    },

    async setInvite(userId, code, expiresAt) {
      await db.profile.update({ where: { id: userId }, data: { inviteCode: code, inviteExpiresAt: expiresAt } });
    },

    async inviterByCode(code): Promise<InviterRecord | null> {
      const inviter = await db.profile.findUnique({
        where: { inviteCode: code },
        select: { id: true, displayName: true, avatarUrl: true, inviteExpiresAt: true },
      });
      return inviter
        ? { id: inviter.id, name: inviter.displayName, avatarUrl: inviter.avatarUrl, inviteExpiresAt: inviter.inviteExpiresAt }
        : null;
    },

    async acceptInvite(userId, inviterId): Promise<AcceptOutcome> {
      return db.$transaction(async (tx) => {
        /**
         * Locks both accounts first, in a fixed order, so two people racing for
         * the last free seat are settled one after the other. This was `for
         * update` inside `accept_invite`, and it is the one place raw SQL is
         * unavoidable: Prisma cannot express a row lock.
         */
        await tx.$executeRawUnsafe(
          'select 1 from profiles where id = any($1::uuid[]) order by id for update',
          [userId, inviterId].sort(),
        );

        const already = await tx.friendship.findUnique({
          where: { userId_friendId: { userId, friendId: inviterId } },
          select: { userId: true },
        });
        if (already) {
          return 'already_friends';
        }

        const [me, inviter] = await Promise.all([
          tx.profile.findUnique({ where: { id: userId }, select: { premium: true, _count: { select: { friends: true } } } }),
          tx.profile.findUnique({ where: { id: inviterId }, select: { premium: true, _count: { select: { friends: true } } } }),
        ]);
        if (!me || !inviter) {
          return 'cap_inviter';
        }
        if (!me.premium && me._count.friends >= FreeFriendCap) {
          return 'cap_self';
        }
        if (!inviter.premium && inviter._count.friends >= FreeFriendCap) {
          return 'cap_inviter';
        }

        await tx.friendship.createMany({
          data: [
            { userId, friendId: inviterId },
            { userId: inviterId, friendId: userId },
          ],
        });
        return 'accepted';
      });
    },

    async addFeedback(userId, topic, message) {
      await db.feedback.create({ data: { userId, topic, message } });
    },

    async progress(installId, userId) {
      const rows = await db.onboardingProgress.findMany({
        where: userId ? { OR: [{ installId }, { userId }] } : { installId },
        select: {
          installId: true,
          userId: true,
          currentStep: true,
          furthestStep: true,
          reachedAt: true,
          completedAt: true,
        },
      });

      return rows.map((row) => ({
        installId: row.installId,
        userId: row.userId,
        currentStep: row.currentStep,
        furthestStep: row.furthestStep,
        reachedAt: (row.reachedAt ?? {}) as Record<string, string>,
        completedAt: row.completedAt,
      }));
    },

    async writeProgress(installId, row: OnboardingRow) {
      const now = new Date();
      await db.onboardingProgress.upsert({
        where: { installId },
        create: {
          installId,
          userId: row.userId,
          currentStep: row.currentStep,
          furthestStep: row.furthestStep,
          reachedAt: row.reachedAt,
          startedAt: now,
          completedAt: row.completedAt,
          updatedAt: now,
        },
        update: {
          userId: row.userId,
          currentStep: row.currentStep,
          furthestStep: row.furthestStep,
          reachedAt: row.reachedAt,
          completedAt: row.completedAt,
          updatedAt: now,
        },
      });
    },

    async setSubscription(userId, state: SubscriptionState) {
      /** An id RevenueCat knows but this database does not is ignored, not raised. */
      await db.profile.updateMany({
        where: { id: userId },
        data: {
          subscriptionStatus: state.status,
          subscriptionProductId: state.productId,
          subscriptionStore: state.store,
          subscriptionExpiresAt: state.expiresAt ? new Date(state.expiresAt) : null,
        },
      });
    },
  };
}

/** The profile as the app receives it, matching the other backend exactly. */
export function toProfileJson(profile: ProfileRecord, email: string | null = null) {
  return {
    id: profile.id,
    name: profile.displayName,
    email,
    avatarUrl: profile.avatarUrl,
    dailyLimit: profile.dailyLimit,
    counterStyle: profile.counterStyle,
    counterPosition: { x: profile.counterPositionX, y: profile.counterPositionY },
    notificationsEnabled: profile.notificationsEnabled,
    screenTimeGranted: profile.screenTimeGranted,
    overlayGranted: profile.overlayGranted,
    premium: profile.premium,
    subscription: {
      status: profile.subscriptionStatus,
      expiresAt: profile.subscriptionExpiresAt ? profile.subscriptionExpiresAt.toISOString() : null,
    },
  };
}
