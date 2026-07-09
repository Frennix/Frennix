import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  formatAuthErrorForDisplay,
  formatLoginError,
  getAuthErrorDetails,
  getSupabase,
  signInWithEmail,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import { FrennixLogo } from "@/components/FrennixLogo";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { isSupabaseConfigured } from "@/lib/config";
import { logDiagnostic, markDiagnosticFailure, markDiagnosticSuccess } from "@/lib/client-diagnostics";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { webAppShell } from "@/lib/flex-layout";

export default function LoginScreen() {
  const { applySession } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hideFrennixBootShell();
  }, []);

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
      console.error("[sign-in] signInWithPassword failed", getAuthErrorDetails(e));
      const friendly = formatLoginError(e);
      showAlert("Sign in failed", friendly);
      setError(friendly);
      setLoading(false);
      return;
    }

    try {
      console.info("[sign-in] applying session", { userId: session.user.id });
      await applySession(session);
      markDiagnosticSuccess("auth.login", { userId: session.user.id.slice(0, 8) });
      logDiagnostic("auth", "login session applied", "info", { email: session.user.email });
      router.replace("/");
    } catch (e) {
      console.error("[sign-in] post-auth applySession failed", e);
      markDiagnosticFailure("auth.applySession", e, { userId: session.user.id.slice(0, 8) });
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

      const { error: signInError } = await getSupabase().auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (signInError) throw signInError;
      const { data: sessionData } = await getSupabase().auth.getSession();
      await applySession(sessionData.session);
      router.replace("/");
    } catch (e) {
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        setError(formatAuthErrorForDisplay(e));
      }
    }
  }

  const form = (
    <>
      <FrennixLogo variant="full" height={56} style={styles.logo} />
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Train together. Grow together.</Text>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        placeholder="Your password"
      />
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
    </>
  );

  return (
    <StartupMountProbe id="auth-login">
      {Platform.OS === "web" ? (
        <ScrollView
          nativeID="auth-login-screen"
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, spacing.xl) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {form}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          nativeID="auth-login-screen"
          style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {form}
        </KeyboardAvoidingView>
      )}
    </StartupMountProbe>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === "web" ? webAppShell : null),
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  logo: { alignSelf: "center", marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.bodySmall, marginBottom: spacing.md, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.danger },
  apple: { height: 48, width: "100%" },
  link: { alignItems: "center", marginTop: spacing.md },
  linkText: { ...typography.body, color: colors.accent },
});
