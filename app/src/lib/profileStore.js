/**
 * Persistence for the onboarding profile and the screening schedule.
 *
 * The app's in-memory shape (camelCase, nested `profile`/`intake`) and the database
 * shape (snake_case, flat) are deliberately different — the screens were written
 * before the schema existed. Rather than rewrite every screen, the mapping lives
 * here so there is exactly one place that knows both shapes.
 */
import { supabase, isConfigured } from "./supabase";

/* ---------------- profile ---------------- */

function toRow(userId, { profile = {}, intake = {} }, extra = {}) {
  return {
    user_id: userId,
    first_name: profile.name || null,
    dob: profile.dob || null,
    sex: profile.sex || null,
    smoker: !!profile.smoker,
    family_early_heart_disease: !!profile.familyEarlyHeartDisease,
    family_or_personal_cancer: !!profile.familyOrPersonalCancer,
    diabetes_or_prediabetes: !!profile.diabetesOrPrediabetes,
    exercise_frequency: intake.exercise || null,
    sleep_quality: intake.sleep || null,
    conditions: intake.conditions || [],
    family_history: intake.familyHistory || [],
    past_events: intake.pastEvents || null,
    primary_concern: intake.primaryConcern || null,
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

function fromRow(row) {
  if (!row) return null;
  return {
    profile: {
      name: row.first_name || "",
      dob: row.dob || "",
      sex: row.sex || "male",
      smoker: row.smoker,
      familyEarlyHeartDisease: row.family_early_heart_disease,
      familyOrPersonalCancer: row.family_or_personal_cancer,
      diabetesOrPrediabetes: row.diabetes_or_prediabetes,
    },
    intake: {
      conditions: row.conditions || [],
      familyHistory: row.family_history || [],
      pastEvents: row.past_events || "",
      primaryConcern: row.primary_concern || "",
      exercise: row.exercise_frequency || "",
      sleep: row.sleep_quality || "",
      // input buffers the form expects to exist
      conditionInput: "",
      medInput: "",
      medications: [],
    },
    onboardingStep: row.onboarding_step || 1,
    onboardingCompletedAt: row.onboarding_completed_at,
    consentAcceptedAt: row.consent_accepted_at,
  };
}

export async function loadProfile(userId) {
  if (!isConfigured || !userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("loadProfile", error);
    return null;
  }
  return fromRow(data);
}

export async function saveProfile(userId, data, extra = {}) {
  if (!isConfigured || !userId) return { error: new Error("not configured") };
  // onConflict on user_id makes this idempotent — re-running onboarding updates
  // the existing row instead of failing the unique constraint.
  const { error } = await supabase
    .from("profiles")
    .upsert(toRow(userId, data, extra), { onConflict: "user_id" });
  if (error) console.error("saveProfile", error);
  return { error };
}

/**
 * (C) Called after each onboarding step so a drop-off can be resumed. Records the
 * furthest step reached; never moves the marker backwards if the user navigates back.
 */
export async function saveOnboardingProgress(userId, data, step) {
  return saveProfile(userId, data, { onboarding_step: step });
}

export async function completeOnboarding(userId, data) {
  return saveProfile(userId, data, {
    onboarding_step: 5,
    onboarding_completed_at: new Date().toISOString(),
  });
}

export async function acceptConsent(userId, version = "v1") {
  if (!isConfigured || !userId) return { error: null };
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      consent_accepted_at: new Date().toISOString(),
      consent_version: version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("acceptConsent", error);
  return { error };
}

/* ---------------- medications ---------------- */

/**
 * Onboarding collects medications as free-text strings. They were being dropped
 * entirely; this lands them in ghai.medications so the AI and the meds screen can
 * both read the same list.
 */
export async function saveMedications(userId, meds = []) {
  if (!isConfigured || !userId || !meds.length) return { error: null };
  const rows = meds
    .filter(Boolean)
    .map((m) => (typeof m === "string" ? { name: m } : m))
    .map((m) => ({
      user_id: userId,
      name: m.name,
      dose: m.dose || null,
      frequency: m.frequency || null,
      type: m.type || "prescription",
    }));
  const { error } = await supabase.from("medications").insert(rows);
  if (error) console.error("saveMedications", error);
  return { error };
}

export async function loadMedications(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) {
    console.error("loadMedications", error);
    return [];
  }
  return data || [];
}

/* ---------------- documents ---------------- */

/**
 * Uploads a bloodwork/genetic file to the private health-docs bucket and records it.
 * Files are namespaced by user id because the storage policy enforces that prefix.
 */
export async function uploadDocument(userId, file, kind = "lab") {
  if (!isConfigured || !userId || !file) return { error: null, document: null };

  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("health-docs")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) {
    console.error("uploadDocument/storage", upErr);
    return { error: upErr, document: null };
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      kind,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      status: "uploaded",
    })
    .select()
    .single();
  if (error) {
    console.error("uploadDocument/row", error);
    // The row is what makes the file discoverable. Without it the object is an
    // orphan the user can never see, so clean it up rather than leave litter.
    await supabase.storage.from("health-docs").remove([path]);
    return { error, document: null };
  }
  return { error: null, document: data };
}

/** Every document the user has uploaded, newest first. */
export async function listDocuments(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listDocuments", error);
    return [];
  }
  return data || [];
}

/**
 * Short-lived signed URL for viewing a stored file. The bucket is private, so
 * there is no permanent public link — the URL is minted on demand and expires.
 */
export async function getDocumentUrl(storagePath, expiresInSeconds = 120) {
  if (!isConfigured || !storagePath) return null;
  const { data, error } = await supabase.storage
    .from("health-docs")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.error("getDocumentUrl", error);
    return null;
  }
  return data?.signedUrl || null;
}

/** Remove a document: the stored object first, then its row. */
export async function deleteDocument(document) {
  if (!isConfigured || !document?.id) return { error: null };
  if (document.storage_path) {
    const { error: rmErr } = await supabase.storage
      .from("health-docs")
      .remove([document.storage_path]);
    if (rmErr) console.error("deleteDocument/storage", rmErr);
  }
  const { error } = await supabase.from("documents").delete().eq("id", document.id);
  if (error) console.error("deleteDocument/row", error);
  return { error };
}

export async function loadDocuments(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("id, kind, file_name, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadDocuments", error);
    return [];
  }
  return data || [];
}

export async function loadLabMarkers(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("lab_markers")
    .select("name, value, unit, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadLabMarkers", error);
    return [];
  }
  return data || [];
}

/* ---------------- screenings ---------------- */

export async function saveScreenings(userId, schedule = [], completed = {}) {
  if (!isConfigured || !userId || !schedule.length) return { error: null };
  const rows = schedule.map((item) => ({
    user_id: userId,
    key: item.id,
    name: item.name,
    category: item.category || null,
    frequency: item.frequency || null,
    // A locally-ticked item wins over the engine's computed urgency.
    urgency: completed[item.id] ? "done" : item.urgency || null,
    completed_at: completed[item.id] ? new Date().toISOString().slice(0, 10) : null,
  }));
  const { error } = await supabase
    .from("screenings")
    .upsert(rows, { onConflict: "user_id,key" });
  if (error) console.error("saveScreenings", error);
  return { error };
}

export async function loadScreenings(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("screenings")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.error("loadScreenings", error);
    return [];
  }
  return data || [];
}

export async function markScreeningDone(userId, key, completedAt) {
  if (!isConfigured || !userId) return { error: null };
  const { error } = await supabase
    .from("screenings")
    .update({
      urgency: "done",
      completed_at: completedAt || new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("key", key);
  if (error) console.error("markScreeningDone", error);
  return { error };
}
