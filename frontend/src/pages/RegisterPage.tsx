import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import Footer from "../components/Footer";
import Nav from "../components/Nav";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/library";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(username.trim(), email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <Nav />
      <main className="auth" id="main">
        <div className="auth__intro">
          <h1>Start a shelf.</h1>
          <p>
            An account takes a moment and holds two things worth keeping: the books you
            saved and the page you stopped on.
          </p>
        </div>

        <form className="auth__card" onSubmit={onSubmit}>
          <h2>Create account</h2>
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
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
            <p className="field__hint">At least 8 characters, not entirely numeric.</p>
          </div>

          <button className="btn btn--solid btn--block" type="submit" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>

          <p className="auth__alt">
            Already have one? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </main>
      <Footer />
    </div>
  );
}
