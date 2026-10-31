from django.contrib import admin

from library.models import Author, Book, Chapter, ReadingProgress, ShelfItem


class ChapterInline(admin.TabularInline):
    model = Chapter
    extra = 0
    fields = ["index", "title"]
    readonly_fields = ["index", "title"]
    can_delete = False
    max_num = 0


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ["title", "primary_author", "word_count", "chapter_count", "source", "issued_date"]
    list_filter = ["source", "language", "cover_cached"]
    search_fields = ["title", "authors__name", "gutenberg_id"]
    filter_horizontal = ["authors"]
    inlines = [ChapterInline]
    readonly_fields = ["word_count", "chapter_count", "text_file", "created_at", "updated_at"]


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ["name", "birth_year", "death_year"]
    search_fields = ["name"]


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ["user", "book", "chapter_index", "scroll_ratio", "updated_at"]
    search_fields = ["user__username", "book__title"]


@admin.register(ShelfItem)
class ShelfItemAdmin(admin.ModelAdmin):
    list_display = ["user", "book", "added_at"]
    search_fields = ["user__username", "book__title"]
