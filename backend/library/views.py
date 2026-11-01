import re

from django.db.models import Case, IntegerField, Q, Value, When
from django.http import FileResponse, Http404, HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from library.models import Book, Chapter, ReadingProgress, ShelfItem
from library.serializers import (
    BookDetailSerializer,
    BookListSerializer,
    ChapterContentSerializer,
    ProgressSerializer,
    RegisterSerializer,
    ShelfItemSerializer,
    UploadSerializer,
    UserSerializer,
)
from library.services import gutenberg
from library.services.genre import all_categories, category_filter

# A hand-picked shelf so a first-time visitor has somewhere to start.
FEATURED_IDS = [
    11,     # Alice's Adventures in Wonderland
    12,     # Through the Looking-Glass
    55,     # The Wonderful Wizard of Oz
    16,     # Peter Pan
    289,    # The Wind in the Willows
    708,    # The Princess and the Goblin
    325,    # Phantastes
    1640,   # Lilith
    836,    # The Phoenix and the Carpet
    3536,   # The Enchanted Castle
    61077,  # The King of Elfland's Daughter
    67090,  # The Worm Ouroboros
    3055,   # The Wood Beyond the World
    8395,   # The Gods of Pegana
    42183,  # Queen of the Black Coast
    68061,  # Lud-in-the-Mist
]


def placeholder_cover(title: str) -> HttpResponse:
    """A typographic fallback cover, so no book is a broken image."""
    initials = "".join(word[0] for word in title.split()[:3]).upper() or "?"
    safe_title = (
        title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )[:42]
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#6E2A2A"/>
  <rect x="18" y="18" width="364" height="564" fill="none" stroke="#E6C67E" stroke-opacity="0.45"/>
  <text x="200" y="270" text-anchor="middle" font-family="Georgia, serif" font-size="96" fill="#E6C67E">{initials}</text>
  <text x="200" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#E6C67E" opacity="0.8">{safe_title}</text>
