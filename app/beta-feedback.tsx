import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getErrorMessage, submitFeedback, uploadFeedbackScreenshot } from "@frennix/api";
import type { FeedbackFeatureArea, FeedbackType } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { getFeedbackContext, useFeedbackParams } from "@/lib/feedback-context";
import { pickImageFromLibrary, type PickedImage } from "@/lib/pick-image";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

type Tab = FeedbackType;

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "bug", label: "Report a bug", description: "Something broken or blocking you" },
  { id: "feature", label: "Suggest a feature", description: "Ideas for future improvements" },
  { id: "general", label: "General feedback", description: "Share your experience with Frennix" },
];

function areaLabel(area: FeedbackFeatureArea): string {
  switch (area) {
    case "training_partners":
      return "Training Partners";
    case "trainer_matching":
      return "Trainer Matching";
    case "messages":
      return "Messages";
    case "events":
      return "Events";
    case "notifications":
      return "Notifications";
    default:
      return "General";
  }
}

export default function BetaFeedbackScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { featureArea, screenPath } = useFeedbackParams();
  const [tab, setTab] = useState<Tab>("bug");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<PickedImage | null>(null);
  const [pickingScreenshot, setPickingScreenshot] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const ctx = getFeedbackContext(screenPath ?? undefined);
      let screenshotUrl: string | null = null;

      if (screenshot) {
        screenshotUrl = await uploadFeedbackScreenshot(
          userId,
          screenshot.uri,
          screenshot.mimeType,
          screenshot.file
        );
      }

      return submitFeedback({
        user_id: userId,
        type: tab,
        message,
        feature_area: featureArea,
        screen_path: ctx.screen_path,
        app_version: ctx.app_version,
        platform: ctx.platform,
        os_version: ctx.os_version,
        browser: ctx.browser,
        build_number: ctx.build_number,
        screenshot_url: screenshotUrl,
      });
    },
    onSuccess: () => {
      setMessage("");
      setScreenshot(null);
      showSuccess("Thanks for your feedback!");
    },
    onError: (error) => showAlert("Could not submit", getErrorMessage(error)),
  });

  async function handlePickScreenshot() {
    try {
      setPickingScreenshot(true);
      const picked = await pickImageFromLibrary();
      if (picked) setScreenshot(picked);
    } catch (error) {
      showAlert("Could not attach screenshot", getErrorMessage(error));
    } finally {
      setPickingScreenshot(false);
    }
  }

  function handleSubmit() {
    if (!userId) {
      showAlert("Sign in required", "Sign in to send feedback.");
      return;
    }
    submitMutation.mutate();
  }

  const canSubmit = message.trim().length > 0;
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Invited beta testers — your feedback goes directly to the Frennix team and helps us improve Training
        Partners and Trainer Matching before we build more features.
      </Text>

      {featureArea !== "general" ? (
        <Text style={styles.context}>Area: {areaLabel(featureArea)}</Text>
      ) : null}

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.tab, tab === item.id && styles.tabActive]}
            onPress={() => setTab(item.id)}
          >
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.tabDescription}>{activeTab.description}</Text>

      <View style={styles.form}>
        <Text style={styles.label}>
          {tab === "bug"
            ? "What went wrong?"
            : tab === "feature"
              ? "What would you like to see?"
              : "Your feedback"}
        </Text>
        <Input
          value={message}
          onChangeText={setMessage}
          placeholder={
            tab === "bug"
              ? "Steps to reproduce, what you expected, and what happened instead…"
              : tab === "feature"
                ? "Describe the idea and how it would help your training…"
                : "Tell us about your experience using Frennix…"
          }
          multiline
          numberOfLines={6}
        />

        <View style={styles.screenshotSection}>
          <Text style={styles.label}>Screenshot (optional)</Text>
          {screenshot ? (
            <View style={styles.screenshotPreview}>
              <Image source={{ uri: screenshot.uri }} style={styles.screenshotImage} resizeMode="cover" />
              <Pressable onPress={() => setScreenshot(null)}>
                <Text style={styles.removeScreenshot}>Remove screenshot</Text>
              </Pressable>
            </View>
          ) : (
            <Button
              title="Attach screenshot"
              variant="secondary"
              onPress={() => void handlePickScreenshot()}
              loading={pickingScreenshot}
            />
          )}
        </View>

        <Button
          title="Submit feedback"
          onPress={handleSubmit}
          loading={submitMutation.isPending}
          disabled={!canSubmit}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  context: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
  tabDescription: { ...typography.bodySmall, color: colors.textMuted },
  form: { gap: spacing.md },
  label: { ...typography.body, fontWeight: "600", color: colors.text },
  screenshotSection: { gap: spacing.sm },
  screenshotPreview: { gap: spacing.xs },
  screenshotImage: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: colors.surface },
  removeScreenshot: { ...typography.caption, color: colors.accent, fontWeight: "600" },
});
