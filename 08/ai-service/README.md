# 党校 AI 内部服务

独立 FastAPI 服务，供已经完成登录、权限判断和审计的 Node 服务调用。它负责国产
OpenAI-compatible 模型调用、文档解析分块、Milvus 索引/检索和受限工具对话。

## 安全边界

- 除 `GET /health` 外，所有接口都必须携带 `X-Internal-API-Key`。
- 没有上传接口；文件只能由 Node 在鉴权后通过 `/internal/index` 传入。
- Python 不推导用户权限。Node 必须传入完整的 `allowed_content_ids`，Python 将其作为
  Milvus 强制过滤条件；空列表表示无权检索任何内容。
- 模型不能指定工具 URL。可调用工具只来自服务端 `INTERNAL_TOOLS_JSON` 白名单，禁用重定向，
  且不读取系统代理。工具密钥不会进入模型上下文。
- 工具循环最多执行 `MAX_TOOL_ROUNDS` 轮，不支持 SQL 或写操作工具。Node 仍须复核 citations。
- 不要把用户令牌、密码、模型密钥或无关个人信息放进 messages/tool results。

## 配置与运行

复制 `.env.example` 为 `.env` 并填写密钥。聊天和 embedding 可配置为不同的国产
OpenAI-compatible 地址与模型。`EMBEDDING_DIMENSION` 创建 collection 后不可直接修改；
需要新建 collection 或迁移数据。

```bash
docker compose -f docker-compose.milvus.yml up -d
uvicorn ai_service.main:app --host 127.0.0.1 --port 8000
```

这里只给出运行命令；仓库不会自动启动 Milvus 或服务。Attu 为可选工具：
`docker compose -f docker-compose.milvus.yml --profile tools up -d`。生产环境不要直接暴露
Milvus、Attu 或 AI 服务到公网。

## API 契约

### `GET /health`

无需鉴权，返回 `ok` 或 `degraded`，以及聊天模型配置、embedding 配置和 Milvus 状态。
这是就绪状态汇总，不会实际调用收费模型。

### `POST /text`

Node 通用文案接口。`purpose` 可为 `general_copy`、`wrong_answer_explanation`、
`study_advice`、`content_summary`。`response_format=json` 时必须提供 JSON Schema。

```json
{
  "purpose": "content_summary",
  "messages": [{"role": "user", "content": "请摘要以下内容……"}],
  "response_format": "json",
  "json_schema": {
    "type": "object",
    "properties": {"summary": {"type": "string"}},
    "required": ["summary"],
    "additionalProperties": false
  }
}
```

返回 `{"data": ..., "meta": {"model": "...", "usage": ..., "purpose": "..."}}`。

### `POST /internal/index`

`operation=upsert` 时传 `documents`。Markdown/TXT 可传 `text` 或 Base64；PDF/DOCX 必须传
`content_base64`。每个文档最大 10 MiB，支持 `.md/.markdown/.txt/.pdf/.docx`。

```json
{
  "operation": "upsert",
  "documents": [{
    "content_id": "article-1",
    "document_id": "article-1-body",
    "source_type": "article",
    "is_public": false,
    "org_unit_ids": ["branch-1"],
    "content_version": "7",
    "title": "示例文章",
    "heading": "",
    "attachment_id": "",
    "filename": "article.md",
    "text": "# 标题\n正文"
  }]
}
```

同一 `document_id` 先删除旧分块再写入。`operation=delete` 时传 `content_ids` 和/或
`document_ids`。返回文档数、分块数或删除数。

### `POST /internal/search`

```json
{
  "query": "如何理解相关知识点？",
  "allowed_content_ids": ["article-1", "attachment-2"],
  "top_k": 5,
  "score_threshold": 0.35
}
```

返回 `citations`（含 chunk/content/document/source/title/heading/attachment/version/score/
excerpt）和 `retrievalMeta`（query/topK/returned/allowedContentCount/embeddingModel/durationMs）。
相似度使用 COSINE，分数越高越相似。

### `POST /internal/chat/stream`

请求体：

```json
{
  "messages": [{"role": "user", "content": "这篇资料讲了什么？"}],
  "allowed_content_ids": ["article-1"],
  "top_k": 5,
  "tool_results": [
    {"call_id": null, "name": "my_progress", "result": {"completed": 3}}
  ]
}
```

响应为 SSE，事件类型包括：

- `tool_call`：`start/end`、调用 ID、名称和参数；
- `citations`：知识检索结果和本次 retrievalMeta；
- `content`：回答文本增量；
- `done`：完整回答、去重 citations 和工具调用摘要；
- `error`：`MODEL_UNAVAILABLE`、`VECTOR_STORE_UNAVAILABLE` 或 `INTERNAL_ERROR`。

每个 SSE 的 `data` 都是 `{"type":"事件名","data":...}` JSON。Node 可传预先执行的
`tool_results`；匹配优先级为 `call_id`，无 ID 时按工具名消费一次。

内网工具配置示例（实际应作为单行 JSON 环境变量）：

```json
[{
  "name": "my_progress",
  "description": "查询当前用户学习进度，只读",
  "url": "http://node.internal:3000/internal/ai-tools/my-progress",
  "timeout_seconds": 8,
  "auth_header": "X-Tool-Key",
  "auth_token": "replace-me",
  "parameters": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}]
```

## Milvus collection

`id` 为分块稳定哈希主键；`vector` 为 FLOAT_VECTOR；其余字段为 `content`、`content_id`、
`document_id`、`source_type`、`is_public`、`org_unit_ids`（VARCHAR ARRAY）、
`content_version`、`embedding_model`、`title`、`heading`、`attachment_id`。
向量索引为 HNSW + COSINE。

## 错误

模型配置、连接、超时或上游状态错误返回 HTTP 503 + `MODEL_UNAVAILABLE`；Milvus 失败返回
HTTP 503 + `VECTOR_STORE_UNAVAILABLE`。流开始后的失败使用同名 SSE `error` 事件，不用固定
文案伪装模型结果。请求校验错误为 422，文档解析/业务限制错误为 400。

## 测试

```bash
pytest
```

测试不连接模型或 Milvus，覆盖 Markdown/文本分块边界与 SSE 序列化格式。
