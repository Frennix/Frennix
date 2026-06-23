import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { setMatchingEnabled, updateProfile } from "@frennix/api";
import type { MatchPreference, Profile } from "@frennix/types";
import { FrennixLogo } from "@/components/FrennixLogo";
import { TrainingPartnerReadinessCard } from "@/components/TrainingPartnerReadinessCard";
import { formatActivity, formatGoal } from "@/lib/labels";
import {
  TRAINING_PARTNER_GENDERS,
  TRAINING_PARTNER_PREFS,
  formatTrainingPartnerGender,
  type TrainingPartnerGender,
} from "@/lib/matching-preferences";
import {
  getTrainingPartnerReadinessSummary,
  isTrainingPartnerDiscoveryReady,
} from "@/lib/training-partner-readiness";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { Button, Chip, colors, spacing, typography } from "@frennix/ui";

function confirmDisableDiscovery(onConfirm: () => void) {
  const title = "Hide from training partner discovery?";
  const message =
    "You will not appear in the discovery deck and will not see new training partners. Existing training matches stay.";

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Turn off", style: "destructive", onPress: onConfirm },
  ]);
}

function TrainingProfilePreview({ profile }: { profile: Profile }) {
  const goals = (profile.fitness_goals ?? []).slice(0, 3).map(formatGoal);
  const styles_ = (profile.activities ?? []).slice(0, 4).map(formatActivity);

  return (
    <View style={styles.previewCard}>
      <Text style={styles.sectionLabel}>What athletes see on your card</Text>
      <Text style={styles.previewHint}>
        Your public profile shows your display name, goals, workout styles, and city — not your
        gender or partner filters.
      </Text>
      {goals.length ? (
        <View style={styles.chipRow}>
          {goals.map((label) => (
            <Chip key={label} label={label} selected />
          ))}
        </View>
      ) : (
        <Text style={styles.previewEmpty}>No fitness goals listed yet</Text>
      )}
      {styles_.length ? (
        <View style={styles.chipRow}>
          {styles_.map((label) => (
            <Chip key={label} label={label} />
          ))}
        </View>
      ) : null}
      {profile.city ? (
        <Text style={styles.previewMeta}>{profile.city}</Text>
      ) : (
        <Text style={styles.previewMetaMuted}>Add your city to help nearby athletes find you.</Text>
      )}
      <Link href="/edit-profile" asChild>
        <Text style={styles.editLink}>Edit training profile →</Text>
      </Link>
    </View>
  );
}

