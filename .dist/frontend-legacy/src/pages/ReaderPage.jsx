import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api } from "../api";

const PAGE_TARGET = 2600;
const HEADING_PATTERN = /^(chapter|book|part|act|scene|letter)\s+([ivxlcdm]+|\d+|[a-z]+)\b/i;

function paginate(content) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const pages = [];
  let current = [];
  let size = 0;

  for (const paragraph of paragraphs) {
    if (current.length && size + paragraph.length > PAGE_TARGET) {
      pages.push(current);
      current = [];
      size = 0;
    }
    current.push(paragraph);
    size += paragraph.length;
  }
  if (current.length) pages.push(current);
  return pages;
}

function isHeading(paragraph) {
  if (paragraph.length > 90) return false;
  const firstLine = paragraph.split("\n")[0].trim();
  return HEADING_PATTERN.test(firstLine) || /^[IVXLCDM]+\.?$/.test(firstLine);
}

function isVerse(paragraph) {
  const lines = paragraph.split("\n").filter((line) => line.trim());
  if (lines.length < 3) return false;
  const average = lines.reduce((total, line) => total + line.length, 0) / lines.length;
  return average < 42;
}

export default function ReaderPage() {
  const { slug } = useParams();
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(() => {
    const stored = Number(localStorage.getItem("morrow_font_size"));
    return stored >= 17 && stored <= 26 ? stored : 20;
  });
  const saveTimer = useRef(null);

  useEffect(() => {
    let active = true;
    setBook(null);
    setError("");

    api(`/books/${slug}/`)
      .then((data) => {
        if (!active) return;
        const parsed = paginate(data.content);
        setBook(data);
        setPages(parsed);
        const saved = data.progress?.page || 1;
        setPageIndex(Math.min(Math.max(saved - 1, 0), Math.max(parsed.length - 1, 0)));
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    localStorage.setItem("morrow_font_size", String(fontSize));
  }, [fontSize]);

  const percent = pages.length ? ((pageIndex + 1) / pages.length) * 100 : 0;

  useEffect(() => {
    if (!book || !pages.length) return undefined;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api(`/books/${book.slug}/progress/`, {
        method: "POST",
        body: { page: pageIndex + 1, percent },
      }).catch(() => {});
    }, 600);
    return () => window.clearTimeout(saveTimer.current);
  }, [book, pageIndex, pages.length, percent]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pageIndex]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setPageIndex((index) => Math.min(index + 1, pages.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setPageIndex((index) => Math.max(index - 1, 0));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pages.length]);

  const currentPage = useMemo(() => pages[pageIndex] || [], [pages, pageIndex]);
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === pages.length - 1;

  if (error) {
    return (
      <main className="page-message">
        <h1>This book could not be opened.</h1>
        <p>{error}</p>
        <Link className="button button--solid" to="/">
          Back to the library
        </Link>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="page-loading page-loading--tall">
        <span className="loader" aria-hidden="true" />
        <p>Opening the book…</p>
      </main>
    );
  }

  return (
    <div className="reader" style={{ "--reader-size": `${fontSize}px` }}>
      <div className="reader-bar">
        <div className="reader-bar__inner">
          <Link className="reader-bar__back" to="/">
            Library
          </Link>
          <div className="reader-bar__title">
            <span>{book.title}</span>
            <small>{book.author}</small>
          </div>
          <div className="reader-bar__tools">
            <button
              type="button"
              className="text-size"
              onClick={() => setFontSize((size) => Math.max(17, size - 1))}
              aria-label="Decrease text size"
            >
              A−
            </button>
            <button
              type="button"
              className="text-size"
              onClick={() => setFontSize((size) => Math.min(26, size + 1))}
              aria-label="Increase text size"
            >
              A+
            </button>
            <span className="reader-bar__percent">{Math.round(percent)}%</span>
          </div>
        </div>
        <div className="reader-bar__progress">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <main className="reader__main">
        <article className="reader-page" key={pageIndex}>
          <div className="reader-page__running">
            <span>{book.title}</span>
            <span>{pageIndex + 1}</span>
          </div>

          <div className="reader-page__body">
            {currentPage.map((paragraph, index) => {
              const heading = isHeading(paragraph);
              const verse = !heading && isVerse(paragraph);
              const opening = pageIndex === 0 && index === 0;
              const classes = [
                "reader__para",
                heading ? "reader__para--heading" : "",
                verse ? "reader__para--verse" : "",
                opening && !heading ? "reader__para--opening" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <p className={classes} key={index}>
                  {paragraph}
                </p>
              );
            })}

            {isLast && (
              <div className="reader-end">
                <span className="reader-end__rule" />
                <p>The end.</p>
                <Link to="/">Return to the library</Link>
              </div>
            )}
          </div>

          <div className="reader-page__folio">{pageIndex + 1}</div>
        </article>

        <nav className="reader-nav" aria-label="Page navigation">
          <button
            type="button"
            className="reader-nav__button"
            onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
            disabled={isFirst}
          >
            Previous page
          </button>
          <span className="reader-nav__count">
            Page {pageIndex + 1} of {pages.length}
          </span>
          <button
            type="button"
            className="reader-nav__button"
            onClick={() => setPageIndex((index) => Math.min(pages.length - 1, index + 1))}
            disabled={isLast}
          >
            Next page
          </button>
        </nav>
        <p className="reader-nav__hint">Use the left and right arrow keys to turn pages.</p>
      </main>
    </div>
  );
}
