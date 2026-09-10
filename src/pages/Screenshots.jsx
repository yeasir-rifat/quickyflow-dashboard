import { useEffect, useState } from "react";
import { sb } from "../supabaseClient";
import { formatDateTime } from "../utils/format";
import { useAuth } from "../AuthContext";

export default function Screenshots() {
  const { user, canViewAllActivity } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shots, setShots] = useState([]);
  const [people, setPeople] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const scopedEmployeeId = canViewAllActivity ? employeeFilter : user.id;
        let query = "select=id,employee_id,storage_path,active_domain,active_url,taken_at&order=taken_at.desc&limit=60";
        if (scopedEmployeeId) query += `&employee_id=eq.${scopedEmployeeId}`;

        const [shotRows, peopleRows] = await Promise.all([
          sb.select("screenshots", query),
          canViewAllActivity ? sb.select("profiles", "select=id,full_name,email,role") : Promise.resolve([]),
        ]);
        if (cancelled) return;

        const withUrls = await Promise.all(
          (shotRows || []).map(async (s) => {
            try {
              const url = await sb.createSignedUrl("screenshots", s.storage_path, 1800);
              return { ...s, signedUrl: url };
            } catch (e) {
              return { ...s, signedUrl: null };
            }
          })
        );

        if (cancelled) return;
        setShots(withUrls);
        setPeople(peopleRows || []);
      } catch (e) {
        if (!cancelled) setError("Could not load screenshots.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [canViewAllActivity, employeeFilter, user]);

  const employeeName = (id) => {
    const p = people.find((x) => x.id === id);
    return p ? p.full_name || p.email : id;
  };

  return (
    <div>
      <div className="topbar">
        <h1>{canViewAllActivity ? "Screenshots" : "My Screenshots"}</h1>
        {canViewAllActivity && (
          <select
            className="select-input"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="">All employees</option>
            {people
              .filter((p) => p.role === "employee")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
          </select>
        )}
      </div>

      {loading && <div className="loading-text">Loading screenshots…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {!loading && !error && (
        <div className="screenshot-grid">
          {shots.map((s) => (
            <div className="screenshot-thumb" key={s.id}>
              {s.signedUrl ? (
                <a href={s.signedUrl} target="_blank" rel="noreferrer">
                  <img src={s.signedUrl} alt={s.active_domain || "screenshot"} loading="lazy" />
                </a>
              ) : (
                <div className="screenshot-unavailable">Unavailable</div>
              )}
              <div className="meta">
                {canViewAllActivity && <div>{employeeName(s.employee_id)}</div>}
                <div>{s.active_domain || "—"}</div>
                <div>{formatDateTime(s.taken_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && !error && shots.length === 0 && (
        <div className="empty-state">No screenshots yet.</div>
      )}
    </div>
  );
}
