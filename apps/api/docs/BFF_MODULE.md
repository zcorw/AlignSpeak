# AlignSpeak 前端聚合（BFF）模块说明（MVP 基线）

## 1. 目标与范围
BFF（Backend For Frontend）用于为前端页面提供“页面级聚合接口”，减少前端多次请求和拼装复杂度。

MVP 包含：
- 页面级聚合端点（home/practice/me/progress）
- 统一错误结构
- 统一鉴权与用户上下文传递
- 基础降级能力与链路观测

## 2. 核心决策（默认推荐 + 已确认）
1. 采用 BFF 聚合层
2. 部署方式：挂在现有 API 服务内（路由分组）
3. 聚合模式：页面级端点，不由前端自行拼多模块接口
4. 首页策略：仅聚合文章创建相关信息，不聚合进度指标
5. 练习页：一次返回 `practice-bundle`
6. 我的页：一次返回 `me-summary`
7. 字段风格：下游 `snake_case`，BFF 转 `camelCase`
8. 错误处理：BFF 统一错误码与文案
9. 缓存：只读聚合接口短缓存（5-30 秒）
10. 鉴权：BFF 统一鉴权并向下游传递 `user_id/context`
11. 降级：局部失败可降级返回（附 `warnings`）
12. 版本：`/api/bff/v1/*`
13. Mock 契约：前端 mock 与 BFF 契约保持一致
14. 性能目标：聚合接口 P95 < 300ms
15. 观测：记录请求链路与下游耗时分解

## 3. 端点设计（MVP）
### 3.1 首页（文章创建优先）
`GET /api/bff/v1/home`

说明：
- 返回文章创建草稿、目标语言、快捷入口
- 不返回进度 KPI

### 3.2 练习页聚合
`GET /api/bff/v1/practice?docId=...&segmentId=...`

返回：
- 段落信息
- 遮挡 plan
- 最近识别结果（如有）
- 练习操作所需状态

### 3.3 进度页聚合（可选独立页）
`GET /api/bff/v1/progress`

返回：
- summary
- hotwords

### 3.4 我的页聚合
`GET /api/bff/v1/me`

返回：
- 账号信息
- 进度摘要
- 历史文档列表

## 4. 响应示例
### 4.1 `GET /api/bff/v1/me`
```json
{
  "email": "you@example.com",
  "streakDays": 5,
  "progress": {
    "overallAccuracy30d": 0.88,
    "currentLevel": 3
  },
  "historyDocs": [
    {
      "id": "doc-ja",
      "title": "枕草子（春は、あけぼの）",
      "lastPracticedAt": "2026-03-03T09:40:00Z",
      "level": 2,
      "progressRate": 0.60
    }
  ],
  "warnings": []
}
```

## 5. 聚合执行逻辑
1. BFF 统一鉴权，解析当前用户。
2. 并行调用下游模块（auth/article/practice/progress/masking）。
3. 进行字段映射（snake_case -> camelCase）。
4. 组装页面 DTO（只暴露前端需要字段）。
5. 下游部分失败时返回可降级数据 + `warnings`。

## 6. 错误与降级策略
### 6.1 统一错误结构
```json
{
  "error": {
    "code": "BFF_UPSTREAM_ERROR",
    "message": "服务暂时不可用"
  }
}
```

### 6.2 降级返回
当非核心下游失败时：
- 返回核心数据
- `warnings` 填充失败模块信息

示例：
```json
{
  "data": { "...": "..." },
  "warnings": [
    {
      "source": "hotwords",
      "code": "UPSTREAM_TIMEOUT",
      "message": "错词热区暂不可用"
    }
  ]
}
```

## 7. 缓存策略
- 仅针对只读聚合 GET 接口
- 缓存 key：`route + user_id + query`
- TTL：5-30 秒
- 强一致需求接口（如刚提交练习后）可带 `no_cache=true`

## 8. 安全与权限
- BFF 为鉴权入口，禁止匿名访问私有页面端点
- 所有下游请求携带 `user_id` 上下文，防止跨用户读写
- 日志脱敏，不记录完整 token

## 9. 性能与可观测性
### 9.1 性能目标
- BFF 聚合接口 P95 < 300ms

### 9.2 观测指标
- `bff_request_latency_ms`
- `bff_upstream_latency_ms{service=...}`
- `bff_error_rate`
- `bff_degraded_response_rate`

### 9.3 链路日志
建议记录：
- `request_id`
- `user_id`（脱敏可选）
- 下游调用列表与各自耗时
- 最终状态（ok/degraded/error）

## 10. 与现有前端 mock 的对齐
当前前端已有以下 mock 结构：
- `/api/home-summary`
- `/api/practice-bundle`
- `/api/progress-summary`
- `/api/me-summary`

建议迁移路径：
1. 保持现有 mock 可用
2. 新增 `/api/bff/v1/*` 并让旧路径逐步指向新聚合实现
3. 最终以前端页面只调用 BFF 端点为准
