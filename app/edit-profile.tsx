import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { upsertProfile, uploadAvatar } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { Button, Input, colors, spacing } from "@frennix/ui";

export default function EditProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pickAvatar() {
    if (!session?.user.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const url = await uploadAvatar(session.user.id, result.assets[0].uri, "image/jpeg");
      await upsertProfile({ id: session.user.id, avatar_url: url });
      await refreshProfile();
    }
  }

  async function save() {
    if (!session?.user.id || !profile) return;
    setLoading(true);
    try {
      await upsertProfile({
        id: session.user.id,
        username: profile.username,
        display_name: displayName,
        bio,
        city: city || null,
      });
      await refreshProfile();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button title="Change avatar" variant="secondary" onPress={pickAvatar} />
      <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Input label="Bio" value={bio} onChangeText={setBio} multiline />
      <Input label="City" value={city} onChangeText={setCity} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save" onPress={save} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  error: { color: colors.danger },
});
