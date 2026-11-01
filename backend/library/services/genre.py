"""Shelf is a fantasy library: this decides which Gutenberg books belong in it,
and which fantasy categories each one is filed under."""

from django.db.models import Q

# Subjects like "Fantasy fiction -- Periodicals" are fanzines and essays about
# the genre, not fantasy stories, so they stay out.
NOT_STORIES = ("periodical", "criticism", "authorship")


def is_fantasy(subjects: str, bookshelves: str) -> bool:
    """True when Gutenberg files the book under fantasy or fairy tales.

    Gutenberg's broad "Category: Science-Fiction & Fantasy" shelf is mostly
    science fiction, so only the dedicated "Fantasy" shelf counts.
    """
    for subject in subjects.split(";"):
        subject = subject.strip().lower()
        if any(word in subject for word in NOT_STORIES):
            continue
        if subject.startswith(("fantasy", "fairy tales")):
            return True
    return any(shelf.strip().lower() == "fantasy" for shelf in bookshelves.split(";"))


# A book lands in every category whose words appear in its Gutenberg subjects.
CATEGORIES = [
    {
        "slug": "fairy-tales",
        "name": "Fairy tales & folklore",
        "words": ["fairy tales", "folklore", "nursery rhymes", "legends"],
    },
    {
        "slug": "myths",
        "name": "Myths, gods & Arthurian legend",
        "words": ["mythology", "gods", "arthur", "knights and knighthood", "heroes"],
    },
    {
        "slug": "magic",
        "name": "Magic & witchcraft",
        "words": ["magic", "witches", "wizard", "sorcer", "enchant"],
    },
    {
        "slug": "creatures",
        "name": "Dragons, fairies & creatures",
        "words": [
            "dragons", "fairies", "giants", "goblins", "elves", "mermaids",
            "dwarfs", "unicorns", "animals, mythical", "monsters",
        ],
    },
    {
        "slug": "other-worlds",
        "name": "Other worlds & strange voyages",
        "words": [
            "imaginary places", "voyages, imaginary", "lost worlds", "utopias",
            "oz (imaginary", "atlantis", "lost continents",
        ],
    },
    {
        "slug": "adventure",
        "name": "Heroes & adventure",
        "words": ["adventure", "conan (fictitious", "quests", "kings and rulers"],
    },
    {
        "slug": "dark",
        "name": "Dark & supernatural",
        "words": ["horror", "ghost", "paranormal", "supernatural", "occult", "vampires", "devil"],
    },
    {
        "slug": "children",
        "name": "Children's fantasy",
        "words": ["juvenile", "children's stories", "children's poetry"],
    },
    {
        "slug": "comic",
        "name": "Comic & satirical",
        "words": ["humorous", "satire", "wit and humor"],
    },
    {
        "slug": "science-fantasy",
        "name": "Science fantasy",
        "words": ["science fiction", "time travel"],
    },
    {
        "slug": "dreams",
        "name": "Dreams & allegories",
        "words": ["dreams", "subconsciousness", "allegories", "visions"],
    },
    {
        "slug": "poems-plays",
        "name": "Poems & plays",
        "words": ["poetry", "drama", "plays"],
    },
    {
        "slug": "short-stories",
        "name": "Short story collections",
        "words": ["short stories"],
    },
]

# Whatever none of the categories above claims, so every book has a home.
REMAINDER = {"slug": "more", "name": "More fantasy fiction"}

CATEGORY_BY_SLUG = {category["slug"]: category for category in CATEGORIES}


def _matches(words: list[str]) -> Q:
    query = Q()
    for word in words:
        query |= Q(subjects__icontains=word)
    return query


def all_categories() -> list[dict]:
    """Every category as {slug, name}, the remainder last."""
    return [{"slug": c["slug"], "name": c["name"]} for c in CATEGORIES] + [REMAINDER]


def category_filter(slug: str) -> Q | None:
    """A queryset filter for one category, or None if the slug is unknown."""
    if slug == REMAINDER["slug"]:
        return ~_matches([word for category in CATEGORIES for word in category["words"]])
    category = CATEGORY_BY_SLUG.get(slug)
    return _matches(category["words"]) if category else None


def categories_for(subjects: str) -> list[dict]:
    """The categories a book belongs to, as {slug, name}."""
    lowered = subjects.lower()
    found = [
        {"slug": category["slug"], "name": category["name"]}
        for category in CATEGORIES
        if any(word in lowered for word in category["words"])
    ]
    return found or [REMAINDER]
