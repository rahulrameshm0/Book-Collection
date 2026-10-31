"""
Seed the library with English public-domain books from Project Gutenberg.

Usage:
    python manage.py seed_books            # add any missing books
    python manage.py seed_books --refresh  # re-download and update every book
"""

import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from library.models import Book

GUTENBERG_TEXT = "https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt"

BOOKS = [
    {
        "gutenberg_id": 1342,
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "year": 1813,
        "featured": True,
        "subjects": ["Romance", "Satire", "Classic"],
        "description": (
            "Elizabeth Bennet has no patience for Mr Darcy's pride, and he has none for "
            "her family. Then the letters start arriving."
        ),
    },
    {
        "gutenberg_id": 84,
        "title": "Frankenstein",
        "author": "Mary Shelley",
        "year": 1818,
        "featured": True,
        "subjects": ["Gothic", "Science Fiction", "Classic"],
        "description": (
            "A young scientist builds a living creature, then abandons it. What follows is "
            "the creature's own account of being made and left alone."
        ),
    },
    {
        "gutenberg_id": 2701,
        "title": "Moby-Dick",
        "author": "Herman Melville",
        "year": 1851,
        "subjects": ["Adventure", "Classic"],
        "description": (
            "Ishmael signs on to the Pequod and meets Captain Ahab, whose only cargo is "
            "revenge against a white whale."
        ),
    },
    {
        "gutenberg_id": 11,
        "title": "Alice's Adventures in Wonderland",
        "author": "Lewis Carroll",
        "year": 1865,
        "subjects": ["Children's", "Fantasy", "Classic"],
        "description": (
            "Down a rabbit hole into a world of riddles, tea parties, and a queen with a "
            "terrible temper."
        ),
    },
    {
        "gutenberg_id": 64317,
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "year": 1925,
        "subjects": ["Classic", "Romance"],
        "description": (
            "Nick Carraway moves next door to a man who throws enormous parties for a woman "
            "across the bay."
        ),
    },
    {
        "gutenberg_id": 345,
        "title": "Dracula",
        "author": "Bram Stoker",
        "year": 1897,
        "subjects": ["Gothic", "Horror", "Classic"],
        "description": (
            "A solicitor's trip to Transylvania becomes a race to stop the count from "
            "reaching England."
        ),
    },
    {
        "gutenberg_id": 174,
        "title": "The Picture of Dorian Gray",
        "author": "Oscar Wilde",
        "year": 1890,
        "subjects": ["Gothic", "Satire", "Classic"],
        "description": (
            "A portrait ages while its subject stays young, and every pleasure leaves its "
            "mark somewhere out of sight."
        ),
    },
    {
        "gutenberg_id": 1260,
        "title": "Jane Eyre",
        "author": "Charlotte Brontë",
        "year": 1847,
        "subjects": ["Romance", "Gothic", "Classic"],
        "description": (
            "An orphan becomes a governess at Thornfield Hall, where the third floor keeps "
            "a secret."
        ),
    },
    {
        "gutenberg_id": 1661,
        "title": "The Adventures of Sherlock Holmes",
        "author": "Arthur Conan Doyle",
        "year": 1892,
        "subjects": ["Mystery", "Short Stories", "Classic"],
        "description": (
            "Twelve cases from Baker Street: a scandal in Bohemia, a red-headed league, a "
            "speckled band, and more."
        ),
    },
    {
        "gutenberg_id": 35,
        "title": "The Time Machine",
        "author": "H. G. Wells",
        "year": 1895,
        "subjects": ["Science Fiction", "Adventure", "Classic"],
        "description": (
            "A Victorian inventor travels to the year 802,701 and finds humanity divided "
            "into two."
        ),
    },
    {
        "gutenberg_id": 205,
        "title": "Walden",
        "author": "Henry David Thoreau",
        "year": 1854,
        "subjects": ["Philosophy", "Essays", "Classic"],
        "description": (
            "Thoreau spends two years in a cabin by a pond, measuring what a life actually "
            "needs."
        ),
    },
    {
        "gutenberg_id": 514,
        "title": "Little Women",
        "author": "Louisa May Alcott",
        "year": 1868,
        "subjects": ["Children's", "Romance", "Classic"],
        "description": (
            "Four sisters grow up in wartime Massachusetts, writing, acting, and learning "
            "what they want."
        ),
    },
    {
        "gutenberg_id": 98,
        "title": "A Tale of Two Cities",
        "author": "Charles Dickens",
        "year": 1859,
        "subjects": ["Historical Fiction", "Classic"],
        "description": (
            "London and Paris before the revolution: a doctor released from the Bastille, "
            "a daughter, and a man who looks like another."
        ),
    },
    {
        "gutenberg_id": 768,
        "title": "Wuthering Heights",
        "author": "Emily Brontë",
        "year": 1847,
        "subjects": ["Romance", "Gothic", "Classic"],
        "description": (
            "Heathcliff and Catherine on the moors, and the damage that outlives them both."
        ),
    },
    {
        "gutenberg_id": 36,
        "title": "The War of the Worlds",
        "author": "H. G. Wells",
        "year": 1898,
        "subjects": ["Science Fiction", "Adventure", "Classic"],
        "description": (
            "Cylinders fall on Horsell Common, and the Martians come out."
        ),
    },
    {
        "gutenberg_id": 1952,
        "title": "The Yellow Wallpaper",
        "author": "Charlotte Perkins Gilman",
        "year": 1892,
        "subjects": ["Short Stories", "Gothic", "Classic"],
        "description": (
            "A new mother is confined to an upstairs room with yellow paper. The paper "
            "begins to move."
        ),
    },
    {
        "gutenberg_id": 219,
        "title": "Heart of Darkness",
        "author": "Joseph Conrad",
        "year": 1899,
        "subjects": ["Adventure", "Classic"],
        "description": (
            "Marlow travels up the Congo to find Kurtz, a man the jungle has already "
            "changed."
        ),
    },
    {
        "gutenberg_id": 17396,
        "title": "The Secret Garden",
        "author": "Frances Hodgson Burnett",
        "year": 1911,
        "subjects": ["Children's", "Classic"],
        "description": (
            "Mary Lennox is sent to a Yorkshire manor and finds a walled garden nobody has "
            "opened in ten years."
        ),
    },
]


