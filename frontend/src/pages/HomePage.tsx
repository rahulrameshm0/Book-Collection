import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, queryString } from "../api";
import { useAuth } from "../auth";
import BookCard from "../components/BookCard";
import BookCover from "../components/BookCover";
import Footer from "../components/Footer";
import Icon from "../components/Icon";
import Nav from "../components/Nav";
import type { BookSummary, Facet, Page, Progress } from "../types";

type Stats = { books: number; chapters: number };

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [featured, setFeatured] = useState<BookSummary[]>([]);
  const [shortBooks, setShortBooks] = useState<BookSummary[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [query, setQuery] = useState("");
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
        setFacets(facetData.filter((facet) => facet.count > 0));
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

  function onSearch(event: FormEvent) {
    event.preventDefault();
    navigate(`/library${queryString({ search: query.trim() })}`);
  }

  const standing = featured.slice(0, 5);

  return (
    <div className="shell">
      <Nav />
      <main className="page" id="main">
        <section className="hero">
          <div className="hero__copy">
            <h1 className="hero__title">Other worlds, open on every shelf.</h1>
            <p className="hero__note">
              {stats ? `${stats.books.toLocaleString("en")} fantasy books` : "Fantasy books"} from
              the public domain, from Oz and Wonderland to Elfland and Witchland. Set for the
              screen, split into chapters, and free to read.
            </p>

            <form className="hero__search" role="search" onSubmit={onSearch}>
              <label className="visually-hidden" htmlFor="home-search">
                Search titles and authors
              </label>
              <Icon name="search" size={20} />
              <input
                id="home-search"
                type="search"
                placeholder="Search fantasy by title or author"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button className="btn btn--solid" type="submit">
                Search
              </button>
            </form>

            {stats ? (
              <p className="hero__stats">
                {stats.chapters.toLocaleString("en")} chapters ready to read, all free.
              </p>
            ) : null}
          </div>

          {standing.length ? (
            <div className="ledge" aria-label="Featured books">
              <div className="ledge__books">
                {standing.map((book) => (
                  <Link key={book.id} className="ledge__book" to={`/books/${book.id}`}>
                    <BookCover src={book.cover_url} title={book.title} />
                    <span className="visually-hidden">{book.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {error ? <p className="notice">{error}</p> : null}

        {progress ? (
          <section className="continue" aria-label="Continue reading">
            <Link className="continue__cover" to={`/books/${progress.book_id}`}>
              <BookCover src={progress.cover_url} title={progress.book_title} />
            </Link>
            <div className="continue__body">
              <p className="continue__label">You were reading</p>
              <h2 className="continue__title">{progress.book_title}</h2>
              <p className="continue__meta">
                {progress.chapter_title || "Chapter one"}, {progress.percent}% through
              </p>
              <div className="meter" aria-hidden="true">
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

        {facets.length ? (
          <section className="section">
            <div className="section__head">
              <h2 className="section__title">Browse by category</h2>
              <Link className="section__link" to="/library">
                See every book
              </Link>
            </div>
            <ul className="chips">
              {facets.map((facet) => (
                <li key={facet.slug}>
                  <Link className="chip" to={`/library${queryString({ category: facet.slug })}`}>
                    {facet.name}
                    <small>{facet.count.toLocaleString("en")}</small>
                  </Link>
                </li>
              ))}
            </ul>
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
            <div className="grid">
              {featured.slice(0, 12).map((book) => (
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
            <div className="grid">
              {shortBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        ) : null}

      </main>
      <Footer />
    </div>
  );
}
