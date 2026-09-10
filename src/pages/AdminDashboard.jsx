import { useEffect, useState } from "react";
import { sb } from "../supabaseClient";
import { formatDuration, formatHoursShort, startOfTodayISO, startOfWeekISO } from "../utils/format";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [people, setPeople] = useState([]);
  const [sessionsToday, setSessionsToday] = useState([]);
  const [sessionsWeek, setSessionsWeek] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [ppl, today, week] = await Promise.all([
          sb.select("profiles", "select=id,full_name,email,role&order=full_name.asc"),
          sb.select(
            "work_sessions",
            `started_at=gte.${startOfTodayISO()}&select=id,employee_id,status,duration_seconds,started_at`
          ),
          sb.select(
            "work_sessions",
            `started_at=gte.${startOfWeekISO()}&select=id,employee_id,duration_seconds`
          ),
        ]);
        if (cancelled) return;
        setPeople(ppl || []);
        setSessionsToday(today || []);
        setSessionsWeek(week || []);
      } catch (e) {
        if (!cancelled) setError("Could not load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="loading-text">Loading dashboard…</div>;
  if (error) return <div className="banner banner-error">{error}</div>;

  // The team-overview table shows working staff — i.e. everyone who
  // isn't purely an administrator. Assistant admins can still clock time
  // themselves in some orgs, but they're not the audience this table is
  // built for, so only plain employees are listed here (same as before).
  const employees = people.filter((p) => p.role === "employee");

  const activeNow = sessionsToday.filter((s) => s.status === "running").length;
  const todaySeconds = sessionsToday.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
  const weekSeconds = sessionsWeek.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

  const perEmployeeToday = {};
  for (const s of sessionsToday) {
    perEmployeeToday[s.employee_id] = (perEmployeeToday[s.employee_id] || 0) + (s.duration_seconds || 0);
  }
  const statusByEmployee = {};
  for (const s of sessionsToday) {
    statusByEmployee[s.employee_id] = s.status;
  }

  return (
    <div>
      <div className="topbar">
        <h1>Team Overview</h1>
      </div>

      <div className="grid grid-4 stats-grid">
        <div className="card stat-card">
          <div className="stat-label">Employees</div>
          <div className="stat-value">{employees.length}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Active now</div>
          <div className="stat-value">{activeNow}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Tracked today</div>
          <div className="stat-value">{formatHoursShort(todaySeconds)}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Tracked this week</div>
          <div className="stat-value">{formatHoursShort(weekSeconds)}</div>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Today</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const status = statusByEmployee[e.id] || "stopped";
                const seconds = perEmployeeToday[e.id] || 0;
                return (
                  <tr key={e.id}>
                    <td>{e.full_name || e.email}</td>
                    <td>
                      <span className={`badge ${status}`}>{status}</span>
                    </td>
                    <td>{formatDuration(seconds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {employees.length === 0 && <div className="empty-state">No employees yet.</div>}
      </div>
    </div>
  );
}
