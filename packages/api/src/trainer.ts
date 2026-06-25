import type {
  AddTrainerCertificationInput,
  AddTrainerPortfolioPhotoInput,
  Profile,
  TrainerCertification,
  TrainerCertificationStatus,
  TrainerConnection,
  TrainerPortfolioPhoto,
  TrainerProfile,
  TrainerProfileBundle,
  TrainerSearchFilters,
  TrainerSearchResult,
  TrainerVerificationLevel,
  UpsertTrainerProfileInput,
} from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getProfilesByIds } from "./profiles";
import { readImageBytes, normalizeImageExt } from "./profile-utils";
import { withTimeout, IMAGE_UPLOAD_TIMEOUT_MS } from "./upload-utils";
import { getSupabase } from "./supabase";

function trainerError(error: unknown, context: string): Error {
  return formatSupabaseError(error, context);
}

function parseTrainerProfile(value: unknown): TrainerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid trainer profile");
  }
  return value as TrainerProfile;
}

function parseProfile(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid profile");
  }
  return value as Profile;
}

function parseCertifications(value: unknown): TrainerCertification[] {
  if (!Array.isArray(value)) return [];
  return value as TrainerCertification[];
}

function parsePortfolio(value: unknown): TrainerPortfolioPhoto[] {
  if (!Array.isArray(value)) return [];
  return value as TrainerPortfolioPhoto[];
}

function parseBundle(value: unknown): TrainerProfileBundle | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid trainer profile bundle");
  }
  const row = value as Record<string, unknown>;
  return {
    profile: parseProfile(row.profile),
    trainer: parseTrainerProfile(row.trainer),
    certifications: parseCertifications(row.certifications),
    portfolio: parsePortfolio(row.portfolio),
    connection: (row.connection as TrainerConnection | null | undefined) ?? null,
    review_stats: row.review_stats as TrainerProfileBundle["review_stats"],
  };
}

function parseSearchResults(value: unknown): TrainerSearchResult[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const row = value as Record<string, unknown>;
  const results = row.results;
  if (!Array.isArray(results)) return [];
  return results as TrainerSearchResult[];
}

export async function upsertTrainerProfile(
  input: UpsertTrainerProfileInput
): Promise<TrainerProfile> {
  const { data, error } = await getSupabase().rpc("upsert_trainer_profile", {
    p_bio: input.bio ?? null,
    p_experience: input.experience ?? null,
    p_training_philosophy: input.training_philosophy ?? null,
    p_years_experience: input.years_experience ?? null,
    p_specialties: input.specialties ?? [],
    p_other_specialty: input.other_specialty ?? null,
    p_categories: input.categories ?? [],
    p_availability_status: input.availability_status ?? "available",
    p_coaching_formats: input.coaching_formats ?? [],
    p_budget_min_monthly: input.budget_min_monthly ?? null,
    p_budget_max_monthly: input.budget_max_monthly ?? null,
    p_discovery_enabled: input.discovery_enabled ?? false,
    p_instagram_url: input.instagram_url ?? null,
    p_tiktok_url: input.tiktok_url ?? null,
    p_youtube_url: input.youtube_url ?? null,
    p_website_url: input.website_url ?? null,
    p_linkedin_url: input.linkedin_url ?? null,
  });

  if (error) throw trainerError(error, "Failed to save trainer profile");
  return parseTrainerProfile(data);
}

export async function getMyTrainerProfile(): Promise<TrainerProfileBundle | null> {
  const { data, error } = await getSupabase().rpc("get_my_trainer_profile");
  if (error) throw trainerError(error, "Failed to load trainer profile");
  return parseBundle(data);
}

export async function getTrainerProfileByUsername(
  username: string
): Promise<TrainerProfileBundle | null> {
  const { data, error } = await getSupabase().rpc("get_trainer_profile", {
    p_username: username,
  });
  if (error) throw trainerError(error, "Failed to load trainer profile");
  return parseBundle(data);
}

export async function searchTrainers(
  filters: TrainerSearchFilters = {}
): Promise<TrainerSearchResult[]> {
  const { data, error } = await getSupabase().rpc("search_trainers", {
    p_query: filters.query ?? null,
    p_goal: filters.goal ?? null,
    p_specialty: filters.specialty ?? null,
    p_category: filters.category ?? null,
    p_city: filters.city ?? null,
    p_budget_max: filters.budgetMax ?? null,
    p_coaching_format: filters.coachingFormat ?? null,
    p_verification_level: filters.verificationLevel ?? null,
    p_limit: filters.limit ?? 20,
    p_offset: filters.offset ?? 0,
  });

  if (error) throw trainerError(error, "Failed to search trainers");
  return parseSearchResults(data);
}

