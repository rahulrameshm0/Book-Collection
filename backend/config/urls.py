from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from django.views.static import serve as static_serve

admin.site.site_header = "Shelf administration"
admin.site.site_title = "Shelf"


def spa(request, path=""):
    """Serve the built React app for any non-API route."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        raise Http404(
            "The frontend is not built yet. Run `npm run dev` in frontend/ while "
            "developing, or `npm run build` to let Django serve it."
        )
    return FileResponse(index.open("rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("library.urls")),
]

if settings.DEBUG:
    from django.conf.urls.static import static

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Built single-page app: hashed asset files, then every other route.
urlpatterns += [
    re_path(
        r"^assets/(?P<path>.*)$",
        static_serve,
        {"document_root": settings.FRONTEND_DIST / "assets"},
    ),
    re_path(r"^(?!api/|admin/|static/|media/).*$", spa),
]
