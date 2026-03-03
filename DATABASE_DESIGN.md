# AlignSpeak 数据库设计（MVP）

## 1. 设计目标
- 支持账号体系（注册、登录、登出）
- 支持文章与段落练习
- 支持遮挡计划（Level 0-4）
- 支持录音识别结果与对齐明细存档
- 支持个人进度与历史文档列表

数据库建议：`PostgreSQL 15+`

## 2. 说明：当前不启用 `refresh_tokens`
当前项目需求较轻，MVP 阶段不创建 `refresh_tokens` 表。

当前会话策略建议：
- 仅使用短周期 `access_token`
- 过期后要求重新登录

后续若需要“多端会话管理、token 轮换、精准撤销”，再新增 `refresh_tokens` 表。

## 3. ER 关系（文本版）
1. `users` 1:N `articles`
2. `articles` 1:N `article_segments`
3. `article_segments` 1:N `segment_tokens`
4. `article_segments` 1:N `tts_assets`
5. `users` 1:N `practice_attempts`
6. `article_segments` 1:N `practice_attempts`
7. `practice_attempts` 1:1 `attempt_recognition`
8. `practice_attempts` 1:N `attempt_compare_blocks`
9. `attempt_compare_blocks` 1:N `attempt_compare_tokens`
10. `practice_attempts` 1:N `attempt_noise_spans`
11. `users` + `article_segments` 1:1 `segment_progress`
12. `users` + `article_segments` 1:N `mask_plans`

## 4. 表结构与字段说明

### 4.1 `users`
用户主表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 用户ID，如 `usr_xxx` |
| email | varchar(255) | UNIQUE, NOT NULL | 登录邮箱（统一小写） |
| password_hash | varchar(255) | NOT NULL | 密码哈希（Argon2id/bcrypt） |
| display_name | varchar(80) | NOT NULL | 显示名 |
| role | varchar(16) | NOT NULL, default `user` | 角色：`user/admin` |
| status | varchar(16) | NOT NULL, default `active` | 状态：`active/disabled` |
| token_version | int | NOT NULL, default 1 | 令牌失效版本号（可选） |
| last_login_at | timestamptz | NULL | 最近登录时间 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |

索引建议：
- `idx_users_status`(`status`)

### 4.2 `articles`
用户文章主表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 文章ID，如 `art_xxx` |
| user_id | varchar(32) | FK -> users.id, NOT NULL | 所属用户 |
| title | varchar(200) | NOT NULL | 标题 |
| language | varchar(8) | NOT NULL | 语言：`ja/en/zh` |
| raw_text | text | NOT NULL | 原始全文 |
| normalized_text | text | NOT NULL | 规范化全文 |
| source_type | varchar(24) | NOT NULL, default `manual` | 来源：`manual/upload/ocr` |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |

索引建议：
- `idx_articles_user_id_created_at`(`user_id`, `created_at` desc)

### 4.3 `article_segments`
文章段落表（练习最小业务单元）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 段落ID，如 `seg_xxx` |
| article_id | varchar(32) | FK -> articles.id, NOT NULL | 所属文章 |
| segment_order | int | NOT NULL | 段落顺序（从1开始） |
| plain_text | text | NOT NULL | 段落原文 |
| normalized_text | text | NOT NULL | 规范化段落文本 |
| token_count | int | NOT NULL, default 0 | token 数 |
| created_at | timestamptz | NOT NULL | 创建时间 |

约束建议：
- UNIQUE(`article_id`, `segment_order`)

索引建议：
- `idx_segments_article_order`(`article_id`, `segment_order`)

### 4.4 `segment_tokens`
段落 token 明细（支持 `surface/yomi`）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | bigserial | PK | 自增ID |
| segment_id | varchar(32) | FK -> article_segments.id, NOT NULL | 所属段落 |
| token_order | int | NOT NULL | token 顺序（0-based） |
| surface | varchar(128) | NOT NULL | 展示文本 |
| yomi | varchar(128) | NULL | 读音（用于日语对齐） |
| pos | varchar(32) | NULL | 词性 |
| char_start | int | NOT NULL | 起始字符偏移 |
| char_end | int | NOT NULL | 结束字符偏移（开区间） |
| is_maskable | boolean | NOT NULL, default true | 是否可遮挡 |

