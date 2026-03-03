# AlignSpeak 练习录音与识别（STT）模块说明（MVP 基线）

## 1. 目标与范围
本模块用于接收移动端麦克风采集音频，完成语音转写，并向下游对齐模块输出标准识别结果。

MVP 包含：
- 录音会话创建
- 分片上传（chunk）
- 结束录音并触发异步识别
- 识别任务查询与结果获取

MVP 不包含：
- 用户手动上传录音文件（脱离麦克风采集流程）
- STT 内部 diff 计算（由对齐模块负责）

## 2. 核心决策（已确认）
### 2.1 录音与上传
- 录音来源：移动端麦克风实时采集
- 上传方式：分片上传（建议每片 1-2 秒）
- 音频格式：固定 `webm/opus`
- 单次录音时长上限：`10 分钟`

### 2.2 识别执行
- 触发方式：录音结束后异步识别
- 返回方式：`job_id` 轮询
- STT 职责边界：仅产出识别结果，不做对齐差异计算

### 2.3 质量与可靠性
- 供应商策略：适配器模式（先接一个供应商，保留可替换能力）
- 文本规范化：后端统一做空白/标点/全半角规范化
- 失败重试：自动重试最多 2 次（仅可重试错误）
- 任务超时：最大处理时长 `120s`

### 2.4 安全与留存
- 权限隔离：仅录音发起用户可上传/结束/查询
- 原始音频保留：`3 天`
- 识别文本保留：长期（用于训练记录）
- 限流：每用户每分钟最多发起 5 次录音会话（MVP 默认）

## 3. 处理流程（MVP）
1. 前端发起录音会话，获得 `recording_id`。
2. 前端按 `seq` 连续上传 `webm/opus` 分片。
3. 前端调用 `finish` 结束会话并触发识别，获得 `job_id`。
4. 后端按 `seq` 合并音频，进入 STT 队列。
5. Worker 调用 ChatGPT STT 模型转写，得到识别文本。
6. 任务完成后写入识别结果并返回给前端。

### 3.1 `finish` 触发后的 STT 详细过程
`POST /practice/recordings/{recording_id}/finish` 被调用后，服务端执行如下步骤：

1. `finish` 幂等检查  
- 若该 `recording_id` 已经进入 `processing/done`，直接返回已有 `job_id`。

2. 分片完整性校验  
- 检查 `seq` 是否连续（`0..total_chunks-1`）。  
- 检查累计时长不超过 10 分钟。  
- 缺片时返回校验错误，要求前端补传后再次 `finish`。

3. 分片合并  
- 按 `seq` 升序读取 `webm/opus` 分片。  
- 合并成单一录音文件（如 `recording_id.webm`）。  
- 将录音会话状态更新为 `uploaded`。

4. 创建识别任务  
- 写入 `stt_job` 记录并置为 `processing`。  
- 将任务投递到异步队列（避免 `finish` 请求超时）。

5. 调用 ChatGPT STT 模型  
- Worker 读取合并后的录音文件。  
- 调用 OpenAI 音频转写接口（模型名通过配置项注入，例如 `STT_MODEL`）。  
- 获取 `recognized_text`（以及可选置信信息/原始响应）。

6. 结果后处理  
- 对文本执行统一规范化（空白、标点、全半角）。  
- 写入识别结果表（如 `attempt_recognition` 或 `stt_result`）。

7. 任务收敛  
- 成功：`job.status = done`，可被 `/stt-jobs/{job_id}` 查询。  
- 失败：按策略重试（最多 2 次）；最终置 `failed`。  
- 超时：超过 120 秒置 `timeout`。

## 4. API 契约（MVP）
### 4.1 创建录音会话
`POST /practice/segments/{segment_id}/recordings/start`

Request:
```json
{
  "client_ts": "2026-03-02T10:00:00Z"
}
```

Response `201`:
```json
{
  "recording_id": "rec_xxx",
  "status": "recording"
}
```

### 4.2 上传录音分片
`POST /practice/recordings/{recording_id}/chunks`

Headers:
- `Content-Type: audio/webm`

Query / form 字段：
- `seq`（从 0 递增）
- `duration_ms`（可选）

Body:
- chunk 二进制数据（`webm/opus`）

Response `200`:
```json
{
  "recording_id": "rec_xxx",
  "seq": 12,
  "accepted": true
}
```

幂等规则：
- 以 `recording_id + seq` 唯一
- 同 `seq` 重传时覆盖旧片段

### 4.3 结束录音并触发识别
`POST /practice/recordings/{recording_id}/finish`

Request:
```json
{
  "total_chunks": 120,
  "duration_ms": 598000
}
```

Response `202`:
```json
{
  "recording_id": "rec_xxx",
  "job_id": "stt_job_xxx",
  "status": "processing"
}
```

### 4.4 查询识别任务
`GET /stt-jobs/{job_id}`

Response `200`（处理中）:
```json
{
  "job_id": "stt_job_xxx",
  "status": "processing"
}
```

Response `200`（成功）:
```json
{
  "job_id": "stt_job_xxx",
  "status": "done",
  "recognized_text": "春は、あけぼの。",
  "confidence": 0.9432,
  "provider": "xxx_stt",
  "model": "xxx_model"
}
```

Response `200`（失败）:
```json
{
  "job_id": "stt_job_xxx",
  "status": "failed",
  "error_code": "STT_PROVIDER_ERROR"
}
```

## 5. 会话与任务状态
### 5.1 录音会话状态
- `recording`：录音中/上传中
- `uploaded`：已结束录音，待识别
- `processing`：识别中
- `done`：识别完成
- `failed`：识别失败
- `timeout`：识别超时

### 5.2 任务超时
- 从进入 `processing` 起计时
- 超过 120 秒置为 `timeout`

## 6. 数据存储建议
- 录音分片临时目录：按 `recording_id/seq` 存储
- 合并文件：`recording_id.webm`
- 识别结果：落 `attempt_recognition`（或专用 stt_result 表）
- 原始音频生命周期：3 天后自动清理

## 7. 错误码建议
- `VALIDATION_ERROR`：参数错误或缺失
- `UNSUPPORTED_AUDIO_FORMAT`：非 `webm/opus`
- `RECORDING_TOO_LONG`：超出 10 分钟限制
- `RECORDING_NOT_FOUND`：录音会话不存在
- `STT_JOB_NOT_FOUND`：任务不存在
- `STT_PROVIDER_ERROR`：供应商调用失败
- `STT_TIMEOUT`：识别超时
- `FORBIDDEN`：越权访问
- `RATE_LIMITED`：触发限流

## 8. 审计与监控（MVP）
### 8.1 审计事件
- `recording_start`
- `recording_chunk_upload`
- `recording_finish`
- `stt_done`
- `stt_failed`
- `stt_timeout`

### 8.2 监控指标
- 识别成功率
- 任务处理时延（P50/P95）
- 重试率
- 超时率
