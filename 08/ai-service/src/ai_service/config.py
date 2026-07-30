import ipaddress
from functools import lru_cache
from typing import Any

from pydantic import BaseModel, Field, HttpUrl, TypeAdapter, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class InternalToolConfig(BaseModel):
    name: str = Field(pattern=r"^[a-zA-Z][a-zA-Z0-9_-]{0,63}$")
    description: str
    url: HttpUrl
    timeout_seconds: float = Field(default=8, gt=0, le=30)
    auth_header: str | None = None
    auth_token: str | None = None
    parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})

    @field_validator("url")
    @classmethod
    def require_safe_url(cls, value: HttpUrl) -> HttpUrl:
        host = (value.host or "").lower()
        private_name = host == "localhost" or host.endswith((".local", ".internal"))
        try:
            address = ipaddress.ip_address(host.strip("[]"))
            private_ip = address.is_private or address.is_loopback
        except ValueError:
            private_ip = False
        if not (private_name or private_ip):
            raise ValueError("内网工具 URL 仅允许 localhost、私网 IP 或 .local/.internal 域名")
        return value

    @field_validator("auth_header")
    @classmethod
    def restrict_auth_header(cls, value: str | None) -> str | None:
        if value is not None and not value.lower().startswith("x-"):
            raise ValueError("auth_header 必须是 X- 开头的自定义请求头")
        return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore"
    )

    app_name: str = "党校 AI 内部服务"
    internal_api_key: str = Field(min_length=16)
    request_timeout_seconds: float = Field(default=30, gt=0, le=120)

    chat_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    chat_api_key: str = ""
    chat_model: str = "qwen-plus"
    chat_temperature: float = Field(default=0.2, ge=0, le=2)

    embedding_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-v4"
    embedding_dimension: int = Field(default=1024, ge=64, le=65536)
    embedding_batch_size: int = Field(default=16, ge=1, le=128)

    milvus_uri: str = "http://localhost:19530"
    milvus_token: str = ""
    milvus_collection: str = "party_school_knowledge"

    chunk_size: int = Field(default=800, ge=200, le=4000)
    chunk_overlap: int = Field(default=100, ge=0, le=1000)
    search_top_k: int = Field(default=5, ge=1, le=20)
    max_allowed_content_ids: int = Field(default=2000, ge=1, le=10000)
    max_tool_rounds: int = Field(default=3, ge=1, le=5)
    internal_tools_json: str = "[]"

    @model_validator(mode="after")
    def validate_chunking(self) -> "Settings":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("CHUNK_OVERLAP 必须小于 CHUNK_SIZE")
        return self

    @property
    def internal_tools(self) -> list[InternalToolConfig]:
        tools = TypeAdapter(list[InternalToolConfig]).validate_json(self.internal_tools_json)
        names = [tool.name for tool in tools]
        if "knowledge_retrieval" in names:
            raise ValueError("knowledge_retrieval 是保留工具名")
        if len(names) != len(set(names)):
            raise ValueError("INTERNAL_TOOLS_JSON 中工具名不能重复")
        return tools


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
