import json
from typing import Any

from pymilvus import DataType, MilvusClient

from .config import Settings


class VectorStoreUnavailable(RuntimeError):
    pass


OUTPUT_FIELDS = [
    "id",
    "content",
    "content_id",
    "document_id",
    "source_type",
    "is_public",
    "org_unit_ids",
    "content_version",
    "embedding_model",
    "title",
    "heading",
    "attachment_id",
]


class VectorStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: MilvusClient | None = None

    def connect(self) -> MilvusClient:
        if self._client is not None:
            return self._client
        try:
            client = MilvusClient(
                uri=self.settings.milvus_uri,
                token=self.settings.milvus_token or None,
                timeout=self.settings.request_timeout_seconds,
            )
            self._client = client
            self._ensure_collection()
            return client
        except Exception as exc:
            self._client = None
            raise VectorStoreUnavailable("Milvus 连接或 collection 初始化失败") from exc

    def _ensure_collection(self) -> None:
        client = self._client
        if client is None:
            raise VectorStoreUnavailable("Milvus 尚未连接")
        name = self.settings.milvus_collection
        if client.has_collection(name):
            description = client.describe_collection(collection_name=name)
            fields = {field["name"]: field for field in description.get("fields", [])}
            missing = set(OUTPUT_FIELDS + ["vector"]) - set(fields)
            if missing:
                raise VectorStoreUnavailable(
                    f"现有 Milvus collection 缺少字段: {', '.join(sorted(missing))}"
                )
            vector_params = fields["vector"].get("params", {})
            existing_dim = int(vector_params.get("dim", self.settings.embedding_dimension))
            if existing_dim != self.settings.embedding_dimension:
                raise VectorStoreUnavailable(
                    "现有 Milvus collection 向量维度与 EMBEDDING_DIMENSION 不一致"
                )
            return

        schema = MilvusClient.create_schema(auto_id=False, enable_dynamic_field=False)
        schema.add_field("id", DataType.VARCHAR, is_primary=True, max_length=192)
        schema.add_field("vector", DataType.FLOAT_VECTOR, dim=self.settings.embedding_dimension)
        schema.add_field("content", DataType.VARCHAR, max_length=8192)
        schema.add_field("content_id", DataType.VARCHAR, max_length=128)
        schema.add_field("document_id", DataType.VARCHAR, max_length=128)
        schema.add_field("source_type", DataType.VARCHAR, max_length=32)
        schema.add_field("is_public", DataType.BOOL)
        schema.add_field(
            "org_unit_ids",
            DataType.ARRAY,
            element_type=DataType.VARCHAR,
            max_capacity=256,
            max_length=128,
        )
        schema.add_field("content_version", DataType.VARCHAR, max_length=64)
        schema.add_field("embedding_model", DataType.VARCHAR, max_length=128)
        schema.add_field("title", DataType.VARCHAR, max_length=512)
        schema.add_field("heading", DataType.VARCHAR, max_length=512)
        schema.add_field("attachment_id", DataType.VARCHAR, max_length=128)

        index = client.prepare_index_params()
        index.add_index(
            field_name="vector",
            index_name="vector_cosine_hnsw",
            index_type="HNSW",
            metric_type="COSINE",
            params={"M": 16, "efConstruction": 200},
        )
        client.create_collection(collection_name=name, schema=schema, index_params=index)

    def health(self) -> bool:
        try:
            self.connect().list_collections()
            return True
        except VectorStoreUnavailable:
            return False
        except Exception:
            return False

    def upsert(self, rows: list[dict[str, Any]], document_ids: list[str]) -> int:
        try:
            client = self.connect()
            self.delete(document_ids=document_ids)
            if rows:
                client.insert(collection_name=self.settings.milvus_collection, data=rows)
            return len(rows)
        except VectorStoreUnavailable:
            raise
        except Exception as exc:
            raise VectorStoreUnavailable("Milvus 写入失败") from exc

    def delete(
        self, *, content_ids: list[str] | None = None, document_ids: list[str] | None = None
    ) -> int:
        clauses: list[str] = []
        if content_ids:
            clauses.append(f"content_id in {json.dumps(content_ids, ensure_ascii=False)}")
        if document_ids:
            clauses.append(f"document_id in {json.dumps(document_ids, ensure_ascii=False)}")
        if not clauses:
            return 0
        try:
            result = self.connect().delete(
                collection_name=self.settings.milvus_collection,
                filter=" or ".join(f"({clause})" for clause in clauses),
            )
            return int(result.get("delete_count", 0))
        except VectorStoreUnavailable:
            raise
        except Exception as exc:
            raise VectorStoreUnavailable("Milvus 删除失败") from exc

    def search(
        self,
        vector: list[float],
        allowed_content_ids: list[str],
        top_k: int,
        score_threshold: float | None,
    ) -> list[dict[str, Any]]:
        if not allowed_content_ids:
            return []
        expression = f"content_id in {json.dumps(allowed_content_ids, ensure_ascii=False)}"
        try:
            result = self.connect().search(
                collection_name=self.settings.milvus_collection,
                data=[vector],
                anns_field="vector",
                filter=expression,
                limit=top_k,
                output_fields=OUTPUT_FIELDS,
                search_params={"metric_type": "COSINE", "params": {"ef": max(64, top_k * 4)}},
            )
        except VectorStoreUnavailable:
            raise
        except Exception as exc:
            raise VectorStoreUnavailable("Milvus 检索失败") from exc

        hits: list[dict[str, Any]] = []
        for hit in result[0] if result else []:
            score = float(hit.get("distance", 0))
            if score_threshold is not None and score < score_threshold:
                continue
            entity = dict(hit.get("entity") or {})
            entity["id"] = hit.get("id", entity.get("id"))
            entity["score"] = score
            hits.append(entity)
        return hits
