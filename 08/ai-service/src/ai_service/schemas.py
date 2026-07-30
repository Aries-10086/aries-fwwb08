import json
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_validator

Identifier = Annotated[str, Field(min_length=1, max_length=128)]


class ProviderOverride(BaseModel):
    """Node 管理端下发的模型配置覆盖；未提供的字段沿用环境变量。"""

    chat_base_url: str | None = Field(default=None, min_length=1, max_length=512)
    chat_api_key: str | None = Field(default=None, max_length=2048)
    chat_model: str | None = Field(default=None, min_length=1, max_length=128)
    embedding_base_url: str | None = Field(default=None, min_length=1, max_length=512)
    embedding_api_key: str | None = Field(default=None, max_length=2048)
    embedding_model: str | None = Field(default=None, min_length=1, max_length=128)
    embedding_dimension: int | None = Field(default=None, ge=64, le=65536)

    def as_updates(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in self.model_dump().items()
            if value is not None and value != ""
        }


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)


class TextRequest(BaseModel):
    purpose: Literal["general_copy", "wrong_answer_explanation", "study_advice", "content_summary"]
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)
    response_format: Literal["text", "json"] = "text"
    json_schema: dict[str, Any] | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)
    provider: ProviderOverride | None = None

    @model_validator(mode="after")
    def require_json_schema(self) -> "TextRequest":
        if self.response_format == "json" and not self.json_schema:
            raise ValueError("response_format=json 时必须提供 json_schema")
        return self


class SourceDocument(BaseModel):
    content_id: Identifier
    document_id: Identifier
    source_type: str = Field(min_length=1, max_length=32)
    is_public: bool = False
    org_unit_ids: list[Identifier] = Field(default_factory=list, max_length=256)
    content_version: str = Field(min_length=1, max_length=64)
    title: str = Field(default="", max_length=512)
    heading: str = Field(default="", max_length=512)
    attachment_id: str = Field(default="", max_length=128)
    filename: str = Field(min_length=1, max_length=512)
    text: str | None = Field(default=None, max_length=5_000_000)
    content_base64: str | None = Field(default=None, max_length=15_000_000)

    @model_validator(mode="after")
    def exactly_one_body(self) -> "SourceDocument":
        if (self.text is None) == (self.content_base64 is None):
            raise ValueError("text 与 content_base64 必须且只能提供一个")
        return self


class IndexRequest(BaseModel):
    operation: Literal["upsert", "delete"]
    documents: list[SourceDocument] = Field(default_factory=list, max_length=20)
    content_ids: list[Identifier] = Field(default_factory=list, max_length=1000)
    document_ids: list[Identifier] = Field(default_factory=list, max_length=1000)
    provider: ProviderOverride | None = None

    @model_validator(mode="after")
    def validate_operation(self) -> "IndexRequest":
        if self.operation == "upsert" and not self.documents:
            raise ValueError("upsert 必须提供 documents")
        if self.operation == "delete" and not (self.content_ids or self.document_ids):
            raise ValueError("delete 必须提供 content_ids 或 document_ids")
        total_size = sum(
            len(document.text or "") + len(document.content_base64 or "")
            for document in self.documents
        )
        if total_size > 20_000_000:
            raise ValueError("单次索引请求的文档内容合计不能超过 20 MB")
        return self


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    allowed_content_ids: list[Identifier] = Field(max_length=10_000)
    top_k: int = Field(default=5, ge=1, le=20)
    score_threshold: float | None = Field(default=None, ge=-1, le=1)
    provider: ProviderOverride | None = None


class ToolResult(BaseModel):
    call_id: str | None = Field(default=None, max_length=128)
    name: str = Field(min_length=1, max_length=64)
    result: Any

    @model_validator(mode="after")
    def limit_result_size(self) -> "ToolResult":
        if len(json.dumps(self.result, ensure_ascii=False, default=str)) > 50_000:
            raise ValueError("单个 tool result 不能超过 50 KB")
        return self


class ChatStreamRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)
    allowed_content_ids: list[Identifier] = Field(max_length=10_000)
    allowed_tool_names: list[Identifier] = Field(default_factory=list, max_length=64)
    tool_results: list[ToolResult] = Field(default_factory=list, max_length=50)
    top_k: int = Field(default=5, ge=1, le=20)
    system_prompt: str | None = Field(default=None, max_length=10_000)
    provider: ProviderOverride | None = None

    @model_validator(mode="after")
    def limit_context_size(self) -> "ChatStreamRequest":
        if sum(len(message.content) for message in self.messages) > 200_000:
            raise ValueError("messages 总长度不能超过 200,000 字符")
        return self


class ProviderPingRequest(BaseModel):
    target: Literal["chat", "embedding"] = "chat"
    provider: ProviderOverride | None = None
