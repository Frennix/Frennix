import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useEffect, useState } from "react";
import {
  addTrainerCertification,
  addTrainerPortfolioPhoto,
  deleteTrainerCertification,
  deleteTrainerPortfolioPhoto,
  uploadTrainerCertificationDocument,
  uploadTrainerPortfolioPhoto,
  upsertTrainerProfile,
} from "@frennix/api";
import type {
  TrainerAvailabilityStatus,
  TrainerCategory,
  TrainerCertification,
  TrainerCoachingFormat,
  TrainerPortfolioCategory,
  TrainerPortfolioPhoto,
  TrainerProfileBundle,
  TrainerSpecialty,
  UpsertTrainerProfileInput,
} from "@frennix/types";
import {
  TRAINER_AVAILABILITY_STATUSES,
  TRAINER_CATEGORIES,
  TRAINER_COACHING_FORMATS,
  TRAINER_PORTFOLIO_CATEGORIES,
  TRAINER_SPECIALTIES,
} from "@frennix/types";
import {
  formatCoachingFormat,
  formatPortfolioCategory,
  formatTrainerAvailability,
  formatTrainerCategory,
  formatTrainerSpecialty,
} from "@/lib/trainer-labels";
import { pickImageFromLibrary } from "@/lib/pick-image";
import { showAlert } from "@/lib/alerts";
import { Button, Chip, Input, colors, spacing, typography } from "@frennix/ui";

type TrainerProfileEditorProps = {
  userId: string;
  initial?: TrainerProfileBundle | null;
  onSaved?: () => void;
  showDiscoveryToggle?: boolean;
};

