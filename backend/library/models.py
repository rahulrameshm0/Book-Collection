from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Book(models.Model):
    """A public-domain English book with its full text."""

    gutenberg_id = models.PositiveIntegerField(unique=True)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    year = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    subjects = models.JSONField(default=list, blank=True)
    language = models.CharField(max_length=8, default="en")
    content = models.TextField()
    word_count = models.PositiveIntegerField(default=0)
    featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return f"{self.title} — {self.author}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:180] or "book"
            slug = base
            n = 2
            while Book.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{n}"
                n += 1
            self.slug = slug
        if not self.word_count and self.content:
            self.word_count = len(self.content.split())
        super().save(*args, **kwargs)

    @property
    def reading_minutes(self):
        return max(1, round(self.word_count / 230))


class ReadingProgress(models.Model):
    """Where a reader left off, stored per user and book."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reading_progress"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="progress_entries")
    page = models.PositiveIntegerField(default=1)
    percent = models.FloatField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="unique_progress_per_user_book")
        ]

    def __str__(self):
        return f"{self.user} · {self.book} · {self.percent:.0f}%"
