import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { requestApproximateDeviceLocation } from "@/lib/device-location";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import { FrennixLogo } from "@/components/FrennixLogo";
import type { GeocodedPlace } from "@/lib/location-geocode";
import { Button, colors, spacing, typography } from "@frennix/ui";

type LocationChoice = "pending" | "device" | "manual" | "skipped";

type LocationOnboardingStepProps = {
  onLocationResolved: (place: GeocodedPlace | null) => void;
};

export function LocationOnboardingStep({ onLocationResolved }: LocationOnboardingStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualVisible, setManualVisible] = useState(false);
  const [choice, setChoice] = useState<LocationChoice>("pending");

  async function handleAllowLocation() {
    setLoading(true);
    setError("");
    setChoice("device");
    try {
      const result = await requestApproximateDeviceLocation();
      if (result.status === "granted") {
        onLocationResolved(result.place);
        return;
      }
      if (result.status === "denied") {
        setError("Location access denied. Enter your city manually or continue without location.");
        setChoice("pending");
        return;
      }
      setError(result.message);
      setChoice("pending");
    } finally {
      setLoading(false);
    }
  }

  function handleNotNow() {
    setChoice("skipped");
    onLocationResolved(null);
  }

  function handleManualSave(place: GeocodedPlace) {
    setChoice("manual");
    onLocationResolved(place);
    setManualVisible(false);
  }

  return (
    <View style={styles.container}>
      <FrennixLogo variant="mark" height={88} style={styles.logo} />
      <Text style={styles.heading}>Find Your Training Partner</Text>
      <Text style={styles.body}>
        Allow Frennix to use your approximate location to help you discover nearby training
        partners, fitness groups, challenges, and events. Your exact location is never shared with
        other users.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accent} /> : null}

      <View style={styles.actions}>
        <Button
          title="Allow Location"
          onPress={() => void handleAllowLocation()}
          loading={loading}
          disabled={choice === "skipped"}
        />
        <Button
          title="Enter Location Manually"
          variant="secondary"
          onPress={() => setManualVisible(true)}
          disabled={loading || choice === "skipped"}
        />
        <Button
          title="Not Now"
          variant="ghost"
          onPress={handleNotNow}
          disabled={loading}
        />
      </View>

      <ManualLocationSheet
        visible={manualVisible}
        onClose={() => setManualVisible(false)}
        onSave={async (place) => handleManualSave(place)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  logo: { alignSelf: "center", marginBottom: spacing.xs },
  heading: { ...typography.heading, color: colors.text, textAlign: "center" },
  body: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22, textAlign: "center" },
  error: { color: colors.danger, ...typography.caption },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
