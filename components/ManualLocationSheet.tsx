import { useState } from "react";
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

    setLoading(true);
    setError("");
    try {
      const place = await geocodeCityState(trimmedCity, trimmedState);
      if (!place) {
        setError("Could not find that city. Check spelling and try again.");
        return;
      }
      await onSave(place);
      setCity("");
      setState("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save location");
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomActionSheet visible={visible} onClose={onClose} scrollEnabled>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Input label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
        <Input label="State" value={state} onChangeText={setState} autoCapitalize="characters" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        <Button title="Save location" onPress={() => void handleSave()} loading={loading} />
        <Button title="Cancel" variant="ghost" onPress={onClose} disabled={loading} />
      </View>
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.heading, color: colors.text },
  description: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  error: { color: colors.danger, ...typography.caption },
});
