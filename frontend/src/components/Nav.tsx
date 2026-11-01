import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../auth";
import ThemeToggle from "./ThemeToggle";

export default function Nav() {
  const { user, logout } = useAuth();

  return (
    <header className="nav">
      <div className="nav__inner">
        <Link className="wordmark" to="/">
          <img src="/logo.svg" alt="" width="26" height="26" />
          Shelf
        </Link>

        <nav className="nav__links" aria-label="Main">
          <NavLink to="/library">Library</NavLink>
          {user ? <NavLink to="/shelf">My shelf</NavLink> : null}
        </nav>

        <div className="nav__actions">
          <ThemeToggle />
          {user ? (
            <>
              <span className="nav__user">{user.username}</span>
              <button className="btn btn--quiet" type="button" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn--quiet" to="/login">
                Sign in
              </Link>
              <Link className="btn btn--solid btn--sm nav__join" to="/register">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
