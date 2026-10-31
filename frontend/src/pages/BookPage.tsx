import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError, api, formatCount } from "../api";
import { useAuth } from "../auth";
import BookCover from "../components/BookCover";
import Footer from "../components/Footer";
import Nav from "../components/Nav";
import type { BookDetail } from "../types";

function publicationYear(value: string | null) {
  if (!value) return null;
  return value.slice(0, 4);
}

export default function BookPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setBook(null);
    setError("");
    api<BookDetail>(`/books/${id}/`, { auth: Boolean(user) })
      .then((data) => {
        if (active) setBook(data);
      })
      .catch((err: ApiError) => {
        if (active) {
          setError(err.status === 404 ? "That book is not in the catalogue." : err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [id, user]);

  async function toggleShelf() {
    if (!book) return;
    if (!user) {
      navigate("/login", { state: { from: `/books/${book.id}` } });
      return;
    }
    setSaving(true);
    try {
      if (book.on_shelf) {
        await api(`/me/shelf/${book.id}/`, { method: "DELETE" });
        setBook({ ...book, on_shelf: false });
      } else {
        await api("/me/shelf/", { method: "POST", body: { book_id: book.id } });
        setBook({ ...book, on_shelf: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your shelf.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !book) {
    return (
      <div className="shell">
        <Nav />
        <main className="page">
          <div className="empty">
            <h2>This book isn’t here.</h2>
            <p>{error}</p>
            <Link className="btn btn--solid" to="/library">
              Back to the library
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="shell">
        <Nav />
        <main className="page loading">Fetching the book…</main>
        <Footer />
      </div>
    );
  }

  const startChapter = book.progress?.chapter_index ?? 0;
  const year = publicationYear(book.issued_date);
  const hasProgress = Boolean(book.progress && book.progress.percent > 0);

  return (
    <div className="shell">
      <Nav />
      <main className="page">
        <div className="book-hero">
          <div className="book-hero__cover">
            <BookCover src={book.cover_url} title={book.title} />
          </div>

          <div className="book-hero__body">
            <h1 className="book-hero__title">{book.title}</h1>
            <p className="book-hero__authors">
              {book.authors.map((author) => author.sort_name).join(", ") || "Unknown author"}
            </p>

            {book.description ? (
              <p className="book-hero__description">{book.description}</p>
            ) : (
              <p className="book-hero__description">
                {book.subjects.length
                  ? `A ${book.subjects.slice(0, 3).join(", ").toLowerCase()} title from the public-domain shelf.`
                  : "This edition has no description yet, but the full text is ready to read."}
              </p>
            )}

            <div className="book-hero__actions">
              <Link
                className="btn btn--solid"
                to={`/books/${book.id}/read/${startChapter}`}
              >
                {hasProgress ? "Continue reading" : "Start reading"}
              </Link>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={toggleShelf}
                disabled={saving}
                aria-pressed={book.on_shelf}
              >
                {book.on_shelf ? "Remove from shelf" : "Add to shelf"}
              </button>
              {book.source === "gutenberg" ? (
                <a
                  className="btn btn--quiet"
                  href={`https://www.gutenberg.org/ebooks/${book.gutenberg_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source edition
                </a>
              ) : null}
            </div>

            <dl className="meta-list">
              <div>
                <dt>Length</dt>
                <dd>{book.word_count ? `${formatCount(book.word_count)} words` : "Not measured"}</dd>
              </div>
              <div>
                <dt>Chapters</dt>
                <dd>{book.chapter_count || "—"}</dd>
              </div>
              <div>
                <dt>First published</dt>
                <dd>{year ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>English</dd>
              </div>
              {book.progress ? (
                <div>
                  <dt>Your progress</dt>
                  <dd>{book.progress.percent}%</dd>
                </div>
              ) : null}
            </dl>

            {book.subjects.length ? (
              <p style={{ marginTop: 24, fontSize: 13, color: "var(--muted)", maxWidth: "60ch" }}>
                {book.subjects.slice(0, 8).join(" · ")}
              </p>
            ) : null}
          </div>
        </div>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">Contents</h2>
            <p className="section__note">
              {book.chapter_count} chapters
              {hasProgress ? ` · you stopped in ${book.progress?.chapter_title || "chapter one"}` : ""}
            </p>
          </div>

          <div className={book.chapters.length > 40 ? "toc toc__scroll" : "toc"}>
            {book.chapters.map((chapter) => (
              <Link
                className="toc__item"
                key={chapter.id}
                to={`/books/${book.id}/read/${chapter.index}`}
                aria-current={book.progress?.chapter_index === chapter.index}
              >
                <span>{chapter.index + 1}</span>
                <span>{chapter.title || `Chapter ${chapter.index + 1}`}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
