import { useEffect, useState } from "react";
import { sb } from "../supabaseClient";
import { formatDuration, formatDateTime, startOfTodayISO, startOfWeekISO } from "../utils/format";
import { useAuth } from "../AuthContext";

export default function MyTime() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const rows = await sb.select(
          "work_sessions",
          `employee_id=eq.${user.id}&select=id,status,started_at,ended_at,duration_seconds&order=started_at.desc&limit=50`
        );
        if (!cancelled) setSessions(rows || []);
      } catch (e) {
        if (!cancelled) setError("Could not load your sessions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <div className="loading-text">Loading your sessions…</div>;
  if (error) return <div className="banner banner-error">{error}</div>;

  // Compare as actual Date/epoch values, not raw ISO strings — Postgres
  // returns timestamps like "...+00:00" while startOfTodayISO() produces
  // "...Z", and those two suffixes don't always sort correctly as strings.
  const todayStartMs = new Date(startOfTodayISO()).getTime();
  const weekStartMs = new Date(startOfWeekISO()).getTime();
  const todaySeconds = sessions
    .filter((s) => new Date(s.started_at).getTime() >= todayStartMs)
    .reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const weekSeconds = sessions
    .filter((s) => new Date(s.started_at).getTime() >= weekStartMs)
    .reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  return (
    <div>
      <div className="topbar">
        <h1>My Time</h1>
      </div>

      <div className="grid grid-2 stats-grid">
        <div className="card stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value">{formatDuration(todaySeconds)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">This week</div>
          <div className="stat-value">{formatDuration(weekSeconds)}</div>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{formatDateTime(s.started_at)}</td>
                  <td>
                    <span className={`badge ${s.status}`}>{s.status}</span>
                  </td>
                  <td>{formatDuration(s.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sessions.length === 0 && <div className="empty-state">No sessions recorded yet.</div>}
      </div>
    </div>
  );
}
