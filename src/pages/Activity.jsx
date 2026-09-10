import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sb } from "../supabaseClient";
import { formatDuration, formatDateTime } from "../utils/format";
import { useAuth } from "../AuthContext";

export default function Activity() {
  const { user, canViewAllActivity } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterEmployee = searchParams.get("employee") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [people, setPeople] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const employeeId = canViewAllActivity ? filterEmployee : user.id;
        let query =
          "select=id,employee_id,domain,url,page_title,started_at,ended_at,duration_seconds&order=started_at.desc&limit=100";
        if (employeeId) query += `&employee_id=eq.${employeeId}`;

        const [logRows, peopleRows] = await Promise.all([
          sb.select("activity_logs", query),
          canViewAllActivity ? sb.select("profiles", "select=id,full_name,email,role") : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setLogs(logRows || []);
        setPeople(peopleRows || []);
      } catch (e) {
        if (!cancelled) setError("Could not load activity logs.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [canViewAllActivity, filterEmployee, user]);

  const employeeName = (id) => {
    const p = people.find((x) => x.id === id);
    return p ? p.full_name || p.email : id;
  };

  if (loading) return <div className="loading-text">Loading activity…</div>;
  if (error) return <div className="banner banner-error">{error}</div>;

  return (
    <div>
      <div className="topbar">
        <h1>{canViewAllActivity ? "Activity Logs" : "My Activity"}</h1>
        {canViewAllActivity && (
          <select
            className="select-input"
            value={filterEmployee}
            onChange={(e) => {
              const v = e.target.value;
              setSearchParams(v ? { employee: v } : {});
            }}
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
      <div className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {canViewAllActivity && <th>Employee</th>}
                <th>Domain</th>
                <th>Page title</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  {canViewAllActivity && <td>{employeeName(l.employee_id)}</td>}
                  <td>{l.domain || "—"}</td>
                  <td className="truncate-cell">{l.page_title || "—"}</td>
                  <td>{formatDateTime(l.started_at)}</td>
                  <td>{formatDuration(l.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && <div className="empty-state">No activity recorded yet.</div>}
      </div>
    </div>
  );
}
