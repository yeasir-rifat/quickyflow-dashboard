// ============================================================
// Lightweight Supabase REST client for the dashboard.
// Uses the same PostgREST + GoTrue endpoints as the browser
// extension (supabase-lite.js), so both apps stay in sync
// without needing the full @supabase/supabase-js SDK.
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const FETCH_TIMEOUT_MS = 10000;

async function qfFetch(url, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

const SESSION_KEY = "qf_dashboard_session";

class SupabaseClient {
  constructor(url, anonKey) {
    this.url = (url || "").replace(/\/$/, "");
    this.anonKey = anonKey;
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.userEmail = null;
    this.role = null; // "admin" | "employee" — resolved from profiles table after login
    this._loadFromStorage();
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.userId = data.user_id;
        this.userEmail = data.user_email;
        this.role = data.role || null;
      }
    } catch (e) {
      // ignore corrupt storage
    }
    this.ensureRefreshScheduled();
  }

  _saveToStorage() {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        access_token: this.accessToken,
        refresh_token: this.refreshToken,
        user_id: this.userId,
        user_email: this.userEmail,
        role: this.role,
      })
    );
  }

  isLoggedIn() {
    return !!this.accessToken;
  }

  async signIn(email, password) {
    const res = await qfFetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: this.anonKey },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || "Login failed");
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.userId = data.user.id;
    this.userEmail = data.user.email;
    await this._loadProfileRole();
    this._saveToStorage();
    this._scheduleRefresh(data.expires_in);
    return data.user;
  }

  // Accepts a session handed off from the browser extension (its popup
  // already has a valid access_token/refresh_token pair from its own
  // signIn()). Used for the "log in on the extension, dashboard opens
  // already signed in" flow — see the hash-based handoff read in App.jsx.
  async setSessionFromTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    // We don't have the user id/email yet — ask GoTrue who this token
    // belongs to before we can load the profile role or save to storage.
    const res = await qfFetch(`${this.url}/auth/v1/user`, {
      method: "GET",
      headers: { apikey: this.anonKey, Authorization: `Bearer ${accessToken}` },
    });
    const user = await res.json();
    if (!res.ok) throw new Error(user.error_description || user.msg || "Invalid session");
    this.userId = user.id;
    this.userEmail = user.email;
    await this._loadProfileRole();
    this._saveToStorage();
    this._scheduleRefresh(3300); // unknown real expiry after handoff — refresh proactively (~55 min)
    return user;
  }

  // Access tokens expire (default ~1hr) — without this, a dashboard tab
  // left open would start silently failing requests after an hour.
  _scheduleRefresh(expiresInSeconds) {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    const ms = Math.max(10_000, (expiresInSeconds || 3600) * 1000 - 60_000);
    this._refreshTimer = setTimeout(() => this._refreshAccessToken(), ms);
  }

  async _refreshAccessToken() {
    if (!this.refreshToken) return;
    try {
      const res = await qfFetch(`${this.url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.anonKey },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || "Refresh failed");
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this._saveToStorage();
      this._scheduleRefresh(data.expires_in);
    } catch (e) {
      console.warn("token refresh failed, signing out", e);
      await this.signOut();
      window.location.reload(); // send the user back to the login screen
    }
  }

  // Called on page load if a session was restored from localStorage, so
  // refresh keeps running across page refreshes/new tabs too.
  ensureRefreshScheduled() {
    if (this.isLoggedIn() && !this._refreshTimer) {
      this._scheduleRefresh(300);
    }
  }

  async _loadProfileRole() {
    try {
      const rows = await this.select("profiles", `id=eq.${this.userId}&select=role`);
      this.role = rows && rows[0] ? rows[0].role : "employee";
    } catch (e) {
      this.role = "employee";
    }
  }

  async signOut() {
    const token = this.accessToken;
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.userEmail = null;
    this.role = null;
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    localStorage.removeItem(SESSION_KEY);
    if (token) {
      qfFetch(`${this.url}/auth/v1/logout`, {
        method: "POST",
        headers: { apikey: this.anonKey, Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  _authHeaders(extra = {}) {
    return {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  async select(table, query) {
    const res = await qfFetch(`${this.url}/rest/v1/${table}?${query}`, {
      method: "GET",
      headers: this._authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
  }

  async insert(table, rows) {
    const res = await qfFetch(`${this.url}/rest/v1/${table}`, {
      method: "POST",
      headers: this._authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(rows),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
  }

  async update(table, query, patch) {
    const res = await qfFetch(`${this.url}/rest/v1/${table}?${query}`, {
      method: "PATCH",
      headers: this._authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
  }

  // Returns a signed URL for a private storage object (screenshots bucket)
  async createSignedUrl(bucket, path, expiresInSeconds = 3600) {
    const res = await qfFetch(`${this.url}/storage/v1/object/sign/${bucket}/${path}`, {
      method: "POST",
      headers: this._authHeaders(),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return `${this.url}/storage/v1${data.signedURL}`;
  }

  // --- role helpers -------------------------------------------------
  isAdmin() {
    return this.role === "admin";
  }
  isAssistantAdmin() {
    return this.role === "assistant_admin";
  }
  // Both admin and assistant_admin can view all employees' activity/screenshots.
  canViewAllActivity() {
    return this.role === "admin" || this.role === "assistant_admin";
  }
  // Only admin can create/edit/remove users.
  canManageUsers() {
    return this.role === "admin";
  }

  // --- server-side admin API (service-role actions) ------------------
  // These call the Vercel serverless functions under /api, which are the
  // only place the service-role key is ever used. The browser never sees
  // that key — only this dashboard's own backend does.
  async _callAdminApi(path, body) {
    const res = await qfFetch(`/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async adminCreateUser({ email, password, full_name, role }) {
    return this._callAdminApi("admin-create-user", { email, password, full_name, role });
  }

  async adminUpdateRole(user_id, role) {
    return this._callAdminApi("admin-update-role", { user_id, role });
  }

  async adminDeleteUser(user_id) {
    return this._callAdminApi("admin-delete-user", { user_id });
  }
}

export const sb = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
