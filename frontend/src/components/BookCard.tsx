import { Link } from "react-router-dom";

import { formatCount } from "../api";
import type { BookSummary } from "../types";
import BookCover from "./BookCover";

export default function BookCard({ book }: { book: BookSummary }) {
  const detail = `words` in book ? `${formatCount(book.word_count)} words` : "";

  return (
    <Link className="book" to={`/books/${book.id}`}>
      <BookCover src={book.cover_url} title={book.title} />
      <h3 className="book__title">{book.title}</h3>
      <p className="book__author">{book.authors.join(", ") || "Unknown author"}</p>
      {detail ? <p className="book__meta">{detail}</p> : null}
    </Link>
  );
}
