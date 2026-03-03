# AlignSpeak 约定规范

## 1. 命名约定
- 标识符统一英文
- API 字段优先 snake_case（BFF 兼容字段除外）
- 领域术语固定：user、article、segment、token、attempt、mask_plan

ID 前缀建议：
- usr_
- art_
- seg_
- att_
- msk_

## 2. 架构约定（强制）
- 分层：presentation / application / domain / infrastructure
- 依赖只能单向流动
- 控制层仅做协议转换与参数处理
- 业务逻辑必须在 usecase/domain
- 前端组件禁止直接请求接口

## 3. 对齐约定
对齐状态固定集合：
- correct
- substitute
- missing
- insert

## 4. 遮挡约定
等级映射：
- L0 -> 0%
- L1 -> 20%
- L2 -> 40%
- L3 -> 70%
- L4 -> 90%

masked_token_indices 必须：0-based、去重、升序。

## 5. 错误响应约定
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  }
}
```

## 6. 安全约定
- 禁止提交密钥、凭据、令牌
- 密码必须哈希存储
- 日志不记录完整敏感内容

## 7. Docker Compose（强制）
开发与联调统一使用 docker compose。


## Encoding Convention
- All newly created or updated files must use UTF-8 (without BOM).
- Do not commit files encoded as GBK/ANSI/UTF-16.

## Third-Party First Convention (Mandatory)
- For generic capabilities (HTTP, date/time, validation, state helpers, etc.), use mature libraries first.
- Do not build in-house utility modules for solved problems unless there is a strong technical constraint.
- Recommended defaults:
  - HTTP: `axios`
  - Date/time: `dayjs`
- Any exception must be documented in PR with technical rationale and maintenance plan.
