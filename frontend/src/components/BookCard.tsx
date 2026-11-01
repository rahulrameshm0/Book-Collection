import { Link } from "react-router-dom";

import { readingTime } from "../api";
import type { BookSummary } from "../types";
import BookCover from "./BookCover";

export default function BookCard({ book }: { book: BookSummary }) {
  return (
    <Link className="book" to={`/books/${book.id}`}>
      <BookCover src={book.cover_url} title={book.title} />
      <h3 className="book__title">{book.title}</h3>
      <p className="book__author">{book.authors.join(", ") || "Unknown author"}</p>
      {book.word_count ? <p className="book__meta">{readingTime(book.word_count)}</p> : null}
    </Link>
  );
}
