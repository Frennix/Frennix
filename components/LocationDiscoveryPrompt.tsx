import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import {
  confirmExistingSavedCity,
  markLocationPromptCompleted,
  markLocationPromptDismissed,
  profileHasLegacyCityOnly,
  saveUserLocation,
  shouldShowLocationOnboardingPrompt,
} from "@frennix/api";
import { requestApproximateDeviceLocation } from "@/lib/device-location";
import { formatCityState } from "@/lib/location-geocode";
import { FrennixLogo } from "@/components/FrennixLogo";
import { Button, colors, spacing, typography } from "@frennix/ui";
import { showAlert } from "@/lib/alerts";

/** One-time prompt for existing onboarded users (including legacy city-only profiles). */
export function LocationDiscoveryPrompt() {
  const { session, authReady, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);

  const legacyCityLabel = formatCityState(profile?.city, profile?.state);
  const hasLegacyCity = profileHasLegacyCityOnly(profile);

  useEffect(() => {
    if (!authReady || !profile) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const show = shouldShowLocationOnboardingPrompt(profile);
      if (!cancelled && show) {
        setVisible(true);
      }
      if (!cancelled) setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, profile, profile?.id, profile?.location_prompt_completed_at]);

  const finishPrompt = useCallback(async () => {
    setVisible(false);
    setManualVisible(false);
  }, []);

  const handleNotNow = useCallback(async () => {
    if (!userId) return;
    const updated = await markLocationPromptDismissed(userId);
    await refreshProfile(updated);
    await finishPrompt();
  }, [finishPrompt, refreshProfile, userId]);

  const handleEnableLocation = useCallback(async () => {
    if (!userId) return;
    setEnabling(true);
    try {
      const result = await requestApproximateDeviceLocation();
      if (result.status === "granted") {
        const updated = await saveUserLocation(userId, result.place);
        await markLocationPromptCompleted(userId);
        await refreshProfile(updated);
        await finishPrompt();
        return;
      }
      if (result.status === "denied") {
        showAlert(
          "Location access denied",
          "You can enter your city manually or turn on location later in Privacy & Discovery settings."
        );
        return;
      }
      showAlert("Location unavailable", result.message);
    } finally {
      setEnabling(false);
    }
  }, [finishPrompt, refreshProfile, userId]);

  const handleManualSave = useCallback(
    async (place: Parameters<typeof saveUserLocation>[1]) => {
      if (!userId) return;
      const updated = await saveUserLocation(userId, place);
      await markLocationPromptCompleted(userId);
      await refreshProfile(updated);
      await finishPrompt();
    },
    [finishPrompt, refreshProfile, userId]
  );

  const handleUseExistingCity = useCallback(async () => {
    if (!userId) return;
    const updated = await confirmExistingSavedCity(userId);
    await refreshProfile(updated);
    await finishPrompt();
  }, [finishPrompt, refreshProfile, userId]);

  const { backdropStyle } = useCenterOverlaySafeArea(visible || manualVisible);

  if (checking || !visible) {
    return (
      <ManualLocationSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSave={handleManualSave}
        title="Enter your city"
      />
    );
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={() => void handleNotNow()}
        accessibilityViewIsModal
      >
        <View style={[styles.backdrop, ...backdropStyle]}>
          <View style={styles.card}>
            <FrennixLogo variant="mark" height={72} style={styles.logo} />
            <Text style={styles.title}>Find Your Training Partner</Text>
            {hasLegacyCity && legacyCityLabel ? (
              <View style={styles.savedCityCard}>
                <Text style={styles.savedCityLabel}>Your saved city</Text>
                <Text style={styles.savedCityValue}>{legacyCityLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.body}>
              {hasLegacyCity
                ? "Allow Frennix to use your approximate device location to improve nearby match recommendations. Your exact location is never shared — only city-level or distance ranges."
                : "Allow Frennix to use your approximate location to help you discover nearby training partners, groups, challenges, and events. Your exact location is never shared."}
            </Text>
            <Text style={styles.privacy}>
              You can update location and privacy anytime in Privacy & Discovery settings.
            </Text>
            {enabling ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
            <View style={styles.actions}>
              <Button
                title="Allow Location"
                onPress={() => void handleEnableLocation()}
                loading={enabling}
                disabled={enabling}
              />
              <Button
                title="Enter Location Manually"
                variant="secondary"
                onPress={() => setManualVisible(true)}
                disabled={enabling}
              />
              {hasLegacyCity && legacyCityLabel ? (
                <Button
                  title="Use Existing City"
                  variant="secondary"
                  onPress={() => void handleUseExistingCity()}
                  disabled={enabling}
                />
              ) : null}
              <Pressable onPress={() => void handleNotNow()} style={styles.laterButton}>
                <Text style={styles.laterText}>Not Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ManualLocationSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSave={handleManualSave}
        title="Enter your city"
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  logo: { alignSelf: "center" },
  title: { ...typography.heading, color: colors.text, textAlign: "center" },
  savedCityCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  savedCityLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  savedCityValue: { ...typography.body, color: colors.text, fontWeight: "600" },
  body: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22 },
  privacy: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  loader: { marginVertical: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  laterButton: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: { ...typography.bodySmall, color: colors.textMuted },
});
