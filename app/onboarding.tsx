import { zodResolver } from "@hookform/resolvers/zod";
import { Redirect, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { getSession, getErrorMessage, upsertProfile, uploadAvatar, claimReferral } from "@frennix/api";
import { ACTIVITIES, FITNESS_GOALS, type MatchPreference } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { formatActivity, formatGoal } from "@/lib/labels";
import { SubmitStatusBanner } from "@/components/SubmitStatusBanner";
import { claimPendingReferral } from "@/lib/referral-storage";
import { Avatar, Button, Input, colors, spacing, typography } from "@frennix/ui";

const SUCCESS_NAV_DELAY_MS = 2000;

const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;
const MATCH_PREFS: { value: MatchPreference; label: string }[] = [
  { value: "any", label: "Anyone" },
  { value: "same", label: "Same gender" },
  { value: "opposite", label: "Different gender" },
];

const onboardingSchema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, underscores only"),
  displayName: z.string().min(1, "Display name is required"),
  bio: z.string().optional(),
  city: z.string().optional(),
  gender: z.enum(GENDERS, { required_error: "Select your gender" }),
  matchPreference: z.enum(["same", "opposite", "any"]),
  goals: z.array(z.string()).min(1, "Pick at least one goal"),
  activities: z.array(z.string()).optional().default([]),
});

type OnboardingForm = z.infer<typeof onboardingSchema>;

