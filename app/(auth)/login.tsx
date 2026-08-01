import { Link, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  formatAuthErrorForDisplay,
  formatLoginError,
  getAuthErrorDetails,
  getSupabase,
  signInWithEmail,
} from "@frennix/api";
import { LoginHeroSection } from "@/components/auth/LoginHeroSection";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { Button, Input, PasswordInput, colors, radius, spacing, typography } from "@frennix/ui";
import { StartupMountProbe } from "@/components/StartupMountProbe";
import { isSupabaseConfigured } from "@/lib/config";
import { logDiagnostic, markDiagnosticFailure, markDiagnosticSuccess } from "@/lib/client-diagnostics";
import { logStartupStep } from "@/lib/startup-step-log";
import { recordWebStartupCheckpoint, redactUserId } from "@/lib/web-startup-checkpoints";
import { hideFrennixBootShell } from "@/lib/hide-boot-shell";
import { webAppShell } from "@/lib/flex-layout";

export default function LoginScreen() {
  const { applySession } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    logStartupStep("login:render:end");
    hideFrennixBootShell();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 480,
        delay: 320,
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateY, {
        toValue: 0,
        duration: 480,
        delay: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [formOpacity, formTranslateY]);

  async function handleLogin() {
    setError("");
    setLoading(true);
    if (Platform.OS === "web") {
      recordWebStartupCheckpoint("login:submitted");
    }

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
      if (Platform.OS === "web") {
        recordWebStartupCheckpoint("session:created", { userId: redactUserId(session.user.id) });
      }
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
      <LoginHeroSection topInset={insets.top} />

      <Animated.View
        style={[
          styles.formSheet,
          {
            opacity: formOpacity,
            transform: [{ translateY: formTranslateY }],
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
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
        <PasswordInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          placeholder="Your password"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          disabled={!isSupabaseConfigured()}
        />

        {Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={styles.apple}
            onPress={handleApple}
          />
        ) : null}

        {!isSupabaseConfigured() ? (
          <Text style={styles.configHint}>
            Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env to enable
            the backend.
          </Text>
        ) : null}

        <Link href="/(auth)/forgot-password" style={styles.link}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </Link>

        <Link href="/(auth)/signup" style={styles.link}>
          <Text style={styles.linkText}>New to Frennix? Create account</Text>
        </Link>
      </Animated.View>
    </>
  );

  return (
    <StartupMountProbe id="auth-login">
      {Platform.OS === "web" ? (
        <ScrollView
          nativeID="auth-login-screen"
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {form}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            nativeID="auth-login-screen"
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {form}
          </ScrollView>
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
  },
  formSheet: {
    marginTop: -spacing.lg,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 -12px 40px rgba(0,0,0,0.35)" } as object)
      : null),
  },
  error: { ...typography.bodySmall, color: colors.danger },
  configHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  apple: { height: 48, width: "100%" },
  link: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  linkText: { ...typography.body, color: colors.accent, fontWeight: "600" },
});
