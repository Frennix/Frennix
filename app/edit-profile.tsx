import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getErrorMessage, updateProfile } from "@frennix/api";
import { ACTIVITIES, FITNESS_GOALS } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity, formatGoal } from "@/lib/labels";
import { getDefaultBioForEdit } from "@/lib/profile";
import { avatarDisplayUri } from "@/lib/avatar";
import { useAvatarUpload } from "@/lib/useAvatarUpload";
import { showAlert } from "@/lib/alerts";
import { Button, Chip, EditableAvatar, Input, colors, spacing, typography } from "@frennix/ui";

const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores only");

export default function EditProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { pickAndUploadAvatar, uploading, error: avatarError } = useAvatarUpload();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(getDefaultBioForEdit(profile));
  const [city, setCity] = useState(profile?.city ?? "");
  const [goals, setGoals] = useState<string[]>(profile?.fitness_goals ?? []);
  const [activities, setActivities] = useState<string[]>(profile?.activities ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleItem(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function save() {
    if (!session?.user.id || !profile) return;

    const parsedUsername = usernameSchema.safeParse(username.toLowerCase().trim());
    if (!parsedUsername.success) {
      setError(parsedUsername.error.errors[0]?.message ?? "Invalid username");
      return;
    }
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await updateProfile(session.user.id, {
        username: parsedUsername.data,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        fitness_goals: goals,
        activities,
      });
      await refreshProfile(session.user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
      router.back();
    } catch (e) {
      const message = getErrorMessage(e);
      setError(message);
      showAlert("Save failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <EditableAvatar
          uri={avatarDisplayUri(profile?.avatar_url, profile?.updated_at)}
          name={profile?.display_name}
          size={112}
          onPress={pickAndUploadAvatar}
          uploading={uploading}
        />
        <Text style={styles.avatarHint}>Tap to change profile photo</Text>
        {avatarError ? <Text style={styles.error}>{avatarError}</Text> : null}
      </View>

      <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Input
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Tell the community about your fitness journey..."
      />
      <Input label="City" value={city} onChangeText={setCity} placeholder="Where do you train?" />

      <Text style={styles.label}>Fitness goals</Text>
      <View style={styles.chips}>
        {FITNESS_GOALS.map((goal) => (
          <Chip
            key={goal}
            label={formatGoal(goal)}
            selected={goals.includes(goal)}
            onPress={() => toggleItem(goals, goal, setGoals)}
          />
        ))}
      </View>

      <Text style={styles.label}>Workout interests</Text>
      <View style={styles.chips}>
        {ACTIVITIES.map((activity) => (
          <Chip
            key={activity}
            label={formatActivity(activity)}
            selected={activities.includes(activity)}
            onPress={() => toggleItem(activities, activity, setActivities)}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save changes" onPress={save} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  avatarSection: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  avatarHint: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.body, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.danger },
});
