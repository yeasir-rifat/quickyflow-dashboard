import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Employees from "./pages/Employees";
import Activity from "./pages/Activity";
import Screenshots from "./pages/Screenshots";
import MyTime from "./pages/MyTime";

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Only a full admin may manage users (create/edit role/remove).
function RequireUserManagement({ children }) {
  const { user, canManageUsers } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!canManageUsers) return <Navigate to="/" replace />;
  return children;
}

// (Team-wide vs. own-only scoping for activity/screenshots is handled
// inside those page components based on role, not by route guards —
// every authenticated role can reach /activity and /screenshots, each
// sees only what RLS + the page's own query allow.)

export default function App() {
  const { user, canViewAllActivity } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <div className={`app-shell ${mobileNavOpen ? "nav-open" : ""}`}>
              <div className="mobile-topbar">
                <button
                  className="hamburger-btn"
                  aria-label="Toggle menu"
                  onClick={() => setMobileNavOpen((v) => !v)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="mobile-brand">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
                    <path d="M12 7.5V12L15 14" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Quickyflow
                </div>
              </div>
              {mobileNavOpen && (
                <div className="nav-overlay" onClick={() => setMobileNavOpen(false)} />
              )}
              <Sidebar onNavigate={() => setMobileNavOpen(false)} />
              <div className="main-content">
                <Routes>
                  <Route
                    path="/"
                    element={canViewAllActivity ? <AdminDashboard /> : <MyTime />}
                  />
                  <Route
                    path="/employees"
                    element={
                      <RequireUserManagement>
                        <Employees />
                      </RequireUserManagement>
                    }
                  />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/screenshots" element={<Screenshots />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
