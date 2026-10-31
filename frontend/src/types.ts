export type Author = {
  id: number;
  name: string;
  sort_name: string;
  birth_year: number | null;
  death_year: number | null;
};

export type BookSummary = {
  id: number;
  title: string;
  authors: string[];
  cover_url: string;
  word_count: number;
  chapter_count: number;
  subject_list: string[];
};

export type ChapterRef = {
  id: number;
  index: number;
  title: string;
};

export type Progress = {
  book_id: number;
  book_title: string;
  cover_url: string;
  chapter_index: number;
  chapter_title: string;
  scroll_ratio: number;
  percent: number;
  updated_at: string;
};

export type BookDetail = {
  id: number;
  gutenberg_id: number | null;
  title: string;
  authors: Author[];
  cover_url: string;
  description: string;
  subjects: string[];
  shelves: string[];
  issued_date: string | null;
  source: "gutenberg" | "upload";
  word_count: number;
  chapter_count: number;
  chapters: ChapterRef[];
  on_shelf: boolean;
  progress: Progress | null;
};

export type ChapterContent = {
  id: number;
  index: number;
  title: string;
  text: string;
  previous: { index: number; title: string } | null;
  next: { index: number; title: string } | null;
};

export type ShelfItem = {
  id: number;
  book: BookSummary;
  added_at: string;
};

export type Page<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Facet = {
  name: string;
  count: number;
};

export type User = {
  id: number;
  username: string;
  email: string;
  is_staff?: boolean;
};

export type BookQuery = {
  search?: string;
  subject?: string;
  shelf?: string;
  author?: string;
  ordering?: string;
  page?: number;
};
