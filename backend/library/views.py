from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Book, ReadingProgress
from .serializers import (
    BookDetailSerializer,
    BookListSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"user": UserSerializer(user).data, **tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class BookListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = BookListSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Book.objects.filter(language="en")
        search = self.request.query_params.get("search", "").strip()
        subject = self.request.query_params.get("subject", "").strip()

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(author__icontains=search)
                | Q(description__icontains=search)
            )
        if subject:
            qs = qs.filter(subjects__contains=[subject])
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        subjects = set()
        for book in Book.objects.filter(language="en"):
            subjects.update(book.subjects or [])
        response.data = {
            "books": response.data,
            "subjects": sorted(subjects),
            "count": len(response.data),
        }
        return response


class BookDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookDetailSerializer
    queryset = Book.objects.filter(language="en")
    lookup_field = "slug"


class MyReadingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        entries = (
            ReadingProgress.objects.filter(user=request.user)
            .select_related("book")
            .order_by("-updated_at")
        )
        return Response(
            [
                {
                    "book": BookListSerializer(entry.book).data,
                    "page": entry.page,
                    "percent": entry.percent,
                    "updated_at": entry.updated_at,
                }
                for entry in entries
            ]
        )


class ProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        try:
            book = Book.objects.get(slug=slug, language="en")
        except Book.DoesNotExist:
            return Response({"detail": "Book not found."}, status=status.HTTP_404_NOT_FOUND)

        page = request.data.get("page", 1)
        percent = request.data.get("percent", 0)
        try:
            page = max(1, int(page))
            percent = min(100.0, max(0.0, float(percent)))
        except (TypeError, ValueError):
            return Response(
                {"detail": "page and percent must be numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry, _ = ReadingProgress.objects.update_or_create(
            user=request.user,
            book=book,
            defaults={"page": page, "percent": percent},
        )
        return Response(
            {"page": entry.page, "percent": entry.percent, "updated_at": entry.updated_at}
        )
