# AlignSpeak 账号系统设计（MVP）

## 1. 目标与范围
账号系统用于支持多用户隔离、进度持久化、权限控制与安全审计。MVP 包含：
- 邮箱+密码注册与登录
- Access Token 鉴权
- Refresh Token 续期与轮换
- 个人资料查询与退出登录
- 资源按 `user_id` 隔离（文章、练习、音频、报告）

MVP 不包含：
- 第三方登录（Google/Apple 等）
- 多因素认证（MFA）
- 企业级 SSO

## 2. 角色与权限
- `user`：默认角色，可访问和管理自己的资源
- `admin`：可执行系统级运维/审计操作（非业务默认路径）

权限原则：
- 默认拒绝（deny by default）
- 所有业务资源读取/写入必须检查所属 `user_id`

## 3. 认证模型
采用双令牌模型：
- Access Token：JWT，短时有效（建议 15 分钟）
- Refresh Token：随机字符串，长时有效（建议 30 天），服务端存 hash，支持轮换

建议载荷（Access Token）：
- `sub`：用户 ID
- `role`：角色
- `ver`：令牌版本（用于强制失效）
- `exp`：过期时间（UTC）

## 4. API 设计（MVP）
### 4.1 注册
- `POST /auth/register`
- body：`{ "email": "...", "password": "...", "display_name": "..." }`
- return：`{ "user_id": "usr_xxx" }`

### 4.2 登录
- `POST /auth/login`
- body：`{ "email": "...", "password": "..." }`
- return：
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### 4.3 刷新
- `POST /auth/refresh`
- body：`{ "refresh_token": "..." }`
- 行为：旧 refresh token 失效并下发新 refresh token（轮换）

### 4.4 登出
- `POST /auth/logout`
- body：`{ "refresh_token": "..." }`
- 行为：撤销指定 refresh token（可扩展“全部设备登出”）

### 4.5 当前用户
- `GET /auth/me`
- header：`Authorization: Bearer <access_token>`
- return：`{ "user_id": "...", "email": "...", "role": "user" }`

## 5. 数据模型（建议）
### 5.1 users
- `id` (`usr_*`)
- `email`（唯一索引，统一小写）
- `password_hash`
- `role`（`user|admin`）
- `status`（`active|disabled`）
- `token_version`（强制令牌失效）
- `created_at` / `updated_at`
- `last_login_at`

### 5.2 refresh_tokens
- `id` (`rtk_*`)
- `user_id`
- `token_hash`（不存明文）
- `expires_at`
- `revoked_at`
- `rotated_from`（可选，记录轮换链路）
- `created_at`
- `ip` / `user_agent`（可选）

### 5.3 业务表关联
- `articles.user_id`
- `attempts.user_id`
- `mask_plans.user_id`
- 其他用户私有资源均需持有 `user_id` 外键

## 6. 安全基线
- 密码使用 `Argon2id` 或 `bcrypt` 哈希，禁止明文或可逆加密存储
- 登录、注册、刷新接口配置限流
- 所有鉴权失败返回统一错误结构，不暴露账户存在性细节
- 生产环境强制 HTTPS
- Refresh Token 轮换并支持撤销，防止重放

## 7. 与现有模块集成
- 前端：
  - 增加登录/注册页面
  - 统一请求拦截器注入 `Authorization`
  - 401 时走刷新流程，刷新失败则跳转登录
- 后端：
  - 新增 `Auth Service`
  - 在业务路由增加鉴权依赖（当前用户）
  - 业务查询默认附带 `user_id` 过滤

## 8. 验收标准（MVP）
- 新用户可注册并登录
- 带 token 可访问 `/auth/me` 与业务私有接口
- 无 token 或无效 token 访问被拒绝
- 资源越权访问被拒绝（A 不能访问 B 的数据）
- 刷新令牌可轮换且旧 token 失效