export default function MatchingSettingsScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const userId = session?.user.id ?? "";
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const showWelcome = welcome === "1";

  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [gender, setGender] = useState<TrainingPartnerGender | null>(null);
  const [partnerPreference, setPartnerPreference] = useState<MatchPreference>("any");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const profileReady = profile ? isTrainingPartnerDiscoveryReady(profile) : false;

  useEffect(() => {
    if (!profile) return;
    setDiscoveryEnabled(profile.matching_enabled ?? false);
    setGender((profile.gender as TrainingPartnerGender | null) ?? null);
    setPartnerPreference(profile.match_preference ?? "any");
  }, [profile?.id, profile?.updated_at, profile?.matching_enabled]);

  function handleDiscoveryToggle(next: boolean) {
    if (next && profile && !isTrainingPartnerDiscoveryReady(profile)) {
      setError(getTrainingPartnerReadinessSummary(profile));
      return;
    }

    if (!next && discoveryEnabled) {
      confirmDisableDiscovery(() => setDiscoveryEnabled(false));
      return;
    }

    setError("");
    setDiscoveryEnabled(next);
  }

  async function handleSave() {
    if (!userId || !profile) return;

    if (discoveryEnabled && !gender) {
      setError("Select a gender for your private training partner filters.");
      return;
    }

    if (discoveryEnabled && !isTrainingPartnerDiscoveryReady(profile)) {
      setError(getTrainingPartnerReadinessSummary(profile));
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateProfile(userId, {
        gender,
        match_preference: partnerPreference,
      });
      await setMatchingEnabled(userId, discoveryEnabled);
      await refreshProfile();
      showAlert(
        "Preferences saved",
        discoveryEnabled
          ? "You can now find training partners who share your goals and workout style."
          : "Training partner discovery is turned off."
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.intro}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <FrennixLogo variant="full" height={32} style={styles.logo} />

      {showWelcome ? (
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>Set up training partner discovery</Text>
          <Text style={styles.welcomeBody}>
            Your profile is saved. Turn on discovery when you are ready to connect with athletes
            who share your training goals.
          </Text>
        </View>
      ) : null}

      <Text style={styles.intro}>
        Control how you appear in the training partner discovery deck. Filters below are private —
        only you see them.
      </Text>

      <TrainingPartnerReadinessCard profile={profile} />

      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Show me in training partner discovery</Text>
          <Text style={styles.toggleDescription}>
            When on, you appear in other athletes&apos; decks and can browse new training partners.
            Both athletes need discovery enabled to connect.
          </Text>
        </View>
        <Switch
          value={discoveryEnabled}
          onValueChange={handleDiscoveryToggle}
          disabled={!profileReady && !discoveryEnabled}
          trackColor={{ false: colors.border, true: colors.accentMuted }}
          thumbColor={discoveryEnabled ? colors.accent : colors.textMuted}
          ios_backgroundColor={colors.border}
        />
      </View>

      {!profileReady && !discoveryEnabled ? (
        <Text style={styles.toggleLockedHint}>
          Complete your training profile above to turn on discovery.
        </Text>
      ) : null}

      <TrainingProfilePreview profile={profile} />

      <Text style={styles.sectionLabel}>Private training partner filters</Text>
      <Text style={styles.filterHint}>
        These settings filter who appears in your discovery deck. They are never shown on your
        public profile or discovery card.
      </Text>

      <Text style={styles.fieldLabel}>Your gender</Text>
      <Text style={styles.fieldDescription}>
        Used only to apply your partner filters. Other athletes cannot see this on your profile.
      </Text>
      <View style={styles.chipRow}>
        {TRAINING_PARTNER_GENDERS.map((value) => (
          <Chip
            key={value}
            label={formatTrainingPartnerGender(value)}
            selected={gender === value}
            onPress={() => setGender(value)}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Who you want to train with</Text>
      {TRAINING_PARTNER_PREFS.map(({ value, label, description }) => (
        <View key={value} style={styles.prefOption}>
          <Chip
            label={label}
            selected={partnerPreference === value}
            onPress={() => setPartnerPreference(value)}
          />
          <Text style={styles.prefDescription}>{description}</Text>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Save preferences" onPress={handleSave} loading={saving} />

      {showWelcome ? (
        <Button title="Skip for now" variant="ghost" onPress={() => router.replace("/(tabs)")} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: {
    padding: spacing.xl,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  logo: { alignSelf: "flex-start", marginBottom: spacing.xs },
  welcomeBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    gap: spacing.xs,
  },
  welcomeTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  welcomeBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  intro: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 22,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: { flex: 1, gap: 4 },
  toggleTitle: { ...typography.body, fontWeight: "600", color: colors.text },
  toggleDescription: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  toggleLockedHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: -spacing.xs,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.heading,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.sm,
  },
  previewHint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  filterHint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
  fieldLabel: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  fieldDescription: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: spacing.xs,
  },
  prefOption: { gap: spacing.xs, marginBottom: spacing.sm },
  prefDescription: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
    paddingLeft: spacing.xs,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  previewEmpty: { ...typography.caption, color: colors.textMuted },
  previewMeta: { ...typography.bodySmall, color: colors.textSecondary },
  previewMetaMuted: { ...typography.caption, color: colors.textMuted },
  editLink: { ...typography.bodySmall, color: colors.accent, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 14 },
});
