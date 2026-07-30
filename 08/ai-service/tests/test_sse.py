import json

from ai_service.chat import encode_sse, sse_event


def test_sse_event_uses_json_data() -> None:
    event = sse_event("content", "第一行\n第二行")

    assert event["event"] == "content"
    assert json.loads(event["data"]) == {
        "type": "content",
        "data": "第一行\n第二行",
    }


def test_encoded_sse_has_event_data_and_blank_terminator() -> None:
    encoded = encode_sse("done", {"answer": "完成"})

    assert encoded.startswith("event: done\ndata: ")
    assert encoded.endswith("\n\n")
    payload = json.loads(encoded.split("data: ", 1)[1].strip())
    assert payload["type"] == "done"
    assert payload["data"]["answer"] == "完成"


def test_error_event_contract() -> None:
    event = sse_event(
        "error", {"code": "MODEL_UNAVAILABLE", "message": "聊天模型连接失败或超时"}
    )
    payload = json.loads(event["data"])

    assert payload["type"] == "error"
    assert payload["data"]["code"] == "MODEL_UNAVAILABLE"
