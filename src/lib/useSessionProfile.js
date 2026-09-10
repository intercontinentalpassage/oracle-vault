import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Returns { loading, session, profile } and keeps them in sync with
// Supabase Auth state changes (login/logout in another tab, token refresh).
export function useSessionProfile() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(sess) {
      if (!sess) {
        if (!cancelled) {
          setProfile(null);
          setSession(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", sess.user.id).maybeSingle();
      if (!cancelled) {
        setSession(sess);
        setProfile(data || null);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setLoading(true);
      loadProfile(sess);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session, profile };
}
