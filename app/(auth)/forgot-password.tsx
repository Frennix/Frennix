import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { resetPasswordForEmail } from "@frennix/api";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import { isSupabaseConfigured } from "@/lib/config";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setError("");
    setLoading(true);
    try {
      await resetPasswordForEmail(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter your email and we will send a link to reset your password.
      </Text>

      {sent ? (
        <Text style={styles.success}>Check your email for a reset link.</Text>
      ) : (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Send reset link"
            onPress={handleReset}
            loading={loading}
            disabled={!email || !isSupabaseConfigured()}
          />
        </>
      )}

      <Link href="/(auth)/login" style={styles.link}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
    justifyContent: "center",
  },
  title: { ...typography.title },
  subtitle: { ...typography.bodySmall, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 14 },
  success: { ...typography.body, color: colors.accent },
  link: { alignItems: "center", marginTop: spacing.md },
  linkText: { color: colors.accent, fontSize: 16 },
});
