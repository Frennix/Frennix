import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { requestApproximateDeviceLocation } from "@/lib/device-location";
import { ManualLocationSheet } from "@/components/ManualLocationSheet";
import { FrennixLogo } from "@/components/FrennixLogo";
import type { GeocodedPlace } from "@/lib/location-geocode";
import {
  applySignupDeviceLocationResult,
  applySignupManualLocation,
  beginSignupDeviceLocationRequest,
  cancelSignupDeviceLocationRequest,
  initialSignupLocationStepState,
  LOCATION_STEP_MESSAGES,
  skipSignupDeviceLocation,
  type SignupLocationReduction,
  type SignupLocationStepState,
} from "@/lib/signup-location-flow";
import { Button, colors, spacing, typography } from "@frennix/ui";

type LocationOnboardingStepProps = {
  /** False once signup leaves this step, so a late location result cannot overwrite the choice. */
  active?: boolean;
  onLocationResolved: (place: GeocodedPlace | null) => void;
  onDevicePermissionDeniedChange?: (denied: boolean) => void;
};

export function LocationOnboardingStep({
  active = true,
  onLocationResolved,
  onDevicePermissionDeniedChange,
}: LocationOnboardingStepProps) {
  const [state, setState] = useState<SignupLocationStepState>(initialSignupLocationStepState);
  const [manualVisible, setManualVisible] = useState(false);
  const stateRef = useRef(state);

  function commit(result: SignupLocationReduction) {
    if (result.effect.type === "none" && result.state === stateRef.current) return;
    stateRef.current = result.state;
    setState(result.state);
    if (result.effect.type === "device_permission_denied") {
      onDevicePermissionDeniedChange?.(true);
      return;
    }
    if (result.effect.type === "advance") {
      onDevicePermissionDeniedChange?.(result.effect.devicePermissionDenied);
      onLocationResolved(result.effect.place);
    }
  }

  useEffect(() => {
    if (active) return;
    setManualVisible(false);
    const current = stateRef.current;
    const dismissed = cancelSignupDeviceLocationRequest(current);
    if (dismissed.state !== current) {
      stateRef.current = dismissed.state;
      setState(dismissed.state);
    }
  }, [active]);

  async function handleAllowLocation() {
    const begun = beginSignupDeviceLocationRequest(stateRef.current);
    if (begun.state === stateRef.current) return;
    const requestId = begun.state.requestId;
    stateRef.current = begun.state;
    setState(begun.state);
    try {
      const result = await requestApproximateDeviceLocation();
      commit(applySignupDeviceLocationResult(stateRef.current, requestId, result));
    } catch {
      commit(
        applySignupDeviceLocationResult(stateRef.current, requestId, {
          status: "unavailable",
          message: LOCATION_STEP_MESSAGES.unavailable,
        })
      );
    }
  }

  function handleNotNow() {
    commit(skipSignupDeviceLocation(stateRef.current));
  }

  function handleOpenManual() {
    const cancelled = cancelSignupDeviceLocationRequest(stateRef.current);
    if (cancelled.state !== stateRef.current) {
      stateRef.current = cancelled.state;
      setState(cancelled.state);
    }
    setManualVisible(true);
  }

  function handleManualSave(place: GeocodedPlace) {
    setManualVisible(false);
    commit(applySignupManualLocation(stateRef.current, place));
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

      {state.error ? <Text style={styles.error}>{state.error}</Text> : null}
      {state.loading ? (
        <Text style={styles.status}>
          Checking location… You can enter a city or continue without it.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Allow Location"
          onPress={() => void handleAllowLocation()}
          loading={state.loading}
        />
        <Button title="Enter Location Manually" variant="secondary" onPress={handleOpenManual} />
        <Button title="Not Now" variant="ghost" onPress={handleNotNow} />
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
  error: { ...typography.caption, color: colors.danger },
  status: { ...typography.caption, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
