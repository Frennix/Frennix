import { Link, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { config } from "@/lib/config";
import { Button, colors, spacing, typography } from "@frennix/ui";

function formatUsername(username: string | null | undefined) {
  const trimmed = username?.trim();
  return trimmed ? `@${trimmed}` : "No username yet";
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Sign out", style: "destructive", onPress: onConfirm },
  ]);
}

function showError(message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message);
    return;
  }
  Alert.alert("Sign out failed", message);
}

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      queryClient.clear();
      router.replace("/(auth)/login");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not sign out");
    } finally {
      setSigningOut(false);
    }
  }

  function confirmSignOut() {
    confirmAction("Sign out", "Are you sure you want to sign out?", handleSignOut);
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => Alert.alert("Could not open link"));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Account</Text>
      <Text style={styles.row}>{formatUsername(profile?.username)}</Text>

      <Text style={styles.section}>Legal</Text>
      <Pressable onPress={() => openUrl(config.privacyPolicyUrl)}>
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
      <Pressable onPress={() => openUrl(config.termsUrl)}>
        <Text style={styles.link}>Terms of Service</Text>
      </Pressable>

      <Text style={styles.section}>Coming soon</Text>
      <Link href="/matching" asChild>
        <Pressable>
          <Text style={styles.link}>Partner matching</Text>
        </Pressable>
      </Link>
      <Text style={styles.muted}>Marketplace · Premium · Live stream</Text>

      <View style={styles.footer}>
        <Button
          title="Sign out"
          variant="danger"
          onPress={confirmSignOut}
          loading={signingOut}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl },
  section: { ...typography.heading, fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { ...typography.body },
  link: { ...typography.body, color: colors.accent, paddingVertical: spacing.xs },
  muted: { ...typography.bodySmall },
  footer: { marginTop: "auto", paddingBottom: spacing.xl },
});
