# AlignSpeak 邀请码注册流程设计

## 1. 目标
- 注册改为“邀请码制”。
- 系统第一个用户必须是 `admin`。
- 只有 `admin` 可以生成邀请码。
- 每个邀请码最多可注册 3 个用户。

## 2. 首个用户注册（Bootstrap）
- 接口：`POST /api/auth/bootstrap-admin`
- 条件：
  - 当前系统用户总数必须为 `0`。
  - 请求体需携带 `bootstrap_key`，且必须与服务端配置 `BOOTSTRAP_ADMIN_KEY` 一致。
- 结果：
  - 创建 `role=admin`、`status=active` 的首个用户。
  - 首个管理员创建成功后，bootstrap 接口永久关闭（返回 `AUTH_BOOTSTRAP_CLOSED`）。

## 3. 邀请码模型
### 3.1 `invitation_codes`
- `id`：邀请码记录主键（`inv_*`）
- `code`：邀请码字符串（唯一）
- `created_by_user_id`：创建者（管理员）
- `max_uses`：最大可用次数（固定默认 3）
- `used_count`：已使用次数
- `status`：`active | disabled`
- `created_at` / `updated_at`

### 3.2 `invitation_code_usages`
- `id`：主键
- `invitation_code_id`：关联邀请码
- `user_id`：被邀请码绑定的用户（唯一，避免重复消耗）
- `used_at`：使用时间

## 4. 邀请码生成
- 接口：`POST /api/auth/invitation-codes`
- 鉴权：仅 `admin`
- 行为：
  - 生成格式 `INV-XXXXXXXXXX` 的随机码。
  - `max_uses=3`，`used_count=0`。

## 5. 注册流程（邀请码制）
- 接口：`POST /api/auth/register`
- 入参新增：`invitation_code`
- 核心规则：
  - 如果系统尚无用户，禁止普通注册，必须先 bootstrap（`AUTH_BOOTSTRAP_REQUIRED`）。
  - 注册时验证邀请码：
    - 必须存在且 `status=active`
    - `used_count < max_uses`
  - 首次绑定用户时消耗 1 次邀请码配额并写入 `invitation_code_usages`。
  - 已绑定邀请码的 pending 用户重复注册，不重复消耗配额。
  - 注册后仍保持邮箱验证码激活流程（`pending -> verify-email -> active`）。

## 6. 前端注册表单调整
- 新增必填字段：`Invitation Code`
- 提交体新增：`invitation_code`

## 7. 错误码约定
- `AUTH_BOOTSTRAP_REQUIRED`：系统未初始化管理员，禁止普通注册
- `AUTH_BOOTSTRAP_CLOSED`：首个管理员已创建，bootstrap 已关闭
- `AUTH_BOOTSTRAP_DISABLED`：服务端未配置 bootstrap key
- `AUTH_INVITATION_REQUIRED`：缺少邀请码
- `AUTH_INVITATION_INVALID`：邀请码无效或已禁用
- `AUTH_INVITATION_EXHAUSTED`：邀请码使用次数已达上限
- `AUTH_EMAIL_ALREADY_EXISTS`：邮箱已存在（bootstrap 场景）
