# AlignSpeak 标准朗读（TTS）模块说明（MVP 基线）

## 1. 目标与范围
本模块用于为练习段落生成标准朗读音频，并提供异步任务状态查询与音频资源获取能力。

MVP 包含：
- 按段落发起 TTS 生成
- 异步任务（`job_id`）查询
- 音频本地存储与读取
- 基础缓存复用

MVP 不包含：
- 全文一键 TTS
- 预签名 URL
- 成本配额控制

## 2. 核心决策
### 2.1 你已确认
- 仅按段落生成（不做全文）
- 缓存键：仅 `segment_id`
- 生成接口返回异步 `job_id`
- 存储方式：本地文件存储
- 预签名 URL：暂不做
- 成本控制：暂不做

### 2.2 其余采用默认值
- 触发方式：手动触发生成
- 音色：单默认音色
- 语速：可调（`0.8 ~ 1.2`）
- 输出格式：`mp3`
- 失败重试：服务端自动重试（最多 2 次）
- 访问控制：仅资源所有者可访问
- 监控：纳入 MVP（成功率、耗时、缓存命中）
- 语言支持：`ja/en/zh` 首期可用

## 3. 处理流程（MVP）
1. 前端在段落练习页发起生成请求（携带 `segment_id`）。
2. 服务端创建任务并返回 `job_id`。
3. Worker/后台任务调用 TTS 提供方生成音频。
4. 生成成功后写入本地存储，并记录 `tts_assets`。
5. 前端轮询任务状态，成功后拿到 `audio_url` 进行播放。

## 4. API 契约（MVP）
### 4.1 创建段落 TTS 任务
`POST /articles/{article_id}/tts-jobs`

Request:
```json
{
  "segment_id": "seg_xxx",
  "speed": 1.0
}
```

Response `202`:
```json
{
  "job_id": "tts_job_xxx",
  "status": "queued"
}
```

说明：
- `segment_id` 必填（当前模块只支持段落）
- 若命中缓存，可直接返回已完成任务态（实现可选）

### 4.2 查询 TTS 任务状态
`GET /tts-jobs/{job_id}`

Response `200`（进行中）:
```json
{
  "job_id": "tts_job_xxx",
  "status": "processing"
}
```

Response `200`（成功）:
```json
{
  "job_id": "tts_job_xxx",
  "status": "done",
  "audio_url": "/media/tts/seg_xxx.mp3",
  "cached": false
}
```

Response `200`（失败）:
```json
{
  "job_id": "tts_job_xxx",
  "status": "failed",
  "error_code": "TTS_PROVIDER_ERROR"
}
```

### 4.3 获取段落可用 TTS 资源（可选便捷接口）
`GET /segments/{segment_id}/tts`

Response `200`:
```json
{
  "segment_id": "seg_xxx",
  "audio_url": "/media/tts/seg_xxx.mp3",
  "voice": "default",
  "speed": 1.0
}
```

## 5. 缓存与一致性
- 缓存命中规则：按 `segment_id` 唯一命中
- 由于文章模块为“创建后只读”，`segment_id` 缓存可稳定复用
- 若后续开放编辑，缓存键需升级为 `segment_id + text_hash (+voice+speed)`

## 6. 数据落库建议
可复用 `tts_assets` 表，核心字段：
- `segment_id`
- `voice`（默认值 `default`）
- `speed`
- `audio_url`
- `created_at`

## 7. 错误码建议
- `VALIDATION_ERROR`：参数不合法
- `SEGMENT_NOT_FOUND`：段落不存在
- `TTS_JOB_NOT_FOUND`：任务不存在
- `TTS_PROVIDER_ERROR`：TTS 供应方失败
- `TTS_TIMEOUT`：任务超时
- `FORBIDDEN`：越权访问

## 8. 安全与权限
- 所有接口需鉴权
- 仅段落所属用户可触发与读取 TTS 资源
- 本地音频文件访问应通过应用层鉴权路由转发，不直接暴露目录列表

## 9. 监控指标（MVP）
- 任务成功率
- 平均生成时延（P50/P95）
- 缓存命中率
- 失败原因分布（provider/timeout/validation）
