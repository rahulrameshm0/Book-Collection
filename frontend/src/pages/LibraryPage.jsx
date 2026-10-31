import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth";
import BookCard from "../components/BookCard";
import BookCover from "../components/BookCover";
import Footer from "../components/Footer";
import Nav from "../components/Nav";

function formatWords(words) {
  if (!words) return "0";
  if (words >= 1_000_000) return `${(words / 1_000_000).toFixed(1)}M`;
  if (words >= 1_000) return `${Math.round(words / 1_000)}k`;
  return String(words);
}

export default function LibraryPage() {
  const { user } = useAuth();
  const [books, setBooks] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [reading, setReading] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All");

  useEffect(() => {
    let active = true;
    api("/books/", { auth: false })
      .then((data) => {
        if (!active) return;
        setBooks(data.books);
        setSubjects(data.subjects);
      })
      .catch(() => {
        if (active) setError("The library could not be opened. Check that the API is running.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setReading([]);
      return undefined;
    }
    let active = true;
    api("/reading/")
      .then((data) => {
        if (active) setReading(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const featured = useMemo(
    () => books?.find((book) => book.featured) || books?.[0],
    [books]
  );

  const visible = useMemo(() => {
    if (!books) return [];
    const term = search.trim().toLowerCase();
    return books.filter((book) => {
      const matchesSubject = subject === "All" || book.subjects.includes(subject);
      const matchesSearch =
        !term ||
        book.title.toLowerCase().includes(term) ||
        book.author.toLowerCase().includes(term);
      return matchesSubject && matchesSearch;
    });
  }, [books, search, subject]);

  const inProgress = reading.filter((entry) => entry.percent > 0 && entry.percent < 99.5);
  const latest = inProgress[0];

  if (error) {
    return (
      <>
        <Nav />
        <main className="page-message">
          <h1>The library is closed.</h1>
          <p>{error}</p>
          <button type="button" className="button button--solid" onClick={() => window.location.reload()}>
            Try again
          </button>
        </main>
      </>
    );
  }

  if (!books) {
    return (
      <>
        <Nav />
        <main className="page-loading page-loading--tall">
          <span className="loader" aria-hidden="true" />
          <p>Opening the library…</p>
        </main>
      </>
    );
  }

  const authors = new Set(books.map((book) => book.author)).size;
  const words = books.reduce((total, book) => total + book.word_count, 0);

  return (
    <>
      <Nav />

      <main>
        <section className="hero">
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="hero__kicker">English classics, public domain</p>
              <h1 className="hero__title">The English canon, open after hours.</h1>
              <p className="hero__lede">
                Complete novels and stories, from Austen and Dickens to Wells and Wilde.
                No abridgements — just a library card and a quiet hour.
              </p>

              <div className="hero__actions">
                {user ? (
                  <Link
                    className="button button--solid"
                    to={latest ? `/books/${latest.book.slug}` : `/books/${featured.slug}`}
                  >
                    {latest ? "Continue reading" : "Start reading"}
                  </Link>
                ) : (
                  <Link className="button button--solid" to="/register">
                    Get a library card
                  </Link>
                )}
                <a className="button button--quiet" href="#collection">
                  Browse the shelf
                </a>
              </div>

              <dl className="hero__stats">
                <div>
                  <dt>Volumes</dt>
                  <dd>{books.length}</dd>
                </div>
                <div>
                  <dt>Authors</dt>
                  <dd>{authors}</dd>
                </div>
                <div>
                  <dt>Words</dt>
                  <dd>{formatWords(words)}</dd>
                </div>
              </dl>
            </div>

            <div className="hero__display">
              <div className="hero__frame">
                <BookCover book={featured} className="cover--hero" />
              </div>
              <Link className="hero__caption" to={`/books/${featured.slug}`}>
                <span className="hero__caption-label">On the front desk</span>
                <span className="hero__caption-title">{featured.title}</span>
                <span className="hero__caption-meta">
                  {featured.author} · {featured.year} · {featured.reading_minutes} min
                </span>
              </Link>
            </div>
          </div>
        </section>

        {user && inProgress.length > 0 && (
          <section className="continue" id="continue">
            <div className="container">
              <div className="section-heading">
                <h2>Continue reading</h2>
                <p>Your place is kept, page by page.</p>
              </div>
              <div className="continue__row">
                {inProgress.slice(0, 4).map((entry) => (
                  <Link
                    className="continue-card"
                    to={`/books/${entry.book.slug}`}
                    key={entry.book.id}
                  >
                    <BookCover book={entry.book} className="cover--mini" />
                    <div className="continue-card__body">
                      <span className="continue-card__title">{entry.book.title}</span>
                      <span className="continue-card__author">{entry.book.author}</span>
                      <div
                        className="continue-card__track"
                        role="progressbar"
                        aria-valuenow={Math.round(entry.percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${entry.book.title} progress`}
                      >
                        <span style={{ width: `${entry.percent}%` }} />
                      </div>
                      <span className="continue-card__percent">
                        {Math.round(entry.percent)}% read
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="collection" id="collection">
          <div className="container">
            <div className="collection__head">
              <div className="section-heading">
                <h2>The collection</h2>
                <p>
                  {visible.length === books.length
                    ? `${books.length} books, unabridged and free to read.`
                    : `${visible.length} of ${books.length} books.`}
                </p>
              </div>

              <label className="search">
                <span className="visually-hidden">Search the collection</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title or author"
                />
              </label>
            </div>

            <div className="filters" role="group" aria-label="Filter by subject">
              <button
                type="button"
                className={subject === "All" ? "filter filter--active" : "filter"}
                onClick={() => setSubject("All")}
              >
                All
              </button>
              {subjects.map((name) => (
                <button
                  type="button"
                  key={name}
                  className={subject === name ? "filter filter--active" : "filter"}
                  onClick={() => setSubject(name)}
                >
                  {name}
                </button>
              ))}
            </div>

            {visible.length > 0 ? (
              <div className="shelf">
                {visible.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            ) : (
              <div className="empty-shelf">
                <p>Nothing on this shelf matches “{search || subject}”.</p>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setSearch("");
                    setSubject("All");
                  }}
                >
                  Clear the filters
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
