import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import {
  formatPasswordResetCountdown,
  formatPasswordResetError,
  formatPasswordResetWaitMessage,
  resetPasswordForEmail,
  resolvePasswordResetRateLimitCooldown,
} from "@frennix/api";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import { getPasswordResetRedirectUrl } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/config";

const RESET_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [explicitCooldown, setExplicitCooldown] = useState(false);
  const [genericRateLimit, setGenericRateLimit] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((seconds) => {
        if (seconds <= 1) {
          setExplicitCooldown(false);
          setGenericRateLimit(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds > 0]);

  async function handleReset() {
    setError("");
    setSuccessMessage("");
    setGenericRateLimit(false);
    setExplicitCooldown(false);
    setLoading(true);
    try {
      await resetPasswordForEmail(email.trim(), getPasswordResetRedirectUrl());
      setSuccessMessage("Password reset email sent. Please check your inbox.");
      setCooldownSeconds(RESET_COOLDOWN_SECONDS);
      setExplicitCooldown(true);
    } catch (e) {
      const { cooldownSeconds: waitSeconds, hasExplicitWait } =
        resolvePasswordResetRateLimitCooldown(e);

      if (waitSeconds > 0) {
        setCooldownSeconds(waitSeconds);
        setExplicitCooldown(hasExplicitWait);
        setGenericRateLimit(!hasExplicitWait);
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

  const cooldownMessage =
    cooldownSeconds > 0 && explicitCooldown
      ? formatPasswordResetWaitMessage(cooldownSeconds)
      : null;

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

      {genericRateLimit && cooldownSeconds > 0 ? (
        <View style={styles.rateLimitBox}>
          <Text style={styles.rateLimitText}>
            Too many reset requests were sent. Please wait a few minutes before trying again.
          </Text>
          <Text style={styles.countdown}>{formatPasswordResetCountdown(cooldownSeconds)}</Text>
        </View>
      ) : null}

      {cooldownMessage ? <Text style={styles.cooldown}>{cooldownMessage}</Text> : null}

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
  rateLimitBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rateLimitText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22 },
  countdown: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  link: { alignItems: "center", marginTop: spacing.md },
  linkText: { color: colors.accent, fontSize: 16 },
});
