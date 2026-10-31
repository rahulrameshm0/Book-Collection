from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from library.models import Author, Book, Chapter, ReadingProgress, ShelfItem

User = get_user_model()


class AuthorSerializer(serializers.ModelSerializer):
    sort_name = serializers.CharField(read_only=True)

    class Meta:
        model = Author
        fields = ["id", "name", "sort_name", "birth_year", "death_year"]


class BookListSerializer(serializers.ModelSerializer):
    authors = serializers.SerializerMethodField()
    cover_url = serializers.CharField(read_only=True)
    subject_list = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "authors",
            "cover_url",
            "word_count",
            "chapter_count",
            "subject_list",
        ]

    def get_authors(self, obj):
        return [author.sort_name for author in obj.authors.all()]

    def get_subject_list(self, obj):
        return obj.subject_list[:3]


class ChapterSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ["id", "index", "title"]


class ChapterContentSerializer(serializers.ModelSerializer):
    text = serializers.SerializerMethodField()
    previous = serializers.SerializerMethodField()
    next = serializers.SerializerMethodField()

    class Meta:
        model = Chapter
        fields = ["id", "index", "title", "text", "previous", "next"]

    def _chapter(self, chapter, offset):
        target = chapter.book.chapters.filter(index=chapter.index + offset).first()
        return {"index": target.index, "title": target.title} if target else None

    def get_previous(self, obj):
        return self._chapter(obj, -1)

    def get_next(self, obj):
        return self._chapter(obj, 1)

    def get_text(self, obj):
        from library.services.gutenberg import read_chapter

        return read_chapter(obj.book, obj)


class BookDetailSerializer(serializers.ModelSerializer):
    authors = AuthorSerializer(many=True, read_only=True)
    cover_url = serializers.CharField(read_only=True)
    subjects = serializers.SerializerMethodField()
    shelves = serializers.SerializerMethodField()
    description = serializers.CharField(read_only=True)
    chapters = serializers.SerializerMethodField()
    on_shelf = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "gutenberg_id",
            "title",
            "authors",
            "cover_url",
            "description",
            "subjects",
            "shelves",
            "issued_date",
            "source",
            "word_count",
            "chapter_count",
            "chapters",
            "on_shelf",
            "progress",
        ]

    def get_subjects(self, obj):
        return obj.subject_list

    def get_shelves(self, obj):
        return obj.shelf_list

    def get_chapters(self, obj):
        # Only titles and indexes are needed for the table of contents.
        return [
            {"id": chapter.id, "index": chapter.index, "title": chapter.title}
            for chapter in obj.chapters.all()
        ]

    def get_on_shelf(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ShelfItem.objects.filter(user=request.user, book=obj).exists()

    def get_progress(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        entry = ReadingProgress.objects.filter(user=request.user, book=obj).first()
        if not entry:
            return None
        return ProgressSerializer(entry).data


class ProgressSerializer(serializers.ModelSerializer):
    book_id = serializers.IntegerField(source="book.id", read_only=True)
    book_title = serializers.CharField(source="book.title", read_only=True)
    cover_url = serializers.CharField(source="book.cover_url", read_only=True)
    chapter_title = serializers.SerializerMethodField()
    percent = serializers.SerializerMethodField()

    class Meta:
        model = ReadingProgress
        fields = [
            "book_id",
            "book_title",
            "cover_url",
            "chapter_index",
            "chapter_title",
            "scroll_ratio",
            "percent",
            "updated_at",
        ]

    def get_chapter_title(self, obj):
        chapter = obj.book.chapters.filter(index=obj.chapter_index).first()
        return chapter.title if chapter else ""

    def get_percent(self, obj):
        total = obj.book.chapter_count or 1
        within = (obj.chapter_index + min(max(obj.scroll_ratio, 0), 1)) / total
        return round(min(within * 100, 100), 1)


class ShelfItemSerializer(serializers.ModelSerializer):
    book = BookListSerializer(read_only=True)

    class Meta:
        model = ShelfItem
        fields = ["id", "book", "added_at"]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined"]


class UploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=512)
    authors = serializers.CharField(required=False, allow_blank=True)
    file = serializers.FileField()
