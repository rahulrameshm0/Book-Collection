import csv
import io
import re

import requests
from django.conf import settings
from django.core.management.base import BaseCommand

from library.models import Author, Book
from library.services import gutenberg
from library.services.genre import is_fantasy

CATALOG_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv"
CSV_PATH = settings.BASE_DIR / "data" / "pg_catalog.csv"


def parse_authors(raw):
    """'Austen, Jane, 1775-1817; Smith, John' -> [(name, birth, death)]"""
    authors = []
    for chunk in raw.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        birth = death = None
        match = re.match(r"^(.*?),\s*(\d{3,4})-(\d{0,4})$", chunk)
        name = chunk
        if match:
            name = match.group(1).strip()
            birth = int(match.group(2))
            death = int(match.group(3)) if match.group(3) else None
        name = re.sub(r"\s+", " ", name)
        authors.append((name, birth, death))
    return authors


def clean_title(title):
    return re.sub(r"\s+", " ", title).strip()


class Command(BaseCommand):
    help = "Seed the catalog with English-language Project Gutenberg books."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Only import the first N English fantasy books (default: all ~670).",
        )
        parser.add_argument(
            "--refresh-csv",
            action="store_true",
            help="Download the catalog file again instead of using the cached copy.",
        )

    def handle(self, *args, **options):
        rows = self.load_catalog(refresh=options["refresh_csv"])
        english = [
            row
            for row in rows
            if row["Type"] == "Text"
            and row["Language"].strip().lower() == "en"
            and is_fantasy(row.get("Subjects", ""), row.get("Bookshelves", ""))
        ]

        # Prune against the whole fantasy list, so --limit never deletes books.
        removed = self.prune({int(row["Text#"]) for row in english if row["Text#"].isdigit()})
        if options["limit"]:
            english = english[: options["limit"]]

        if removed:
            self.stdout.write(f"Removed {removed:,} books that are not fantasy.")

        self.stdout.write(f"Importing {len(english):,} English fantasy books…")

        existing_ids = set(
            Book.objects.exclude(gutenberg_id=None).values_list("gutenberg_id", flat=True)
        )
        self.refresh_metadata(english, existing_ids)

        seen = set()
        pending = []
        skipped = 0

        for row in english:
            try:
                gid = int(row["Text#"])
            except (KeyError, ValueError):
                skipped += 1
                continue

            title = clean_title(row.get("Title", ""))
            if not title or gid in existing_ids:
                skipped += 1
                continue

            dedupe_key = (title.lower(), row.get("Authors", "").lower())
            if dedupe_key in seen:
                skipped += 1
                continue
            seen.add(dedupe_key)

            pending.append(
                {
                    "gutenberg_id": gid,
                    "title": title[:512],
                    "language": "en",
                    "subjects": row.get("Subjects", "")[:4000],
                    "bookshelves": row.get("Bookshelves", "")[:4000],
                    "issued_date": row.get("Issued") or None,
                    "authors": parse_authors(row.get("Authors", "")),
                }
            )

        self.stdout.write(f"Downloaded the catalogue. Adding {len(pending):,} new books…")

        # Authors first, in one go, so a 62,000-book import is not 62,000 round trips.
        author_meta: dict[str, list[int | None]] = {}
        for book in pending:
            for name, birth, death in book["authors"]:
                key = name[:255]
                meta = author_meta.setdefault(key, [None, None])
                if meta[0] is None and birth is not None:
                    meta[0] = birth
                if meta[1] is None and death is not None:
                    meta[1] = death

        Author.objects.bulk_create(
            [
                Author(name=name, birth_year=meta[0], death_year=meta[1])
                for name, meta in author_meta.items()
            ],
            batch_size=2000,
            ignore_conflicts=True,
        )
        author_ids = dict(Author.objects.values_list("name", "id"))
        through = Book.authors.through

        created = 0
        for start in range(0, len(pending), 1000):
            batch = pending[start : start + 1000]
            books = [
                Book(
                    gutenberg_id=book["gutenberg_id"],
                    title=book["title"],
                    language="en",
                    subjects=book["subjects"],
                    bookshelves=book["bookshelves"],
                    issued_date=book["issued_date"],
                )
                for book in batch
            ]
            Book.objects.bulk_create(books, batch_size=1000)

            id_by_gid = dict(
                Book.objects.filter(
                    gutenberg_id__in=[book.gutenberg_id for book in books]
                ).values_list("gutenberg_id", "id")
            )

            links = []
            for book in batch:
                book_id = id_by_gid.get(book["gutenberg_id"])
                if not book_id:
                    continue
                for name, birth, death in book["authors"]:
                    author_id = author_ids.get(name[:255])
                    if author_id:
                        links.append(through(book_id=book_id, author_id=author_id))

            through.objects.bulk_create(links, batch_size=2000, ignore_conflicts=True)
            created += len(books)
            if created % 10000 == 0 or created == len(pending):
                self.stdout.write(f"  {created:,} added…")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Added {created:,} books, skipped {skipped:,}. "
                f"Catalog now holds {Book.objects.count():,} books."
            )
        )

    def prune(self, fantasy_ids):
        """Delete every Gutenberg book outside the fantasy catalogue, with its
        cached files. Books people uploaded themselves are kept."""
        doomed = list(
            Book.objects.filter(source=Book.Source.GUTENBERG)
            .exclude(gutenberg_id__in=fantasy_ids)
            .values_list("id", flat=True)
        )

        for start in range(0, len(doomed), 1000):
            batch = Book.objects.filter(pk__in=doomed[start : start + 1000])
            for book in batch:
                gutenberg.text_path(book).unlink(missing_ok=True)
                gutenberg.cover_path(book).unlink(missing_ok=True)
            batch.delete()

        if doomed:
            Author.objects.filter(books=None).delete()
        return len(doomed)

    def refresh_metadata(self, rows, existing_ids):
        """Copy subjects and shelves onto books that are already here, so books
        created by seed_books before the catalogue get their categories."""
        by_gid = {int(row["Text#"]): row for row in rows if row["Text#"].isdigit()}
        books = list(Book.objects.filter(gutenberg_id__in=existing_ids & by_gid.keys()))
        for book in books:
            row = by_gid[book.gutenberg_id]
            book.subjects = row.get("Subjects", "")[:4000]
            book.bookshelves = row.get("Bookshelves", "")[:4000]
        Book.objects.bulk_update(books, ["subjects", "bookshelves"], batch_size=500)

    def load_catalog(self, refresh=False):
        CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
        if refresh or not CSV_PATH.exists():
            self.stdout.write("Downloading the Project Gutenberg catalog (≈21 MB) and keeping the fantasy…")
            response = requests.get(CATALOG_URL, timeout=180)
            response.raise_for_status()
            rows = csv.DictReader(io.StringIO(response.content.decode("utf-8-sig")))
            self.write_fantasy_only(rows)
        text = CSV_PATH.read_text(encoding="utf-8-sig")
        return list(csv.DictReader(io.StringIO(text)))

    def write_fantasy_only(self, rows):
        """Keep only the English fantasy rows, so the repo carries no other books."""
        with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=rows.fieldnames)
            writer.writeheader()
            for row in rows:
                if (
                    row["Type"] == "Text"
                    and row["Language"].strip().lower() == "en"
                    and is_fantasy(row.get("Subjects", ""), row.get("Bookshelves", ""))
                ):
                    writer.writerow(row)
