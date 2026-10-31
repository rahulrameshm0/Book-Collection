"""Fetching and caching book text from Project Gutenberg."""

import io
import logging
import re
from pathlib import Path

import requests
from django.conf import settings
from django.db import transaction

from library.models import Book, Chapter
from library.services.chapters import (
    chapterize,
    strip_boilerplate,
    strip_heading,
    unwrap_paragraphs,
    word_count,
)

logger = logging.getLogger(__name__)

TEXT_URL = "https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt"
COVER_URL = "https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.cover.medium.jpg"
HEADERS = {"User-Agent": "Shelf/1.0 (personal reading app; contact: local)"}
TIMEOUT = 60

BOOKS_DIR = "books"
COVERS_DIR = "covers"


def text_path(book: Book) -> Path:
    return Path(settings.MEDIA_ROOT) / BOOKS_DIR / f"{book.pk}.txt"


def cover_path(book: Book) -> Path:
    return Path(settings.MEDIA_ROOT) / COVERS_DIR / f"{book.pk}.jpg"


def download_text(gutenberg_id: int) -> str:
    url = TEXT_URL.format(gid=gutenberg_id)
    response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    return response.content.decode("utf-8", errors="replace")


def _store(book: Book, text: str, chapters) -> Book:
    """Write the text and chapter offsets (UTF-8 byte offsets, so file seeks
    land exactly where they should even when the book is full of curly quotes)."""
    path = text_path(book)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

    spans = []
    previous_char = 0
    previous_byte = 0
    for title, start, end, _body in chapters:
        start_byte = previous_byte + len(text[previous_char:start].encode("utf-8"))
        end_byte = start_byte + len(text[start:end].encode("utf-8"))
        spans.append((title, start_byte, end_byte))
        previous_char, previous_byte = end, end_byte

    with transaction.atomic():
        book.chapters.all().delete()
        Chapter.objects.bulk_create(
            [
                Chapter(
                    book=book,
                    index=index,
                    title=title[:512],
                    start_offset=start,
                    end_offset=end,
                )
                for index, (title, start, end) in enumerate(spans)
            ]
        )
        book.text_file = f"{BOOKS_DIR}/{path.name}"
        book.chapter_count = len(spans)
        book.word_count = word_count(text)
        book.save(update_fields=["text_file", "chapter_count", "word_count", "updated_at"])
    return book


def fetch_and_store(book: Book, force: bool = False) -> Book:
    """Download, clean, chapterize and cache a book. Safe to call repeatedly."""
    path = text_path(book)
    if path.exists() and book.chapter_count and not force:
        return book

    raw = download_text(book.gutenberg_id)
    text = unwrap_paragraphs(strip_boilerplate(raw))
    if not text:
        raise ValueError(f"Book #{book.gutenberg_id} has no readable text")

    chapters = chapterize(text, book.title)
    if not chapters:
        raise ValueError(f"Could not split book #{book.gutenberg_id} into chapters")

    return _store(book, text, chapters)


def read_chapter(book: Book, chapter: Chapter) -> str:
    path = text_path(book)
    if not path.exists():
        return ""
    with path.open("rb") as handle:
        handle.seek(max(0, chapter.start_offset))
        raw = handle.read(max(0, chapter.end_offset - chapter.start_offset))
    return strip_heading(raw.decode("utf-8", errors="replace").strip(), chapter.title)


def download_cover(book: Book) -> bool:
    if not book.gutenberg_id:
        return False
    url = COVER_URL.format(gid=book.gutenberg_id)
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        response.raise_for_status()
    except requests.RequestException:
        return False
    if not response.headers.get("Content-Type", "").startswith("image/"):
        return False
    path = cover_path(book)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    Book.objects.filter(pk=book.pk).update(cover_cached=True)
    return True


def parse_upload(book: Book, upload) -> Book:
    """Store a .txt or .epub upload and chapterize it."""
    name = (upload.name or "").lower()
    if name.endswith(".epub"):
        text = _epub_to_text(upload)
    elif name.endswith((".txt", ".md")):
        upload.seek(0)
        text = upload.read().decode("utf-8", errors="replace")
    else:
        raise ValueError("Only .txt, .md and .epub files are supported")

    text = unwrap_paragraphs(strip_boilerplate(text))
    if not text.strip():
        raise ValueError("The uploaded file contains no readable text")

    chapters = chapterize(text, book.title)
    return _store(book, text, chapters)


def _epub_to_text(upload) -> str:
    import ebooklib
    from ebooklib import epub

    upload.seek(0)
    data = upload.read()
    epub_book = epub.read_epub(io.BytesIO(data), options={"ignore_ncx": True})
    parts = []
    for item in epub_book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        try:
            html = item.get_content().decode("utf-8", errors="replace")
        except Exception:  # pragma: no cover - defensive
            continue
        parts.append(_html_to_text(html))
    return "\n\n".join(part for part in parts if part.strip())


def _html_to_text(html: str) -> str:
    from html.parser import HTMLParser

    class Extractor(HTMLParser):
        block_tags = {
            "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6",
            "li", "tr", "blockquote", "section", "article",
        }

        def __init__(self):
            super().__init__()
            self.chunks = []
            self.skip = False

        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style"):
                self.skip = True
            if tag in self.block_tags:
                self.chunks.append("\n")

        def handle_endtag(self, tag):
            if tag in ("script", "style"):
                self.skip = False
            if tag in self.block_tags:
                self.chunks.append("\n")

        def handle_data(self, data):
            if not self.skip:
                self.chunks.append(data)

    parser = Extractor()
    parser.feed(html)
    text = "".join(parser.chunks)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()
