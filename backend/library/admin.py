from django.contrib import admin

from .models import Book, ReadingProgress


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "year", "word_count", "featured")
    search_fields = ("title", "author")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "page", "percent", "updated_at")
