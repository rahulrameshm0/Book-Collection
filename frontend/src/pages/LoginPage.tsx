import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import Footer from "../components/Footer";
import Nav from "../components/Nav";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/library";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <Nav />
      <main className="auth">
        <div className="auth__intro">
          <h1>Your place is kept.</h1>
          <p>
            Sign in to pick up exactly where you stopped, keep a shelf of books you mean
            to read, and sync that across your devices.
          </p>
        </div>

        <form className="auth__card" onSubmit={onSubmit}>
          <h2>Sign in</h2>
          {error ? <p className="form-error">{error}</p> : null}

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button className="btn btn--solid" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <p className="auth__alt">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </main>
      <Footer />
    </div>
  );
}
