// ============================================================
// POST /api/admin-delete-user
// Body: { user_id }
//
// Deletes an auth user via the Admin API. This cascades to their
// profiles row (on delete cascade) and, in turn, to their
// work_sessions/activity_logs/screenshots rows, since those all
// reference profiles(id) with on delete cascade too.
// ============================================================

import { requireAdmin } from "./_lib/requireAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = ctx;
  const { user_id } = req.body || {};

  if (!user_id) {
    res.status(400).json({ error: "user_id is required." });
    return;
  }
  if (user_id === ctx.user.id) {
    res.status(400).json({ error: "You can't delete your own account while logged in as it." });
    return;
  }

  try {
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      res.status(delRes.status).json({ error: err.msg || "Could not delete user." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error." });
  }
};
