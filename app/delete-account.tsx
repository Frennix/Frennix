import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ACCOUNT_DELETION_INTACT_MESSAGE,
  ACCOUNT_DELETION_NOT_ENABLED_MESSAGE,
  ACCOUNT_DELETION_STORAGE_PENDING_MESSAGE,
  deleteOwnAccount,
  shouldAnnounceStoragePending,
} from "@frennix/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { confirmDeleteAccount, showAlert, showFriendlyError } from "@/lib/alerts";
import { redirectToLogin } from "@/lib/auth-navigation";
import { clearFeedCache } from "@/lib/feed-cache";
import { unregisterPushNotifications } from "@/lib/notifications";
import { Button, colors, spacing, typography } from "@frennix/ui";

const CONFIRM_WORD = "DELETE";

const DELETED_ITEMS = [
  "Your login and password",
  "Your profile, username, and photos",
  "Posts and Reels you created, including uploaded media",
  "Stories you created",
  "Comments, likes, and reactions you made",
  "Messages you sent",
  "Training matches, follows, and blocks you own",
  "Groups, challenges, and events you created",
];

const RETAINED_ITEMS = [
  "Other people's accounts, posts, and messages",
  "Conversation threads others still belong to",
  "Safety reports about you, kept without your name",
  "Backups and records Frennix may legally need to keep",
];

function deletionFailureFallback(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (raw.includes("Account deletion is not enabled on the server yet")) {
    return ACCOUNT_DELETION_NOT_ENABLED_MESSAGE;
  }
  return ACCOUNT_DELETION_INTACT_MESSAGE;
}

export default function DeleteAccountScreen() {
  const { session, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canSubmit = confirmText.trim() === CONFIRM_WORD && !deleting;

  async function runDelete() {
    setDeleting(true);
    try {
      const result = await deleteOwnAccount();
      if (shouldAnnounceStoragePending(result)) {
        showAlert("Account deleted", ACCOUNT_DELETION_STORAGE_PENDING_MESSAGE);
      }
      if (session?.user.id) {
        try {
          await unregisterPushNotifications(session.user.id);
        } catch {
          // Session is already invalid after a successful delete.
        }
        try {
          await clearFeedCache(session.user.id);
        } catch {
          // Local cache cleanup is best-effort.
        }
      }
      try {
        await signOut();
      } catch {
        // Auth user is already gone.
      }
      queryClient.clear();
      redirectToLogin();
    } catch (error) {
      showFriendlyError("Could not delete account", error, deletionFailureFallback(error));
    } finally {
      setDeleting(false);
    }
  }

  function handleDeletePress() {
    if (!canSubmit) return;
    confirmDeleteAccount(() => {
      void runDelete();
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Delete your account</Text>
      <Text style={styles.lede}>
        This permanently removes your Frennix account. It cannot be undone. Sign out only logs you
        out and does not delete anything.
      </Text>

      <Text style={styles.section}>This will delete</Text>
      {DELETED_ITEMS.map((item) => (
        <Text key={item} style={styles.bullet}>
          • {item}
        </Text>
      ))}

      <Text style={styles.section}>This will keep</Text>
      {RETAINED_ITEMS.map((item) => (
        <Text key={item} style={styles.bullet}>
          • {item}
        </Text>
      ))}

      <Text style={styles.section}>Confirm</Text>
      <Text style={styles.hint}>Type {CONFIRM_WORD} to enable the delete button.</Text>
      <TextInput
        value={confirmText}
        onChangeText={setConfirmText}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_WORD}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={!deleting}
        accessibilityLabel="Type DELETE to confirm account deletion"
      />

      <View style={styles.footer}>
        <Button
          title="Delete account"
          variant="danger"
          onPress={handleDeletePress}
          loading={deleting}
          disabled={!canSubmit}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.xs,
  },
  title: { ...typography.heading, fontSize: 22, marginBottom: spacing.sm },
  lede: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  section: { ...typography.heading, fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
  bullet: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footer: { marginTop: spacing.xl },
});
