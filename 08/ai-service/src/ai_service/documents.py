import base64
import binascii
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from .schemas import SourceDocument

SUPPORTED_SUFFIXES = {".md", ".markdown", ".txt", ".pdf", ".docx"}


class DocumentParseError(ValueError):
    pass


@dataclass(frozen=True)
class Chunk:
    content: str
    heading: str
    index: int


def parse_document(document: SourceDocument) -> str:
    suffix = Path(document.filename).suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise DocumentParseError(f"不支持的文件类型: {suffix or '无扩展名'}")
    if document.text is not None:
        if suffix not in {".md", ".markdown", ".txt"}:
            raise DocumentParseError("PDF/DOCX 必须通过 content_base64 提供原始文件")
        return _normalize(document.text)

    try:
        raw = base64.b64decode(document.content_base64 or "", validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DocumentParseError("content_base64 不是有效 Base64") from exc
    if len(raw) > 10 * 1024 * 1024:
        raise DocumentParseError("文档超过 10 MiB 限制")

    try:
        if suffix in {".md", ".markdown", ".txt"}:
            return _normalize(raw.decode("utf-8-sig"))
        if suffix == ".pdf":
            reader = PdfReader(BytesIO(raw))
            if len(reader.pages) > 1000:
                raise DocumentParseError("PDF 页数超过 1000 页限制")
            return _normalize("\n\n".join(page.extract_text() or "" for page in reader.pages))
        doc = Document(BytesIO(raw))
        return _normalize("\n".join(paragraph.text for paragraph in doc.paragraphs))
    except DocumentParseError:
        raise
    except Exception as exc:
        raise DocumentParseError(f"{suffix} 文档解析失败") from exc


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[Chunk]:
    if overlap >= chunk_size:
        raise ValueError("chunk_overlap 必须小于 chunk_size")
    text = _normalize(text)
    if not text:
        return []

    sections = _markdown_sections(text)
    chunks: list[Chunk] = []
    for heading, section in sections:
        remaining = section
        while remaining:
            if len(remaining) <= chunk_size:
                piece = remaining
                remaining = ""
            else:
                cut = _best_cut(remaining, chunk_size)
                piece = remaining[:cut]
                effective_overlap = min(overlap, cut - 1)
                next_start = cut - effective_overlap
                remaining = remaining[next_start:].lstrip()
            piece = piece.strip()
            if piece:
                chunks.append(Chunk(content=piece, heading=heading, index=len(chunks)))
    return chunks


def _markdown_sections(text: str) -> list[tuple[str, str]]:
    matches = list(re.finditer(r"(?m)^(#{1,6})\s+(.+?)\s*$", text))
    if not matches:
        return [("", text)]
    result: list[tuple[str, str]] = []
    if matches[0].start() > 0 and text[: matches[0].start()].strip():
        result.append(("", text[: matches[0].start()].strip()))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        result.append((match.group(2).strip(), text[match.start() : end].strip()))
    return result


def _best_cut(text: str, limit: int) -> int:
    floor = max(1, int(limit * 0.6))
    for separator in ("\n\n", "\n", "。", "！", "？", "；", " "):
        position = text.rfind(separator, floor, limit + 1)
        if position >= floor:
            return position + len(separator)
    return limit


def _normalize(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text.replace("\x00", "")).strip()
