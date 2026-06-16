import { Redirect, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { updatePassword } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";

export default function ResetPasswordScreen() {
  const { session, loading, passwordRecovery, signOut, clearPasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccessMessage("Password updated successfully.");
      clearPasswordRecovery();
      await signOut();
      setTimeout(() => {
        router.replace("/(auth)/login");
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!session || !passwordRecovery) {
    return <Redirect href="/(auth)/login" />;
  }

  const canSubmit =
    password.length >= 8 && confirmPassword.length >= 8 && !submitting && !successMessage;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.subtitle}>Choose a new password for your Frennix account.</Text>

      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      <Input
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title="Update password"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />
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
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  title: { ...typography.title },
  subtitle: { ...typography.bodySmall, marginBottom: spacing.md, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 14 },
  success: { ...typography.body, color: colors.accent },
});
