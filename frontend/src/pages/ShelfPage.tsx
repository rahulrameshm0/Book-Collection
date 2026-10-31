import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import BookCover from "../components/BookCover";
import Footer from "../components/Footer";
import Nav from "../components/Nav";
import type { Progress, ShelfItem } from "../types";

export default function ShelfPage() {
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api<ShelfItem[]>("/me/shelf/"), api<Progress[]>("/me/progress/")])
      .then(([shelf, entries]) => {
        if (!active) return;
        setItems(shelf);
        setProgress(entries);
      })
      .catch(() => {
        if (active) setError("Your shelf could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function remove(bookId: number) {
    const previous = items;
    setItems((current) => current?.filter((item) => item.book.id !== bookId) ?? null);
    try {
      await api(`/me/shelf/${bookId}/`, { method: "DELETE" });
    } catch {
      setItems(previous);
      setError("That book could not be removed. Try again.");
    }
  }

  const progressFor = (bookId: number) =>
    progress.find((entry) => entry.book_id === bookId && entry.percent > 0);

  return (
    <div className="shell">
      <Nav />
      <main className="page">
        <div className="library__head" style={{ marginTop: 44 }}>
          <div>
            <h1 className="library__title">My shelf</h1>
            <p className="library__count">
              {items ? `${items.length} saved ${items.length === 1 ? "book" : "books"}` : "Loading…"}
            </p>
          </div>
          <Link className="section__link" to="/library">
            Find more books
          </Link>
        </div>

        {error ? <p className="notice">{error}</p> : null}

        {items && items.length === 0 ? (
          <div className="empty">
            <h2>Nothing saved yet.</h2>
            <p>
              Add a book from the library and it will wait here. Your reading progress is
              tracked separately, so you can come back to any book without saving it first.
            </p>
            <Link className="btn btn--solid" to="/library">
              Browse the library
            </Link>
          </div>
        ) : null}

        {items && items.length ? (
          <div className="grid" style={{ paddingTop: 34 }}>
            {items.map((item) => {
              const entry = progressFor(item.book.id);
              return (
                <div className="book" key={item.id}>
                  <Link to={`/books/${item.book.id}`}>
                    <BookCover src={item.book.cover_url} title={item.book.title} />
                  </Link>
                  <h3 className="book__title">
                    <Link to={`/books/${item.book.id}`}>{item.book.title}</Link>
                  </h3>
                  <p className="book__author">
                    {item.book.authors.join(", ") || "Unknown author"}
                  </p>
                  <p className="book__meta">
                    {entry ? `${entry.percent}% read` : "Not started"}
                  </p>
                  <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    <Link
                      className="btn btn--quiet"
                      style={{ fontSize: 12 }}
                      to={
                        entry
                          ? `/books/${item.book.id}/read/${entry.chapter_index}`
                          : `/books/${item.book.id}/read/0`
                      }
                    >
                      {entry ? "Continue" : "Read"}
                    </Link>
                    <button
                      className="btn btn--quiet"
                      style={{ fontSize: 12 }}
                      type="button"
                      onClick={() => remove(item.book.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
