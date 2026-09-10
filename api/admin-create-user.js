// ============================================================
// POST /api/admin-create-user
// Body: { email, password, full_name, role }   role: employee | assistant_admin | admin
//
// Only reachable by an already-authenticated admin (see
// _lib/requireAdmin.js). Creates the auth user via Supabase's Admin
// API (service-role key — used only here, only on the server, never
// sent to the browser), which is what generates the real auth UUID.
// The database trigger (handle_new_user) then auto-creates a
// 'employee'-role profiles row for that UUID; this function
// immediately PATCHes that row to the requested role, so the UUID is
// always the one Supabase Auth generated — never a manually-made ID.
// ============================================================

import { requireAdmin } from "./_lib/requireAdmin.js";

const ALLOWED_ROLES = ["employee", "assistant_admin", "admin"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return; // requireAdmin already sent the error response

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = ctx;
  const { email, password, full_name, role } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const safeRole = ALLOWED_ROLES.includes(role) ? role : "employee";

  try {
    // 1. Create the auth user. Supabase generates the UUID — we never
    // invent one ourselves.
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true, // skip email verification for admin-provisioned accounts
        user_metadata: { full_name: full_name || email },
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      res.status(createRes.status).json({
        error: created.msg || created.error_description || created.error || "Could not create user.",
      });
      return;
    }
    const newUserId = created.id;

    // 2. The on_auth_user_created trigger has already inserted a
    // profiles row with role='employee' by this point (trigger runs
    // synchronously inside the same transaction as user creation).
    // If a non-default role or a different display name was requested,
    // patch it now using the service-role key (bypasses RLS, which is
    // fine — this whole endpoint already required an admin caller).
    if (safeRole !== "employee" || full_name) {
      const patchBody = {};
      if (safeRole !== "employee") patchBody.role = safeRole;
      if (full_name) patchBody.full_name = full_name;

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${newUserId}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => ({}));
        // The auth user now exists but the role patch failed — surface
        // this clearly rather than silently leaving them as 'employee'.
        res.status(207).json({
          warning: "User created but role assignment failed — edit their role from the Employees page.",
          detail: patchErr,
          user: { id: newUserId, email, role: "employee" },
        });
        return;
      }
    }

    res.status(200).json({
      user: { id: newUserId, email, full_name: full_name || email, role: safeRole },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error." });
  }
};