</svg>"""
    response = HttpResponse(svg, content_type="image/svg+xml")
    response["Cache-Control"] = "public, max-age=86400"
    return response


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Book.objects.prefetch_related("authors")
    permission_classes = [AllowAny]
    throttle_classes = []

    def get_serializer_class(self):
        if self.action == "list":
            return BookListSerializer
        return BookDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        # Every fantasy book is listed; its text is fetched the first time it is opened.
        readable = (params.get("readable") or "0").strip().lower()
        if readable in {"1", "true", "yes", "on"}:
            queryset = queryset.filter(text_file__gt="", chapter_count__gt=0)

        search = (params.get("search") or params.get("q") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(authors__name__icontains=search)
                | Q(subjects__icontains=search)
            ).distinct()

        author = (params.get("author") or "").strip()
        if author:
            queryset = queryset.filter(authors__id=author) if author.isdigit() else queryset.filter(
                authors__name__icontains=author
            )

        subject = (params.get("subject") or "").strip()
        if subject:
            queryset = queryset.filter(subjects__icontains=subject)

        shelf = (params.get("shelf") or "").strip()
        if shelf:
            queryset = queryset.filter(bookshelves__icontains=shelf)

        category = category_filter((params.get("category") or "").strip())
        if category is not None:
            queryset = queryset.filter(category)

        ordering = params.get("ordering", "title")
        allowed = {
            "title": "title",
            "-title": "-title",
            "recent": "-issued_date",
            "long": "-word_count",
            "short": "word_count",
        }

        if search:
            # Title matches outrank author matches outrank subject matches.
            queryset = queryset.annotate(
                _relevance=Case(
                    When(title__istartswith=search, then=Value(0)),
                    When(title__icontains=search, then=Value(1)),
                    When(authors__name__icontains=search, then=Value(2)),
                    default=Value(3),
                    output_field=IntegerField(),
                )
            )
            return queryset.order_by("_relevance", allowed.get(ordering, "title"), "id")

        if ordering in {"short", "long"}:
            # Books not opened yet have no word count; keep them out of the way.
            queryset = queryset.annotate(
                _unmeasured=Case(When(word_count=0, then=Value(1)), default=Value(0))
            )
            return queryset.order_by("_unmeasured", allowed[ordering], "id")

        return queryset.order_by(allowed.get(ordering, "title"), "id")

    def retrieve(self, request, *args, **kwargs):
        book = self.get_object()
        if book.gutenberg_id and not book.chapter_count:
            # First visit: download and split the text so the contents are ready.
            try:
                gutenberg.fetch_and_store(book)
            except Exception:  # noqa: BLE001 - the page still shows the book's details
                pass
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path=r"chapters")
    def chapters(self, request, pk=None):
        book = self.get_object()
        return Response(
            [{"id": c.id, "index": c.index, "title": c.title} for c in book.chapters.all()]
        )

    @action(detail=True, methods=["get"], url_path=r"chapters/(?P<index>[0-9]+)")
    def chapter(self, request, pk=None, index=None):
        book = self.get_object()
        if book.gutenberg_id:
            # No-op when cached; restores the text if the disk was wiped (e.g. a redeploy).
            gutenberg.fetch_and_store(book)

        chapter = book.chapters.filter(index=index).first()
        if not chapter:
            raise Http404("Chapter not found.")

        return Response(ChapterContentSerializer(chapter).data)

    @action(detail=True, methods=["get"], url_path="cover")
    def cover(self, request, pk=None):
        book = self.get_object()
        path = gutenberg.cover_path(book)
        if not path.exists():
            if not gutenberg.download_cover(book):
                return placeholder_cover(book.title)
        response = FileResponse(path.open("rb"), content_type="image/jpeg")
        response["Cache-Control"] = "public, max-age=604800"
        return response

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        book = self.get_object()
        if book.gutenberg_id:
            gutenberg.fetch_and_store(book)
        path = gutenberg.text_path(book)
        if not path.exists():
            raise Http404("Text not available.")
        return FileResponse(
            path.open("rb"),
            as_attachment=True,
            filename=f"{book.title[:80]}.txt",
            content_type="text/plain; charset=utf-8",
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def featured(request):
    books = Book.objects.filter(
        gutenberg_id__in=FEATURED_IDS, text_file__gt="", chapter_count__gt=0
    ).prefetch_related("authors")
    by_id = {book.gutenberg_id: book for book in books}
    ordered = [by_id[gid] for gid in FEATURED_IDS if gid in by_id]
    return Response(BookListSerializer(ordered, many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def stats(request):
    return Response({"books": Book.objects.count(), "chapters": Chapter.objects.count()})


@api_view(["GET"])
@permission_classes([AllowAny])
def browse_facets(request):
    """The fantasy categories, with how many books each holds."""
    return Response(
        [
            {
                "slug": category["slug"],
                "name": category["name"],
                "count": Book.objects.filter(category_filter(category["slug"])).count(),
            }
            for category in all_categories()
        ]
    )


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProgressListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = (
            ReadingProgress.objects.filter(user=request.user)
            .select_related("book")
            .prefetch_related("book__authors")[:12]
        )
        return Response(ProgressSerializer(entries, many=True).data)


class ProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, book_id):
        book = Book.objects.filter(pk=book_id).first()
        if not book:
            return Response({"detail": "Book not found."}, status=404)

        chapter_index = int(request.data.get("chapter_index", 0) or 0)
        if book.chapter_count:
            chapter_index = max(0, min(chapter_index, book.chapter_count - 1))
        scroll_ratio = float(request.data.get("scroll_ratio", 0) or 0)
        scroll_ratio = min(max(scroll_ratio, 0.0), 1.0)

        progress, _ = ReadingProgress.objects.update_or_create(
            user=request.user,
            book=book,
            defaults={"chapter_index": chapter_index, "scroll_ratio": scroll_ratio},
        )
        return Response(ProgressSerializer(progress).data)


class ShelfListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = ShelfItem.objects.filter(user=request.user).select_related("book")
        items = items.prefetch_related("book__authors")
        return Response(ShelfItemSerializer(items, many=True).data)

    def post(self, request):
        book = Book.objects.filter(pk=request.data.get("book_id")).first()
        if not book:
            return Response({"detail": "Book not found."}, status=404)
        item, created = ShelfItem.objects.get_or_create(user=request.user, book=book)
        return Response(
            ShelfItemSerializer(item).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ShelfItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, book_id):
        ShelfItem.objects.filter(user=request.user, book_id=book_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UploadView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "upload"

    def post(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Staff access required."}, status=403)

        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        book = Book.objects.create(
            title=data["title"][:512],
            source=Book.Source.UPLOAD,
            language="en",
        )
        author_name = data.get("authors", "").strip()
        if author_name:
            from library.models import Author

            author, _ = Author.objects.get_or_create(name=author_name[:255])
            book.authors.add(author)

        try:
            gutenberg.parse_upload(book, data["file"])
        except Exception as exc:
            book.delete()
            return Response({"detail": str(exc)}, status=400)

        return Response(
            BookDetailSerializer(book, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
