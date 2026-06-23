import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { FrennixLogo } from "@/components/FrennixLogo";
import { Button, colors, spacing, typography } from "@frennix/ui";

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <FrennixLogo variant="mark" height={120} style={styles.logo} />
      <Text style={styles.tagline}>
        Connect through shared fitness goals, accountability, and real-world training partners.
      </Text>
      <View style={styles.actions}>
        <Link href="/(auth)/login" asChild>
          <Button title="Sign in" />
        </Link>
        <Link href="/(auth)/signup" asChild>
          <Button title="Create account" variant="secondary" />
        </Link>
      </View>
      <Text style={styles.hint}>
        Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env to enable the backend.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.lg,
  },
  logo: { alignSelf: "center", marginBottom: spacing.md },
  tagline: { ...typography.body, color: colors.textSecondary, lineHeight: 26 },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  hint: { ...typography.caption, textAlign: "center", marginTop: spacing.xl },
});
