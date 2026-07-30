import asyncio
import hashlib
import time
from typing import Any

from .config import Settings
from .documents import chunk_text, parse_document
from .providers import ModelProvider
from .schemas import IndexRequest, SearchRequest
from .store import VectorStore


class KnowledgeService:
    def __init__(self, settings: Settings, provider: ModelProvider, store: VectorStore) -> None:
        self.settings = settings
        self.provider = provider
        self.store = store

    async def mutate_index(self, request: IndexRequest) -> dict[str, Any]:
        if request.operation == "delete":
            deleted = await asyncio.to_thread(
                self.store.delete,
                content_ids=request.content_ids,
                document_ids=request.document_ids,
            )
            return {"operation": "delete", "deleted": deleted}

        rows: list[dict[str, Any]] = []
        document_ids: list[str] = []
        for document in request.documents:
            text = await asyncio.to_thread(parse_document, document)
            chunks = chunk_text(text, self.settings.chunk_size, self.settings.chunk_overlap)
            vectors = await self.provider.embed([chunk.content for chunk in chunks])
            document_ids.append(document.document_id)
            for chunk, vector in zip(chunks, vectors, strict=True):
                raw_id = (
                    f"{document.document_id}:{document.content_version}:{chunk.index}:"
                    f"{self.settings.embedding_model}"
                )
                chunk_id = hashlib.sha256(raw_id.encode()).hexdigest()
                rows.append(
                    {
                        "id": chunk_id,
                        "vector": vector,
                        "content": chunk.content[:8192],
                        "content_id": document.content_id,
                        "document_id": document.document_id,
                        "source_type": document.source_type,
                        "is_public": document.is_public,
                        "org_unit_ids": document.org_unit_ids,
                        "content_version": document.content_version,
                        "embedding_model": self.settings.embedding_model,
                        "title": document.title,
                        "heading": chunk.heading or document.heading,
                        "attachment_id": document.attachment_id,
                    }
                )
        inserted = await asyncio.to_thread(self.store.upsert, rows, list(set(document_ids)))
        return {
            "operation": "upsert",
            "documents": len(document_ids),
            "chunks": inserted,
            "embeddingModel": self.settings.embedding_model,
        }

    async def search(self, request: SearchRequest) -> dict[str, Any]:
        if len(request.allowed_content_ids) > self.settings.max_allowed_content_ids:
            raise ValueError(
                f"allowed_content_ids 超过服务限制 {self.settings.max_allowed_content_ids}"
            )
        started = time.perf_counter()
        if not request.allowed_content_ids:
            return {
                "citations": [],
                "retrievalMeta": {
                    "query": request.query,
                    "topK": request.top_k,
                    "returned": 0,
                    "allowedContentCount": 0,
                    "embeddingModel": self.settings.embedding_model,
                    "durationMs": 0,
                },
            }
        vector = (await self.provider.embed([request.query]))[0]
        hits = await asyncio.to_thread(
            self.store.search,
            vector,
            request.allowed_content_ids,
            request.top_k,
            request.score_threshold,
        )
        citations = [
            {
                "chunkId": hit["id"],
                "contentId": hit["content_id"],
                "documentId": hit["document_id"],
                "sourceType": hit["source_type"],
                "title": hit["title"],
                "heading": hit["heading"],
                "attachmentId": hit["attachment_id"] or None,
                "contentVersion": hit["content_version"],
                "score": hit["score"],
                "excerpt": hit["content"],
            }
            for hit in hits
        ]
        return {
            "citations": citations,
            "retrievalMeta": {
                "query": request.query,
                "topK": request.top_k,
                "returned": len(citations),
                "allowedContentCount": len(request.allowed_content_ids),
                "embeddingModel": self.settings.embedding_model,
                "durationMs": round((time.perf_counter() - started) * 1000),
            },
        }
