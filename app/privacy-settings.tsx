import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  deriveLocationDisplayMode,
  getUserFriendlyErrorMessage,
  locationDisplayToToggles,
  removeUserLocation,
  saveUserLocation,
  setMatchingEnabledWithOptOut,
  updateDiscoveryPrivacy,
  updateProfile,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { setPresenceSharingEnabled } from "@/lib/presence";
import { showAlert } from "@/lib/alerts";
import { FrennixLogo } from "@/components/FrennixLogo";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import { requestApproximateDeviceLocation } from "@/lib/device-location";
import { formatCityState } from "@/lib/location-geocode";
import { Button, colors, spacing, typography } from "@frennix/ui";

function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.textMuted}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

export default function PrivacySettingsScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const [manualVisible, setManualVisible] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const showOnlineStatus = profile?.show_online_status !== false;
  const appearInMatch = profile?.matching_enabled ?? true;
  const useLocationMatching = profile?.use_location_for_matching ?? true;
  const toggles = locationDisplayToToggles(profile?.location_display_mode ?? "city_state");
  const showCityState = profile?.show_city_state ?? toggles.showCityState;
  const showApproxDistance = profile?.show_approximate_distance ?? toggles.showApproximateDistance;
  const hideLocation = toggles.hideLocation;
  const savedLocationLabel = formatCityState(profile?.city, profile?.state);

  const onlineMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error("Not signed in");
      const { setPresence } = await import("@frennix/api");
      const updated = await updateProfile(userId, { show_online_status: next });
      setPresenceSharingEnabled(next);
      if (!next) {
        await setPresence(false, "privacy-show-online-status-off");
      }
      await refreshProfile(updated);
    },
    onError: (error) => {
      showAlert(
        "Could not update privacy setting",
        getUserFriendlyErrorMessage(error, "Something went wrong")
      );
    },
  });

  const discoveryMutation = useMutation({
    mutationFn: async (patch: Parameters<typeof updateDiscoveryPrivacy>[1]) => {
      if (!userId) throw new Error("Not signed in");
      const updated = await updateDiscoveryPrivacy(userId, patch);
      await refreshProfile(updated);
    },
    onError: (error) => {
      showAlert(
        "Could not update discovery settings",
        getUserFriendlyErrorMessage(error, "Something went wrong")
      );
    },
  });

  const applyDisplayMode = useCallback(
    (nextShowCity: boolean, nextShowDistance: boolean, nextHide: boolean) => {
      const mode = deriveLocationDisplayMode(nextShowCity, nextShowDistance, nextHide);
      discoveryMutation.mutate({
        show_city_state: nextShowCity,
        show_approximate_distance: nextShowDistance,
        location_display_mode: mode,
      });
    },
    [discoveryMutation]
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

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const discoveryBusy = discoveryMutation.isPending || locationLoading;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <FrennixLogo variant="full" height={40} style={styles.logo} />
        <Text style={styles.pageTitle}>Privacy & Discovery</Text>
        <Text style={styles.intro}>
          Control how you appear in Frennix Match, what others see about your location, and your
          online status. Disabling discovery or location may reduce nearby recommendations.
        </Text>

        <Text style={styles.sectionTitle}>Frennix Match</Text>
        <SettingRow
          title="Appear in Frennix Match"
          description="When off, you are removed from the training partner deck and nearby match recommendations. Existing matches and messages stay."
          value={appearInMatch}
          onValueChange={(next) => {
            if (!next) {
              void setMatchingEnabledWithOptOut(userId, false).then(refreshProfile);
              return;
            }
            void setMatchingEnabledWithOptOut(userId, true).then(refreshProfile);
          }}
          disabled={discoveryBusy}
        />
        <SettingRow
          title="Use Location for Nearby Matches"
          description="Uses your approximate city coordinates to rank nearby training partners. Does not share your exact location."
          value={useLocationMatching}
          onValueChange={(next) => discoveryMutation.mutate({ use_location_for_matching: next })}
          disabled={discoveryBusy || !savedLocationLabel}
        />

        <Text style={styles.sectionTitle}>Location visibility</Text>
        <SettingRow
          title="Show My City and State"
          description="Display your city and state on your public profile when location is not hidden."
          value={showCityState && !hideLocation}
          onValueChange={(next) =>
            applyDisplayMode(next, showApproxDistance && !next ? true : showApproxDistance, false)
          }
          disabled={discoveryBusy || hideLocation}
        />
        <SettingRow
          title="Show My Approximate Distance"
          description="Show distance ranges like “5–10 miles away” instead of or alongside your city."
          value={showApproxDistance && !hideLocation}
          onValueChange={(next) => applyDisplayMode(showCityState, next, false)}
          disabled={discoveryBusy || hideLocation}
        />
        <SettingRow
          title="Hide My Location"
          description="Hides your city, state, and distance from your public profile. You can still use Frennix and stay discoverable in Match if enabled above."
          value={hideLocation}
          onValueChange={(next) =>
            applyDisplayMode(showCityState, showApproxDistance, next)
          }
          disabled={discoveryBusy}
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
          onValueChange={(next) => onlineMutation.mutate(next)}
          disabled={onlineMutation.isPending}
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
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: { flex: 1, gap: spacing.xs },
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
