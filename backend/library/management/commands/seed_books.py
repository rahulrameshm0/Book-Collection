"""
Load a curated English-language starter shelf from Project Gutenberg.

These books come with a short description and download their text right away,
so the app has something to read on a fresh install.

Usage:
    python manage.py seed_books               # add anything missing
    python manage.py seed_books --refresh     # re-download text for all of them
"""

from django.core.management.base import BaseCommand

from library.models import Author, Book
from library.services import gutenberg

BOOKS = [
    {
        "gutenberg_id": 1342,
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "description": (
            "Elizabeth Bennet has no patience for Mr Darcy's pride, and he has none "
            "for her family. Then the letters start arriving."
        ),
    },
    {
        "gutenberg_id": 84,
        "title": "Frankenstein",
        "author": "Mary Shelley",
        "description": (
            "A young scientist builds a living creature, then abandons it. What follows "
            "is the creature's own account of being made and left alone."
        ),
    },
    {
        "gutenberg_id": 2701,
        "title": "Moby-Dick",
        "author": "Herman Melville",
        "description": (
            "Ishmael signs on to the Pequod and meets Captain Ahab, whose only cargo is "
            "revenge against a white whale."
        ),
    },
    {
        "gutenberg_id": 11,
        "title": "Alice's Adventures in Wonderland",
        "author": "Lewis Carroll",
        "description": (
            "Down a rabbit hole into a world of riddles, tea parties, and a queen with "
            "a terrible temper."
        ),
    },
    {
        "gutenberg_id": 64317,
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "description": (
            "Nick Carraway moves next door to a man who throws enormous parties for a "
            "woman across the bay."
        ),
    },
    {
        "gutenberg_id": 345,
        "title": "Dracula",
        "author": "Bram Stoker",
        "description": (
            "A solicitor's trip to Transylvania becomes a race to stop the count from "
            "reaching England."
        ),
    },
    {
        "gutenberg_id": 174,
        "title": "The Picture of Dorian Gray",
        "author": "Oscar Wilde",
        "description": (
            "A portrait ages while its subject stays young, and every pleasure leaves "
            "its mark somewhere out of sight."
        ),
    },
    {
        "gutenberg_id": 1260,
        "title": "Jane Eyre",
        "author": "Charlotte Brontë",
        "description": (
            "An orphan becomes a governess at Thornfield Hall, where the third floor "
            "keeps a secret."
        ),
    },
    {
        "gutenberg_id": 1661,
        "title": "The Adventures of Sherlock Holmes",
        "author": "Arthur Conan Doyle",
        "description": (
            "Twelve cases from Baker Street: a scandal in Bohemia, a red-headed league, "
            "a speckled band, and more."
        ),
    },
    {
        "gutenberg_id": 35,
        "title": "The Time Machine",
        "author": "H. G. Wells",
        "description": (
            "A Victorian inventor travels to the year 802,701 and finds humanity divided "
            "into two."
        ),
    },
    {
        "gutenberg_id": 205,
        "title": "Walden",
        "author": "Henry David Thoreau",
        "description": (
            "Thoreau spends two years in a cabin by a pond, measuring what a life "
            "actually needs."
        ),
    },
    {
        "gutenberg_id": 514,
        "title": "Little Women",
        "author": "Louisa May Alcott",
        "description": (
            "Four sisters grow up in wartime Massachusetts, writing, acting, and "
            "learning what they want."
        ),
    },
    {
        "gutenberg_id": 98,
        "title": "A Tale of Two Cities",
        "author": "Charles Dickens",
        "description": (
            "London and Paris before the revolution: a doctor released from the "
            "Bastille, a daughter, and a man who looks like another."
        ),
    },
    {
        "gutenberg_id": 768,
        "title": "Wuthering Heights",
        "author": "Emily Brontë",
        "description": (
            "Heathcliff and Catherine on the moors, and the damage that outlives them "
            "both."
        ),
    },
    {
        "gutenberg_id": 36,
        "title": "The War of the Worlds",
        "author": "H. G. Wells",
        "description": "Cylinders fall on Horsell Common, and the Martians come out.",
    },
    {
        "gutenberg_id": 1952,
        "title": "The Yellow Wallpaper",
        "author": "Charlotte Perkins Gilman",
        "description": (
            "A new mother is confined to an upstairs room with yellow paper. The paper "
            "begins to move."
        ),
    },
    {
        "gutenberg_id": 219,
        "title": "Heart of Darkness",
        "author": "Joseph Conrad",
        "description": (
            "Marlow travels up the Congo to find Kurtz, a man the jungle has already "
            "changed."
        ),
    },
    {
        "gutenberg_id": 17396,
        "title": "The Secret Garden",
        "author": "Frances Hodgson Burnett",
        "description": (
            "Mary Lennox is sent to a Yorkshire manor and finds a walled garden nobody "
            "has opened in ten years."
        ),
    },
]


class Command(BaseCommand):
    help = "Seed a curated starter shelf of English public-domain books."

    def add_arguments(self, parser):
        parser.add_argument(
            "--refresh",
            action="store_true",
            help="Re-download text for books that are already present.",
        )
        parser.add_argument(
            "--metadata-only",
            action="store_true",
            help="Create the rows without downloading their text now.",
        )

    def handle(self, *args, **options):
        refresh = options["refresh"]

        for entry in BOOKS:
            book, created = Book.objects.get_or_create(
                gutenberg_id=entry["gutenberg_id"],
                defaults={
                    "title": entry["title"],
                    "description": entry["description"],
                    "language": "en",
                },
            )
            if not created:
                book.title = entry["title"]
                book.description = entry["description"]
                book.save(update_fields=["title", "description"])

            author, _ = Author.objects.get_or_create(name=entry["author"])
            book.authors.clear()
            book.authors.add(author)

            if options["metadata_only"]:
                continue

            already_ready = book.chapter_count and not refresh
            if already_ready:
                continue

            try:
                gutenberg.fetch_and_store(book, force=refresh)
                self.stdout.write(f"  ready  {book.title} ({book.chapter_count} chapters)")
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(f"  failed {book.title}: {exc}")

        self.stdout.write(
            self.style.SUCCESS(f"Starter shelf loaded. Catalog holds {Book.objects.count()} books.")
        )
