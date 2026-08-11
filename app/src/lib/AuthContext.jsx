import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isConfigured } from "./supabase";

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  recovering: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // True while the user is completing a password reset — they arrive via the email
  // link with a temporary session, and must set a new password before using the app.
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    // Restore any persisted session first, then keep it in sync. onAuthStateChange
    // also fires on token refresh, so the user object never goes stale.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Clicking the reset link opens the app with this event + a recovery session.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      // Cancelling the reset (sign out) must also leave recovery.
      if (event === "SIGNED_OUT") setRecovering(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    recovering,
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    // Send the reset email. The link must return the user to the deployed app so the
    // PASSWORD_RECOVERY event fires there. Prefer an explicit configured URL
    // (VITE_SITE_URL, e.g. https://intake.layer3labs.io on Render) so reset always
    // targets production even if the page was opened from another origin; fall back
    // to the current origin for local runs.
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
      }),
    // Set the new password, then leave recovery so the app renders normally.
    updatePassword: async (password) => {
      const res = await supabase.auth.updateUser({ password });
      if (!res.error) setRecovering(false);
      return res;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
