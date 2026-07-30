import asyncio
import hmac
import json
import logging
from functools import lru_cache
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from .chat import ChatService, sse_event
from .config import Settings, get_settings
from .documents import DocumentParseError
from .knowledge import KnowledgeService
from .providers import ModelProvider, ProviderUnavailable
from .schemas import (
    ChatStreamRequest,
    IndexRequest,
    ProviderOverride,
    ProviderPingRequest,
    SearchRequest,
    TextRequest,
)
from .store import VectorStore, VectorStoreUnavailable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

TEXT_PURPOSE_PROMPTS = {
    "general_copy": "按用户要求生成简洁、准确的中文文案，不编造未提供的事实。",
    "wrong_answer_explanation": (
        "解释错题原因和知识点。标准答案是上游系统提供的权威数据，不得修改或质疑标准答案。"
    ),
    "study_advice": "只解释上游给出的成绩和统计，不自行计算、修改或杜撰分数与排名。",
    "content_summary": "只依据输入内容生成摘要、重点和学习提示；内容不足时明确说明。",
}

app = FastAPI(
    title="党校 AI 内部服务",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@lru_cache
def get_components() -> tuple[Settings, ModelProvider, VectorStore, KnowledgeService, ChatService]:
    settings = get_settings()
    provider = ModelProvider(settings)
    store = VectorStore(settings)
    knowledge = KnowledgeService(settings, provider, store)
    chat = ChatService(settings, provider, knowledge)
    return settings, provider, store, knowledge, chat


def apply_provider_override(
    settings: Settings, override: ProviderOverride | None
) -> Settings:
    if override is None:
        return settings
    updates = override.as_updates()
    if not updates:
        return settings
    return settings.model_copy(update=updates)


def components_for(
    override: ProviderOverride | None,
) -> tuple[Settings, ModelProvider, VectorStore, KnowledgeService, ChatService]:
    settings, provider, store, knowledge, chat = get_components()
    new_settings = apply_provider_override(settings, override)
    if new_settings is settings:
        return settings, provider, store, knowledge, chat
    new_provider = ModelProvider(new_settings)
    new_knowledge = KnowledgeService(new_settings, new_provider, store)
    new_chat = ChatService(new_settings, new_provider, new_knowledge)
    return new_settings, new_provider, store, new_knowledge, new_chat


def require_internal_key(
    x_internal_api_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = get_settings().internal_api_key
    if not x_internal_api_key or not hmac.compare_digest(x_internal_api_key, expected):
        raise HTTPException(status_code=401, detail="内部服务鉴权失败")


InternalAuth = Annotated[None, Depends(require_internal_key)]


@app.exception_handler(ProviderUnavailable)
async def provider_error_handler(_request: Any, exc: ProviderUnavailable) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "MODEL_UNAVAILABLE", "message": str(exc)}},
    )


@app.exception_handler(VectorStoreUnavailable)
async def vector_error_handler(_request: Any, exc: VectorStoreUnavailable) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={"error": {"code": "VECTOR_STORE_UNAVAILABLE", "message": str(exc)}},
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    settings, _provider, store, _knowledge, _chat = get_components()
    milvus_ok = await asyncio.to_thread(store.health)
    model_configured = bool(settings.chat_api_key)
    embedding_configured = bool(settings.embedding_api_key or settings.chat_api_key)
    healthy = milvus_ok and model_configured and embedding_configured
    return {
        "status": "ok" if healthy else "degraded",
        "service": "party-school-ai-service",
        "dependencies": {
            "chatModel": "configured" if model_configured else "not_configured",
            "embeddingModel": "configured" if embedding_configured else "not_configured",
            "milvus": "ok" if milvus_ok else "unavailable",
        },
    }


@app.post("/text")
async def generate_text(request: TextRequest, _auth: InternalAuth) -> dict[str, Any]:
    _settings, provider, _store, _knowledge, _chat = components_for(request.provider)
    response_format = None
    if request.response_format == "json":
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "node_requested_output",
                "strict": True,
                "schema": request.json_schema,
            },
        }
    response = await provider.complete(
        [
            {"role": "system", "content": TEXT_PURPOSE_PROMPTS[request.purpose]},
            *[message.model_dump() for message in request.messages],
        ],
        response_format=response_format,
        temperature=request.temperature,
    )
    content = response.choices[0].message.content or ""
    output: Any = content
    if request.response_format == "json":
        try:
            output = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ProviderUnavailable("聊天模型未返回有效 JSON") from exc
    usage = response.usage.model_dump() if response.usage else None
    return {
        "data": output,
        "meta": {"model": response.model, "usage": usage, "purpose": request.purpose},
    }


@app.post("/internal/index")
async def mutate_index(request: IndexRequest, _auth: InternalAuth) -> dict[str, Any]:
    _settings, _provider, _store, knowledge, _chat = components_for(request.provider)
    try:
        return await knowledge.mutate_index(request)
    except DocumentParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/internal/search")
async def search(request: SearchRequest, _auth: InternalAuth) -> dict[str, Any]:
    _settings, _provider, _store, knowledge, _chat = components_for(request.provider)
    try:
        return await knowledge.search(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/internal/chat/stream")
async def chat_stream(request: ChatStreamRequest, _auth: InternalAuth) -> EventSourceResponse:
    _settings, _provider, _store, _knowledge, chat = components_for(request.provider)

    async def events():
        try:
            async for event in chat.stream(request):
                yield event
        except ProviderUnavailable as exc:
            logger.warning("chat model unavailable: %s", exc)
            yield sse_event("error", {"code": "MODEL_UNAVAILABLE", "message": str(exc)})
        except VectorStoreUnavailable as exc:
            logger.warning("vector store unavailable: %s", exc)
            yield sse_event(
                "error", {"code": "VECTOR_STORE_UNAVAILABLE", "message": str(exc)}
            )
        except Exception:
            logger.exception("unexpected streaming chat error")
            yield sse_event(
                "error", {"code": "INTERNAL_ERROR", "message": "AI 服务处理失败"}
            )

    return EventSourceResponse(
        events(),
        ping=15,
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@app.post("/internal/provider-ping")
async def provider_ping(request: ProviderPingRequest, _auth: InternalAuth) -> dict[str, Any]:
    _settings, provider, _store, _knowledge, _chat = components_for(request.provider)
    if request.target == "embedding":
        vectors = await provider.embed(["党校 AI 设置连通性测试"])
        dimension = len(vectors[0]) if vectors else 0
        return {
            "ok": True,
            "target": "embedding",
            "model": provider.settings.embedding_model,
            "dimension": dimension,
        }

    response = await provider.complete(
        [
            {
                "role": "user",
                "content": "请只回复两个字：正常",
            }
        ],
        temperature=0,
    )
    sample = (response.choices[0].message.content or "")[:80]
    return {
        "ok": True,
        "target": "chat",
        "model": response.model or provider.settings.chat_model,
        "sample": sample,
    }
