# 强引导流程 V2 后端待执行清单

更新时间：2026-03-04  
状态：待实施（仅规划，不含代码改造）

## 1. 结论
- 需要调整数据库结构。  
- 原因：当前后端仅有 `articles`、`article_segments` 等基础表，不具备“按用户+按文章+按等级+按段落”的进度持久化能力，无法可靠支持“打开历史文章后恢复该文章进度”。

## 2. 目标能力
- 每篇文章独立记录用户练习进度。
- 支持按等级（L1-L4）与段落维度计算达标状态。
- 支持从历史文章恢复到上次未完成位置。
- 允许跳过段落，但等级完成判定仍要求“该等级所有段落至少一次 >=85%”。

## 3. 数据结构待办

### 3.1 文章级进度表（建议）
- [ ] 新增表 `article_practice_progress`
- [ ] 字段建议：
  - `id`（主键）
  - `user_id`（索引）
  - `article_id`（索引）
  - `current_level`（1-4）
  - `current_segment_id`
  - `level_status`（in_progress/completed）
  - `article_status`（in_progress/completed）
  - `updated_at` / `created_at`
- [ ] 唯一约束：`(user_id, article_id)`

### 3.2 段落级进度表（建议）
- [ ] 新增表 `segment_level_progress`
- [ ] 字段建议：
  - `id`（主键）
  - `user_id`
  - `article_id`
  - `segment_id`
  - `level`（1-4）
  - `best_accuracy`
  - `passed`（bool）
  - `passed_at`（nullable）
  - `attempt_count`
  - `skip_count`
  - `updated_at` / `created_at`
- [ ] 唯一约束：`(user_id, article_id, segment_id, level)`

### 3.3 练习尝试记录表（建议）
- [ ] 新增表 `practice_attempts`
- [ ] 字段建议：
  - `id`（主键）
  - `user_id` / `article_id` / `segment_id`
  - `level`
  - `accuracy_rate`
  - `is_passed`
  - `source`（normal/retry/skip_return）
  - `created_at`

### 3.4 引导状态表（可选）
- [ ] 评估是否新增 `guided_flow_state`（服务端状态快照）
- [ ] 若采用 localStorage + 服务端进度混合，可不新增此表，仅保留文章进度表

## 4. 规则实现待办
- [ ] 规则 1：段落晋级阈值 `accuracy >= 85%`
- [ ] 规则 2：等级完成条件：当前等级下所有段落 `passed=true`
- [ ] 规则 3：允许跳过当前段，但未达标段必须在本等级结束前补齐
- [ ] 规则 4：升级后不允许回退到已完成等级
- [ ] 规则 5：允许手动升降级时，重置当前等级进度并记录操作日志

## 5. API 待办（文章管理/练习模块）
- [ ] `GET /articles/{article_id}/progress`：读取该文章当前进度
- [ ] `POST /articles/{article_id}/progress/attempt`：提交一次段落练习结果并更新进度
- [ ] `POST /articles/{article_id}/progress/skip`：标记当前段跳过并推进到下一段
- [ ] `POST /articles/{article_id}/progress/level-switch`：手动切换等级（触发重置逻辑）
- [ ] `GET /me/history-articles`：返回历史文章 + 可恢复进度摘要

## 6. 迁移与上线待办
- [ ] 设计 SQLAlchemy Model 与迁移方案（若继续 `create_all`，需先规划迁移策略）
- [ ] 增加必要索引（`user_id, article_id, level` 组合）
- [ ] 为旧用户初始化默认进度（按文章首段、L1、in_progress）
- [ ] 增加数据一致性检查任务（防止段落删除/新增后的孤儿进度）

## 7. 测试待办
- [ ] 单元测试：等级完成判定、跳过回补、手动切换重置
- [ ] 集成测试：历史文章恢复、跨会话恢复、并发提交结果一致性
- [ ] 接口测试：鉴权、边界值、错误码

## 8. 与前端协同说明
- [ ] localStorage 仍保留“当前会话快速恢复”
- [ ] 后端进度作为权威状态，进入历史文章时以服务端进度为准
- [ ] 前端若本地状态与服务端冲突，按服务端覆盖并提示用户
