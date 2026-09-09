import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("লগইন ব্যর্থ হয়েছে। ইমেইল বা পাসওয়ার্ড ভুল।");
      return;
    }

    // প্রোফাইল লোড করা (role, নাম ইত্যাদি)
    const { data: profile } = await supabase
      .from("employees")
      .select("id, role, full_name, email")
      .eq("id", data.user.id)
      .single();

    if (!profile) {
      setError("আপনার অ্যাকাউন্ট এখনো সেটআপ করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।");
      await supabase.auth.signOut();
      return;
    }

    onLoggedIn(profile);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>◆</span>
          <h1 style={styles.brandName}>Quickyflow</h1>
        </div>
        <p style={styles.tagline}>টাইম ট্র্যাকিং ড্যাশবোর্ড</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>ইমেইল</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            required
          />
          <label style={styles.label}>পাসওয়ার্ড</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <div style={styles.error}>{error}</div>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "প্রবেশ করা হচ্ছে..." : "প্রবেশ করুন"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: "36px 32px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  brandMark: {
    color: "var(--amber)",
    fontSize: 20,
  },
  brandName: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--text)",
  },
  tagline: {
    color: "var(--text-dim)",
    fontSize: 13,
    margin: "0 0 28px",
  },
  form: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 12,
    color: "var(--text-dim)",
    marginTop: 10,
  },
  input: {
    background: "var(--panel-raised)",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "11px 12px",
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "var(--font-body)",
  },
  error: {
    color: "var(--red)",
    fontSize: 12.5,
    marginTop: 4,
  },
  button: {
    marginTop: 18,
    background: "var(--amber)",
    color: "#1a1305",
    border: "none",
    borderRadius: 8,
    padding: "12px",
    fontWeight: 700,
    fontSize: 14,
  },
};
