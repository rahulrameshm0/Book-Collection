from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    BookDetailView,
    BookListView,
    LoginView,
    MeView,
    MyReadingView,
    ProgressView,
    RegisterView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("reading/", MyReadingView.as_view(), name="my_reading"),
    path("books/", BookListView.as_view(), name="book_list"),
    path("books/<slug:slug>/", BookDetailView.as_view(), name="book_detail"),
    path("books/<slug:slug>/progress/", ProgressView.as_view(), name="book_progress"),
]
