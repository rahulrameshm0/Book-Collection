# Shelf

A reading app for public-domain fantasy. Shelf carries every English-language
fantasy and fairy-tale book in the [Project Gutenberg](https://www.gutenberg.org/)
catalog (about 1,100 books, from Oz and Wonderland to Elfland and Witchland)
and nothing else. It splits each book into chapters, files it into fantasy
categories, and lets you read in the browser, keep a personal shelf, and pick
up where you left off.

Built with **Django + Django REST Framework** on the backend and **React +
TypeScript (Vite)** on the frontend.

## Features

**Browsing**

- 14 fantasy categories, plus search by title or author
- Sort by title, newest on Gutenberg, shortest or longest
- Estimated reading time on every book (at 250 words a minute)
- A starter shelf of 16 fantasy classics on the home page

**Reading**

- Chapter-by-chapter reader with Gutenberg's licence text stripped and
  paragraphs unwrapped
- Four page styles: Auto (follows the site theme), Paper, Sepia and Night
- Adjustable text size and line length, remembered per browser
- Arrow keys move between chapters
- Any book's text is downloaded from Gutenberg the first time someone opens it

**Accounts**

- Sign up and sign in with JWT authentication
- Personal shelf, and reading progress saved per book down to the scroll position
- Upload your own `.txt`, `.md` or `.epub` files
- Download any book as plain text

**Design**

- Light and dark mode. The site follows your system setting until you pick one
  with the sun/moon button, then remembers your choice.
- Works on phones, keeps keyboard focus visible, and respects reduced motion

## What counts as fantasy

A book is in the library when Gutenberg gives it a subject starting with
"Fantasy" or "Fairy tales", or puts it on its "Fantasy" bookshelf. Fanzines
and essays about the genre are left out, and so is Gutenberg's broad
"Science-Fiction & Fantasy" shelf, which is mostly science fiction.

Each book is then filed into every category whose keywords appear in its
subjects, so one book can sit in several:

| Category | Category |
| --- | --- |
| Fairy tales & folklore | Dark & supernatural |
| Myths, gods & Arthurian legend | Children's fantasy |
| Magic & witchcraft | Comic & satirical |
| Dragons, fairies & creatures | Science fantasy |
| Other worlds & strange voyages | Dreams & allegories |
| Heroes & adventure | Poems & plays |
| Short story collections | More fantasy fiction (anything the others miss) |

Both rules live in [`backend/library/services/genre.py`](backend/library/services/genre.py).
To add or rename a category, edit the `CATEGORIES` list there; the API, library
sidebar and home page pick it up automatically.

## Project structure

```
backend/
  config/                  settings, URLs, WSGI
  library/
    models.py              Book, Author, Chapter, ShelfItem, ReadingProgress
    views.py               API views
    services/gutenberg.py  downloading, cleaning and caching book text
    services/chapters.py   splitting a book into chapters
    services/genre.py      what counts as fantasy, and its categories
    management/commands/   sync_catalog, seed_books
  data/pg_catalog.csv      the fantasy rows of the Gutenberg catalog
  media/                   cached book text and covers (not in git)
frontend/
  src/pages/               Home, Library, Book, Reader, Shelf, Login, Register
  src/components/          Nav, BookCard, BookCover, ThemeToggle, Icon, Footer
  src/theme.ts             light/dark mode
  src/styles.css           all styles, with colour tokens for both themes
build.sh                   production build script (used by Render)
render.yaml                Render Blueprint
```

In production Django serves the built frontend from `frontend/dist`, so the
whole app runs as one service.

## Running locally

Requirements: Python 3.12+, Node 20+.

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py sync_catalog      # import the fantasy catalog
python manage.py seed_books        # download the 16-book starter shelf
python manage.py createsuperuser   # optional, for /admin
python manage.py runserver
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to Django on port 8000.

Locally the app uses SQLite. Set `DATABASE_URL` to use another database instead.

### Management commands

| Command | What it does |
| --- | --- |
| `sync_catalog` | Imports every fantasy book in `data/pg_catalog.csv` and **deletes any Gutenberg book that is not in it**, with its shelf entries and reading progress. Uploaded books are kept. Safe to run repeatedly. |
| `sync_catalog --refresh-csv` | Downloads a fresh catalog from Gutenberg first, keeping only the fantasy rows. |
| `seed_books` | Downloads the text of the 16 starter books so the home page has something to show. |
| `seed_books --refresh` | Downloads the starter books' text again. |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | insecure dev key | Required in production |
| `DJANGO_DEBUG` | `1` | Set to `0` in production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Comma-separated hostnames. On Render the service's own hostname is added automatically. |
| `DATABASE_URL` | SQLite file | e.g. `postgres://user:pass@host/db` |
| `DJANGO_MEDIA_ROOT` | `backend/media` | Where book text and covers are cached |

## API

All endpoints are under `/api/`.

| Endpoint | Description |
| --- | --- |
| `GET books/` | List books (paginated). Filters: `category`, `search`, `ordering` (`title`, `recent`, `short`, `long`), `page`, `page_size` |
| `GET books/{id}/` | Book details with categories and chapters. Downloads the text on first visit. |
| `GET books/{id}/chapters/` | Chapter list |
| `GET books/{id}/chapters/{index}/` | Chapter text |
| `GET books/{id}/cover/` | Cover image, or a generated cover if Gutenberg has none |
| `GET books/{id}/download/` | Full text as `.txt` |
| `POST books/upload/` | Upload a book (signed in) |
| `GET facets/` | Fantasy categories with book counts |
| `GET featured/` | The starter shelf |
| `GET stats/` | Book and chapter counts |
| `POST auth/register/` | Create an account |
| `POST auth/token/`, `auth/token/refresh/` | Sign in, refresh the JWT |
| `GET auth/me/` | Current user |
| `me/shelf/`, `me/shelf/{book_id}/` | Personal shelf (signed in) |
| `me/progress/`, `me/progress/{book_id}/` | Reading progress (signed in) |

## Deploying to Render

The repo includes a [Render Blueprint](https://render.com/docs/blueprint-spec)
that creates a free web service and a free PostgreSQL database.

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and connect the repo. If it isn't
   listed, use **Configure account** to give Render access to it.
3. Click **Deploy Blueprint**.

On every deploy, `build.sh` builds the frontend, installs dependencies, runs
migrations, runs `sync_catalog` and runs `seed_books`. The secret key and
database URL are set automatically.

To create an admin account on a paid instance, open the service's **Shell** tab
in Render and run `cd backend && python manage.py createsuperuser`. Free
instances have no shell.

Notes on the free plan:

- An account can have only one free Postgres database, and Render deletes it
  after 30 days unless it is upgraded.
- The service sleeps when idle, so the first request afterwards takes 30–60
  seconds.
- The disk is wiped on every restart. Gutenberg books download again when
  opened, but uploaded books are lost.

### Troubleshooting

- **`npm ci` fails with "package.json and package-lock.json are not in sync"**:
  run `npm install` in `frontend/` and commit the updated `package-lock.json`.
  Render uses Node 22, whose npm is stricter than newer local versions.

## Credits

Book texts, metadata and covers come from [Project Gutenberg](https://www.gutenberg.org/).
Every book here is in the public domain in the United States.
