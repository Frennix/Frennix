import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { signUpWithEmail } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { storePendingReferralCode } from "@/lib/referral-storage";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import { FrennixLogo } from "@/components/FrennixLogo";

export default function SignupScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const { applySession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ref) {
      void storePendingReferralCode(ref);
    }
  }, [ref]);

  async function handleSignup() {
    setError("");
    setLoading(true);
    try {
      const { session } = await signUpWithEmail(email.trim(), password);

      if (!session) {
        setError("Account created. Check your email to confirm, then sign in.");
        return;
      }

      await applySession(session);
      router.replace("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FrennixLogo variant="full" height={56} style={styles.logo} />
      <Text style={styles.title}>Join Frennix</Text>
      <Text style={styles.subtitle}>Build your fitness community</Text>

      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Create account" onPress={handleSignup} loading={loading} />

      <Link href="/(auth)/login" style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md, justifyContent: "center" },
  logo: { alignSelf: "center", marginBottom: spacing.sm },
  title: { ...typography.title },
  subtitle: { ...typography.bodySmall, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 14 },
  link: { alignItems: "center", marginTop: spacing.md },
  linkText: { color: colors.accent, fontSize: 16 },
});
