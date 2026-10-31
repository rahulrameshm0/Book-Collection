import { Link, NavLink } from "react-router-dom";

import { useAuth } from "../auth";

export default function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="nav__inner">
        <Link className="wordmark" to="/">
          Shelf
        </Link>

        <div className="nav__links">
          <NavLink to="/library">Library</NavLink>
          {user ? <NavLink to="/shelf">My shelf</NavLink> : null}
        </div>

        <div className="nav__actions">
          {user ? (
            <>
              <span className="nav__user">
                Signed in as <strong>{user.username}</strong>
              </span>
              <button className="btn btn--quiet" type="button" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn--quiet" to="/login">
                Sign in
              </Link>
              <Link className="btn btn--solid btn--sm" to="/register">
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
