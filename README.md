# AlignSpeak

[中文](README.md) | [English](README.en.md)

AlignSpeak 是一个 AI 辅助的朗读与口语练习项目。

## 项目结构

- `apps/web_v2`: 前端（React + Vite）
- `apps/api`: 后端（FastAPI）
- `deploy/production`: 生产部署相关文件

## 本地快速启动

1. 准备后端环境变量文件：

```powershell
Copy-Item apps/api/.env.secrets.example apps/api/.env.secrets
```

2. 编辑 `apps/api/.env.secrets`，至少填写：
`JWT_SECRET`、`POSTGRES_PASSWORD`、`DATABASE_URL`、`OPENAI_API_KEY`。

3. 启动全部服务：

```powershell
docker compose up -d --build
```

4. 访问地址：

- 前端：`http://localhost/`
- API 健康检查：`http://localhost/api/health`
- 数据库管理（可选）：`http://127.0.0.1:18080`

## 常用命令

```powershell
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f web
docker compose logs -f api

# 停止服务
docker compose down
```

## 更多文档

- `OVERVIEW.md`
- `ARCHITECTURE.md`
- `deploy/production/README.md`
