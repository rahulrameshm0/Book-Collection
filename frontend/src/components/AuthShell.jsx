import { Link } from "react-router-dom";

export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth__aside">
        <Link to="/" className="wordmark wordmark--light">
          Morrow<span className="wordmark__dot">.</span>
        </Link>

        <blockquote className="auth__quote">
          <p>“There is no frigate like a book to take us lands away.”</p>
          <cite>Emily Dickinson</cite>
        </blockquote>

        <div className="auth__aside-foot">
          <span>English classics</span>
          <span>Public domain</span>
        </div>
      </aside>

      <main className="auth__main">
        <div className="auth__form">{children}</div>
      </main>
    </div>
  );
}
