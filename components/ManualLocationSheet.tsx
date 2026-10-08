import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BottomActionSheet } from "@/components/BottomActionSheet";
import { geocodeCityState } from "@/lib/location-geocode";
import { Button, Input, colors, spacing, typography } from "@frennix/ui";
import type { GeocodedPlace } from "@/lib/location-geocode";

type ManualLocationSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (place: GeocodedPlace) => void | Promise<void>;
  title?: string;
  description?: string;
};

export function ManualLocationSheet({
  visible,
  onClose,
  onSave,
  title = "Choose your city",
  description = "Enter your city and state. We only use this approximate location for nearby training partner recommendations — never your exact address.",
}: ManualLocationSheetProps) {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    if (visible) return;
    requestRef.current += 1;
    savingRef.current = false;
    setLoading(false);
  }, [visible]);

  function handleClose() {
    requestRef.current += 1;
    savingRef.current = false;
    setLoading(false);
    setError("");
    onClose();
  }

  async function handleSave() {
    const trimmedCity = city.trim();
    const trimmedState = state.trim();
    if (!trimmedCity) {
      setError("City is required");
      return;
    }
    if (!trimmedState) {
      setError("State is required");
      return;
    }
    if (savingRef.current) return;

    const requestId = ++requestRef.current;
    savingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const place = await geocodeCityState(trimmedCity, trimmedState);
      if (requestId !== requestRef.current) return;
      if (!place) {
        setError("Could not find that city. Check spelling and try again.");
        return;
      }
      await onSave(place);
      if (requestId !== requestRef.current) return;
      setCity("");
      setState("");
      onClose();
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setError(e instanceof Error ? e.message : "Could not save location");
    } finally {
      if (requestId === requestRef.current) {
        savingRef.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <BottomActionSheet visible={visible} onClose={handleClose} scrollEnabled>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Input testID="manual-location-city" label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
        <Input testID="manual-location-state" label="State" value={state} onChangeText={setState} autoCapitalize="characters" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        <Button title="Save location" onPress={() => void handleSave()} loading={loading} />
        <Button title="Cancel" variant="ghost" onPress={handleClose} />
      </View>
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.heading, color: colors.text },
  description: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  error: { ...typography.caption, color: colors.danger },
});
