"""
Load a curated starter shelf of fantasy classics from Project Gutenberg.

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
        "gutenberg_id": 11,
        "title": "Alice's Adventures in Wonderland",
        "author": "Lewis Carroll",
        "description": (
            "Alice follows a white rabbit down a hole into a country where the rules "
            "change every time she grows or shrinks."
        ),
    },
    {
        "gutenberg_id": 12,
        "title": "Through the Looking-Glass",
        "author": "Lewis Carroll",
        "description": (
            "Alice climbs through the mirror over the mantelpiece and joins a living game "
            "of chess, hoping to be crowned a queen."
        ),
    },
    {
        "gutenberg_id": 55,
        "title": "The Wonderful Wizard of Oz",
        "author": "L. Frank Baum",
        "description": (
            "A cyclone carries Dorothy to Oz, and the way home runs along a yellow brick "
            "road to a wizard who may not be what he seems."
        ),
    },
    {
        "gutenberg_id": 16,
        "title": "Peter Pan",
        "author": "J. M. Barrie",
        "description": (
            "Wendy and her brothers fly out of the nursery window to Neverland, where "
            "boys never grow up and Captain Hook is waiting."
        ),
    },
    {
        "gutenberg_id": 289,
        "title": "The Wind in the Willows",
        "author": "Kenneth Grahame",
        "description": (
            "Mole abandons his spring cleaning for the riverbank, Ratty's boat, and the "
            "ruinous enthusiasms of Mr Toad."
        ),
    },
    {
        "gutenberg_id": 708,
        "title": "The Princess and the Goblin",
        "author": "George MacDonald",
        "description": (
            "Princess Irene finds her great-great-grandmother spinning in a forgotten "
            "tower, while goblins dig beneath the castle."
        ),
    },
    {
        "gutenberg_id": 325,
        "title": "Phantastes",
        "author": "George MacDonald",
        "description": (
            "The morning after his twenty-first birthday, Anodos wakes to find his "
            "bedroom turning into a forest, and walks into Fairy Land."
        ),
    },
    {
        "gutenberg_id": 1640,
        "title": "Lilith",
        "author": "George MacDonald",
        "description": (
            "Mr Vane follows his family's long-dead librarian through a mirror into a "
            "land where the dead lie sleeping and Lilith still rules."
        ),
    },
    {
        "gutenberg_id": 836,
        "title": "The Phoenix and the Carpet",
        "author": "E. Nesbit",
        "description": (
            "Four children find an egg rolled up in their new nursery carpet. It hatches "
            "a vain phoenix, and the carpet turns out to fly."
        ),
    },
    {
        "gutenberg_id": 3536,
        "title": "The Enchanted Castle",
        "author": "E. Nesbit",
        "description": (
            "Three children on holiday find a sleeping princess in a hidden garden, and a "
            "ring whose wishes never go quite to plan."
        ),
    },
    {
        "gutenberg_id": 61077,
        "title": "The King of Elfland's Daughter",
        "author": "Lord Dunsany",
        "description": (
            "The people of Erl want a magic lord, so their prince crosses into Elfland "
            "and brings back the king's daughter as his bride."
        ),
    },
    {
        "gutenberg_id": 67090,
        "title": "The Worm Ouroboros",
        "author": "E. R. Eddison",
        "description": (
            "The lords of Demonland go to war with the sorcerer-king of Witchland, in a "
            "saga told in grand, archaic prose."
        ),
    },
    {
        "gutenberg_id": 3055,
        "title": "The Wood Beyond the World",
        "author": "William Morris",
        "description": (
            "Golden Walter leaves home to follow a strange trio across the sea, into a "
            "wood ruled by a sorceress."
        ),
    },
    {
        "gutenberg_id": 8395,
        "title": "The Gods of Pegana",
        "author": "Lord Dunsany",
        "description": (
            "Dunsany's first book: the scripture of an invented pantheon, gods who made "
            "the worlds and wait for their maker to wake."
        ),
    },
    {
        "gutenberg_id": 42183,
        "title": "Queen of the Black Coast",
        "author": "Robert E. Howard",
        "description": (
            "Conan takes ship to escape the law and falls in with Bêlit, a pirate queen, "
            "on a jungle river haunted by something older than men."
        ),
    },
    {
        "gutenberg_id": 68061,
        "title": "Lud-in-the-Mist",
        "author": "Hope Mirrlees",
        "description": (
            "In a town that has outlawed fairy fruit, the mayor's own son eats some, and "
            "the mayor must follow him across the border into Fairyland."
        ),
    },
]


class Command(BaseCommand):
    help = "Seed a curated starter shelf of public-domain fantasy."

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
