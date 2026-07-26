import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { useCenterOverlaySafeArea } from "@/components/BottomOverlayShell";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import {
  markLocationPromptCompleted,
  markLocationPromptDismissed,
  saveUserLocation,
  shouldShowLocationOnboardingPrompt,
} from "@frennix/api";
import { requestApproximateDeviceLocation } from "@/lib/device-location";
import { FrennixLogo } from "@/components/FrennixLogo";
import { Button, colors, spacing, typography } from "@frennix/ui";
import { showAlert } from "@/lib/alerts";

/** One-time prompt for existing users without a saved location. */
export function LocationDiscoveryPrompt() {
  const { session, authReady, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);

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
  }, [authReady, profile?.id, profile?.location_prompt_completed_at, profile?.city, profile?.latitude]);

  const handleMaybeLater = useCallback(async () => {
    setVisible(false);
    if (!userId) return;
    const updated = await markLocationPromptDismissed(userId);
    await refreshProfile(updated);
  }, [refreshProfile, userId]);

  const handleEnableLocation = useCallback(async () => {
    if (!userId) return;
    setEnabling(true);
    try {
      const result = await requestApproximateDeviceLocation();
      if (result.status === "granted") {
        const updated = await saveUserLocation(userId, result.place);
        await markLocationPromptCompleted(userId);
        await refreshProfile(updated);
        setVisible(false);
        return;
      }
      if (result.status === "denied") {
        showAlert(
          "Location access denied",
          "You can choose your city manually or turn on location later in Privacy & Discovery settings."
        );
        return;
      }
      showAlert("Location unavailable", result.message);
    } finally {
      setEnabling(false);
    }
  }, [refreshProfile, userId]);

  const handleManualSave = useCallback(
    async (place: Parameters<typeof saveUserLocation>[1]) => {
      if (!userId) return;
      const updated = await saveUserLocation(userId, place);
      await markLocationPromptCompleted(userId);
      await refreshProfile(updated);
      setManualVisible(false);
      setVisible(false);
    },
    [refreshProfile, userId]
  );

  const { backdropStyle } = useCenterOverlaySafeArea(visible || manualVisible);

  if (checking || !visible) {
    return (
      <ManualLocationSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSave={handleManualSave}
        title="Choose your city"
      />
    );
  }

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        onRequestClose={() => void handleMaybeLater()}
        accessibilityViewIsModal
      >
        <View style={[styles.backdrop, ...backdropStyle]}>
          <View style={styles.card}>
            <FrennixLogo variant="full" height={48} style={styles.logo} />
            <Text style={styles.title}>Find more training partners</Text>
            <Text style={styles.body}>
              Frennix can use your approximate location to recommend nearby people, workouts, and
              events.
            </Text>
            <Text style={styles.privacy}>
              You can change your privacy and discovery settings at any time.
            </Text>
            {enabling ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
            <View style={styles.actions}>
              <Button
                title="Enable Location"
                onPress={() => void handleEnableLocation()}
                loading={enabling}
                disabled={enabling}
              />
              <Button
                title="Choose My City"
                variant="secondary"
                onPress={() => setManualVisible(true)}
                disabled={enabling}
              />
              <Pressable onPress={() => void handleMaybeLater()} style={styles.laterButton}>
                <Text style={styles.laterText}>Maybe Later</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ManualLocationSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSave={handleManualSave}
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
  body: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22 },
  privacy: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  loader: { marginVertical: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  laterButton: { alignItems: "center", paddingVertical: spacing.sm },
  laterText: { ...typography.bodySmall, color: colors.textMuted },
});
