import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getChallenge,
  getErrorMessage,
  updateChallenge,
  uploadChallengeCover,
} from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { stackBackOptions } from "@/lib/stack-navigation";
import { Button, Input, colors, radius, spacing, typography } from "@frennix/ui";

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

function combineDateInput(date: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return endOfDay ? `${date}T23:59:59.999Z` : `${date}T00:00:00.000Z`;
}

export default function EditChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverMime, setCoverMime] = useState("image/jpeg");
  const [coverFile, setCoverFile] = useState<File | undefined>();
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: challenge, isLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: () => getChallenge(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!challenge) return;
    if (challenge.created_by !== userId) {
      showAlert("Edit challenge", "Only the challenge creator can edit this challenge.");
      router.back();
      return;
    }
    setTitle(challenge.title);
    setDescription(challenge.description ?? "");
    setRules(challenge.rules ?? "");
    setStartDate(toDateInput(challenge.start_date));
    setEndDate(toDateInput(challenge.end_date));
    setExistingCoverUrl(challenge.cover_image_url ?? null);
    setCoverUri(null);
    setRemoveCover(false);
  }, [challenge, userId]);

  async function pickCover() {
    if (loading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert("Media access", "Photo library access is required to add a cover image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setCoverUri(asset.uri);
    setCoverMime(asset.mimeType ?? "image/jpeg");
    setCoverFile("file" in asset ? asset.file ?? undefined : undefined);
    setRemoveCover(false);
  }

  function clearCover() {
    setCoverUri(null);
    setCoverFile(undefined);
    setRemoveCover(true);
  }

  async function submit() {
    if (!id || !userId || !challenge) return;
    if (!title.trim()) {
      setError("Challenge title is required");
      return;
    }

    const startIso = combineDateInput(startDate);
    const endIso = combineDateInput(endDate, true);
    if (!startIso || !endIso) {
      setError("Enter valid start and end dates (YYYY-MM-DD)");
      return;
    }
    if (new Date(endIso) < new Date(startIso)) {
      setError("End date must be on or after start date");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let coverUrl: string | null = removeCover ? null : existingCoverUrl;
      let removedCoverUrl: string | null = null;

      if (coverUri) {
        coverUrl = await uploadChallengeCover(userId, id, coverUri, coverMime, coverFile);
        if (existingCoverUrl && existingCoverUrl !== coverUrl) {
          removedCoverUrl = existingCoverUrl;
        }
      } else if (removeCover && existingCoverUrl) {
        removedCoverUrl = existingCoverUrl;
        coverUrl = null;
      }

      await updateChallenge(
        id,
        userId,
        {
          title: title.trim(),
          description: description.trim() || null,
          rules: rules.trim() || null,
          start_date: startIso,
          end_date: endIso,
          cover_image_url: coverUrl,
        },
        { removedCoverUrl }
      );

      await queryClient.invalidateQueries({ queryKey: ["challenge", id] });
      await queryClient.invalidateQueries({ queryKey: ["discover-challenges"] });
      showSuccess("Challenge updated successfully.");
      router.back();
    } catch (e) {
      const message = getErrorMessage(e) || "Something went wrong. Please try again.";
      setError(message);
      showAlert("Update failed", message);
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || !challenge) {
    return (
      <>
        <Stack.Screen options={stackBackOptions("Edit challenge", { presentation: "modal" })} />
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading challenge…</Text>
        </View>
      </>
    );
  }

  const previewCover = coverUri ?? (!removeCover ? existingCoverUrl : null);

  return (
    <>
      <Stack.Screen options={stackBackOptions("Edit challenge", { presentation: "modal" })} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Input
          label="Challenge title"
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!loading}
        />
        <Input
          label="Rules"
          value={rules}
          onChangeText={setRules}
          multiline
          editable={!loading}
          placeholder="How scoring, check-ins, or participation works…"
        />
        <Input
          label="Start date (YYYY-MM-DD)"
          value={startDate}
          onChangeText={setStartDate}
          autoCapitalize="none"
          editable={!loading}
        />
        <Input
          label="End date (YYYY-MM-DD)"
          value={endDate}
          onChangeText={setEndDate}
          autoCapitalize="none"
          editable={!loading}
        />

        <View style={styles.coverSection}>
          <Text style={styles.sectionLabel}>Cover image</Text>
          {previewCover ? (
            <Image source={{ uri: previewCover }} style={styles.coverPreview} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>No cover image</Text>
            </View>
          )}
          <View style={styles.coverActions}>
            <Button title="Choose cover" variant="secondary" onPress={pickCover} disabled={loading} />
            {previewCover ? (
              <Button title="Remove cover" variant="danger" onPress={clearCover} disabled={loading} />
            ) : null}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Save changes" onPress={submit} loading={loading} disabled={loading} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textMuted },
  sectionLabel: { ...typography.body, fontWeight: "600", color: colors.text },
  coverSection: { gap: spacing.sm },
  coverPreview: {
    width: "100%",
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  coverPlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  coverPlaceholderText: { ...typography.caption, color: colors.textMuted },
  coverActions: { gap: spacing.sm },
  error: { ...typography.bodySmall, color: colors.danger },
});
