# 数智党校 · 微信小程序

对标 [`../08-mobile`](../08-mobile) 的党员/书记端，使用 **Taro 4 + React + TypeScript**，共用 [`../08`](../08) 后端 API。管理端请继续使用 PC 网页。

## 环境要求

- Node.js 20+
- 微信开发者工具
- 先启动 `08` 的数据库与 API（默认 `http://localhost:3001`）

## 本地启动

```bash
# 1) 启动后端（在 08 目录）
cd ../08
npm run db:up
npm run server:dev

# 2) 安装并编译小程序
cd ../08-miniprogram
npm install
npm run dev:weapp
```

然后打开 **微信开发者工具** → **导入** → 选择本目录 `08-miniprogram`（`project.config.json` 已将 `miniprogramRoot` 指向 `dist/`）。

开发期请在开发者工具中：

- 详情 → 本地设置 → **不校验合法域名、web-view、TLS 版本以及 HTTPS 证书**
- AppID 可用测试号，或保持 `touristappid`

也可从 PC 工程快捷启动：

```bash
cd ../08
npm run miniprogram:dev
```

## 账号

与 PC / 移动端 H5 相同：

- 党员：`member` / `member123`
- 支部书记：`secretary` / `secretary123`
- 管理员登录后会提示使用 PC 端

## 配置

- 开发 API 地址：[`.env.development`](.env.development) 中的 `TARO_APP_API_BASE`
- 生产 API 地址：[`.env.production`](.env.production) 中的 `TARO_APP_API_BASE`（正式环境须为 HTTPS）
- 正式上线前在微信公众平台配置 request / uploadFile / downloadFile 合法域名

本地联调请使用 `http://127.0.0.1:3001`（不要用 `localhost`）。修改 env 后需重新执行 `npm run dev:weapp` 或 `npm run build:weapp`。

## 功能范围

| 角色 | 能力 |
|------|------|
| 党员 | 学习任务、内容详情、测验、错题本、AI 报告、账号/改密 |
| 书记 | 支部看板、成绩、以及党员侧学习/测验 |
| 管理员 | 仅提示前往 PC |

不含：组织/题库/组卷/考试配置等 Admin 功能；不含微信一键登录（一期为账号密码 + Bearer）。