export function TrainerProfileEditor({
  userId,
  initial,
  onSaved,
  showDiscoveryToggle = true,
}: TrainerProfileEditorProps) {
  const queryClient = useQueryClient();
  const trainer = initial?.trainer;

  const [bio, setBio] = useState(trainer?.bio ?? "");
  const [experience, setExperience] = useState(trainer?.experience ?? "");
  const [philosophy, setPhilosophy] = useState(trainer?.training_philosophy ?? "");
  const [yearsExperience, setYearsExperience] = useState(
    trainer?.years_experience != null ? String(trainer.years_experience) : ""
  );
  const [specialties, setSpecialties] = useState<TrainerSpecialty[]>(trainer?.specialties ?? []);
  const [categories, setCategories] = useState<TrainerCategory[]>(trainer?.categories ?? []);
  const [otherSpecialty, setOtherSpecialty] = useState(trainer?.other_specialty ?? "");
  const [availability, setAvailability] = useState<TrainerAvailabilityStatus>(
    trainer?.availability_status ?? "available"
  );
  const [formats, setFormats] = useState<TrainerCoachingFormat[]>(trainer?.coaching_formats ?? []);
  const [budgetMin, setBudgetMin] = useState(
    trainer?.budget_min_monthly != null ? String(trainer.budget_min_monthly / 100) : ""
  );
  const [budgetMax, setBudgetMax] = useState(
    trainer?.budget_max_monthly != null ? String(trainer.budget_max_monthly / 100) : ""
  );
  const [discoveryEnabled, setDiscoveryEnabled] = useState(trainer?.discovery_enabled ?? false);
  const [instagram, setInstagram] = useState(trainer?.instagram_url ?? "");
  const [tiktok, setTiktok] = useState(trainer?.tiktok_url ?? "");
  const [youtube, setYoutube] = useState(trainer?.youtube_url ?? "");
  const [website, setWebsite] = useState(trainer?.website_url ?? "");
  const [linkedin, setLinkedin] = useState(trainer?.linkedin_url ?? "");
  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certifications, setCertifications] = useState<TrainerCertification[]>(
    initial?.certifications ?? []
  );
  const [portfolio, setPortfolio] = useState<TrainerPortfolioPhoto[]>(initial?.portfolio ?? []);
  const [portfolioCategory, setPortfolioCategory] = useState<TrainerPortfolioCategory>("coaching");

  useEffect(() => {
    if (!initial) return;
    setCertifications(initial.certifications ?? []);
    setPortfolio(initial.portfolio ?? []);
  }, [initial]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const years = yearsExperience.trim() ? Number.parseInt(yearsExperience, 10) : null;
      const minCents = budgetMin.trim() ? Math.round(Number.parseFloat(budgetMin) * 100) : null;
      const maxCents = budgetMax.trim() ? Math.round(Number.parseFloat(budgetMax) * 100) : null;

      const input: UpsertTrainerProfileInput = {
        bio: bio.trim() || null,
        experience: experience.trim() || null,
        training_philosophy: philosophy.trim() || null,
        years_experience: Number.isFinite(years!) ? years : null,
        specialties,
        other_specialty: specialties.includes("other") ? otherSpecialty.trim() || null : null,
        categories,
        availability_status: availability,
        coaching_formats: formats,
        budget_min_monthly: minCents,
        budget_max_monthly: maxCents,
        discovery_enabled: discoveryEnabled,
        instagram_url: instagram.trim() || null,
        tiktok_url: tiktok.trim() || null,
        youtube_url: youtube.trim() || null,
        website_url: website.trim() || null,
        linkedin_url: linkedin.trim() || null,
      };

      await upsertTrainerProfile(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-trainer-profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["trainer-search"] });
      onSaved?.();
    },
    onError: (e) => showAlert("Save failed", e instanceof Error ? e.message : "Could not save"),
  });

  function toggleSpecialty(specialty: TrainerSpecialty) {
    setSpecialties((prev) =>
      prev.includes(specialty) ? prev.filter((s) => s !== specialty) : [...prev, specialty]
    );
  }

  function toggleCategory(category: TrainerCategory) {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  function toggleFormat(format: TrainerCoachingFormat) {
    setFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  }

  async function handleAddCertification() {
    if (!certName.trim()) {
      showAlert("Certification", "Enter a certification name");
      return;
    }
    try {
      let document_url: string | null = null;
      let document_path: string | null = null;
      const picked = await pickImageFromLibrary();
      if (picked) {
        const uploaded = await uploadTrainerCertificationDocument(userId, picked.uri, picked.mimeType);
        document_url = uploaded.url;
        document_path = uploaded.path;
      }
      const cert = await addTrainerCertification(userId, {
        name: certName.trim(),
        issuer: certIssuer.trim() || null,
        document_url,
        document_path,
      });
      setCertifications((prev) => [cert, ...prev]);
      setCertName("");
      setCertIssuer("");
    } catch (e) {
      showAlert("Upload failed", e instanceof Error ? e.message : "Could not add certification");
    }
  }

  async function handleRemoveCert(id: string) {
    try {
      await deleteTrainerCertification(id);
      setCertifications((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      showAlert("Delete failed", e instanceof Error ? e.message : "Could not delete certification");
    }
  }

  async function handleAddPortfolioPhoto() {
    try {
      const picked = await pickImageFromLibrary();
      if (!picked) return;
      const uploaded = await uploadTrainerPortfolioPhoto(userId, picked.uri, picked.mimeType);
      const photo = await addTrainerPortfolioPhoto(userId, {
        image_url: uploaded.url,
        storage_path: uploaded.path,
        category: portfolioCategory,
      });
      setPortfolio((prev) => [...prev, photo]);
    } catch (e) {
      showAlert("Upload failed", e instanceof Error ? e.message : "Could not add portfolio photo");
    }
  }

  async function handleRemovePortfolio(id: string) {
    try {
      await deleteTrainerPortfolioPhoto(id);
      setPortfolio((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      showAlert("Delete failed", e instanceof Error ? e.message : "Could not delete photo");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Trainer profile</Text>
      <Text style={styles.hint}>
        Build a professional coaching profile separate from Training Partners discovery.
      </Text>

      {showDiscoveryToggle ? (
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>Discoverable as a trainer</Text>
            <Text style={styles.switchHint}>Athletes can find you in Find Trainer</Text>
          </View>
          <Switch value={discoveryEnabled} onValueChange={setDiscoveryEnabled} />
        </View>
      ) : null}

      <Input label="Bio" value={bio} onChangeText={setBio} multiline placeholder="Who you coach and how you help" />
      <Input
        label="Years of experience"
        value={yearsExperience}
        onChangeText={setYearsExperience}
        keyboardType="number-pad"
        placeholder="e.g. 8"
      />
      <Input
        label="Experience"
        value={experience}
        onChangeText={setExperience}
        multiline
        placeholder="Background, credentials, coaching history"
      />
      <Input
        label="Training philosophy"
        value={philosophy}
        onChangeText={setPhilosophy}
        multiline
        placeholder="How you approach coaching"
      />

      <Text style={styles.label}>Trainer categories</Text>
      <Text style={styles.hintInline}>How you describe your coaching role in discovery.</Text>
      <View style={styles.chipRow}>
        {TRAINER_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={formatTrainerCategory(category)}
            selected={categories.includes(category)}
            onPress={() => toggleCategory(category)}
          />
        ))}
      </View>

      <Text style={styles.label}>Specialties</Text>
      <View style={styles.chipRow}>
        {TRAINER_SPECIALTIES.map((specialty) => (
          <Chip
            key={specialty}
            label={formatTrainerSpecialty(specialty)}
            selected={specialties.includes(specialty)}
            onPress={() => toggleSpecialty(specialty)}
          />
        ))}
      </View>
      {specialties.includes("other") ? (
        <Input label="Other specialty" value={otherSpecialty} onChangeText={setOtherSpecialty} />
      ) : null}

      <Text style={styles.label}>Availability</Text>
      <View style={styles.chipRow}>
        {TRAINER_AVAILABILITY_STATUSES.map((status) => (
          <Chip
            key={status}
            label={formatTrainerAvailability(status)}
            selected={availability === status}
            onPress={() => setAvailability(status)}
          />
        ))}
      </View>

      <Text style={styles.label}>Coaching format</Text>
      <View style={styles.chipRow}>
        {TRAINER_COACHING_FORMATS.map((format) => (
          <Chip
            key={format}
            label={formatCoachingFormat(format)}
            selected={formats.includes(format)}
            onPress={() => toggleFormat(format)}
          />
        ))}
      </View>

      <Text style={styles.label}>Monthly budget (display only)</Text>
      <View style={styles.budgetRow}>
        <Input label="From $" value={budgetMin} onChangeText={setBudgetMin} keyboardType="decimal-pad" />
        <Input label="To $" value={budgetMax} onChangeText={setBudgetMax} keyboardType="decimal-pad" />
      </View>

      <Text style={styles.section}>Social links</Text>
      <Input label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" />
      <Input label="TikTok" value={tiktok} onChangeText={setTiktok} autoCapitalize="none" />
      <Input label="YouTube" value={youtube} onChangeText={setYoutube} autoCapitalize="none" />
      <Input label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" />
      <Input label="LinkedIn" value={linkedin} onChangeText={setLinkedin} autoCapitalize="none" />

      <Text style={styles.section}>Certifications</Text>
      {certifications.map((cert) => (
        <View key={cert.id} style={styles.listRow}>
          <View style={styles.listCopy}>
            <Text style={styles.listTitle}>{cert.name}</Text>
            <Text style={styles.listMeta}>
              {cert.issuer ?? "Self-reported"} · {cert.review_status}
            </Text>
          </View>
          <Button title="Remove" variant="secondary" onPress={() => handleRemoveCert(cert.id)} />
        </View>
      ))}
      <Input label="Certification name" value={certName} onChangeText={setCertName} placeholder="NASM CPT" />
      <Input label="Issuer" value={certIssuer} onChangeText={setCertIssuer} placeholder="NASM" />
      <Button title="Add certification" variant="secondary" onPress={handleAddCertification} />

      <Text style={styles.section}>Portfolio photos</Text>
      <View style={styles.chipRow}>
        {TRAINER_PORTFOLIO_CATEGORIES.map((category) => (
          <Chip
            key={category}
            label={formatPortfolioCategory(category)}
            selected={portfolioCategory === category}
            onPress={() => setPortfolioCategory(category)}
          />
        ))}
      </View>
      {portfolio.map((photo) => (
        <View key={photo.id} style={styles.listRow}>
          <View style={styles.listCopy}>
            <Text style={styles.listTitle}>{formatPortfolioCategory(photo.category)}</Text>
            <Text style={styles.listMeta} numberOfLines={1}>
              {photo.caption ?? photo.image_url}
            </Text>
          </View>
          <Button title="Remove" variant="secondary" onPress={() => handleRemovePortfolio(photo.id)} />
        </View>
      ))}
      <Button title="Upload portfolio photo" variant="secondary" onPress={handleAddPortfolioPhoto} />

      <Button title="Save trainer profile" onPress={() => saveMutation.mutate()} loading={saveMutation.isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    ...typography.heading,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
  hintInline: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchCopy: { flex: 1 },
  switchLabel: { ...typography.body, fontWeight: "600" },
  switchHint: { ...typography.caption, color: colors.textMuted },
  budgetRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  listCopy: { flex: 1 },
  listTitle: { ...typography.body, fontWeight: "600" },
  listMeta: { ...typography.caption, color: colors.textMuted },
});
