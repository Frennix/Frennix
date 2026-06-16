import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { getReferralStats, getReferredFriends } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import {
  copyInviteLink,
  getInviteLink,
  inviteViaSms,
  shareInviteLink,
  shareToSocial,
} from "@/lib/invite";
import { Avatar, Button, EmptyState, colors, radius, spacing, typography } from "@frennix/ui";

export default function InviteFriendsScreen() {
  const { profile } = useAuth();
  const userId = profile?.id ?? "";
  const referralCode = profile?.referral_code ?? "";
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["referral-stats", userId],
    queryFn: () => getReferralStats(userId),
    enabled: !!userId,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ["referred-friends", userId],
    queryFn: () => getReferredFriends(userId),
    enabled: !!userId,
  });

  async function runAction(action: string, fn: () => Promise<void>) {
    setBusyAction(action);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  }

  if (!profile?.referral_code) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Invite link loading"
          description="Complete your profile setup to get your personal invite link."
        />
      </View>
    );
  }

  const displayName = profile.display_name || "A friend";
  const inviteLink = getInviteLink(referralCode);
  const friendsJoined = stats?.friendsJoined ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroNumber}>{friendsJoined}</Text>
        <Text style={styles.heroLabel}>
          {friendsJoined === 1 ? "friend joined" : "friends joined"} from your invites
        </Text>
      </View>

      <View style={styles.linkCard}>
        <Text style={styles.linkLabel}>Your invite link</Text>
        <Text style={styles.linkText} selectable>
          {inviteLink}
        </Text>
        <Button
          title="Copy link"
          variant="secondary"
          onPress={() => runAction("copy", () => copyInviteLink(referralCode))}
          loading={busyAction === "copy"}
        />
      </View>

      <View style={styles.actions}>
        <Button
          title="Share invite link"
          onPress={() => runAction("share", () => shareInviteLink(displayName, referralCode))}
          loading={busyAction === "share"}
        />
        <Button
          title="Invite via text message"
          variant="secondary"
          onPress={() => runAction("sms", () => inviteViaSms(displayName, referralCode))}
          loading={busyAction === "sms"}
        />
        <Button
          title="Share on social media"
          variant="secondary"
          onPress={() => runAction("social", () => shareToSocial(displayName, referralCode))}
          loading={busyAction === "social"}
        />
      </View>

      {friends.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friends who joined</Text>
          {friends.map((friend) => (
            <View key={friend.id} style={styles.friendRow}>
              <Avatar uri={friend.avatar_url} name={friend.display_name} size={40} />
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friend.display_name}</Text>
                <Text style={styles.friendUsername}>@{friend.username}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          Share your link with training partners. When they sign up and finish onboarding, they&apos;ll
          show up here.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  hero: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  heroNumber: { ...typography.title, fontSize: 48, color: colors.accent },
  heroLabel: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  linkCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  linkLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  linkText: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  actions: { gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.heading, fontSize: 18 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  friendInfo: { flex: 1, gap: 2 },
  friendName: { ...typography.body, fontWeight: "600", color: colors.text },
  friendUsername: { ...typography.caption, color: colors.textMuted },
  hint: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
});