export default function OnboardingScreen() {
  const { session, loading, passwordRecovery, refreshProfile, applySession } = useAuth();
  const [step, setStep] = useState(0);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const submittingRef = useRef(false);
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    shouldUnregister: false,
    defaultValues: {
      username: "",
      displayName: "",
      bio: "",
      city: "",
      gender: undefined,
      matchPreference: "any",
      goals: [],
      activities: [],
    },
  });

  const goals = watch("goals");
  const activities = watch("activities");
  const gender = watch("gender");
  const matchPreference = watch("matchPreference");

  function toggleField(field: "goals" | "activities", value: string) {
    const current = watch(field);
    const next = current.includes(value)
      ? current.filter((x) => x !== value)
      : [...current, value];
    setValue(field, next, { shouldValidate: true });
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  function onInvalid(fieldErrors: FieldErrors<OnboardingForm>) {
    const first = Object.values(fieldErrors).find((error) => error?.message);
    setSubmitError(first?.message ?? "Please complete all steps");
  }

  async function onSubmit(data: OnboardingForm) {
    if (loading || submittingRef.current || submitSuccess) return;

    let userId = session?.user.id;
    if (!userId) {
      const freshSession = await getSession();
      userId = freshSession?.user.id;
      if (freshSession) await applySession(freshSession);
    }

    if (!userId) {
      setSubmitError("You must be signed in to save your profile");
      return;
    }

    submittingRef.current = true;
    setSubmitError("");
    try {
      const upsertPayload = {
        id: userId,
        username: data.username.toLowerCase(),
        display_name: data.displayName,
        bio: data.bio || null,
        city: data.city || null,
        fitness_goals: data.goals,
        activities: data.activities,
        gender: data.gender,
        match_preference: data.matchPreference,
        avatar_url: null as string | null,
        onboarding_complete: true,
        visibility: "public" as const,
      };

      let avatarUrl: string | null = null;
      if (avatarUri) {
        setUploadingAvatar(true);
        avatarUrl = await uploadAvatar(userId, avatarUri, "image/jpeg");
        setUploadingAvatar(false);
      }
      upsertPayload.avatar_url = avatarUrl;

      console.info("[onboarding] saving profile", {
        userId,
        username: upsertPayload.username,
        onboarding_complete: upsertPayload.onboarding_complete,
      });
      const saved = await upsertProfile(upsertPayload);
      await claimPendingReferral(claimReferral);
      await refreshProfile(saved);
      setSubmitSuccess(true);
      navigateTimeoutRef.current = setTimeout(() => {
        router.replace("/(tabs)");
        submittingRef.current = false;
      }, SUCCESS_NAV_DELAY_MS);
    } catch (e) {
      setUploadingAvatar(false);
      submittingRef.current = false;
      console.error("[onboarding] save profile failed", e);
      const detail = getErrorMessage(e);
      showAlert("Could not save profile", detail);
      setSubmitError(detail);
    }
  }

  function prevStep() {
    if (step > 0) setStep(step - 1);
  }

  async function nextStep() {
    if (step === 0) {
      const ok = await trigger(["username", "displayName"]);
      if (ok) setStep(1);
    } else if (step === 1) {
      const ok = await trigger(["gender", "matchPreference"]);
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await trigger(["goals"]);
      if (ok) setStep(3);
    }
  }

  const stepTitles = ["Your profile", "About you", "Your goals", "Your activities"];

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (passwordRecovery) {
    return <Redirect href="/reset-password" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{stepTitles[step]}</Text>

      <View style={step === 0 ? styles.stepPanel : styles.hiddenStep} pointerEvents={step === 0 ? "auto" : "none"}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            <Avatar uri={avatarUri} name={watch("displayName")} size={96} />
            <Text style={styles.avatarHint}>Tap to add photo</Text>
          </Pressable>
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Username"
                value={value}
                onChangeText={(t) => onChange(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                autoCapitalize="none"
                error={step === 0 ? errors.username?.message : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Display name"
                value={value}
                onChangeText={onChange}
                error={step === 0 ? errors.displayName?.message : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="bio"
            render={({ field: { onChange, value } }) => (
              <Input label="Bio" value={value} onChangeText={onChange} multiline />
            )}
          />
          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, value } }) => (
              <Input label="City (optional)" value={value} onChangeText={onChange} />
            )}
          />
      </View>

      {step === 1 ? (
        <View style={styles.stepPanel}>
          <Text style={styles.sectionLabel}>Gender</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                style={[styles.chip, gender === g && styles.chipActive]}
                onPress={() => setValue("gender", g, { shouldValidate: true })}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                  {g.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.gender ? <Text style={styles.error}>{errors.gender.message}</Text> : null}
          <Text style={styles.sectionLabel}>Partner preference (for future matching)</Text>
          <View style={styles.chips}>
            {MATCH_PREFS.map(({ value, label }) => (
              <Pressable
                key={value}
                style={[styles.chip, matchPreference === value && styles.chipActive]}
                onPress={() => setValue("matchPreference", value)}
              >
                <Text
                  style={[styles.chipText, matchPreference === value && styles.chipTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.stepPanel}>
          <View style={styles.chips}>
            {FITNESS_GOALS.map((g) => (
              <Pressable
                key={g}
                style={[styles.chip, goals.includes(g) && styles.chipActive]}
                onPress={() => toggleField("goals", g)}
              >
                <Text style={[styles.chipText, goals.includes(g) && styles.chipTextActive]}>
                  {formatGoal(g)}
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.goals ? <Text style={styles.error}>{errors.goals.message}</Text> : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.stepPanel}>
          <View style={styles.chips}>
            {ACTIVITIES.map((a) => (
              <Pressable
                key={a}
                style={[styles.chip, activities.includes(a) && styles.chipActive]}
                onPress={() => toggleField("activities", a)}
              >
                <Text style={[styles.chipText, activities.includes(a) && styles.chipTextActive]}>
                  {formatActivity(a)}
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.activities ? <Text style={styles.error}>{errors.activities.message}</Text> : null}
        </View>
      ) : null}

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <SubmitStatusBanner
        isSubmitting={isSubmitting || uploadingAvatar}
        isSuccess={submitSuccess}
        submittingLabel={uploadingAvatar ? "Uploading photo…" : "Setting up your profile…"}
        successLabel="Welcome to Frennix! Taking you to your feed…"
      />

      <View style={styles.footer}>
        {step > 0 ? (
          <Button title="Back" variant="secondary" onPress={prevStep} disabled={isSubmitting || submitSuccess} />
        ) : null}
        {step < 3 ? (
          <Button title="Continue" onPress={nextStep} />
        ) : (
          <Button
            title={submitSuccess ? "Profile saved!" : "Start training together"}
            loadingTitle="Saving…"
            onPress={handleSubmit(onSubmit, onInvalid)}
            loading={isSubmitting || uploadingAvatar}
            disabled={submitSuccess}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.title, marginBottom: spacing.sm },
  stepPanel: { gap: spacing.md },
  hiddenStep: { height: 0, overflow: "hidden", opacity: 0 },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  avatarWrap: { alignItems: "center", gap: spacing.sm },
  avatarHint: { ...typography.caption, color: colors.accent },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, textTransform: "capitalize" },
  chipTextActive: { color: colors.accent, fontWeight: "600" },
  error: { color: colors.danger },
  footer: { marginTop: spacing.lg, gap: spacing.sm },
});
