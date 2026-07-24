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
- `LLM_BASE_URL`、`LLM_API_KEY`：可选的大模型服务配置

`docker-compose.yml` 只启动 PostgreSQL 16；应用仍通过 npm 在宿主机运行。历史 SQLite 文件不会被读取、迁移或删除。

## 数据库迁移

迁移定义在 `api/db.ts`，便于随 Vercel Serverless 包一起发布。初始化使用 PostgreSQL advisory lock 和 `schema_migrations` 表，支持并发冷启动与重复启动。新增 schema 变更时应追加新版本，不能修改已经发布的 migration。
