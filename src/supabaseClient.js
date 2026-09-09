import { createClient } from "@supabase/supabase-js";

// Supabase credentials are provided through Vite environment variables.
// Local: create .env.local from .env.example
// Vercel: Project Settings → Environment Variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabaseConfigError =
  "Supabase এখনো কনফিগার করা হয়নি। Vercel-এর Environment Variables-এ VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY যোগ করুন।";

// Keep the app usable before Supabase is configured.
// This lightweight fallback lets App.jsx render the Login screen instead of crashing.
const unconfiguredAuth = {
  async getSession() {
    return { data: { session: null }, error: new Error(supabaseConfigError) };
  },
  onAuthStateChange() {
    return {
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    };
  },
  async signInWithPassword() {
    return { data: { user: null }, error: new Error(supabaseConfigError) };
  },
  async signOut() {
    return { error: new Error(supabaseConfigError) };
  },
};

const unconfiguredClient = {
  auth: unconfiguredAuth,
  from() {
    return {
      select() {
        return {
          eq() {
            return {
              async single() {
                return { data: null, error: new Error(supabaseConfigError) };
              },
            };
          },
          async order() {
            return { data: [], error: new Error(supabaseConfigError) };
          },
        };
      },
    };
  },
};

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : unconfiguredClient;
