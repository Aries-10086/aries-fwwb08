from ai_service.documents import chunk_text


def test_empty_text_has_no_chunks() -> None:
    assert chunk_text(" \n ") == []


def test_markdown_heading_is_preserved_as_metadata() -> None:
    chunks = chunk_text("# 第一章\n内容一。\n\n## 第二节\n内容二。", chunk_size=200, overlap=20)

    assert [chunk.heading for chunk in chunks] == ["第一章", "第二节"]
    assert chunks[0].content.startswith("# 第一章")
    assert [chunk.index for chunk in chunks] == [0, 1]


def test_long_text_is_bounded_and_overlapped() -> None:
    text = "甲" * 180 + "\n\n" + "乙" * 180 + "\n\n" + "丙" * 180
    chunks = chunk_text(text, chunk_size=220, overlap=30)

    assert len(chunks) >= 3
    assert all(0 < len(chunk.content) <= 220 for chunk in chunks)
    assert set(chunks[0].content[-20:]) <= set(chunks[1].content[:40])


def test_overlap_must_be_smaller_than_chunk_size() -> None:
    try:
        chunk_text("正文", chunk_size=200, overlap=200)
    except ValueError as exc:
        assert "小于" in str(exc)
    else:
        raise AssertionError("expected ValueError")
