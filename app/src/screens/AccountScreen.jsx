import React, { useEffect, useState } from "react";
import { Check, ChevronRight, LogOut, Trash2 } from "lucide-react";
import { COLORS, DISPLAY, RADIUS } from "../theme/tokens";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";
import { loadAccount, saveAccount, deleteAccount } from "../lib/profileStore";

const EMPTY = {
  name: "", dob: "", sex: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "",
};

const input = {
  width: "100%", boxSizing: "border-box", background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.md, padding: "10px 12px", fontSize: 14, color: COLORS.textPrimary, outline: "none",
};
const label = { fontSize: 11.5, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 5, display: "block" };
const primary = {
  width: "100%", background: COLORS.teal, color: COLORS.onAccent, border: "none", borderRadius: RADIUS.md,
  padding: "12px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const secondary = {
  ...primary, background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}`,
};

function Field({ id, title, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={label}>{title}</label>
      {children}
    </div>
  );
}

function Notice({ tone = "ok", children }) {
  if (!children) return null;
  const ok = tone === "ok";
  return (
    <div style={{
      fontSize: 12.5, lineHeight: 1.45, marginTop: 10, padding: "8px 10px", borderRadius: RADIUS.sm,
      background: ok ? COLORS.goodDim : COLORS.badDim, color: ok ? COLORS.good : COLORS.danger,
      display: "flex", gap: 6, alignItems: "flex-start",
    }}>
      {ok && <Check size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span>{children}</span>
    </div>
  );
}

// ---- ACCOUNT ----
// The member's own details and login: name, date of birth, contact and address,
// email and password, sign out, and permanent deletion. Always the real account,
// read from the database, even in Test mode.
function AccountScreen({ setActive, onSaved }) {
  const { user, signOut } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState(null);

  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [passwordMsg, setPasswordMsg] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) return undefined;
    loadAccount(user.id).then((a) => {
      if (cancelled) return;
      setForm({ ...EMPTY, ...(a || {}) });
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setDetailsMsg(null); };

  const saveDetails = async () => {
    setSaving(true);
    const { error } = await saveAccount(user.id, form);
    setSaving(false);
    setDetailsMsg(error ? { tone: "bad", text: "Couldn't save. Check your connection and try again." } : { tone: "ok", text: "Saved." });
    if (!error) onSaved?.();
  };

  const changeEmail = async () => {
    const next = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setEmailMsg({ tone: "bad", text: "Enter a valid email address." });
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: next });
    setEmailMsg(error
      ? { tone: "bad", text: error.message }
      : { tone: "ok", text: `Check ${next} (and your current inbox) for a link to confirm the change.` });
    if (!error) setEmail("");
  };

  const changePassword = async () => {
    if (password.length < 8) { setPasswordMsg({ tone: "bad", text: "Use at least 8 characters." }); return; }
    if (password !== password2) { setPasswordMsg({ tone: "bad", text: "The two passwords don't match." }); return; }
    const { error } = await supabase.auth.updateUser({ password });
    setPasswordMsg(error ? { tone: "bad", text: error.message } : { tone: "ok", text: "Password updated." });
    if (!error) { setPassword(""); setPassword2(""); }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    setDeleteMsg(null);
    const { error } = await deleteAccount();
    if (error) {
      setDeleteBusy(false);
      setDeleteMsg({ tone: "bad", text: `Your account was not deleted. ${error.message}` });
      return;
    }
    // The login no longer exists; clearing the local session returns them to the
    // welcome screen.
    await signOut();
  };

  return (
    <div style={{ padding: "24px 18px 40px" }}>
      <button onClick={() => setActive("home")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18,
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Home
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Account</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>{user?.email}</div>

      <SectionLabel>Personal details</SectionLabel>
      <Card>
        {!loaded ? (
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>Loading…</div>
        ) : (
          <>
            <Field id="acct-name" title="Full name">
              <input id="acct-name" style={input} value={form.name} onChange={set("name")} autoComplete="name" />
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field id="acct-dob" title="Date of birth">
                  <input id="acct-dob" type="date" style={input} value={form.dob} onChange={set("dob")} autoComplete="bday" />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field id="acct-sex" title="Sex at birth">
                  <select id="acct-sex" style={input} value={form.sex} onChange={set("sex")}>
                    <option value="">Select</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </Field>
              </div>
            </div>
            <Field id="acct-phone" title="Phone">
              <input id="acct-phone" type="tel" style={input} value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="(555) 123-4567" />
            </Field>
            <Field id="acct-a1" title="Street address">
              <input id="acct-a1" style={input} value={form.addressLine1} onChange={set("addressLine1")} autoComplete="address-line1" />
            </Field>
            <Field id="acct-a2" title="Apartment, suite (optional)">
              <input id="acct-a2" style={input} value={form.addressLine2} onChange={set("addressLine2")} autoComplete="address-line2" />
            </Field>
            <Field id="acct-city" title="City">
              <input id="acct-city" style={input} value={form.city} onChange={set("city")} autoComplete="address-level2" />
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field id="acct-state" title="State">
                  <input id="acct-state" style={input} value={form.state} onChange={set("state")} autoComplete="address-level1" />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field id="acct-zip" title="ZIP code">
                  <input id="acct-zip" style={input} value={form.postalCode} onChange={set("postalCode")} autoComplete="postal-code" inputMode="numeric" />
                </Field>
              </div>
            </div>
            <button onClick={saveDetails} disabled={saving} style={{ ...primary, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save details"}
            </button>
            <Notice tone={detailsMsg?.tone}>{detailsMsg?.text}</Notice>
          </>
        )}
      </Card>

      <SectionLabel>Login</SectionLabel>
      <Card>
        <Field id="acct-email" title="Change email">
          <input id="acct-email" type="email" style={input} value={email} onChange={(e) => { setEmail(e.target.value); setEmailMsg(null); }} placeholder="New email address" autoComplete="email" />
        </Field>
        <button onClick={changeEmail} disabled={!email.trim()} style={{ ...secondary, opacity: email.trim() ? 1 : 0.5 }}>Update email</button>
        <Notice tone={emailMsg?.tone}>{emailMsg?.text}</Notice>

        <div style={{ height: 1, background: COLORS.border, margin: "16px 0" }} />

        <Field id="acct-pw" title="New password">
          <input id="acct-pw" type="password" style={input} value={password} onChange={(e) => { setPassword(e.target.value); setPasswordMsg(null); }} autoComplete="new-password" />
        </Field>
        <Field id="acct-pw2" title="Confirm new password">
          <input id="acct-pw2" type="password" style={input} value={password2} onChange={(e) => { setPassword2(e.target.value); setPasswordMsg(null); }} autoComplete="new-password" />
        </Field>
        <button onClick={changePassword} disabled={!password} style={{ ...secondary, opacity: password ? 1 : 0.5 }}>Update password</button>
        <Notice tone={passwordMsg?.tone}>{passwordMsg?.text}</Notice>
      </Card>

      <button onClick={signOut} style={{ ...secondary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        <LogOut size={15} /> Sign out
      </button>

      <SectionLabel>Delete account</SectionLabel>
      <Card style={{ borderColor: `${COLORS.danger}40` }}>
        <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
          Permanently deletes your account, your health profile, labs, uploaded records, check-ins, conversations
          and connected-device data. This cannot be undone.
        </div>
        {!deleting ? (
          <button onClick={() => setDeleting(true)} style={{
            ...secondary, marginTop: 12, color: COLORS.danger, borderColor: `${COLORS.danger}60`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Trash2 size={15} /> Delete my account
          </button>
        ) : (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="acct-confirm" style={label}>Type DELETE to confirm</label>
            <input id="acct-confirm" style={input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" autoComplete="off" />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => { setDeleting(false); setConfirmText(""); setDeleteMsg(null); }} style={{ ...secondary, flex: 1 }}>Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={confirmText !== "DELETE" || deleteBusy}
                style={{ ...primary, flex: 1, background: COLORS.danger, opacity: confirmText === "DELETE" && !deleteBusy ? 1 : 0.45 }}
              >
                {deleteBusy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        )}
        <Notice tone={deleteMsg?.tone}>{deleteMsg?.text}</Notice>
      </Card>
    </div>
  );
}

export { AccountScreen };
