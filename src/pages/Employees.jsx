import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sb } from "../supabaseClient";
import { useAuth } from "../AuthContext";
import { formatDate } from "../utils/format";

const ROLE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "assistant_admin", label: "Assistant Admin" },
  { value: "admin", label: "Admin" },
];

function emptyForm() {
  return { email: "", password: "", full_name: "", role: "employee" };
}

export default function Employees() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [people, setPeople] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const [roleUpdating, setRoleUpdating] = useState(null); // user id currently being patched
  const [deleting, setDeleting] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function loadPeople() {
    setLoading(true);
    setError("");
    try {
      const rows = await sb.select(
        "profiles",
        "select=id,full_name,email,role,created_at&order=created_at.desc"
      );
      setPeople(rows || []);
    } catch (e) {
      setError("Could not load employees.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!form.email || !form.password) {
      setFormError("Email and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setCreating(true);
    try {
      await sb.adminCreateUser(form);
      setForm(emptyForm());
      setShowForm(false);
      await loadPeople();
    } catch (err) {
      setFormError(err.message || "Could not create user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(personId, newRole) {
    setRoleUpdating(personId);
    setError("");
    // optimistic update
    const prev = people;
    setPeople((ps) => ps.map((p) => (p.id === personId ? { ...p, role: newRole } : p)));
    try {
      await sb.adminUpdateRole(personId, newRole);
    } catch (err) {
      setPeople(prev); // revert on failure
      setError(err.message || "Could not update role.");
    } finally {
      setRoleUpdating(null);
    }
  }

  async function handleDelete(personId) {
    setDeleting(personId);
    setError("");
    try {
      await sb.adminDeleteUser(personId);
      setPeople((ps) => ps.filter((p) => p.id !== personId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message || "Could not remove user.");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <div className="loading-text">Loading employees…</div>;

  return (
    <div>
      <div className="topbar">
        <h1>Employees</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add person"}
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {showForm && (
        <form className="card form-card" onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-field">
              <label>Full name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="form-field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
                required
              />
            </div>
            <div className="form-field">
              <label>Temporary password</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="form-field">
              <label>Role</label>
              <select
                className="select-input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {formError && <div className="error-text" style={{ marginTop: 4 }}>{formError}</div>}
          <div style={{ marginTop: 14 }}>
            <button className="btn" disabled={creating}>
              {creating ? "Creating…" : "Create person"}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const isSelf = p.id === user?.id;
              return (
                <tr key={p.id}>
                  <td>{p.full_name || "—"}</td>
                  <td>{p.email}</td>
                  <td>
                    <select
                      className="select-input"
                      value={p.role}
                      disabled={roleUpdating === p.id}
                      onChange={(e) => handleRoleChange(p.id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(p.created_at)}</td>
                  <td style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Link to={`/activity?employee=${p.id}`} className="link-action">
                      View activity →
                    </Link>
                    {!isSelf &&
                      (confirmDeleteId === p.id ? (
                        <span style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn danger small"
                            disabled={deleting === p.id}
                            onClick={() => handleDelete(p.id)}
                          >
                            {deleting === p.id ? "Removing…" : "Confirm"}
                          </button>
                          <button className="btn secondary small" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button className="link-action danger" onClick={() => setConfirmDeleteId(p.id)}>
                          Remove
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {people.length === 0 && <div className="empty-state">No employees yet — add your first person above.</div>}
      </div>
    </div>
  );
}