约束建议：
- UNIQUE(`segment_id`, `token_order`)

索引建议：
- `idx_segment_tokens_segment_order`(`segment_id`, `token_order`)

### 4.5 `tts_assets`
标准音频资源表（按段落缓存）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 资源ID，如 `tts_xxx` |
| segment_id | varchar(32) | FK -> article_segments.id, NOT NULL | 所属段落 |
| voice | varchar(64) | NOT NULL | 音色 |
| speed | numeric(4,2) | NOT NULL, default 1.00 | 语速 |
| audio_url | text | NOT NULL | 音频地址 |
| duration_ms | int | NULL | 时长 |
| text_hash | varchar(64) | NOT NULL | 文本哈希（去重） |
| created_at | timestamptz | NOT NULL | 创建时间 |

约束建议：
- UNIQUE(`segment_id`, `voice`, `speed`, `text_hash`)

### 4.6 `mask_plans`
遮挡计划（可复盘每次级别与遮挡位点）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 计划ID，如 `msk_xxx` |
| user_id | varchar(32) | FK -> users.id, NOT NULL | 所属用户 |
| segment_id | varchar(32) | FK -> article_segments.id, NOT NULL | 所属段落 |
| level | smallint | NOT NULL | 遮挡等级（0-4） |
| mask_ratio | numeric(4,3) | NOT NULL | 遮挡比例 |
| masked_token_indices | jsonb | NOT NULL | 遮挡下标数组（升序去重） |
| strategy | varchar(32) | NOT NULL, default `rule` | 策略：`rule/ai` |
| created_at | timestamptz | NOT NULL | 创建时间 |

约束建议：
- CHECK(`level` between 0 and 4)

索引建议：
- `idx_mask_plans_user_segment_created`(`user_id`, `segment_id`, `created_at` desc)

### 4.7 `practice_attempts`
练习尝试主表（一次录音提交一条）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 尝试ID，如 `att_xxx` |
| user_id | varchar(32) | FK -> users.id, NOT NULL | 所属用户 |
| article_id | varchar(32) | FK -> articles.id, NOT NULL | 所属文章 |
| segment_id | varchar(32) | FK -> article_segments.id, NOT NULL | 所属段落 |
| mask_plan_id | varchar(32) | FK -> mask_plans.id, NULL | 本次使用遮挡计划 |
| audio_url | text | NULL | 录音地址 |
| started_at | timestamptz | NULL | 录音开始时间 |
| finished_at | timestamptz | NULL | 录音结束时间 |
| submitted_at | timestamptz | NOT NULL | 提交识别时间 |
| alignment_mode | varchar(16) | NOT NULL, default `yomi` | 对齐模式：`yomi/surface` |
| accuracy_rate | numeric(5,2) | NULL | 本次准确率 |
| status | varchar(16) | NOT NULL, default `done` | 状态：`done/failed` |

索引建议：
- `idx_attempts_user_submitted_at`(`user_id`, `submitted_at` desc)
- `idx_attempts_segment_submitted_at`(`segment_id`, `submitted_at` desc)

### 4.8 `attempt_recognition`
识别结果原文表（1:1）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| attempt_id | varchar(32) | PK, FK -> practice_attempts.id | 所属尝试 |
| recognized_text | text | NOT NULL | STT 输出全文 |
| stt_provider | varchar(32) | NULL | STT服务商 |
| stt_model | varchar(64) | NULL | STT模型 |
| confidence | numeric(5,4) | NULL | 置信度（可选） |
| raw_payload | jsonb | NULL | 原始识别返回（可选） |
| created_at | timestamptz | NOT NULL | 创建时间 |

