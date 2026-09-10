// ============================================================
// POST /api/admin-update-role
// Body: { user_id, role }   role: employee | assistant_admin | admin
//
// Lets an admin change another user's role. Uses the service-role key
// server-side so this always succeeds regardless of RLS (the RLS
// policy on profiles already blocks non-admins from doing this
// directly from the browser — this endpoint re-checks admin status
// independently via requireAdmin before touching anything).
// ============================================================

import { requireAdmin } from "./_lib/requireAdmin.js";

const ALLOWED_ROLES = ["employee", "assistant_admin", "admin"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = ctx;
  const { user_id, role } = req.body || {};

  if (!user_id || !ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ error: "user_id and a valid role are required." });
    return;
  }

  // Prevent an admin from demoting themselves and locking everyone out
  // (including themselves) by accident, if they were the last admin.
  if (user_id === ctx.user.id && role !== "admin") {
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?role=eq.admin&select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const admins = await countRes.json();
    if (Array.isArray(admins) && admins.length <= 1) {
      res.status(400).json({ error: "You're the only admin — promote someone else before changing your own role." });
      return;
    }
  }

  try {
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ role }),
    });
    const data = await patchRes.json();
    if (!patchRes.ok) {
      res.status(patchRes.status).json({ error: data.message || "Could not update role." });
      return;
    }
    res.status(200).json({ profile: data[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error." });
  }
};
