import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { storePendingReferralCode } from "@/lib/referral-storage";
import { useAuth } from "@/providers/AuthProvider";
import { colors } from "@frennix/ui";

export default function JoinReferralScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session, profile, authReady } = useAuth();

  useEffect(() => {
    if (code) {
      void storePendingReferralCode(code);
    }
  }, [code]);

  if (!authReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (session?.user) {
    if (profile?.onboarding_complete) {
      return <Redirect href="/(tabs)" />;
    }
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(auth)/signup" />;
}
