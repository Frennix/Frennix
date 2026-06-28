import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { claimPlatformBootstrap, getPlatformBootstrapStatus } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { hashStaffToken } from "@/lib/founder/crypto";
import { Button, EmptyState, colors, spacing, typography } from "@frennix/ui";

export default function FounderBootstrapScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const bootstrapQuery = useQuery({
    queryKey: ["platform-bootstrap-status"],
    queryFn: getPlatformBootstrapStatus,
  });

  useEffect(() => {
    if (bootstrapQuery.data && !bootstrapQuery.data.needs_bootstrap) {
      router.replace("/founder/admin");
    }
  }, [bootstrapQuery.data, router]);

  if (bootstrapQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!bootstrapQuery.data?.needs_bootstrap) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Bootstrap not needed"
          description="This platform already has an owner. Use a staff invite link to join the team."
        />
      </View>
    );
  }

  if (!session?.user.id) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Sign in required"
          description="Sign in to your Frennix account, then enter your bootstrap token to claim platform owner access."
        />
      </View>
    );
  }

  if (!bootstrapQuery.data.bootstrap_configured) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Bootstrap not configured"
          description="Run the founder-bootstrap-init Edge Function once with FOUNDER_BOOTSTRAP_SECRET set, then return here with that secret."
        />
      </View>
    );
  }

  async function handleClaim() {
    if (!token.trim()) return;
    setStatus("loading");
    try {
      const tokenHash = await hashStaffToken(token.trim());
      await claimPlatformBootstrap(tokenHash);
      setStatus("success");
      setMessage("Platform owner access granted. You can now invite staff from Admin.");
      setTimeout(() => router.replace("/founder/admin"), 1500);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Bootstrap claim failed");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Platform Setup</Text>
      <Text style={styles.body}>
        One-time owner bootstrap. Enter the secret configured via the founder-bootstrap-init Edge Function.
      </Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="Bootstrap secret"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />
      {message ? <Text style={status === "error" ? styles.error : styles.success}>{message}</Text> : null}
      <Button
        title={status === "loading" ? "Claiming…" : "Claim Owner Access"}
        onPress={() => void handleClaim()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  title: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.textSecondary },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { ...typography.caption, color: colors.danger },
  success: { ...typography.caption, color: colors.accent },
});
