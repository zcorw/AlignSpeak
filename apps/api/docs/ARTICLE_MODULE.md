# AlignSpeak 文章管理模块说明（MVP 基线）

## 1. 目标与范围
本模块负责文章导入、语言标注、段落切分与文章查询，为后续 TTS/STT/练习流程提供标准化输入。

MVP 包含：
- 粘贴文本导入
- 文本文件导入（`txt`/`md`）
- 图片 OCR 导入（提取文本后入库）
- 文章详情查询（含段落）
- 我的文章列表查询

MVP 不包含：
- 文章在线协作
- 文章全文编辑回写（创建后只读）
- 复杂文档格式（如 `docx/pdf`）原生导入

## 2. 核心决策（已确认）
### 2.1 导入方式
- 支持三种导入：
  - 手动粘贴文本
  - 上传 `txt/md`
  - 上传图片并 OCR 提取文本

### 2.2 语言策略
- 语言由用户显式选择：`ja | en | zh`

### 2.3 切分策略
- 练习最小单元按“段落”切分（`segment`）
- `segment_order` 从 `1` 开始递增

### 2.4 标题与可编辑性
- 标题由用户填写
- 文章创建后只读；如需修改，走“新建文章”流程

### 2.5 推荐默认值（你已采用）
- 创建接口返回：`article_id + segments`
- 单篇最大长度：`20000` 字符（超限返回校验错误）
- 数据可见性：仅作者可见（按 `user_id` 隔离）

## 3. API 契约（MVP）
### 3.1 创建文章（统一入口）
`POST /articles`

支持两种请求体：

1) `application/json`（粘贴文本）
```json
{
  "title": "枕草子（春は、あけぼの）",
  "language": "ja",
  "source_type": "manual",
  "text": "春は、あけぼの。..."
}
```

2) `multipart/form-data`（文件/图片）
- 通用字段：
  - `title`（string）
  - `language`（`ja|en|zh`）
  - `source_type`（`upload|ocr`）
  - `file`（binary）
- 约束：
  - `source_type=upload` 时仅允许 `txt/md`
  - `source_type=ocr` 时仅允许常见图片格式（`png/jpg/jpeg/webp`）

Response `201`：
```json
{
  "article_id": "art_xxx",
  "title": "枕草子（春は、あけぼの）",
  "language": "ja",
  "segments": [
    { "id": "seg_001", "order": 1, "preview": "春は、あけぼの。" },
    { "id": "seg_002", "order": 2, "preview": "やうやう白くなりゆく山ぎは。" }
  ]
}
```

### 3.2 文章详情
`GET /articles/{article_id}`

Response `200`：
```json
{
  "article_id": "art_xxx",
  "title": "枕草子（春は、あけぼの）",
  "language": "ja",
  "source_type": "manual",
  "raw_text": "春は、あけぼの。...",
  "normalized_text": "春は、あけぼの。...",
  "segments": [
    {
      "id": "seg_001",
      "order": 1,
      "plain_text": "春は、あけぼの。",
      "token_count": 3
    }
  ],
  "created_at": "2026-03-02T08:00:00Z"
}
```

### 3.3 我的文章列表
`GET /articles?limit=20&cursor=...`

Response `200`：
```json
{
  "items": [
    {
      "article_id": "art_xxx",
      "title": "枕草子（春は、あけぼの）",
      "language": "ja",
      "segment_count": 3,
      "created_at": "2026-03-02T08:00:00Z"
    }
  ],
  "next_cursor": null
}
```

## 4. 校验与约束
- `title`：必填，建议 1-200 字符
- `language`：必填，`ja|en|zh`
- 内容文本：清洗后非空，且不超过 20000 字符
- 文件导入：仅 `txt/md`
- OCR 导入：仅图片格式，OCR 失败或提取为空返回业务错误

## 5. 权限与隔离
- 所有文章接口必须鉴权（Bearer Token）
- 仅可访问自己的文章（`article.user_id == current_user_id`）
- 跨用户访问统一返回未授权/不存在语义，不暴露资源存在性

## 6. 错误码建议
- `VALIDATION_ERROR`：参数或格式错误
- `ARTICLE_TOO_LONG`：文本超出长度上限
- `UNSUPPORTED_FILE_TYPE`：不支持的文件类型
- `OCR_EMPTY_TEXT`：OCR 未提取到有效文本
- `FORBIDDEN`：无权访问
- `NOT_FOUND`：资源不存在

## 7. 与下游模块的接口约定
- 为 TTS/STT/练习模块提供稳定主键：`article_id`、`segment_id`
- 段落顺序与文本在创建后保持不变（只读策略）
- 分段结果作为后续遮挡与对齐的输入基线
