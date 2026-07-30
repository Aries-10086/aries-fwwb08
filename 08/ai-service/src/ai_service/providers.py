from collections.abc import AsyncIterator
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from .config import Settings


class ProviderUnavailable(RuntimeError):
    pass


class ModelProvider:
    def __init__(self, settings: Settings) -> None:
        timeout = settings.request_timeout_seconds
        self.settings = settings
        self.chat_client = AsyncOpenAI(
            api_key=settings.chat_api_key or "missing",
            base_url=settings.chat_base_url,
            timeout=timeout,
            max_retries=1,
        )
        self.embedding_client = AsyncOpenAI(
            api_key=settings.embedding_api_key or settings.chat_api_key or "missing",
            base_url=settings.embedding_base_url,
            timeout=timeout,
            max_retries=1,
        )

    def ensure_chat_configured(self) -> None:
        if not self.settings.chat_api_key:
            raise ProviderUnavailable("聊天模型未配置：CHAT_API_KEY 为空")

    def ensure_embedding_configured(self) -> None:
        if not (self.settings.embedding_api_key or self.settings.chat_api_key):
            raise ProviderUnavailable("向量模型未配置：EMBEDDING_API_KEY 为空")

    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        response_format: dict[str, Any] | None = None,
        temperature: float | None = None,
    ) -> Any:
        self.ensure_chat_configured()
        try:
            return await self.chat_client.chat.completions.create(
                model=self.settings.chat_model,
                messages=messages,  # type: ignore[arg-type]
                tools=tools,  # type: ignore[arg-type]
                response_format=response_format,  # type: ignore[arg-type]
                temperature=temperature
                if temperature is not None
                else self.settings.chat_temperature,
            )
        except (APIConnectionError, APITimeoutError) as exc:
            raise ProviderUnavailable("聊天模型连接失败或超时") from exc
        except APIStatusError as exc:
            raise ProviderUnavailable(f"聊天模型返回错误状态: {exc.status_code}") from exc

    async def stream(
        self, messages: list[dict[str, Any]], temperature: float | None = None
    ) -> AsyncIterator[str]:
        self.ensure_chat_configured()
        try:
            response = await self.chat_client.chat.completions.create(
                model=self.settings.chat_model,
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature
                if temperature is not None
                else self.settings.chat_temperature,
                stream=True,
            )
            async for event in response:
                content = event.choices[0].delta.content if event.choices else None
                if content:
                    yield content
        except (APIConnectionError, APITimeoutError) as exc:
            raise ProviderUnavailable("聊天模型流式连接失败或超时") from exc
        except APIStatusError as exc:
            raise ProviderUnavailable(f"聊天模型流式请求失败: {exc.status_code}") from exc

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.ensure_embedding_configured()
        if not texts:
            return []
        vectors: list[list[float]] = []
        try:
            for start in range(0, len(texts), self.settings.embedding_batch_size):
                response = await self.embedding_client.embeddings.create(
                    model=self.settings.embedding_model,
                    input=texts[start : start + self.settings.embedding_batch_size],
                    dimensions=self.settings.embedding_dimension,
                )
                vectors.extend(item.embedding for item in sorted(response.data, key=lambda x: x.index))
        except (APIConnectionError, APITimeoutError) as exc:
            raise ProviderUnavailable("向量模型连接失败或超时") from exc
        except APIStatusError as exc:
            raise ProviderUnavailable(f"向量模型返回错误状态: {exc.status_code}") from exc
        if any(len(vector) != self.settings.embedding_dimension for vector in vectors):
            raise ProviderUnavailable("向量模型返回的维度与 EMBEDDING_DIMENSION 不一致")
        return vectors
