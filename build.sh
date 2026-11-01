#!/usr/bin/env bash
# Render build: compile the React app, then prepare Django to serve it.
set -o errexit

cd frontend
npm ci
npm run build
cd ../backend

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate --no-input

# Both commands skip books that already exist, so re-running on each deploy is cheap.
python manage.py sync_catalog
python manage.py seed_books
