import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import {
  formatPasswordResetError,
  formatPasswordResetWaitMessage,
  PASSWORD_RESET_SUCCESS_COOLDOWN_SECONDS,
  resetPasswordForEmail,
  resolvePasswordResetRateLimitCooldown,
} from "@frennix/api";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import { getPasswordResetRedirectUrl } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/config";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds > 0]);

  async function handleReset() {
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      await resetPasswordForEmail(email.trim(), getPasswordResetRedirectUrl());
      setSuccessMessage("Password reset email sent. Please check your inbox.");
      setCooldownSeconds(PASSWORD_RESET_SUCCESS_COOLDOWN_SECONDS);
    } catch (e) {
      console.error("[password-reset] UI caught error", e);
      const waitSeconds = resolvePasswordResetRateLimitCooldown(e);
      if (waitSeconds > 0) {
        setCooldownSeconds(waitSeconds);
      } else {
        const friendlyError = formatPasswordResetError(e);
        if (friendlyError) setError(friendlyError);
      }
    } finally {
      setLoading(false);
    }
  }

  const canSend =
    Boolean(email.trim()) && isSupabaseConfigured() && !loading && cooldownSeconds === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>
        Enter your email and we will send a link to reset your password.
      </Text>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

      {cooldownSeconds > 0 ? (
        <Text style={styles.cooldown}>{formatPasswordResetWaitMessage(cooldownSeconds)}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Send reset link"
        onPress={handleReset}
        loading={loading}
        disabled={!canSend}
      />

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
  subtitle: { ...typography.bodySmall, marginBottom: spacing.md, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: 14 },
  success: { ...typography.body, color: colors.accent },
  cooldown: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22 },
  link: { alignItems: "center", marginTop: spacing.md },
  linkText: { color: colors.accent, fontSize: 16 },
});
