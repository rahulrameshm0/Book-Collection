import { Link } from "react-router-dom";

import BookCover from "./BookCover";

export default function BookCard({ book }) {
  return (
    <Link className="book-card" to={`/books/${book.slug}`} aria-label={`Read ${book.title}`}>
      <BookCover book={book} />
      <div className="book-card__meta">
        <span className="book-card__author">{book.author}</span>
        <span className="book-card__detail">
          {book.year} · {book.reading_minutes} min
        </span>
      </div>
    </Link>
  );
}
