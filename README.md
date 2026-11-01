# Shelf

A reading app for public-domain fantasy. Shelf carries every English-language
fantasy and fairy-tale book in the [Project Gutenberg](https://www.gutenberg.org/)
catalog (~1,100 books, from Oz and Wonderland to Elfland and Witchland) and
nothing else. It splits each book into chapters and lets you read it in the
browser, keep a personal shelf, and pick up where you left off.

A book counts as fantasy when Gutenberg gives it a "Fantasy…" or "Fairy tales…"
subject, or puts it on its "Fantasy" bookshelf. Books are then filed into
categories such as *Fairy tales & folklore*, *Magic & witchcraft* and *Dragons,
fairies & creatures*. Both rules live in `backend/library/services/genre.py`.

Built with **Django + Django REST Framework** on the backend and **React +
TypeScript (Vite)** on the frontend.

## Features

- Browse ten fantasy categories, or search by title or author
- Any book's text is downloaded from Gutenberg the first time someone opens it
- Clean chapter-by-chapter reader (Gutenberg boilerplate stripped, paragraphs unwrapped)
- Accounts with JWT authentication
- Personal shelf and reading progress per book
- Upload your own `.txt`, `.md` or `.epub` files (signed-in users)
- Book covers fetched on demand, with a typographic fallback cover
- Download any book as plain text

## Project structure

```
backend/                Django project
  config/               settings, URLs, WSGI
  library/              models, API views, serializers
    services/           Gutenberg download + chapter splitting
    services/genre.py   what counts as fantasy, and its categories
    management/commands sync_catalog, seed_books
  data/pg_catalog.csv   the fantasy rows of the Gutenberg catalog
frontend/               React + TypeScript app (Vite)
build.sh                production build script (used by Render)
render.yaml             Render Blueprint
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
python manage.py sync_catalog      # import fantasy books, remove any that are not
python manage.py seed_books        # download a starter shelf of fantasy classics
python manage.py createsuperuser   # optional, for /admin
python manage.py runserver
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` requests to Django on port 8000.

Locally the app uses SQLite. Set `DATABASE_URL` to use another database instead.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | insecure dev key | Required in production |
| `DJANGO_DEBUG` | `1` | Set to `0` in production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Comma-separated hostnames |
| `DATABASE_URL` | SQLite file | e.g. `postgres://user:pass@host/db` |
| `DJANGO_MEDIA_ROOT` | `backend/media` | Where book text and covers are cached |

## API

All endpoints are under `/api/`.

| Endpoint | Description |
| --- | --- |
| `GET books/?category=magic` | List, search and filter books (paginated) |
| `GET books/{id}/` | Book details |
| `GET books/{id}/chapters/` | Chapter list |
| `GET books/{id}/chapters/{index}/` | Chapter text |
| `GET books/{id}/cover/` | Cover image |
| `GET books/{id}/download/` | Full text as `.txt` |
| `POST books/upload/` | Upload a book (auth) |
| `GET facets/` | Fantasy categories with book counts |
| `GET featured/`, `stats/` | Home page data |
| `POST auth/register/` | Create an account |
| `POST auth/token/`, `auth/token/refresh/` | Log in / refresh JWT |
| `GET auth/me/` | Current user |
| `me/shelf/`, `me/shelf/{book_id}/` | Personal shelf (auth) |
| `me/progress/`, `me/progress/{book_id}/` | Reading progress (auth) |

## Deploying to Render

The repo includes a [Render Blueprint](https://render.com/docs/blueprint-spec)
that creates a free web service and a free PostgreSQL database.

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and select the repo.
3. Click **Apply**.

`build.sh` builds the frontend, installs dependencies, runs migrations and
imports the catalog on each deploy. The secret key and database URL are set
automatically.

Notes on the free plan:

- Free Render Postgres databases expire after 30 days unless upgraded.
- The service sleeps when idle, so the first request afterwards is slow.
- The disk is wiped on every restart. Gutenberg books re-download automatically
  when opened, but uploaded books are lost.

## Credits

Book texts, metadata and covers come from [Project Gutenberg](https://www.gutenberg.org/).
