import { useState, useEffect } from "react";
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
  const { user, canViewAllActivity, loginFromTokens } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [handoffPending, setHandoffPending] = useState(
    () => window.location.hash.includes("qf_at=")
  );

  // The Chrome extension's popup links here with the user's session in the
  // URL fragment (#qf_at=...&qf_rt=...) after they log in there, so this
  // tab opens already signed in instead of showing the login form again.
  // A fragment (not a query string) is used on purpose: fragments are
  // never sent to any server, so the tokens never touch our own backend
  // or get logged anywhere — only this client-side code ever reads them.
  useEffect(() => {
    if (!handoffPending) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const at = params.get("qf_at");
    const rt = params.get("qf_rt");
    // Always strip the hash, even on failure, so a bad/expired token
    // isn't left sitting in the URL (history, refresh, sharing the link).
    window.history.replaceState(null, "", window.location.pathname);
    if (!at || !rt) {
      setHandoffPending(false);
      return;
    }
    loginFromTokens(at, rt)
      .catch(() => {
        // Invalid/expired handoff — fall back to the normal login screen.
      })
      .finally(() => setHandoffPending(false));
  }, [handoffPending, loginFromTokens]);

  if (handoffPending) {
    return <div className="loading-text">Signing you in…</div>;
  }

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