export async function requestTrainerConnection(
  trainerId: string,
  introMessage?: string
): Promise<TrainerConnection> {
  const { data, error } = await getSupabase().rpc("request_trainer_connection", {
    p_trainer_id: trainerId,
    p_intro_message: introMessage ?? null,
  });
  if (error) throw trainerError(error, "Failed to send coaching request");
  return data as TrainerConnection;
}

export async function respondTrainerConnection(
  connectionId: string,
  accept: boolean
): Promise<TrainerConnection> {
  const { data, error } = await getSupabase().rpc("respond_trainer_connection", {
    p_connection_id: connectionId,
    p_accept: accept,
  });
  if (error) throw trainerError(error, "Failed to respond to coaching request");
  return data as TrainerConnection;
}

export async function getTrainerConnections(role?: "trainer" | "client"): Promise<TrainerConnection[]> {
  const { data, error } = await getSupabase().rpc("get_trainer_connections", {
    p_role: role ?? null,
  });
  if (error) throw trainerError(error, "Failed to load trainer connections");
  return (data ?? []) as TrainerConnection[];
}

export async function getTrainerConnectionsEnriched(
  role?: "trainer" | "client"
): Promise<(TrainerConnection & { trainer_verification_level?: string | null })[]> {
  const connections = await getTrainerConnections(role);
  if (!connections.length) return [];

  const profileIds = new Set<string>();
  const trainerIds = new Set<string>();
  for (const c of connections) {
    profileIds.add(c.trainer_id);
    profileIds.add(c.client_id);
    trainerIds.add(c.trainer_id);
  }

  const [profiles, trainerRowsRes] = await Promise.all([
    getProfilesByIds([...profileIds]),
    getSupabase()
      .from("trainer_profiles")
      .select("user_id, verification_level")
      .in("user_id", [...trainerIds]),
  ]);

  if (trainerRowsRes.error) throw trainerError(trainerRowsRes.error, "Failed to load trainer details");

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const verificationByTrainer = new Map(
    (trainerRowsRes.data ?? []).map((row) => [row.user_id as string, row.verification_level as string])
  );

  return connections.map((c) => ({
    ...c,
    trainer: byId.get(c.trainer_id),
    client: byId.get(c.client_id),
    trainer_verification_level: verificationByTrainer.get(c.trainer_id) ?? null,
  }));
}

export async function removeTrainerConnection(connectionId: string): Promise<TrainerConnection> {
  const { data, error } = await getSupabase().rpc("remove_trainer_connection", {
    p_connection_id: connectionId,
  });
  if (error) throw trainerError(error, "Failed to remove connection");
  return data as TrainerConnection;
}

export async function startTrainerConversation(otherUserId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("start_trainer_conversation", {
    p_other_user_id: otherUserId,
  });
  if (error) throw trainerError(error, "Failed to start conversation");
  if (typeof data !== "string") throw new Error("Conversation could not be created");
  return data;
}

export async function addTrainerCertification(
  trainerId: string,
  input: AddTrainerCertificationInput
): Promise<TrainerCertification> {
  const { data, error } = await getSupabase()
    .from("trainer_certifications")
    .insert({
      trainer_id: trainerId,
      name: input.name,
      issuer: input.issuer ?? null,
      issued_year: input.issued_year ?? null,
      document_url: input.document_url ?? null,
      document_path: input.document_path ?? null,
    })
    .select()
    .single();

  if (error) throw trainerError(error, "Failed to add certification");
  return data as TrainerCertification;
}

export async function deleteTrainerCertification(certId: string): Promise<void> {
  const { data: cert, error: fetchError } = await getSupabase()
    .from("trainer_certifications")
    .select("document_path")
    .eq("id", certId)
    .single();

  if (fetchError) throw trainerError(fetchError, "Failed to find certification");

  const { error } = await getSupabase().from("trainer_certifications").delete().eq("id", certId);
  if (error) throw trainerError(error, "Failed to delete certification");

  if (cert?.document_path) {
    await getSupabase().storage.from("trainer-certifications").remove([cert.document_path]);
  }
}

