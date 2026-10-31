const PALETTES = [
  { bg: "#1f4a42", ink: "#f4efe2", accent: "#d9b86c" },
  { bg: "#8f2d2a", ink: "#f6efe0", accent: "#e2c58c" },
  { bg: "#c89b3c", ink: "#1b241e", accent: "#3c2f1c" },
  { bg: "#26364f", ink: "#f1ebdd", accent: "#c9a35c" },
  { bg: "#4a5a3a", ink: "#f4efe2", accent: "#d8c48d" },
  { bg: "#3a2e3f", ink: "#f0e7d8", accent: "#cba96a" },
];

export default function BookCover({ book, className = "" }) {
  const palette = PALETTES[book.id % PALETTES.length];
  const longTitle = book.title.length > 28;

  return (
    <div
      className={`cover ${className}`}
      style={{
        "--cover-bg": palette.bg,
        "--cover-ink": palette.ink,
        "--cover-accent": palette.accent,
      }}
      aria-hidden="true"
    >
      <div className="cover__inner">
        <span className="cover__imprint">Morrow Classics</span>
        <div className="cover__center">
          <span className="cover__rule" />
          <span className={`cover__title ${longTitle ? "cover__title--long" : ""}`}>
            {book.title}
          </span>
          <span className="cover__rule" />
        </div>
        <span className="cover__author">{book.author}</span>
      </div>
    </div>
  );
}
