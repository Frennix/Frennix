import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  deriveLocationDisplayMode,
  getUserFriendlyErrorMessage,
  locationDisplayToToggles,
  removeUserLocation,
  saveUserLocation,
  updateDiscoveryPrivacy,
  updateProfile,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { setPresenceSharingEnabled } from "@/lib/presence";
import { showAlert } from "@/lib/alerts";
import {
  isTrainingPartnerDiscoveryEnabled,
  setTrainingPartnerDiscoveryEnabled,
} from "@/lib/training-partner-discovery-toggle";
import { FrennixLogo } from "@/components/FrennixLogo";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import { requestApproximateDeviceLocation } from "@/lib/device-location";
import { formatCityState } from "@/lib/location-geocode";
import { Button, colors, spacing, typography } from "@frennix/ui";

type PrivacyToggleKey =
  | "appearInMatch"
  | "useLocationMatching"
  | "showCityState"
  | "showApproxDistance"
  | "hideLocation"
  | "showOnlineStatus";

function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
  saving,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <View style={styles.rowSwitchWrap}>
        {saving ? (
          <ActivityIndicator color={colors.accent} size="small" style={styles.rowSavingSpinner} />
        ) : null}
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled || saving}
          trackColor={{ false: colors.border, true: colors.accentMuted }}
          thumbColor={value ? colors.accent : colors.textMuted}
          ios_backgroundColor={colors.border}
          accessibilityLabel={title}
        />
      </View>
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const { session, profile, profileFetchFailed, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const [manualVisible, setManualVisible] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<PrivacyToggleKey | null>(null);
  const [profileRetrying, setProfileRetrying] = useState(false);

  const showOnlineStatus = profile?.show_online_status !== false;
  const appearInMatch = isTrainingPartnerDiscoveryEnabled(profile);
  const useLocationMatching = profile?.use_location_for_matching ?? true;
  const toggles = locationDisplayToToggles(profile?.location_display_mode ?? "city_state");
  const showCityState = profile?.show_city_state ?? toggles.showCityState;
  const showApproxDistance = profile?.show_approximate_distance ?? toggles.showApproximateDistance;
  const hideLocation = toggles.hideLocation;
  const savedLocationLabel = formatCityState(profile?.city, profile?.state);

  const isSaving = useCallback((key: PrivacyToggleKey) => savingKey === key, [savingKey]);

  const runToggleSave = useCallback(
    async (key: PrivacyToggleKey, task: () => Promise<void>) => {
      if (!userId) {
        showAlert("Not signed in", "Sign in again to update privacy settings.");
        return;
      }
      setSavingKey(key);
      try {
        await task();
      } catch (error) {
        showAlert(
          "Could not update privacy setting",
          getUserFriendlyErrorMessage(error, "Something went wrong")
        );
      } finally {
        setSavingKey(null);
      }
    },
    [userId]
  );

  const applyDisplayMode = useCallback(
    (key: PrivacyToggleKey, nextShowCity: boolean, nextShowDistance: boolean, nextHide: boolean) => {
      const mode = deriveLocationDisplayMode(nextShowCity, nextShowDistance, nextHide);
      void runToggleSave(key, async () => {
        const updated = await updateDiscoveryPrivacy(userId, {
          show_city_state: nextShowCity,
          show_approximate_distance: nextShowDistance,
          location_display_mode: mode,
        });
        await refreshProfile(updated);
      });
    },
    [runToggleSave, userId, refreshProfile]
  );

  async function handleEnableDeviceLocation() {
    if (!userId) return;
    setLocationLoading(true);
    try {
      const result = await requestApproximateDeviceLocation();
      if (result.status === "granted") {
        const updated = await saveUserLocation(userId, result.place);
        await refreshProfile(updated);
        return;
      }
      if (result.status === "denied") {
        showAlert(
          "Location access denied",
          "Choose your city manually or enable location in your device settings."
        );
        setManualVisible(true);
        return;
      }
      showAlert("Location unavailable", result.message);
    } finally {
      setLocationLoading(false);
    }
  }

  async function handleRemoveLocation() {
    if (!userId) return;
    const updated = await removeUserLocation(userId);
    await refreshProfile(updated);
  }

  async function handleRetryProfile() {
    if (!userId) return;
    setProfileRetrying(true);
    try {
      await refreshProfile(userId);
    } finally {
      setProfileRetrying(false);
    }
  }

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <FrennixLogo variant="full" height={40} style={styles.logo} />
        <Text style={styles.pageTitle}>Privacy & Discovery</Text>
        <Text style={styles.intro}>
          Control how you appear in Frennix Match, what others see about your location, and your
          online status. Disabling discovery or location may reduce nearby recommendations.
        </Text>

        {profileFetchFailed ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Could not refresh your profile</Text>
            <Text style={styles.errorBody}>
              Settings may be out of date. Retry to load the latest privacy preferences.
            </Text>
            <Button
              title="Retry"
              variant="secondary"
              onPress={() => void handleRetryProfile()}
              loading={profileRetrying}
            />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Frennix Match</Text>
        <SettingRow
          title="Appear in Frennix Match"
          description="When off, you are removed from the training partner deck and nearby match recommendations. Synced with Training partner preferences. Existing matches and messages stay."
          value={appearInMatch}
          saving={isSaving("appearInMatch")}
          onValueChange={(next) =>
            void runToggleSave("appearInMatch", async () => {
              const updated = await setTrainingPartnerDiscoveryEnabled(userId, next);
              await refreshProfile(updated);
            })
          }
        />
        <SettingRow
          title="Use Location for Nearby Matches"
          description="Uses your approximate city coordinates to rank nearby training partners. Does not share your exact location."
          value={useLocationMatching}
          saving={isSaving("useLocationMatching")}
          disabled={!savedLocationLabel}
          onValueChange={(next) =>
            void runToggleSave("useLocationMatching", async () => {
              const updated = await updateDiscoveryPrivacy(userId, {
                use_location_for_matching: next,
              });
              await refreshProfile(updated);
            })
          }
        />

        <Text style={styles.sectionTitle}>Location visibility</Text>
        <SettingRow
          title="Show My City and State"
          description="Display your city and state on your public profile when location is not hidden."
          value={showCityState && !hideLocation}
          saving={isSaving("showCityState")}
          disabled={hideLocation}
          onValueChange={(next) =>
            applyDisplayMode(
              "showCityState",
              next,
              showApproxDistance && !next ? true : showApproxDistance,
              false
            )
          }
        />
        <SettingRow
          title="Show My Approximate Distance"
          description="Show distance ranges like “5–10 miles away” instead of or alongside your city."
          value={showApproxDistance && !hideLocation}
          saving={isSaving("showApproxDistance")}
          disabled={hideLocation}
          onValueChange={(next) => applyDisplayMode("showApproxDistance", showCityState, next, false)}
        />
        <SettingRow
          title="Hide My Location"
          description="Hides your city, state, and distance from your public profile. You can still use Frennix and stay discoverable in Match if enabled above."
          value={hideLocation}
          saving={isSaving("hideLocation")}
          onValueChange={(next) =>
            applyDisplayMode("hideLocation", showCityState, showApproxDistance, next)
          }
        />

        <Text style={styles.sectionTitle}>Saved location</Text>
        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>
            {savedLocationLabel ?? "No location saved"}
          </Text>
          <Text style={styles.locationHint}>
            Only approximate city-level location is stored — never your home address or live GPS.
          </Text>
          <View style={styles.locationActions}>
            <Button
              title="Update My Location"
              variant="secondary"
              onPress={() => void handleEnableDeviceLocation()}
              loading={locationLoading}
            />
            <Button
              title="Choose My City"
              variant="secondary"
              onPress={() => setManualVisible(true)}
              disabled={locationLoading}
            />
            {savedLocationLabel ? (
              <Button
                title="Remove Saved Location"
                variant="ghost"
                onPress={() => void handleRemoveLocation()}
                disabled={locationLoading}
              />
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activity</Text>
        <SettingRow
          title="Show Online Status"
          description="When on, other users can see when you are online or recently active. When off, you appear offline to everyone."
          value={showOnlineStatus}
          saving={isSaving("showOnlineStatus")}
          onValueChange={(next) =>
            void runToggleSave("showOnlineStatus", async () => {
              const { setPresence } = await import("@frennix/api");
              const updated = await updateProfile(userId, { show_online_status: next });
              setPresenceSharingEnabled(next);
              if (!next) {
                await setPresence(false, "privacy-show-online-status-off");
              }
              await refreshProfile(updated);
            })
          }
        />
      </ScrollView>

      <ManualLocationSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSave={async (place) => {
          if (!userId) return;
          const updated = await saveUserLocation(userId, place);
          await refreshProfile(updated);
          setManualVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  logo: { marginBottom: spacing.xs },
  pageTitle: { ...typography.title, marginBottom: spacing.xs },
  intro: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  sectionTitle: {
    ...typography.heading,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  errorBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  errorBody: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1, minWidth: 0, gap: spacing.xs },
  rowSwitchWrap: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: 2,
    minWidth: 52,
    minHeight: 44,
    justifyContent: "flex-end",
  },
  rowSavingSpinner: { width: 20, height: 20 },
  rowTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  rowDescription: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  locationCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  locationLabel: { ...typography.body, fontWeight: "600", color: colors.text },
  locationHint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  locationActions: { gap: spacing.sm, marginTop: spacing.xs },
});