export async function uploadTrainerCertificationDocument(
  trainerId: string,
  uri: string,
  mimeType: string
): Promise<{ url: string; path: string }> {
  const ext = normalizeImageExt(mimeType);
  const path = `${trainerId}/${Date.now()}.${ext}`;
  const body = await readImageBytes(uri);

  const { error: uploadError } = await withTimeout(
    getSupabase().storage.from("trainer-certifications").upload(path, body, {
      contentType: mimeType,
      upsert: false,
    }),
    IMAGE_UPLOAD_TIMEOUT_MS,
    "Certification upload"
  );

  if (uploadError) throw trainerError(uploadError, "Failed to upload certification");

  const { data } = getSupabase().storage.from("trainer-certifications").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function addTrainerPortfolioPhoto(
  trainerId: string,
  input: AddTrainerPortfolioPhotoInput
): Promise<TrainerPortfolioPhoto> {
  const { data, error } = await getSupabase()
    .from("trainer_portfolio_photos")
    .insert({
      trainer_id: trainerId,
      image_url: input.image_url,
      storage_path: input.storage_path,
      caption: input.caption ?? null,
      category: input.category ?? "coaching",
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) throw trainerError(error, "Failed to add portfolio photo");
  return data as TrainerPortfolioPhoto;
}

export async function deleteTrainerPortfolioPhoto(photoId: string): Promise<void> {
  const { data: photo, error: fetchError } = await getSupabase()
    .from("trainer_portfolio_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();

  if (fetchError) throw trainerError(fetchError, "Failed to find portfolio photo");

  const { error } = await getSupabase().from("trainer_portfolio_photos").delete().eq("id", photoId);
  if (error) throw trainerError(error, "Failed to delete portfolio photo");

  if (photo?.storage_path) {
    await getSupabase().storage.from("trainer-portfolio").remove([photo.storage_path]);
  }
}

export async function uploadTrainerPortfolioPhoto(
  trainerId: string,
  uri: string,
  mimeType: string
): Promise<{ url: string; path: string }> {
  const ext = normalizeImageExt(mimeType);
  const path = `${trainerId}/${Date.now()}.${ext}`;
  const body = await readImageBytes(uri);

  const { error: uploadError } = await withTimeout(
    getSupabase().storage.from("trainer-portfolio").upload(path, body, {
      contentType: mimeType,
      upsert: false,
    }),
    IMAGE_UPLOAD_TIMEOUT_MS,
    "Portfolio upload"
  );

  if (uploadError) throw trainerError(uploadError, "Failed to upload portfolio photo");

  const { data } = getSupabase().storage.from("trainer-portfolio").getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function getPendingTrainerCertifications(): Promise<
  (TrainerCertification & { trainer?: Profile })[]
> {
  const { data, error } = await getSupabase()
    .from("trainer_certifications")
    .select("*")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw trainerError(error, "Failed to load pending certifications");

  const certs = (data ?? []) as TrainerCertification[];
  const trainerIds = [...new Set(certs.map((c) => c.trainer_id))];
  const profiles = await getProfilesByIds(trainerIds);
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return certs.map((c) => ({ ...c, trainer: byId.get(c.trainer_id) }));
}

export async function reviewTrainerCertification(
  certId: string,
  status: Extract<TrainerCertificationStatus, "approved" | "rejected">
): Promise<TrainerCertification> {
  const { data, error } = await getSupabase().rpc("review_trainer_certification", {
    p_cert_id: certId,
    p_status: status,
  });
  if (error) throw trainerError(error, "Failed to review certification");
  return data as TrainerCertification;
}

export async function setTrainerVerificationLevel(
  trainerId: string,
  level: TrainerVerificationLevel
): Promise<TrainerProfile> {
  const { data, error } = await getSupabase().rpc("set_trainer_verification_level", {
    p_trainer_id: trainerId,
    p_level: level,
  });
  if (error) throw trainerError(error, "Failed to set verification level");
  return parseTrainerProfile(data);
}

export async function getTrainerVerificationForUser(
  userId: string
): Promise<TrainerVerificationLevel | null> {
  const { data, error } = await getSupabase()
    .from("trainer_profiles")
    .select("verification_level")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw trainerError(error, "Failed to load trainer verification");
  return (data?.verification_level as TrainerVerificationLevel | undefined) ?? null;
}
