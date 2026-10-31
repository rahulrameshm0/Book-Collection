import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="site-nav">
      <div className="site-nav__inner">
        <Link to="/" className="wordmark" aria-label="Morrow home">
          Morrow<span className="wordmark__dot">.</span>
        </Link>

        <nav className="site-nav__links" aria-label="Main">
          <a href="/#collection">Library</a>
          {user && <a href="/#continue">My reading</a>}
        </nav>

        <div className="site-nav__account">
          {user ? (
            <>
              <span className="site-nav__user">Signed in as {user.username}</span>
              <button type="button" className="link-button" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="link-button">
                Sign in
              </Link>
              <Link to="/register" className="nav-cta">
                Get a library card
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