def fetch_text(book):
    url = GUTENBERG_TEXT.format(id=book["gutenberg_id"])
    request = urllib.request.Request(url, headers={"User-Agent": "MorrowLibrary/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    start = re.search(
        r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if start:
        text = text[start.end():]
    end = re.search(
        r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if end:
        text = text[: end.start()]

    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class Command(BaseCommand):
    help = "Load English public-domain books from Project Gutenberg."

    def add_arguments(self, parser):
        parser.add_argument(
            "--refresh",
            action="store_true",
            help="Re-download and update books that are already in the database.",
        )

    def handle(self, *args, **options):
        refresh = options["refresh"]
        to_fetch = [
            book
            for book in BOOKS
            if refresh or not Book.objects.filter(gutenberg_id=book["gutenberg_id"]).exists()
        ]

        if not to_fetch:
            self.stdout.write(self.style.SUCCESS("Library already seeded. Nothing to do."))
            return

        self.stdout.write(f"Downloading {len(to_fetch)} book(s) from Project Gutenberg...")

        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {pool.submit(fetch_text, book): book for book in to_fetch}
            texts = {}
            for future, book in futures.items():
                try:
                    texts[book["gutenberg_id"]] = future.result()
                    self.stdout.write(f"  fetched {book['title']}")
                except Exception as exc:  # noqa: BLE001
                    raise CommandError(f"Could not download {book['title']}: {exc}") from exc

        with transaction.atomic():
            for book in BOOKS:
                gid = book["gutenberg_id"]
                if gid not in texts:
                    continue
                text = texts[gid]
                Book.objects.update_or_create(
                    gutenberg_id=gid,
                    defaults={
                        "title": book["title"],
                        "author": book["author"],
                        "year": book["year"],
                        "description": book["description"],
                        "subjects": book["subjects"],
                        "featured": book.get("featured", False),
                        "language": "en",
                        "content": text,
                        "word_count": len(text.split()),
                    },
                )

        total = Book.objects.count()
        self.stdout.write(self.style.SUCCESS(f"Library ready: {total} English books."))
