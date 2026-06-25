import { Link } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";
import { redirectToLogin } from "@/lib/auth-navigation";
import { useAuth } from "@/providers/AuthProvider";
import { config } from "@/lib/config";
import { unregisterPushNotifications } from "@/lib/notifications";
import { pushScreen } from "@/lib/press-utils";
import { FrennixLogo } from "@/components/FrennixLogo";
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
  const { profile, signOut, session } = useAuth();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      if (session?.user.id) {
        await unregisterPushNotifications(session.user.id);
      }
      await signOut();
      queryClient.clear();
      redirectToLogin();
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FrennixLogo variant="icon" height={28} style={styles.brandMark} />
      <Text style={styles.section}>Account</Text>
      <Text style={styles.row}>{formatUsername(profile?.username)}</Text>

      <Text style={styles.section}>Matching</Text>
      <Pressable onPress={() => pushScreen("/matching")}>
        <Text style={styles.link}>Find training partners</Text>
        <Text style={styles.linkHint}>Browse athletes who share your goals and workout style</Text>
      </Pressable>
      <Pressable onPress={() => pushScreen("/matching/matches")}>
        <Text style={styles.link}>Training matches</Text>
        <Text style={styles.linkHint}>Open chat with athletes you connected with</Text>
      </Pressable>
      <Pressable onPress={() => pushScreen("/matching-settings")}>
        <Text style={styles.link}>Training partner preferences</Text>
        <Text style={styles.linkHint}>Discovery, private filters, and profile readiness</Text>
      </Pressable>
      <Pressable onPress={() => pushScreen("/trainers")}>
        <Text style={styles.link}>Find a trainer</Text>
        <Text style={styles.linkHint}>Browse verified coaches — separate from Training Partners</Text>
      </Pressable>
      <Pressable onPress={() => pushScreen("/trainers/connections")}>
        <Text style={styles.link}>Trainer connections</Text>
        <Text style={styles.linkHint}>Coaching requests and connected trainers</Text>
      </Pressable>
      {profile?.is_trainer ? (
        <Pressable onPress={() => pushScreen("/trainer-profile/edit")}>
          <Text style={styles.link}>Trainer profile</Text>
          <Text style={styles.linkHint}>Bio, specialties, certifications, and portfolio</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => pushScreen("/trainer-profile/setup")}>
          <Text style={styles.link}>Become a trainer</Text>
          <Text style={styles.linkHint}>Add a coaching profile alongside your athlete account</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Invite</Text>
      <Link href="/invite-friends" asChild>
        <Pressable>
          <Text style={styles.link}>Invite friends</Text>
        </Pressable>
      </Link>

      <Text style={styles.section}>Safety</Text>
      <Link href="/blocked-users" asChild>
        <Pressable>
          <Text style={styles.link}>Blocked users</Text>
        </Pressable>
      </Link>

      {profile?.is_admin ? (
        <>
          <Text style={styles.section}>Admin</Text>
          <Link href="/admin-moderation" asChild>
            <Pressable>
              <Text style={styles.link}>Moderation panel</Text>
            </Pressable>
          </Link>
          <Link href="/admin-feedback" asChild>
            <Pressable>
              <Text style={styles.link}>Feedback dashboard</Text>
            </Pressable>
          </Link>
          <Link href="/admin-trainer-review" asChild>
            <Pressable>
              <Text style={styles.link}>Trainer certification review</Text>
            </Pressable>
          </Link>
          <Link href="/admin-analytics" asChild>
            <Pressable>
              <Text style={styles.link}>Product analytics</Text>
            </Pressable>
          </Link>
        </>
      ) : null}

      <Text style={styles.section}>Beta</Text>
      <Link href="/beta-feedback" asChild>
        <Pressable>
          <Text style={styles.link}>Send feedback</Text>
          <Text style={styles.linkHint}>Report bugs, suggest features, or share general feedback</Text>
        </Pressable>
      </Link>

      <Text style={styles.section}>Notifications</Text>
      <Link href="/notification-settings" asChild>
        <Pressable>
          <Text style={styles.link}>Notification settings</Text>
          <Text style={styles.linkHint}>Training matches, messages, and activity alerts</Text>
        </Pressable>
      </Link>

      <Text style={styles.section}>Legal</Text>
      <Pressable onPress={() => openUrl(config.privacyPolicyUrl)}>
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
      <Pressable onPress={() => openUrl(config.termsUrl)}>
        <Text style={styles.link}>Terms of Service</Text>
      </Pressable>

      <Text style={styles.section}>Coming soon</Text>
      <Text style={styles.muted}>Marketplace · Premium · Live stream</Text>

      <View style={styles.footer}>
        <Button
          title="Sign out"
          variant="danger"
          onPress={confirmSignOut}
          loading={signingOut}
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
    flexGrow: 1,
  },
  brandMark: { marginBottom: spacing.sm },
  section: { ...typography.heading, fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { ...typography.body },
  link: { ...typography.body, color: colors.accent, paddingVertical: spacing.xs },
  linkHint: { ...typography.caption, color: colors.textMuted, marginTop: -2, marginBottom: spacing.xs },
  muted: { ...typography.bodySmall },
  footer: { marginTop: spacing.xl },
});
