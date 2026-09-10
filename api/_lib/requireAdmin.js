// ============================================================
// Shared guard for every /api/admin-* function.
//
// Every admin endpoint must prove two things before touching the
// service-role key:
//   1. The request carries a valid Supabase access token (the caller
//      is a real logged-in user, not an anonymous request).
//   2. That user's profiles.role is 'admin'.
//
// Both checks are done with the anon key against PostgREST/GoTrue —
// never with the service-role key — so this guard itself can't be
// tricked into elevating privilege. The service-role key is only
// touched afterwards, inside the calling function, once this has
// already confirmed the caller is a genuine admin.
// ============================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function missingEnvError(res) {
  res.status(500).json({
    error:
      "Server is missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY environment variables.",
  });
}

async function requireAdmin(req, res) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    missingEnvError(res);
    return null;
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return null;
  }

  // 1. Resolve the token to a user via GoTrue (anon key + user's token).
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid or expired session." });
    return null;
  }
  const user = await userRes.json();

  // 2. Confirm that user's profile role is admin (PostgREST, anon key +
  // user's own token — RLS applies normally here, no bypass involved).
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  const rows = await profileRes.json();
  const role = Array.isArray(rows) && rows[0] ? rows[0].role : null;

  if (role !== "admin") {
    res.status(403).json({ error: "Admin role required." });
    return null;
  }

  return { user, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY };
}

export { requireAdmin };

