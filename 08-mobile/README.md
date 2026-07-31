# 数智党校 · 移动端（独立前端）

与 PC 端 `../08` **相互独立**的移动端网页，共用同一套后端 API。

## 启动

先启动 PC 项目后端（API `:3001` + 数据库）：

```bash
cd ../08
npm run db:up
npm run server:dev
```

再启动本移动端：

```bash
cd ../08-mobile
npm install
npm run dev
```

访问：http://localhost:5174/

## 账号

与 PC 端相同：`member/member123`、`secretary/secretary123`  
管理员请使用 PC 端（本端会提示前往 PC）。

## 说明

- 端口：`5174`
- 鉴权本地键：`party_school_mobile_auth`（与 PC 端登录态隔离）
- 底部 Tab：党员（学习/测验/错题/报告/我的）；书记（看板/学习/测验/成绩/我的）
