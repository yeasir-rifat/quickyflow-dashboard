import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      const msg = err?.message || "";
      if (/invalid/i.test(msg) || /credentials/i.test(msg)) {
        setError("Incorrect email or password.");
      } else if (/abort/i.test(msg) || /timeout/i.test(err?.name || "")) {
        setError("Request timed out. Check your connection and try again.");
      } else {
        setError(msg || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
            <path d="M12 7.5V12L15 14" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Quickyflow Dashboard
        </h1>
        <div className="subtitle">Sign in to view time tracking data</div>

        <div className="field">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M3 6.5C3 5.67157 3.67157 5 4.5 5H19.5C20.3284 5 21 5.67157 21 6.5V17.5C21 18.3284 20.3284 19 19.5 19H4.5C3.67157 19 3 18.3284 3 17.5V6.5Z" stroke="#8b9bb4" strokeWidth="1.6" />
            <path d="M4 6.5L12 12.5L20 6.5" stroke="#8b9bb4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="#8b9bb4" strokeWidth="1.6" />
            <path d="M8 10.5V7.5C8 5.29086 9.79086 3.5 12 3.5C14.2091 3.5 16 5.29086 16 7.5V10.5" stroke="#8b9bb4" strokeWidth="1.6" />
            <circle cx="12" cy="15" r="1.4" fill="#8b9bb4" />
          </svg>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="error-text">{error}</div>
        <button className="btn" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
