from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.urls import include, path

from library import views

router = SimpleRouter()
router.register("books", views.BookViewSet, basename="book")


class AppTokenSerializer(TokenObtainPairSerializer):
    """Include the user alongside the tokens so the app boots in one round trip."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "is_staff": self.user.is_staff,
        }
        return data


class AppTokenView(TokenObtainPairView):
    serializer_class = AppTokenSerializer


urlpatterns = [
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/token/", AppTokenView.as_view(), name="token"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("featured/", views.featured, name="featured"),
    path("stats/", views.stats, name="stats"),
    path("facets/", views.browse_facets, name="facets"),
    path("me/progress/", views.ProgressListView.as_view(), name="progress-list"),
    path("me/progress/<int:book_id>/", views.ProgressView.as_view(), name="progress"),
    path("me/shelf/", views.ShelfListView.as_view(), name="shelf-list"),
    path("me/shelf/<int:book_id>/", views.ShelfItemView.as_view(), name="shelf-item"),
    path("books/upload/", views.UploadView.as_view(), name="book-upload"),
    path("", include(router.urls)),
]
