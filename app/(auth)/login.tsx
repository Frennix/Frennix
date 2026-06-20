import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  formatAuthErrorForDisplay,
  formatLoginError,
  getAuthErrorDetails,
  getSupabase,
  signInWithEmail,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { startPresenceTracking } from "@/lib/presence";
import { showAlert } from "@/lib/alerts";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import { isSupabaseConfigured } from "@/lib/config";

export default function LoginScreen() {
  const { applySession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);

    let session = null;
    try {
      const data = await signInWithEmail(email.trim(), password);
      session = data.session;
      if (!session) {
        const err = new Error("Sign in succeeded but no session was returned.");
        console.error("[sign-in] missing session after signInWithPassword", {
          userId: data.user?.id,
        });
        throw err;
      }
    } catch (e) {
      const message = formatLoginError(e);
      console.error("[sign-in] signInWithPassword failed", getAuthErrorDetails(e));
      showAlert("Sign in failed", formatAuthErrorForDisplay(e));
      setError(message);
      setLoading(false);
      return;
    }

    try {
      console.info("[sign-in] applying session", { userId: session.user.id });
      await applySession(session);
      startPresenceTracking(session.user.id, "login");
      router.replace("/");
    } catch (e) {
      console.error("[sign-in] post-auth applySession failed", e);
      const detail = formatAuthErrorForDisplay(e);
      showAlert("Signed in, but setup failed", detail);
      setError(`Signed in, but could not load your profile. ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No identity token");

      const { error } = await getSupabase().auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
      const { data: sessionData } = await getSupabase().auth.getSession();
      await applySession(sessionData.session);
      if (sessionData.session?.user.id) {
        startPresenceTracking(sessionData.session.user.id, "login-apple");
      }
      router.replace("/");
    } catch (e) {
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        setError(e instanceof Error ? e.message : "Apple sign in failed");
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Train together. Grow together.</Text>

      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Sign in" onPress={handleLogin} loading={loading} disabled={!isSupabaseConfigured()} />

      {Platform.OS === "ios" ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={12}
          style={styles.apple}
          onPress={handleApple}
        />
      ) : null}

      <Link href="/(auth)/forgot-password" style={styles.link}>
        <Text style={styles.linkText}>Forgot password?</Text>
      </Link>

      <Link href="/(auth)/signup" style={styles.link}>
        <Text style={styles.linkText}>New to Frennix? Create account</Text>
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md, justifyContent: "center" },
  title: { ...typography.title },
  subtitle: { ...typography.bodySmall, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 14 },
  apple: { height: 48, width: "100%" },
  link: { alignItems: "center", marginTop: spacing.md },
  linkText: { color: colors.accent, fontSize: 16 },
});