### 4.9 `attempt_compare_blocks`
用于前端“行对行对比”的块级结构。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | varchar(32) | PK | 对比块ID，如 `blk_xxx` |
| attempt_id | varchar(32) | FK -> practice_attempts.id, NOT NULL | 所属尝试 |
| block_order | int | NOT NULL | 块顺序 |
| created_at | timestamptz | NOT NULL | 创建时间 |

约束建议：
- UNIQUE(`attempt_id`, `block_order`)

### 4.10 `attempt_compare_tokens`
对比 token 明细（原文侧/识别侧）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | bigserial | PK | 自增ID |
| block_id | varchar(32) | FK -> attempt_compare_blocks.id, NOT NULL | 所属块 |
| side | varchar(8) | NOT NULL | 侧别：`ref/rec` |
| token_order | int | NOT NULL | 当前侧顺序 |
| text | varchar(128) | NOT NULL | token 文本 |
| diff_kind | varchar(16) | NULL | `correct/missing/insert/substitute` |
| pair_key | int | NULL | 可选，对齐配对键 |

约束建议：
- CHECK(`side` in ('ref','rec'))
- UNIQUE(`block_id`, `side`, `token_order`)

索引建议：
- `idx_compare_tokens_block_side`(`block_id`, `side`)

### 4.11 `attempt_noise_spans`
噪声片段标记（可折叠显示）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | bigserial | PK | 自增ID |
| attempt_id | varchar(32) | FK -> practice_attempts.id, NOT NULL | 所属尝试 |
| start_token | int | NOT NULL | 起始token下标（含） |
| end_token | int | NOT NULL | 结束token下标（不含） |
| reason | varchar(64) | NOT NULL | 原因，如 `repeat` |

约束建议：
- CHECK(`end_token` > `start_token`)

### 4.12 `segment_progress`
用户维度段落进度快照（用于首页/我的/进度页快速查询）。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| user_id | varchar(32) | PK(1/2), FK -> users.id | 用户ID |
| segment_id | varchar(32) | PK(2/2), FK -> article_segments.id | 段落ID |
| last_attempt_id | varchar(32) | FK -> practice_attempts.id, NULL | 最近尝试 |
| attempt_count | int | NOT NULL, default 0 | 尝试次数 |
| best_accuracy | numeric(5,2) | NOT NULL, default 0 | 最佳准确率 |
| current_level | smallint | NOT NULL, default 0 | 当前建议遮挡等级 |
| progress_rate | numeric(5,2) | NOT NULL, default 0 | 进度百分比 |
| updated_at | timestamptz | NOT NULL | 更新时间 |

约束建议：
- CHECK(`current_level` between 0 and 4)

## 5. 表关联性说明（业务视角）
1. 一个用户可创建多篇文章，文章由多个段落组成。
2. 段落 token 化后，支持遮挡计算、TTS缓存、对齐展示。
3. 每次“提交识别”产生一条 `practice_attempts`，并关联识别原文、对比块、对比 token、噪声区间。
4. `mask_plans` 记录“当时遮挡等级与实际遮挡位点”，用于复盘。
5. `segment_progress` 作为汇总层，减少首页与历史列表聚合开销。
6. 所有用户私有业务数据都通过 `user_id`（或可追溯到 `user_id`）进行隔离。

## 6. 一致性与约束建议
- 所有时间字段使用 `timestamptz`（UTC）。
- 外键默认 `ON DELETE RESTRICT`，避免误删主数据。
- 关键枚举值建议使用 CHECK 约束。
- JSON 字段（如 `masked_token_indices`）入库前做 schema 校验。

## 7. MVP 最小建表集
- `users`
- `articles`
- `article_segments`
- `segment_tokens`
- `practice_attempts`
- `attempt_recognition`
- `attempt_compare_blocks`
- `attempt_compare_tokens`
- `segment_progress`

按需补充：
- `mask_plans`
- `attempt_noise_spans`
- `tts_assets`
- `refresh_tokens`（后续会话增强时再启用）

