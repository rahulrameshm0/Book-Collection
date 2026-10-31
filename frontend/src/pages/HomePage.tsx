import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, formatCount, queryString } from "../api";
import { useAuth } from "../auth";
import BookCard from "../components/BookCard";
import BookCover from "../components/BookCover";
import Footer from "../components/Footer";
import Nav from "../components/Nav";
import type { BookSummary, Facet, Page, Progress } from "../types";

type Stats = { books: number; chapters: number };

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [featured, setFeatured] = useState<BookSummary[]>([]);
  const [shortBooks, setShortBooks] = useState<BookSummary[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api<Stats>("/stats/", { auth: false }),
      api<BookSummary[]>("/featured/", { auth: false }),
      api<Page<BookSummary>>(`/books/${queryString({ ordering: "short", page_size: 8 })}`, {
        auth: false,
      }),
      api<Facet[]>("/facets/", { auth: false }),
    ])
      .then(([statsData, featuredData, shortData, facetData]) => {
        if (!active) return;
        setStats(statsData);
        setFeatured(featuredData);
        setShortBooks(shortData.results);
        setFacets(facetData.slice(0, 8));
      })
      .catch(() => {
        if (active) setError("The library could not be reached. Is the API running?");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProgress(null);
      return;
    }
    let active = true;
    api<Progress[]>("/me/progress/")
      .then((entries) => {
        if (!active) return;
        setProgress(entries.find((entry) => entry.percent < 99) ?? null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="shell">
      <Nav />
      <main className="page">
        <section className="hero">
          <div>
            <h1 className="hero__statement">
              {stats ? `${stats.books.toLocaleString("en")} English books.` : "Every English classic."}{" "}
              <em>No checkout desk.</em>
            </h1>
            <p className="hero__note">
              Public-domain literature, set for the screen and split chapter by chapter.
              Open a book and start reading — no waiting list, no paywall, no app to install.
            </p>
          </div>
          <aside className="hero__aside">
            <dl className="hero__stats">
              <div>
                <dt>Books catalogued</dt>
                <dd>{stats ? stats.books.toLocaleString("en") : "—"}</dd>
              </div>
              <div>
                <dt>Chapters indexed</dt>
                <dd>{stats ? formatCount(stats.chapters) : "—"}</dd>
              </div>
              <div>
                <dt>Cost to read</dt>
                <dd>Free</dd>
              </div>
            </dl>
          </aside>
        </section>

        {error ? <p className="notice" style={{ marginTop: 32 }}>{error}</p> : null}

        {progress ? (
          <section className="continue" aria-label="Continue reading">
            <div className="continue__cover">
              <BookCover src={progress.cover_url} title={progress.book_title} />
            </div>
            <div>
              <p className="continue__label">Back on the shelf</p>
              <h2 className="continue__title">{progress.book_title}</h2>
              <p className="continue__meta">
                {progress.chapter_title || "Chapter one"} · {progress.percent}% read
              </p>
              <div className="continue__bar">
                <span style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
            <Link
              className="btn btn--solid"
              to={`/books/${progress.book_id}/read/${progress.chapter_index}`}
            >
              Keep reading
            </Link>
          </section>
        ) : null}

        {featured.length ? (
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Start here</h2>
              <Link className="section__link" to="/library">
                Browse everything
              </Link>
            </div>
            <div className="shelf">
              {featured.slice(0, 16).map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        ) : null}

        {shortBooks.length ? (
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Short enough for one evening</h2>
              <Link className="section__link" to="/library?ordering=short">
                More short reads
              </Link>
            </div>
            <div className="shelf">
              {shortBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        ) : null}

        {facets.length ? (
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Browse by shelf</h2>
              <p className="section__note">Shelves are how Gutenberg groups its catalogue.</p>
            </div>
            <div className="filter-list" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", display: "grid", gap: "0 40px" }}>
              {facets.map((facet) => (
                <Link
                  key={facet.name}
                  to={`/library${queryString({ shelf: facet.name })}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: "1px solid var(--line-soft)",
                    fontSize: 13.5,
                    color: "var(--ink-2)",
                  }}
                >
                  <span>{facet.name}</span>
                  <small style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                    {facet.count}
                  </small>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
