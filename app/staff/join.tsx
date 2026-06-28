import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { acceptStaffInvite } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { hashStaffToken } from "@/lib/founder/crypto";
import { Button, EmptyState, colors, spacing, typography } from "@frennix/ui";

export default function StaffJoinScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !session?.user.id || status !== "idle") return;

    let cancelled = false;
    setStatus("loading");

    void (async () => {
      try {
        const tokenHash = await hashStaffToken(String(token));
        const role = await acceptStaffInvite(tokenHash);
        if (cancelled) return;
        setStatus("success");
        setMessage(`Staff access granted (${role}). Open the Founder Dashboard from Settings.`);
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not accept invite");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, session?.user.id, status]);

  if (!token) {
    return (
      <View style={styles.container}>
        <EmptyState title="Invalid invite" description="This staff invite link is missing a token." />
      </View>
    );
  }

  if (!session?.user.id) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Sign in required"
          description="Sign in to your Frennix account, then open this invite link again."
        />
      </View>
    );
  }

  if (status === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Accepting staff invite…</Text>
      </View>
    );
  }

  if (status === "success") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to the team</Text>
        <Text style={styles.body}>{message}</Text>
        <Button title="Open Founder Dashboard" onPress={() => router.replace("/founder")} />
      </View>
    );
  }

  if (status === "error") {
    return (
      <View style={styles.container}>
        <EmptyState title="Invite failed" description={message ?? "Could not accept invite."} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: { ...typography.bodySmall, color: colors.textSecondary },
  title: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
});
