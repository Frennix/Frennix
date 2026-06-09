import { Link, router } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { signOut } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { config } from "@/lib/config";
import { Button, colors, spacing, typography } from "@frennix/ui";

function formatUsername(username: string | null | undefined) {
  const trimmed = username?.trim();
  return trimmed ? `@${trimmed}` : "No username yet";
}

export default function SettingsScreen() {
  const { profile } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

  function confirmSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: handleSignOut },
    ]);
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
        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
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
