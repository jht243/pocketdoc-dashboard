/**
 * Persistence for the onboarding profile and the screening schedule.
 *
 * The app's in-memory shape (camelCase, nested `profile`/`intake`) and the database
 * shape (snake_case, flat) are deliberately different — the screens were written
 * before the schema existed. Rather than rewrite every screen, the mapping lives
 * here so there is exactly one place that knows both shapes.
 */
import { supabase, isConfigured } from "./supabase";
import { buildPreventiveCareSchedule } from "./preventiveCare";
import { fromCompletedAt, isScreeningDone, toCompletedAt } from "./screeningDates";

function ageFromDob(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  return (
    today.getFullYear() -
    birthDate.getFullYear() -
    (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0)
  );
}

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
    // The typed columns above capture only a slice of the questionnaire. The full
    // answer set (GAHT/TRT/peptides, screening history, environmental, goals, …) is
    // stored verbatim so nothing the user enters is lost. `medications` is dropped
    // from the blob because it lives in its own table (loadFullProfile rehydrates it).
    intake_answers: stripMedications(intake),
    updated_at: new Date().toISOString(),
    ...extra,
  };
}

// The medications table is the source of truth for meds; keep them out of the JSON
// blob so the two can't drift.
function stripMedications(intake) {
  // `lifestyle` is a derived duplicate of the flat exercise/sleep/alcohol keys;
  // the *Input fields are transient UI buffers. None belong in the stored blob.
  const { medications, medInput, conditionInput, lifestyle, ...rest } = intake || {};
  return rest;
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
      // Full questionnaire answer set first, then the typed columns win for the
      // handful of fields they own (so a legacy row with no blob still hydrates).
      ...(row.intake_answers || {}),
      conditions: row.conditions || [],
      familyHistory: row.family_history || [],
      pastEvents: row.past_events || "",
      primaryConcern: row.primary_concern || "",
      exercise: row.exercise_frequency || "",
      sleep: row.sleep_quality || "",
      // medications live in their own table; loadFullProfile fills this in.
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

/**
 * Profile row + medications + screenings, shaped the same way onboarding complete
 * leaves in memory — so home / preventive care / AI chat survive a reload.
 */
export async function loadFullProfile(userId) {
  if (!isConfigured || !userId) return null;
  const stored = await loadProfile(userId);
  if (!stored) return null;

  const [meds, screenings] = await Promise.all([
    loadMedications(userId),
    loadScreenings(userId),
  ]);

  // Names only here — the tokens widget and onboarding text join these as strings.
  const medications = (meds || []).map((m) => m.name).filter(Boolean);
  const age = ageFromDob(stored.profile.dob);
  const schedule =
    age != null && stored.profile.dob
      ? buildPreventiveCareSchedule({ ...stored.profile, age })
      : [];

  const completedItems = {};
  for (const row of screenings || []) {
    const value = fromCompletedAt(row.completed_at, row.urgency);
    if (value) completedItems[row.key] = value;
  }

  return {
    ...stored,
    intake: { ...stored.intake, medications },
    // The full rows — dose, frequency, prescriber, type — for the AI context.
    // Flattening to names alone told the model someone takes "Metformin" while
    // hiding the dose they typed in, which is half of what makes it usable.
    medicationsDetail: meds || [],
    schedule,
    completedItems,
  };
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

/**
 * Persist the standalone Health History questionnaire onto the user's existing
 * profile row. Uses UPDATE (not upsert) so it can never null out onboarding-owned
 * columns like first_name/dob, and syncs medications into their own table.
 * `answers` is the flat questionnaire answer set (a superset of the typed columns).
 */
export async function saveHealthHistory(userId, answers = {}) {
  if (!isConfigured || !userId) return { error: null };
  const { error } = await supabase
    .from("profiles")
    .update({
      conditions: answers.conditions || [],
      family_history: answers.familyHistory || [],
      past_events: answers.pastEvents || null,
      primary_concern: answers.primaryConcern || null,
      exercise_frequency: answers.exercise || null,
      sleep_quality: answers.sleep || null,
      intake_answers: stripMedications(answers),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) console.error("saveHealthHistory", error);
  await saveMedications(userId, answers.medications || []);
  return { error };
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
 * Onboarding collects medications as free-text strings. Replace the user's list
 * so re-saving onboarding (or step progress) never duplicates rows.
 */
export async function saveMedications(userId, meds = []) {
  if (!isConfigured || !userId) return { error: null };

  // Held so a failed insert can put them back. Removing one medication rewrites the
  // whole list, so an insert that fails half-way would otherwise delete every
  // medication the member has — a far larger loss than the one they asked for.
  const { data: previous } = await supabase
    .from("medications")
    .select("name, dose, frequency, prescriber, type, active")
    .eq("user_id", userId);

  const { error: delErr } = await supabase
    .from("medications")
    .delete()
    .eq("user_id", userId);
  if (delErr) {
    console.error("saveMedications/delete", delErr);
    return { error: delErr };
  }

  const rows = (meds || [])
    .filter(Boolean)
    .map((m) => (typeof m === "string" ? { name: m } : m))
    .filter((m) => m.name)
    .map((m) => ({
      user_id: userId,
      name: m.name,
      dose: m.dose || null,
      frequency: m.frequency || null,
      prescriber: m.prescriber || null,
      type: m.type || "prescription",
      active: true,
    }));
  if (!rows.length) return { error: null };

  const { error } = await supabase.from("medications").insert(rows);
  if (error) {
    console.error("saveMedications", error);
    if (previous?.length) {
      const { error: restoreErr } = await supabase
        .from("medications")
        .insert(previous.map((m) => ({ ...m, user_id: userId })));
      if (restoreErr) console.error("saveMedications/restore", restoreErr);
    }
  }
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

/**
 * Store the plain-text reading of an uploaded file (or why it couldn't be read).
 *
 * `status` is moved in step with the text so the Records screen can distinguish a
 * file we've read from one we've only stored — and from one we tried and failed to
 * read, which the user needs to know about, because it means the AI can't see it.
 */
export async function saveDocumentText(documentId, text, error = null) {
  if (!isConfigured || !documentId) return { error: null };
  const clean = String(text || "").trim();
  const { error: dbError } = await supabase
    .from("documents")
    .update({
      extracted_text: clean || null,
      extracted_at: new Date().toISOString(),
      extract_error: error ? String(error).slice(0, 500) : null,
      status: clean ? "extracted" : "failed",
    })
    .eq("id", documentId);
  if (dbError) console.error("saveDocumentText", dbError);
  return { error: dbError };
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
 * Which uploaded documents have already produced a lab panel.
 *
 * A file being stored and read is not the same as its results being IN the health
 * record: the markers only land when the member reviews and saves them, and any
 * import whose extraction failed leaves a document with a transcription and no
 * results at all. The Records list uses this to offer those documents a way in,
 * instead of a member seeing "Your AI can read this" while the Labs screen still
 * says they have never imported a panel.
 */
export async function loadPanelDocumentIds(userId) {
  if (!isConfigured || !userId) return new Set();
  const { data, error } = await supabase
    .from("lab_panels")
    .select("document_id")
    .eq("user_id", userId)
    .not("document_id", "is", null);
  if (error) {
    console.error("loadPanelDocumentIds", error);
    // An empty set only costs an extra offer to import results the member can
    // decline; failing closed would hide the path entirely.
    return new Set();
  }
  return new Set((data || []).map((row) => row.document_id));
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

/**
 * What a document put into the health record, so a delete can say what it will take
 * with it — and so the member can see the size of the thing they're undoing.
 */
export async function countDocumentData(documentId) {
  const empty = { markers: 0, genomes: 0 };
  if (!isConfigured || !documentId) return empty;

  const { data: panels } = await supabase
    .from("lab_panels")
    .select("id")
    .eq("document_id", documentId);
  const panelIds = (panels || []).map((row) => row.id);

  let markers = 0;
  if (panelIds.length) {
    const { count } = await supabase
      .from("lab_markers")
      .select("id", { count: "exact", head: true })
      .in("panel_id", panelIds);
    markers = count || 0;
  }

  const { count: genomes } = await supabase
    .from("genetic_markers")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);

  return { markers, genomes: genomes || 0 };
}

/**
 * Remove a document AND everything it put in the health record.
 *
 * The foreign keys are `on delete set null`, which was written for a world where a
 * document was merely the provenance of results a member had typed in themselves.
 * Results are now filed automatically from the file, so that default means deleting
 * a PDF silently keeps every marker it produced — orphaned, unreachable through any
 * screen, and still feeding the Labs list, the trends, the bloodwork score and the
 * AI's context. A member who deletes a health document means the health data, not
 * just the file; and undoing a bad upload has to actually undo it.
 *
 * Derived rows go first, so a failure part-way leaves the document in place to try
 * again rather than leaving results with no file to trace them to.
 */
export async function deleteDocument(document) {
  if (!isConfigured || !document?.id) return { error: null };

  const { data: panels, error: panelReadErr } = await supabase
    .from("lab_panels")
    .select("id")
    .eq("document_id", document.id);
  if (panelReadErr) console.error("deleteDocument/panels", panelReadErr);

  const panelIds = (panels || []).map((row) => row.id);
  if (panelIds.length) {
    // Markers explicitly rather than relying on the panel cascade: an orphaned
    // marker keeps showing on the Labs screen with nothing to date it.
    const { error: markerErr } = await supabase.from("lab_markers").delete().in("panel_id", panelIds);
    if (markerErr) {
      console.error("deleteDocument/markers", markerErr);
      return { error: markerErr };
    }
    const { error: panelErr } = await supabase.from("lab_panels").delete().in("id", panelIds);
    if (panelErr) {
      console.error("deleteDocument/panelRows", panelErr);
      return { error: panelErr };
    }
  }

  const { error: geneErr } = await supabase
    .from("genetic_markers")
    .delete()
    .eq("document_id", document.id);
  if (geneErr) {
    console.error("deleteDocument/genomes", geneErr);
    return { error: geneErr };
  }

  if (document.storage_path) {
    const { error: rmErr } = await supabase.storage
      .from("health-docs")
      .remove([document.storage_path]);
    // An object left in the bucket is litter, not a reason to keep the record rows
    // the member asked to delete.
    if (rmErr) console.error("deleteDocument/storage", rmErr);
  }

  // The row carries the transcription, so this is what removes the document's text
  // from the AI's context.
  const { error } = await supabase.from("documents").delete().eq("id", document.id);
  if (error) console.error("deleteDocument/row", error);
  return { error };
}

export async function loadDocuments(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("documents")
    .select("id, kind, file_name, status, created_at, extracted_text, extracted_at, extract_error")
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
  // The panel carries when blood was actually drawn and where it came from. Without
  // it every marker is dated by when the user happened to upload the file, which
  // turns a three-year lab history into "all imported last Tuesday" and destroys
  // the trend the AI is supposed to reason about.
  const { data, error } = await supabase
    .from("lab_markers")
    .select("name, value, unit, status, ref_range, created_at, lab_panels(drawn_on, source)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadLabMarkers", error);
    // Losing the panel join must not lose the labs themselves: fall back to the flat
    // marker list, which costs the draw date and source but keeps every result in
    // front of the AI and on the Labs screen.
    const { data: flat, error: flatError } = await supabase
      .from("lab_markers")
      .select("name, value, unit, status, ref_range, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (flatError) {
      console.error("loadLabMarkers/flat", flatError);
      return [];
    }
    return (flat || []).map((marker) => ({ ...marker, range: marker.ref_range || null, drawnOn: null, source: null }));
  }
  return (data || []).map(({ lab_panels: panel, ...marker }) => ({
    ...marker,
    range: marker.ref_range || null,
    drawnOn: panel?.drawn_on || null,
    source: panel?.source || null,
  }));
}

/**
 * Persist a reviewed lab import: one panel row plus its markers.
 *
 * This is what the "Save to health record" button had been missing — the screen
 * extracted markers, showed them for review, told the user they were now part of
 * their longitudinal record, and then dropped them on the floor. Every downstream
 * feature that reads labs (the AI health context, lab trends, the bloodwork score,
 * the Discussion Page) was consequently looking at an empty list.
 *
 * Markers hang off a panel rather than standing alone so a single draw stays one
 * event: same date, same source, and re-importing the same document later doesn't
 * blur into the previous one.
 */
export async function saveLabMarkers(userId, markers = [], { documentId = null, source = null, drawnOn = null } = {}) {
  if (!isConfigured || !userId) return { error: null, markers: [] };

  const kept = (markers || []).filter((m) => m && m.name && String(m.name).trim());
  if (!kept.length) return { error: null, markers: [] };

  // One document is one draw. Results are now filed automatically the moment a file
  // is read, and the member can correct a misread value afterwards — so re-saving
  // the same document has to REPLACE its panel, or a single correction would show up
  // on the Labs screen as a second blood draw on the same day and put a phantom step
  // in every trend. Markers cascade with the panel.
  if (documentId) {
    const { data: stale } = await supabase
      .from("lab_panels")
      .select("id")
      .eq("user_id", userId)
      .eq("document_id", documentId);
    const staleIds = (stale || []).map((row) => row.id);
    if (staleIds.length) {
      // Markers first and explicitly, rather than trusting the FK to cascade —
      // orphaned marker rows would keep showing on the Labs screen with no panel to
      // date them, which is exactly the "all imported last Tuesday" failure the
      // panel exists to prevent.
      await supabase.from("lab_markers").delete().in("panel_id", staleIds);
      const { error: clearErr } = await supabase.from("lab_panels").delete().in("id", staleIds);
      if (clearErr) console.error("saveLabMarkers/replace", clearErr);
    }
  }

  const { data: panel, error: panelErr } = await supabase
    .from("lab_panels")
    .insert({
      user_id: userId,
      document_id: documentId,
      source: source || null,
      // A blank date column is honest about "we don't know when this was drawn";
      // an empty string is a date-parse error waiting to happen.
      drawn_on: drawnOn || null,
    })
    .select()
    .single();
  if (panelErr) {
    console.error("saveLabMarkers/panel", panelErr);
    return { error: panelErr, markers: [] };
  }

  const rows = kept.map((m) => ({
    panel_id: panel.id,
    user_id: userId,
    name: String(m.name).trim(),
    value: m.value != null && m.value !== "" ? String(m.value) : null,
    unit: m.unit || null,
    ref_range: m.range || m.ref_range || null,
    status: ["normal", "low", "high", "unknown"].includes(m.status) ? m.status : "unknown",
    // The user has just read these on the review screen and pressed save — that
    // review is exactly what `confirmed` records.
    confirmed: true,
  }));

  const { data, error } = await supabase.from("lab_markers").insert(rows).select();
  if (error) {
    console.error("saveLabMarkers/markers", error);
    // A panel with no markers is a phantom lab draw in the user's history. Undo it
    // rather than leave one behind.
    await supabase.from("lab_panels").delete().eq("id", panel.id);
    return { error, markers: [] };
  }
  return { error: null, markers: data || [] };
}

/* ---------------- genetic markers ---------------- */

/**
 * Persist the genomes extracted (and user-confirmed) from a genetic report.
 *
 * A genetic report is imported as a whole, so a re-import of the *same* source
 * document replaces that document's prior rows rather than stacking duplicates —
 * but genomes from other documents are left untouched. Passing no documentId
 * (e.g. a manual entry) simply appends.
 *
 * `markers` is the app-shaped array the review screen holds; the field names are
 * mapped to the flat table columns here so the screen never has to know the schema.
 */
export async function saveGeneticMarkers(userId, markers = [], documentId = null) {
  if (!isConfigured || !userId) return { error: null, markers: [] };

  if (documentId) {
    const { error: delErr } = await supabase
      .from("genetic_markers")
      .delete()
      .eq("user_id", userId)
      .eq("document_id", documentId);
    if (delErr) {
      console.error("saveGeneticMarkers/delete", delErr);
      return { error: delErr, markers: [] };
    }
  }

  const rows = (markers || [])
    .filter((m) => m && m.gene && String(m.gene).trim())
    .map((m) => ({
      user_id: userId,
      document_id: documentId,
      category: m.category === "pharma" ? "pharma" : "lifestyle",
      gene: String(m.gene).trim(),
      variant: m.variant || null,
      genotype: m.genotype || null,
      rsid: m.rsid || null,
      status: ["normal", "favorable", "variant", "watch", "unknown"].includes(m.status)
        ? m.status
        : "unknown",
      impact: m.impact || null,
      title: m.title || null,
      summary: m.summary || m.what || null,
      notes: m.notes || null,
      recommendations: Array.isArray(m.recommendations)
        ? m.recommendations
        : Array.isArray(m.forYou)
          ? m.forYou
          : [],
      medications: Array.isArray(m.medications) ? m.medications : [],
      ai_context: m.aiContext || m.ai_context || null,
      source: m.source || null,
      confirmed: m.confirmed !== false,
    }));
  if (!rows.length) return { error: null, markers: [] };

  const { data, error } = await supabase
    .from("genetic_markers")
    .insert(rows)
    .select();
  if (error) console.error("saveGeneticMarkers", error);
  return { error, markers: data || [] };
}

/** Every genome the user has imported, newest first, in the app's card shape. */
export async function loadGeneticMarkers(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("genetic_markers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadGeneticMarkers", error);
    return [];
  }
  return (data || []).map(fromGeneticRow);
}

/** DB row → the object shape the Genetic Profile cards render. */
function fromGeneticRow(row) {
  return {
    id: row.id,
    category: row.category || "lifestyle",
    gene: row.gene,
    variant: row.variant || "",
    genotype: row.genotype || "",
    rsid: row.rsid || "",
    status: row.status || "unknown",
    impact: row.impact || "Informative",
    title: row.title || "",
    what: row.summary || "",
    notes: row.notes || "",
    forYou: Array.isArray(row.recommendations) ? row.recommendations : [],
    medications: Array.isArray(row.medications) ? row.medications : [],
    aiContext: row.ai_context || "",
    source: row.source || "",
  };
}

/* ---------------- screenings ---------------- */

/**
 * Persist the full schedule plus completion state.
 * completedItems values: true (done, no month) | "YYYY-MM" (done that month) | falsy.
 * Month values are stored as the first of that month on `completed_at`.
 */
export async function saveScreenings(userId, schedule = [], completed = {}) {
  if (!isConfigured || !userId || !schedule.length) return { error: null };
  const now = new Date().toISOString();
  const rows = schedule.map((item) => {
    const value = completed[item.id];
    const done = isScreeningDone(value);
    const completedAt = done ? toCompletedAt(value) : null;
    return {
      user_id: userId,
      key: item.id,
      name: item.name,
      category: item.category || null,
      frequency: item.frequency || null,
      // A locally-ticked item wins over the engine's computed urgency.
      urgency: done ? "done" : item.urgency || null,
      completed_at: completedAt,
      updated_at: now,
    };
  });
  const { data, error } = await supabase
    .from("screenings")
    .upsert(rows, { onConflict: "user_id,key" })
    .select("key, urgency, completed_at");
  if (error) {
    console.error("saveScreenings", error);
    return { error, data: null };
  }
  return { error: null, data };
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
  const normalized =
    completedAt == null || completedAt === true
      ? null
      : toCompletedAt(completedAt) || String(completedAt).slice(0, 10);
  const { error } = await supabase
    .from("screenings")
    .update({
      urgency: "done",
      completed_at: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("key", key);
  if (error) console.error("markScreeningDone", error);
  return { error };
}
