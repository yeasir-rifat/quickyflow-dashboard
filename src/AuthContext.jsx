import { createContext, useContext, useState, useCallback } from "react";
import { sb } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    sb.isLoggedIn() ? { email: sb.userEmail, id: sb.userId, role: sb.role } : null
  );

  const login = useCallback(async (email, password) => {
    const u = await sb.signIn(email, password);
    setUser({ email: u.email, id: u.id, role: sb.role });
    return u;
  }, []);

  // Used when the browser extension hands off an already-authenticated
  // session via the URL (see App.jsx) — skips the password form entirely.
  const loginFromTokens = useCallback(async (accessToken, refreshToken) => {
    const u = await sb.setSessionFromTokens(accessToken, refreshToken);
    setUser({ email: u.email, id: u.id, role: sb.role });
    return u;
  }, []);

  const logout = useCallback(async () => {
    await sb.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginFromTokens,
        logout,
        isAdmin: user?.role === "admin",
        isAssistantAdmin: user?.role === "assistant_admin",
        canViewAllActivity: user?.role === "admin" || user?.role === "assistant_admin",
        canManageUsers: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
