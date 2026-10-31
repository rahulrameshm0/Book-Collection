from django.db import models


class Author(models.Model):
    name = models.CharField(max_length=255, db_index=True)
    birth_year = models.IntegerField(null=True, blank=True)
    death_year = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["name"], name="unique_author_name"),
        ]

    def __str__(self):
        return self.name

    @property
    def sort_name(self):
        """Gutenberg gives 'Austen, Jane'; show 'Jane Austen' to readers."""
        if "," in self.name:
            last, first = self.name.split(",", 1)
            return f"{first.strip()} {last.strip()}"
        return self.name


class Book(models.Model):
    class Source(models.TextChoices):
        GUTENBERG = "gutenberg", "Project Gutenberg"
        UPLOAD = "upload", "Upload"

    gutenberg_id = models.IntegerField(unique=True, null=True, blank=True, db_index=True)
    title = models.CharField(max_length=512, db_index=True)
    authors = models.ManyToManyField(Author, related_name="books", blank=True)
    language = models.CharField(max_length=16, default="en")
    description = models.TextField(blank=True)
    subjects = models.TextField(blank=True)
    bookshelves = models.TextField(blank=True)
    issued_date = models.DateField(null=True, blank=True)

    source = models.CharField(max_length=16, choices=Source.choices, default=Source.GUTENBERG)
    text_file = models.CharField(max_length=255, blank=True)
    word_count = models.IntegerField(default=0)
    chapter_count = models.IntegerField(default=0)
    cover_cached = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        indexes = [
            models.Index(fields=["title"]),
            models.Index(fields=["gutenberg_id"]),
        ]

    def __str__(self):
        return self.title

    @property
    def primary_author(self):
        author = self.authors.first()
        return author.sort_name if author else ""

    @property
    def subject_list(self):
        return [s.strip() for s in self.subjects.split(";") if s.strip()]

    @property
    def shelf_list(self):
        return [
            s.strip()
            for s in self.bookshelves.split(";")
            if s.strip() and not s.strip().lower().startswith("category:")
        ]

    @property
    def cover_url(self):
        if self.gutenberg_id:
            return f"/api/books/{self.pk}/cover/"
        return ""


class Chapter(models.Model):
    book = models.ForeignKey(Book, related_name="chapters", on_delete=models.CASCADE)
    index = models.PositiveIntegerField()
    title = models.CharField(max_length=512, blank=True)
    start_offset = models.IntegerField()
    end_offset = models.IntegerField()

    class Meta:
        ordering = ["index"]
        constraints = [
            models.UniqueConstraint(fields=["book", "index"], name="unique_chapter_index"),
        ]

    def __str__(self):
        return f"{self.book.title} — {self.title or self.index + 1}"


class ReadingProgress(models.Model):
    user = models.ForeignKey(
        "auth.User", related_name="reading_progress", on_delete=models.CASCADE
    )
    book = models.ForeignKey(Book, related_name="progress_entries", on_delete=models.CASCADE)
    chapter_index = models.PositiveIntegerField(default=0)
    scroll_ratio = models.FloatField(default=0.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="unique_progress_per_book"),
        ]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user} — {self.book} (ch. {self.chapter_index + 1})"


class ShelfItem(models.Model):
    user = models.ForeignKey("auth.User", related_name="shelf", on_delete=models.CASCADE)
    book = models.ForeignKey(Book, related_name="shelf_items", on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="unique_shelf_item"),
        ]
        ordering = ["-added_at"]

    def __str__(self):
        return f"{self.user} — {self.book}"
