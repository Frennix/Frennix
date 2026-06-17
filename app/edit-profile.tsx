import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getErrorMessage, updateProfile } from "@frennix/api";
import { FITNESS_GOALS, SPORTS, WORKOUT_INTERESTS } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { formatActivity, formatGoal } from "@/lib/labels";
import { getDefaultBioForEdit } from "@/lib/profile";
import { mergeProfileActivities, splitProfileActivities } from "@/lib/profile-interests";
import { avatarDisplayUri } from "@/lib/avatar";
import { useAvatarUpload } from "@/lib/useAvatarUpload";
import { showAlert } from "@/lib/alerts";
import { Button, Chip, EditableAvatar, Input, colors, spacing, typography } from "@frennix/ui";

const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores only");

function ChipSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export default function EditProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { pickAndUploadAvatar, uploading, error: avatarError } = useAvatarUpload();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(getDefaultBioForEdit(profile));
  const [city, setCity] = useState(profile?.city ?? "");
  const [goals, setGoals] = useState<string[]>(profile?.fitness_goals ?? []);
  const [sports, setSports] = useState<string[]>([]);
  const [workoutInterests, setWorkoutInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;

    const { sports: profileSports, workoutInterests: profileWorkoutInterests } =
      splitProfileActivities(profile.activities);

    setUsername(profile.username);
    setDisplayName(profile.display_name);
    setBio(getDefaultBioForEdit(profile));
    setCity(profile.city ?? "");
    setGoals(profile.fitness_goals ?? []);
    setSports(profileSports);
    setWorkoutInterests(profileWorkoutInterests);
  }, [profile?.id, profile?.updated_at]);

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
      const updated = await updateProfile(session.user.id, {
        username: parsedUsername.data,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        city: city.trim() || null,
        fitness_goals: goals,
        activities: mergeProfileActivities(sports, workoutInterests),
      });

      await refreshProfile(updated);
      queryClient.setQueryData(["profile", updated.username], updated);
      queryClient.invalidateQueries({ queryKey: ["profile-stats", session.user.id] });
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

      <Text style={styles.sectionHeading}>Basics</Text>
      <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Input
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.sectionHeading}>About</Text>
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        placeholder="Tell the community about your fitness journey..."
      />
      <Input
        label="Location"
        value={city}
        onChangeText={setCity}
        placeholder="City or area where you train"
      />

      <ChipSection title="Sports" hint="Tap to add or remove sports you play or follow.">
        {SPORTS.map((sport) => (
          <Chip
            key={sport}
            label={formatActivity(sport)}
            selected={sports.includes(sport)}
            onPress={() => toggleItem(sports, sport, setSports)}
          />
        ))}
      </ChipSection>

      <ChipSection title="Fitness goals" hint="What are you working toward right now?">
        {FITNESS_GOALS.map((goal) => (
          <Chip
            key={goal}
            label={formatGoal(goal)}
            selected={goals.includes(goal)}
            onPress={() => toggleItem(goals, goal, setGoals)}
          />
        ))}
      </ChipSection>

      <ChipSection title="Workout interests" hint="How do you like to train?">
        {WORKOUT_INTERESTS.map((activity) => (
          <Chip
            key={activity}
            label={formatActivity(activity)}
            selected={workoutInterests.includes(activity)}
            onPress={() => toggleItem(workoutInterests, activity, setWorkoutInterests)}
          />
        ))}
      </ChipSection>

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
  sectionHeading: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  section: { gap: spacing.sm },
  label: { ...typography.body, fontWeight: "600" },
  hint: { ...typography.caption, color: colors.textMuted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.danger },
});
