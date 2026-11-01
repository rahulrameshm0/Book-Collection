import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import { useAuth } from "../auth";
import Icon from "../components/Icon";
import { useTheme } from "../theme";
import type { BookDetail, ChapterContent } from "../types";

// "auto" follows the site theme: paper by day, night after dark.
type Theme = "auto" | "paper" | "sepia" | "night";

const THEMES: Theme[] = ["auto", "paper", "sepia", "night"];

type ReaderSettings = {
  theme: Theme;
  size: number;
  width: number;
};

const SETTINGS_KEY = "shelf_reader_settings";
const DEFAULT_SETTINGS: ReaderSettings = { theme: "auto", size: 20, width: 66 };

function loadSettings(): ReaderSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (stored && typeof stored.size === "number") {
      return {
        theme: THEMES.includes(stored.theme) ? stored.theme : "auto",
        size: Math.min(Math.max(stored.size, 15), 30),
        width: Math.min(Math.max(stored.width, 48), 90),
      };
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_SETTINGS;
}

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 4000);
}

export default function ReaderPage() {
  const { id, index } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const siteTheme = useTheme();
  const chapterIndex = Number(index ?? "0");

  const [book, setBook] = useState<BookDetail | null>(null);
  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [ratio, setRatio] = useState(0);
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  const restored = useRef(false);
  const latestRatio = useRef(0);
  const savedAt = useRef(0);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    let active = true;
    api<BookDetail>(`/books/${id}/`, { auth: Boolean(user) })
      .then((data) => {
        if (active) setBook(data);
      })
      .catch(() => {
        if (active) setError("This book could not be opened.");
      });
    return () => {
      active = false;
    };
  }, [id, user]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setChapter(null);
    restored.current = false;

    api<ChapterContent>(`/books/${id}/chapters/${chapterIndex}/`, { auth: false })
      .then((data) => {
        if (!active) return;
        setChapter(data);
        setRatio(0);
        latestRatio.current = 0;
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      })
      .catch(() => {
        if (active) setError("That chapter could not be opened.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, chapterIndex]);

  // Put the reader back where they stopped, once, on the chapter they left.
  useEffect(() => {
    if (!chapter || !book?.progress || restored.current) return;
    if (book.progress.chapter_index !== chapterIndex) return;
    if (book.progress.scroll_ratio <= 0.01) return;
    restored.current = true;
    const target = book.progress.scroll_ratio;
    window.requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * target, behavior: "instant" as ScrollBehavior });
      setRatio(target);
      latestRatio.current = target;
      if (user) {
        void api(`/me/progress/${book.id}/`, {
          method: "PUT",
          body: { chapter_index: chapterIndex, scroll_ratio: target },
        }).catch(() => {});
      }
    });
  }, [chapter, book, chapterIndex, user]);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 8 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setRatio(value);
      latestRatio.current = value;

      if (!user || !book) return;
      const now = Date.now();
      if (now - savedAt.current < 2500) return;
      savedAt.current = now;
      void api(`/me/progress/${book.id}/`, {
        method: "PUT",
        body: { chapter_index: chapterIndex, scroll_ratio: value },
      }).catch(() => {});
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [user, book, chapterIndex]);

  // Record the chapter itself as soon as it opens.
  useEffect(() => {
    if (!user || !book || !chapter) return;
    void api(`/me/progress/${book.id}/`, {
      method: "PUT",
      body: { chapter_index: chapterIndex, scroll_ratio: 0 },
    }).catch(() => {});
  }, [user, book, chapter, chapterIndex]);

  const goTo = useCallback(
    (target: number | null | undefined) => {
      if (target === null || target === undefined) return;
      navigate(`/books/${id}/read/${target}`);
    },
    [id, navigate],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") goTo(chapter?.next?.index);
      if (event.key === "ArrowLeft") goTo(chapter?.previous?.index);
      if (event.key === "Escape") {
        setPanelOpen(false);
        setTocOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter, goTo]);

  const blocks = useMemo(() => (chapter ? paragraphs(chapter.text) : []), [chapter]);
  const total = book?.chapter_count || 1;
  const overall = Math.min(100, ((chapterIndex + ratio) / total) * 100);

  const readerStyle = {
    "--reader-size": `${settings.size}px`,
    "--reader-width": `${settings.width}ch`,
  } as React.CSSProperties;

  const page =
    settings.theme === "auto" ? (siteTheme === "dark" ? "night" : "paper") : settings.theme;

  return (
    <div className="reader" data-page={page} style={readerStyle}>
      <div className="reader__progress" aria-hidden="true">
        <span style={{ width: `${overall}%` }} />
      </div>

      <div className="reader__bar">
        <Link to={`/books/${id}`} aria-label="Back to book details">
          <Icon name="back" />
          <span className="reader__bar-label">Book</span>
        </Link>
        <span className="reader__bar-title">{book?.title ?? "Opening…"}</span>
        <button type="button" onClick={() => setTocOpen(true)}>
          <Icon name="list" />
          <span className="reader__bar-label">Contents</span>
        </button>
        <button
          type="button"
          className={panelOpen ? "is-active" : ""}
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-label="Reading preferences"
        >
          Aa
        </button>
      </div>

      <main className="reader__body">
        {loading ? <p className="loading">Fetching the chapter…</p> : null}

        {!loading && error ? (
          <div className="empty">
            <h2>This chapter isn’t available.</h2>
            <p>{error}</p>
            <Link className="btn btn--ghost" to={`/books/${id}`}>
              Back to the contents
            </Link>
          </div>
        ) : null}

        {chapter ? (
          <>
            <p className="chapter__position">
              Chapter {chapterIndex + 1} of {total}
            </p>
            <h1 className="chapter__title">
              {chapter.title || `Chapter ${chapterIndex + 1}`}
            </h1>

            <article className="prose">
              {blocks.map((block, i) => (
                <p key={i} className={block.includes("\n") ? "verse" : undefined}>
                  {block}
                </p>
              ))}
            </article>

            {!user ? (
              <p className="reader__hint">
                <Link to="/login" state={{ from: `/books/${id}/read/${chapterIndex}` }}>
                  Sign in
                </Link>{" "}
                to keep your place in this book.
              </p>
            ) : null}

            <nav className="reader__nav" aria-label="Chapter navigation">
              {chapter.previous ? (
                <button type="button" onClick={() => goTo(chapter.previous?.index)}>
                  <small>Previous</small>
                  <span>{chapter.previous.title}</span>
                </button>
              ) : (
                <span />
              )}
              {chapter.next ? (
                <button type="button" className="reader__next" onClick={() => goTo(chapter.next?.index)}>
                  <small>Next</small>
                  <span>{chapter.next.title}</span>
                </button>
              ) : (
                <span />
              )}
            </nav>
          </>
        ) : null}
      </main>

      {panelOpen ? (
        <aside className="reader__panel" aria-label="Reading preferences">
          <h3>Reading</h3>

          <div className="panel-row">
            <label htmlFor="reader-size">
              <span>Text size</span>
              <span>{settings.size}px</span>
            </label>
            <input
              id="reader-size"
              type="range"
              min={15}
              max={28}
              step={1}
              value={settings.size}
              onChange={(event) =>
                setSettings({ ...settings, size: Number(event.target.value) })
              }
            />
          </div>

          <div className="panel-row">
            <label htmlFor="reader-width">
              <span>Line length</span>
              <span>{settings.width}ch</span>
            </label>
            <input
              id="reader-width"
              type="range"
              min={48}
              max={88}
              step={2}
              value={settings.width}
              onChange={(event) =>
                setSettings({ ...settings, width: Number(event.target.value) })
              }
            />
          </div>

          <div className="panel-row">
            <span className="panel-row__label">Page</span>
            <div className="swatches">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={settings.theme === theme}
                  onClick={() => setSettings({ ...settings, theme })}
                >
                  {theme[0].toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn--ghost btn--sm btn--block"
            type="button"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
          >
            Reset
          </button>
        </aside>
      ) : null}

      {tocOpen ? (
        <div className="reader__toc" role="dialog" aria-modal="true" aria-label="Contents">
          <div className="reader__toc-inner">
            <div className="reader__toc-head">
              <span>Contents</span>
              <button type="button" onClick={() => setTocOpen(false)} aria-label="Close contents">
                <Icon name="close" />
              </button>
            </div>
            <ol>
              {book?.chapters.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/books/${id}/read/${item.index}`}
                    aria-current={item.index === chapterIndex}
                    onClick={() => setTocOpen(false)}
                  >
                    <span>{item.index + 1}</span>
                    <span>{item.title || `Chapter ${item.index + 1}`}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
