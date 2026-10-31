import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, queryString } from "../api";
import BookCard from "../components/BookCard";
import Footer from "../components/Footer";
import Nav from "../components/Nav";
import type { BookSummary, Facet, Page } from "../types";

const PAGE_SIZE = 24;

const ORDERINGS = [
  { value: "title", label: "Title, A–Z" },
  { value: "recent", label: "First published" },
  { value: "short", label: "Shortest first" },
  { value: "long", label: "Longest first" },
];

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const shelf = params.get("shelf") ?? "all";
  const ordering = params.get("ordering") ?? "title";
  const page = Number(params.get("page") ?? "1") || 1;

  const [input, setInput] = useState(search);
  const [result, setResult] = useState<Page<BookSummary> | null>(null);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setInput(search);
  }, [search]);

  useEffect(() => {
    let active = true;
    api<Facet[]>("/facets/", { auth: false })
      .then((data) => {
        if (active) setFacets(data.slice(0, 10));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api<Page<BookSummary>>(
      `/books/${queryString({
        search,
        shelf,
        ordering,
        page,
        page_size: PAGE_SIZE,
      })}`,
      { auth: false, signal: controller.signal },
    )
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err: Error) => {
        if (active && err.name !== "AbortError") {
          setError("The library could not be loaded. Check that the API is running.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [search, shelf, ordering, page]);

  useEffect(() => {
    if (input === search) return;
    const timer = window.setTimeout(() => {
      update({ search: input, page: "1" });
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === "all" || (key === "page" && value === "1")) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const totalPages = useMemo(
    () => (result ? Math.max(1, Math.ceil(result.count / PAGE_SIZE)) : 1),
    [result],
  );

  const activeShelfLabel = shelf === "all" ? "The whole library" : shelf;

  return (
    <div className="shell">
      <Nav />
      <main className="page">
        <div className="library">
          <aside className="filters" aria-label="Filters">
            <div className="filters__group">
              <h2>Shelves</h2>
              <div className="filter-list">
                <button
                  type="button"
                  aria-pressed={shelf === "all"}
                  onClick={() => update({ shelf: undefined, page: "1" })}
                >
                  All books
                </button>
                {facets.map((facet) => (
                  <button
                    key={facet.name}
                    type="button"
                    aria-pressed={shelf === facet.name}
                    onClick={() => update({ shelf: facet.name, page: "1" })}
                  >
                    <span>{facet.name}</span>
                    <small>{facet.count}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="filters__group">
              <h2>Reading time</h2>
              <div className="filter-list">
                <button
                  type="button"
                  aria-pressed={ordering === "short"}
                  onClick={() => update({ ordering: "short", page: "1" })}
                >
                  Shortest first
                </button>
                <button
                  type="button"
                  aria-pressed={ordering === "long"}
                  onClick={() => update({ ordering: "long", page: "1" })}
                >
                  Longest first
                </button>
              </div>
            </div>
          </aside>

          <div>
            <div className="library__head">
              <div>
                <h1 className="library__title">{activeShelfLabel}</h1>
                <p className="library__count">
                  {result ? `${result.count.toLocaleString("en")} books` : "Counting…"}
                </p>
              </div>
              <div className="library__tools">
                <div className="search">
                  <label className="visually-hidden" htmlFor="library-search">
                    Search titles and authors
                  </label>
                  <input
                    id="library-search"
                    type="search"
                    placeholder="Title or author"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                  />
                </div>
                <label className="visually-hidden" htmlFor="ordering">
                  Order books
                </label>
                <select
                  id="ordering"
                  className="select"
                  value={ordering}
                  onChange={(event) => update({ ordering: event.target.value, page: "1" })}
                >
                  {ORDERINGS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? <p className="notice">{error}</p> : null}

            {loading && !result ? (
              <div className="grid" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div className="book book-skeleton" key={index}>
                    <div className="book__cover skeleton" />
                    <div className="book__title skeleton" />
                    <div className="book__author skeleton" />
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && result && result.results.length === 0 ? (
              <div className="empty">
                <h2>No books match that.</h2>
                <p>
                  Try a shorter search, or clear the shelf filter to look across the whole
                  catalogue.
                </p>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => {
                    setInput("");
                    setParams(new URLSearchParams(), { replace: true });
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}

            {result && result.results.length ? (
              <div className="grid" style={{ opacity: loading ? 0.55 : 1 }}>
                {result.results.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            ) : null}

            {result && result.count > PAGE_SIZE ? (
              <div className="pager">
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn--ghost btn--sm"
                  type="button"
                  disabled={!result.next}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Next
                </button>
              </div>
            ) : null}

            {result && result.count === 0 && !loading ? (
              <p style={{ marginTop: 24, fontSize: 13, color: "var(--muted)" }}>
                Nothing here yet. Have you run <code>python manage.py sync_catalog</code>?{" "}
                <Link to="/">Back home</Link>
              </p>
            ) : null}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
