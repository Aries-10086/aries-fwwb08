# 党员学习与考试平台

React + Vite 前端、Express API 和 PostgreSQL 数据库组成的本地全栈项目。

## 环境要求

- Node.js 20+
- npm
- Docker Desktop（用于本地 PostgreSQL）

## 本地启动

```bash
npm install
cp .env.example .env
npm run db:up
npm run dev
```

启动后访问：

- 前端：http://localhost:5173
- API：http://localhost:3001/api
- 健康检查：http://localhost:3001/api/health

应用启动时会等待数据库迁移完成；空数据库会在同一初始化流程中自动写入演示数据。

## 演示账号

- 管理员：`admin` / `admin123`
- 支部书记：`secretary` / `secretary123`
- 党员：`member` / `member123`

演示密码仅用于本地开发，请勿用于生产环境。

## 常用命令

```bash
npm run dev          # 同时启动前端和 API
npm run client:dev   # 仅启动前端
npm run server:dev   # 仅启动 API
npm run check        # TypeScript 类型检查
npm run build        # 构建前端

npm run db:up        # 启动并等待 PostgreSQL 健康
npm run db:down      # 停止 PostgreSQL（保留命名卷数据）
npm run db:logs      # 跟踪 PostgreSQL 日志
npm run db:restart   # 重启 PostgreSQL
```

如需清空本地 PostgreSQL 数据，可手动运行 `docker compose down -v`。此命令会删除命名卷，不应在需要保留数据时使用。

## 配置

复制 `.env.example` 后按需修改 `.env`。主要变量：

- `DATABASE_URL`：PostgreSQL 连接串
- `DATABASE_SSL=1`：托管数据库要求 SSL 时启用
- `DB_POOL_MAX`：连接池上限
- `AUTH_SECRET`：登录令牌密钥，生产环境必须替换
- `CORS_ORIGIN`：允许的前端来源，多个值用逗号分隔
- `AI_SERVICE_URL`、`AI_INTERNAL_API_KEY`：Node 调用 Python AI 服务的地址和内部密钥
- `LLM_MODEL`、`LLM_TIMEOUT_MS`：模型标识和 Node 调用超时
- `AI_RATE_LIMIT_*`、`CHAT_RATE_LIMIT_*`：按登录用户的 AI 请求限流
- `LLM_BASE_URL`、`LLM_API_KEY`：未配置 Python 服务时，`/text` 能力使用的 OpenAI-compatible 后备配置
- 聊天 / 向量模型的地址、名称与 API Key 也可在管理端「AI 设置」页面维护（数据库加密存储，优先于环境变量）

默认 `docker compose up` 只启动 PostgreSQL 16，不会拉起模型或向量服务。需要本地知识库和
AI 服务时，先在 `.env` 配好模型密钥，再运行：

```bash
docker compose --profile ai up -d
```

该 profile 会额外启动 Python AI 服务、Milvus、etcd 和 MinIO。宿主机 Node 使用
`AI_SERVICE_URL=http://localhost:8000`；容器间内部请求使用 `X-Internal-API-Key`。

## AI 与知识库接口

- `GET /api/ai/settings`、`PUT /api/ai/settings`、`POST /api/ai/settings/test`：
  管理员配置与测试聊天 / 向量模型
- `POST /api/ai/wrong-explain`：仅讲解当前用户实际答错的题
- `POST /api/ai/exam-feedback`：基于服务端聚合成绩生成反馈
- `POST /api/ai/content-summary`：为当前用户可见内容生成结构化导读
- `/api/chat/sessions`：用户隔离、历史持久化的 SSE 对话
- `GET /api/kb/documents`、`POST /api/kb/reindex/:contentId`、`GET /api/kb/jobs/:id`：
  管理员知识库状态与重建接口

模型调用只在 `llm_calls` 记录 prompt 哈希、模型、usage、耗时和错误码，不保存完整 prompt；
结构化结果使用带版本和过期时间的 `ai_cache`。内容新增、修改和删除会创建 best-effort
索引任务，失败状态可通过管理员接口查看并重试。

## 数据库迁移

迁移定义在 `api/db.ts`，便于随 Vercel Serverless 包一起发布。初始化使用 PostgreSQL advisory lock 和 `schema_migrations` 表，支持并发冷启动与重复启动。新增 schema 变更时应追加新版本，不能修改已经发布的 migration。
