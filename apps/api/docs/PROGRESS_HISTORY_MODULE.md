# AlignSpeak 进度与历史模块说明（MVP 基线）

## 1. 目标与范围
本模块负责沉淀练习结果，提供用户可见的学习进度、历史文档、错词热区与数据导出能力。

MVP 包含：
- 段落级进度维护与文章级聚合
- 个人页进度摘要与历史列表
- 错词热区统计
- 记录导出（JSON/CSV）

MVP 不包含：
- 首页展示进度 KPI（首页保留给文章创建）
- 社交公开排行榜

## 2. 核心决策（已确认）
1. 统计主粒度：段落主粒度，文章做聚合
2. 更新时间点：每次练习完成后立即更新
3. 展示位置：进度信息不在首页展示，仅在“我的”页面展示
4. “我的”页指标口径：整体指标为主 + 最近练习文章卡片
5. 历史列表排序：最近练习时间倒序
6. 准确率口径：最近一次 + 历史最佳同时保留
7. 错词热区窗口：最近 30 天
8. attempt 明细：全量保留
9. 历史分页：cursor 分页
10. 导出：支持 JSON + CSV
11. 可见范围：用户仅本人可见；管理员可见全量
12. 统计一致性：最终一致（允许短暂延迟）
13. API 最小集：`/progress/summary` + `/me/history-docs` + `/progress/hotwords` + 导出接口

## 3. 数据模型建议
复用或对齐现有表：
- `segment_progress`：段落汇总快照（主读模型）
- `practice_attempts`：尝试主表
- `attempt_compare_tokens`：错词来源
- `articles` / `article_segments`：文章与段落维度

建议关键字段（`segment_progress`）：
- `user_id`
- `segment_id`
- `last_attempt_id`
- `attempt_count`
- `best_accuracy`
- `progress_rate`
- `current_level`
- `updated_at`

## 4. 指标口径定义
### 4.1 整体摘要（我的页面）
- `overall_accuracy_30d`：最近 30 天按段落尝试加权平均
- `current_level`：用户最近活跃段落的建议等级中位数（或平均后取整）
- `streak_days`：连续学习天数

### 4.2 最近文章卡片（我的页面）
- `article_id`
- `title`
- `last_practiced_at`
- `progress_rate`
- `level`

### 4.3 历史列表项
- `id`
- `title`
- `last_practiced_at`
- `level`
- `progress_rate`

### 4.4 准确率口径
- `last_accuracy`：最近一次尝试准确率
- `best_accuracy`：历史最佳准确率

### 4.5 错词热区
- 窗口：最近 30 天
- 统计对象：`missing/insert/substitute`
- 结果：`word + kind + count`

## 5. 更新逻辑（每次练习后）
1. 写入 `practice_attempts` 与对齐明细
2. 计算本次段落 `accuracy_rate`
3. 更新 `segment_progress`：
- `attempt_count += 1`
- `best_accuracy = max(old, current)`
- `last_attempt_id = current_attempt_id`
- `progress_rate` 按规则更新
- `updated_at = now()`
4. 异步更新聚合缓存（用户整体指标、热词统计）

说明：
- 采用最终一致模型，允许短时摘要滞后
- 关键明细以 attempt 表为准

## 6. API 契约（MVP）
### 6.1 个人进度摘要（我的页面）
`GET /progress/summary?window=30d`

Response `200`:
```json
{
  "overall_accuracy_30d": 0.88,
  "current_level": 3,
  "streak_days": 5,
  "recent_article": {
    "article_id": "art_xxx",
    "title": "枕草子（春は、あけぼの）",
    "last_practiced_at": "2026-03-03T09:40:00Z",
    "progress_rate": 0.60,
    "level": 2
  }
}
```

### 6.2 历史文档列表（我的页面）
`GET /me/history-docs?cursor=...&limit=20`

Response `200`:
```json
{
  "items": [
    {
      "id": "art_xxx",
      "title": "枕草子（春は、あけぼの）",
      "last_practiced_at": "2026-03-03T09:40:00Z",
      "level": 2,
      "progress_rate": 0.60,
      "last_accuracy": 0.86,
      "best_accuracy": 0.93
    }
  ],
  "next_cursor": null
}
```

### 6.3 错词热区
`GET /progress/hotwords?window=30d&limit=20`

Response `200`:
```json
{
  "items": [
    { "word": "あけぼの", "kind": "missing", "count": 6 },
    { "word": "なりゆく", "kind": "substitute", "count": 4 }
  ]
}
```

### 6.4 导出学习记录
`GET /progress/export?format=json&date_from=2026-02-01&date_to=2026-03-03`

`GET /progress/export?format=csv&date_from=2026-02-01&date_to=2026-03-03`

Response `200`：
- `application/json` 或 `text/csv`

## 7. 权限与隔离
- 所有接口需鉴权
- 用户仅可访问自己的进度与历史
- 管理员可按管理接口查看全量（与用户侧接口隔离）

## 8. 分页与排序
- 默认 `limit=20`，最大 `limit=100`
- cursor 基于 `(last_practiced_at, article_id)` 复合游标
- 排序：`last_practiced_at desc`

## 9. 错误码建议
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `EXPORT_RANGE_TOO_LARGE`
- `UNSUPPORTED_EXPORT_FORMAT`

## 10. 可观测性
建议监控：
- `progress_summary_latency_ms`
- `history_docs_latency_ms`
- `hotwords_latency_ms`
- `export_request_count`
- `export_fail_rate`

建议日志事件：
- `progress_summary_viewed`
- `history_docs_viewed`
- `hotwords_viewed`
- `progress_export_requested`
