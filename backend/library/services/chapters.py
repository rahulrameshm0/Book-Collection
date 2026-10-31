"""Turn a Project Gutenberg plain-text file into something worth reading."""

import re

START_RE = re.compile(
    r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", re.IGNORECASE
)
END_RE = re.compile(
    r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", re.IGNORECASE
)

# CHAPTER IV, Chapter 12., BOOK THE FIRST, PART II, STAVE I, LETTER 3, CHAPTER TWENTY-ONE
HEADING_RE = re.compile(
    r"^[\s_*#]*(?P<label>CHAPTER|Chapter|BOOK|Book|PART|Part|STAVE|Stave|LETTER|Letter|"
    r"ACT|Act|SCENE|Scene)\s+(?P<num>\S+)",
)
HEADING_LABEL = {
    "chapter": "Chapter",
    "book": "Book",
    "part": "Part",
    "stave": "Stave",
    "letter": "Letter",
    "act": "Act",
    "scene": "Scene",
}

PARAGRAPH_SPLIT_RE = re.compile(r"\n[ \t]*\n+")


def strip_boilerplate(text: str) -> str:
    """Remove the licence header/footer Gutenberg wraps around every book."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    start = START_RE.search(text)
    if start:
        text = text[start.end() :]
    end = END_RE.search(text)
    if end:
        text = text[: end.start()]
    return text.strip("\n")


def unwrap_paragraphs(text: str) -> str:
    """Gutenberg hard-wraps at ~70 columns. Re-flow it for screen reading,
    but leave verse and tables (short, indented lines) alone."""
    blocks = []
    for block in PARAGRAPH_SPLIT_RE.split(text):
        lines = [line.rstrip() for line in block.split("\n")]
        content = [line for line in lines if line.strip()]
        if not content:
            continue
        short = sum(1 for line in content if len(line.strip()) < 45)
        looks_like_verse = len(content) > 1 and short / len(content) > 0.6
        if looks_like_verse:
            blocks.append("\n".join(line.strip() for line in content))
        else:
            joined = " ".join(line.strip() for line in content)
            blocks.append(re.sub(r"[ \t]{2,}", " ", joined))
    return "\n\n".join(blocks).strip()


def _leading_number(title: str, match):
    """Read the numeral after the label, accepting '12', 'IV', 'ONE', 'TWENTY-ONE',
    'TWENTY ONE' — but not 'ONE PLAYING'."""
    rest = title[match.start("num") :]
    words = rest.split()
    for count in (2, 1):
        if len(words) < count:
            continue
        number = _parse_number(" ".join(words[:count]))
        if number is not None:
            return number
    return None


def _find_headings(text: str):
    """Return [(char_offset, heading_line, label)] in one pass."""
    positions = []
    cursor = 0
    lines = text.split("\n")
    for line_index, line in enumerate(lines):
        stripped = line.strip()
        if stripped and len(stripped) <= 120:
            match = HEADING_RE.match(stripped)
            if match and _leading_number(stripped, match) is not None:
                title = stripped
                # "CHAPTER I." on one line, "Down the Rabbit-Hole" on the next.
                if re.fullmatch(
                    r"(?:CHAPTER|Chapter|BOOK|Book|PART|Part|STAVE|Stave|LETTER|Letter)"
                    r"\s+(?:\d{1,4}|[IVXLCDM]{1,10}|(?:the\s+)?[A-Za-z]+(?:[-\s][A-Za-z]+)?)\.?",
                    stripped,
                    re.IGNORECASE,
                ):
                    subtitle = _next_content_line(lines, line_index + 1)
                    if (
                        subtitle
                        and len(subtitle) < 80
                        and not subtitle.endswith((".", "!", "?"))
                        and not subtitle.startswith("[")
                        and not HEADING_RE.match(subtitle)
                    ):
                        title = f"{stripped} {subtitle}"
                positions.append(
                    (cursor, title, HEADING_LABEL[match.group("label").lower()])
                )
        cursor += len(line) + 1
    return positions


def _next_content_line(lines, start):
    for line in lines[start : start + 4]:
        if line.strip():
            return line.strip()
    return ""


def strip_heading(body: str, title: str) -> str:
    """The reader renders the chapter title itself, so drop it from the body."""
    lines = body.split("\n")
    while lines and not lines[0].strip():
        lines.pop(0)
    if lines and _normalize(lines[0]) in _normalize(title):
        lines.pop(0)
        while lines and not lines[0].strip():
            lines.pop(0)
        if lines and len(lines[0].strip()) < 80 and _normalize(lines[0]) in _normalize(title):
            lines.pop(0)
    return "\n".join(lines).strip()


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _drop_table_of_contents(headings):
    """TOC entries sit a few dozen characters apart; real chapters are followed
    by pages of prose. Group close-packed headings and keep only the final one,
    unless its number jumps backwards — that means it is the tail of the TOC and
    the numbered text is about to restart."""
    if not headings:
        return []

    runs = [[headings[0]]]
    for heading in headings[1:]:
        if heading[0] - runs[-1][-1][0] < 300:
            runs[-1].append(heading)
        else:
            runs.append([heading])

    keep = []
    for index, run in enumerate(runs):
        if len(run) < 3:
            keep.extend(run)
            continue

        last = run[-1]
        next_number = _heading_number(runs[index + 1][0][1]) if index + 1 < len(runs) else None
        last_number = _heading_number(last[1])
        if next_number is not None and last_number is not None and last_number > next_number:
            continue
        keep.append(last)
    return keep


ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}

WORD_NUMBERS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
    "hundred": 100,
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
    "sixth": 6,
    "seventh": 7,
    "eighth": 8,
    "ninth": 9,
    "tenth": 10,
    "eleventh": 11,
    "twelfth": 12,
    "thirteenth": 13,
    "fourteenth": 14,
    "fifteenth": 15,
    "sixteenth": 16,
    "seventeenth": 17,
    "eighteenth": 18,
    "nineteenth": 19,
    "twentieth": 20,
    "thirtieth": 30,
    "fortieth": 40,
    "fiftieth": 50,
    "sixtieth": 60,
    "seventieth": 70,
    "eightieth": 80,
    "ninetieth": 90,
}


def _roman_to_int(value):
    total = 0
    previous = 0
    for char in reversed(value.upper()):
        current = ROMAN_VALUES.get(char, 0)
        total += -current if current < previous else current
        previous = max(previous, current)
    return total


def _word_to_int(value: str):
    total = 0
    current = 0
    parts = [part for part in re.split(r"[-\s]+", value.lower()) if part and part != "the"]
    if not parts:
        return None
    for part in parts:
        if part not in WORD_NUMBERS:
            return None
        number = WORD_NUMBERS[part]
        if number == 100:
            current = (current or 1) * 100
        else:
            current += number
    return total + current


def _parse_number(token: str):
    token = re.split(r"[—–]", token)[0]
    token = token.strip().strip(".,;:)]}[(_*#†‡\"'“”‘’")
    if not token:
        return None
    if token.isdigit():
        return int(token)
    if re.fullmatch(r"[IVXLCDM]+", token, re.IGNORECASE):
        return _roman_to_int(token)
    return _word_to_int(token)


def _heading_number(title: str):
    match = HEADING_RE.match(title)
    if not match:
        return None
    return _leading_number(title, match)


def _dedupe(headings):
    """Some books list a chapter title in a TOC and again over the text; running
    heads repeat it too. Keep the occurrence followed by the most prose."""
    best = {}
    for position, heading in enumerate(headings):
        key = re.sub(r"\s+", " ", heading[1].lower()).strip(" .")
        following = (
            headings[position + 1][0] if position + 1 < len(headings) else len(headings) * 10**9
        )
        span = following - heading[0]
        if key not in best or span > best[key][0]:
            best[key] = (span, position, heading)

    ordered = sorted(best.values(), key=lambda item: item[1])
    return [heading for _, _, heading in ordered]


def chapterize(text: str, book_title: str = ""):
    """Return [(title, start_offset, end_offset, chapter_text)]."""
    headings = _dedupe(_drop_table_of_contents(_find_headings(text)))

    if len(headings) >= 2:
        chapters = []
        first_start = headings[0][0]
        preamble = text[:first_start].strip()
        if len(preamble.split()) > 120:
            chapters.append(("Front matter", 0, first_start))

        for i, (start, title, label) in enumerate(headings):
            end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
            clean_title = re.sub(r"\s+", " ", title).strip()
            chapters.append((clean_title, start, end))
        return _materialize(text, chapters)

    return _chunk(text, book_title)


def _materialize(text, spans):
    result = []
    for title, start, end in spans:
        body = text[start:end].strip()
        if not body:
            continue
        # Skip a heading that is immediately followed by another heading.
        if len(body.split()) < 3 and len(spans) > 1:
            continue
        result.append((_clean_title(title), start, end, body))
    return result


def _clean_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"\s*[\]\[]\s*$", "", title).strip()
    return title


def _chunk(text, book_title):
    """Fallback for books without headings (complete works, essays, poetry)."""
    words_per_part = 4500
    paragraphs = text.split("\n\n")
    parts = []
    current = []
    current_words = 0
    offset = 0
    part_start = 0

    for paragraph in paragraphs:
        words = len(paragraph.split())
        if current and current_words + words > words_per_part:
            parts.append((part_start, offset))
            part_start = offset
            current = []
            current_words = 0
        current.append(paragraph)
        current_words += words
        offset += len(paragraph) + 2

    parts.append((part_start, len(text)))

    result = []
    for i, (start, end) in enumerate(parts):
        body = text[start:end].strip()
        if not body:
            continue
        if len(parts) == 1:
            title = book_title or "Full text"
        else:
            title = f"Part {i + 1}"
        result.append((title, start, end, body))
    return result


def word_count(text: str) -> int:
    return len(text.split())
