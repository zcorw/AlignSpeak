# AlignSpeak 账号与认证模块说明（MVP 基线）

## 1. 目标与范围
本模块用于提供最小可用的账号注册、登录鉴权与当前用户查询能力，并满足基础防刷与安全要求。

MVP 包含：
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

MVP 不包含：
- `logout` 接口
- refresh token 机制
- 忘记密码/重置密码流程

## 2. 核心决策（已确认）
### 2.1 会话与令牌
- 方案：`Access Token only`
- 有效期：`12 小时`
- 签名算法：`HS256`
- 下发位置：登录响应 `body`
- token 载荷最小字段：
  - `sub`（user_id）
  - `role`
  - `ver`（token_version）
  - `iat`
  - `exp`

### 2.2 密码与账号状态
- 密码哈希：`Argon2id`
- 账号状态：`active | disabled`
- 邮箱规范化：`trim + lowercase`

### 2.3 注册策略
- 开放注册
- 未完成邮箱验证：不允许登录
- 注册成功：仅返回 `user_id`，不自动登录
- 注册字段：`email`、`password` 必填，`display_name` 选填
- 密码强度：至少 8 位，且必须包含字母和数字
- 不要求勾选用户协议/隐私政策复选框（当前阶段）

### 2.4 防刷与风控
- 注册与登录均采用 `IP + email` 双维限流
- 注册接入人机校验（Turnstile/hCaptcha）
- 注册启用邮箱激活验证
- 注册重复邮箱返回统一文案（不暴露是否已存在）

### 2.5 邮箱验证规则
- 验证链接有效期：24 小时
- 验证 token：一次性使用
- 重发限制：60 秒冷却，24 小时内最多 5 次
- 未验证账号清理：7 天未验证自动清理/失效

### 2.6 错误提示策略
- 登录失败统一返回“账号或密码错误”语义，不区分账号不存在或密码错误

## 3. API 契约（MVP）
### 3.1 注册
`POST /auth/register`

Request:
```json
{
  "email": "you@example.com",
  "password": "abc12345",
  "display_name": "Alice"
}
```

Response `201`:
```json
{
  "user_id": "usr_xxx",
  "message": "注册请求已受理，请检查邮箱完成验证"
}
```

说明：
- 若邮箱已存在，也返回同语义文案（避免账户枚举）
- 实际创建策略由服务端控制（已验证/未验证账号的冲突处理在实现层定义）

### 3.2 登录
`POST /auth/login`

Request:
```json
{
  "email": "you@example.com",
  "password": "abc12345"
}
```

Response `200`:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 43200
}
```

失败场景（示例）：
- 邮箱未验证：`403`
- 账号禁用：`403`
- 凭据错误：`401`（统一错误文案）
- 超出限流：`429`

### 3.3 当前用户
`GET /auth/me`

Header:
`Authorization: Bearer <access_token>`

Response `200`:
```json
{
  "user_id": "usr_xxx",
  "email": "you@example.com",
  "role": "user",
  "display_name": "Alice",
  "status": "active"
}
```

## 4. 鉴权与访问控制
- 鉴权白名单：`/auth/register`、`/auth/login`（以及系统健康检查接口，如有）
- 其他业务接口默认要求 Bearer Token
- 认证通过后仍需检查：
  - `status == active`
  - token 中 `ver` 与用户 `token_version` 一致

## 5. 审计与日志（最小集）
至少记录以下安全事件：
- 注册成功/失败
- 登录成功/失败
- 鉴权失败（token 无效、过期、缺失）

要求：
- 日志不记录明文密码或完整 token
- 敏感字段脱敏

## 6. 统一错误结构
```json
{
  "error": {
    "code": "AUTH_ERROR",
    "message": "账号或密码错误"
  }
}
```

备注：`code` 可按场景细分（如 `UNAUTHORIZED`、`RATE_LIMITED`、`EMAIL_NOT_VERIFIED`），但对外文案需遵守“避免枚举”原则。
