import { NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext";

const icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  employees: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15 13.7c2.6 0.2 4.5 2.2 4.5 5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 12H7L9.5 6L14 18L16.5 12H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  screenshots: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 5L9.5 3H14.5L16 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  me: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 19.5c0-3.6 3.1-6.2 7.5-6.2s7.5 2.6 7.5 6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

const ROLE_LABELS = {
  admin: "Admin",
  assistant_admin: "Assistant Admin",
  employee: "Employee",
};

export default function Sidebar({ onNavigate }) {
  const { user, logout, canManageUsers, canViewAllActivity } = useAuth();

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
          <path d="M12 7.5V12L15 14" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Quickyflow
      </div>

      <nav onClick={onNavigate}>
        {canViewAllActivity ? (
          <NavLink to="/" end className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
            {icons.dashboard} Dashboard
          </NavLink>
        ) : (
          <NavLink to="/" end className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
            {icons.me} My Time
          </NavLink>
        )}

        {canManageUsers && (
          <NavLink to="/employees" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
            {icons.employees} Employees
          </NavLink>
        )}

        <NavLink to="/activity" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
          {icons.activity} {canViewAllActivity ? "Activity Logs" : "My Activity"}
        </NavLink>

        <NavLink to="/screenshots" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
          {icons.screenshots} {canViewAllActivity ? "Screenshots" : "My Screenshots"}
        </NavLink>
      </nav>

      <div style={{ flex: 1 }} />

      <div className="sidebar-user">
        <div className="sidebar-user-email" title={user?.email}>{user?.email}</div>
        <span className={`role-pill role-${user?.role}`}>{ROLE_LABELS[user?.role] || user?.role}</span>
      </div>
      <button className="btn secondary" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
