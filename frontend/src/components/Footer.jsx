import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <span className="wordmark wordmark--footer">
            Morrow<span className="wordmark__dot">.</span>
          </span>
          <p className="site-footer__line">
            A quiet reading room for the English classics.
          </p>
        </div>
        <p className="site-footer__note">
          Complete texts from{" "}
          <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">
            Project Gutenberg
          </a>
          . Public domain, set for reading.
        </p>
        <span className="site-footer__built">Django · React</span>
      </div>
    </footer>
  );
}
