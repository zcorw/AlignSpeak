# AlignSpeak 递进遮挡训练模块说明（MVP 基线）

## 1. 目标与范围
本模块负责基于段落 token 与练习表现生成“可复现”的遮挡计划，用于从跟读逐步过渡到背诵。

MVP 包含：
- 固定等级遮挡（L0-L4）
- 规则引擎生成计划（rule）
- 计划落库与复用
- 每次练习后更新段落熟练度指标

MVP 不包含：
- 会话内动态反复改 plan
- 自动降级
- 默认启用 AI 遮挡生成

## 2. 核心决策（已确认）
1. 等级固定：`L0/L1/L2/L3/L4`
2. 比例固定：`0%/20%/40%/70%/90%`
3. 粒度策略：
- `L0`：不遮挡
- `L1`：token 级遮挡
- `L2-L4`：短语级遮挡
4. 默认策略：`rule`，并保留平滑切换到 `ai` 的能力
5. 与错误热区关系：优先遮挡易错词
6. 标点与专有名词：默认不遮挡
7. 低长度段落：按最小可见量约束（见第 4 节）
8. 结果可复现：同输入同输出
9. 遮挡计划落库：是（`mask_plans`）
10. 升级条件：按推荐阈值（见第 5 节）
11. 自动降级：不启用，由用户手动切换
12. 允许每段手动覆盖等级
13. 计划生成方式：按段一次性生成
14. 每段等级独立，按该段熟练度计算，不继承上一段等级
15. 与对齐联动：每次练习后更新该段指标；下次进入该段时重算 plan
16. 前端契约：返回 `masked_token_indices`

## 3. API 契约（MVP）
### 3.1 生成遮挡计划
`POST /masking/plan`

Request:
```json
{
  "segment_id": "seg_xxx",
  "level": 2,
  "manual_override": true
}
```

Response `200`:
```json
{
  "plan_id": "msk_xxx",
  "segment_id": "seg_xxx",
  "level": 2,
  "mask_ratio": 0.4,
  "masked_token_indices": [1, 4, 5, 8],
  "strategy": "rule",
  "reasons": [
    "error_hotspot_priority",
    "phrase_masking_l2_plus"
  ]
}
```

### 3.2 查询段落最近计划
`GET /masking/plan/latest?segment_id=seg_xxx`

### 3.3 练习后更新段落策略指标
`POST /masking/progress/update`

Request:
```json
{
  "segment_id": "seg_xxx",
  "accuracy_rate": 0.91,
  "error_hotspots": ["あけぼの", "なりゆく"]
}
```

## 4. Rule 生成逻辑（可执行）
### 4.1 输入
- `segment_tokens`（含 `token_order/surface/yomi/pos/is_maskable`）
- `level`（0-4）
- 段落策略上下文（错误热区、历史准确率、连续达标次数）
- 用户手动覆盖标记（如有）

### 4.2 预处理
1. 过滤不可遮挡 token：
- `is_maskable=false` 直接排除
- 标点排除
- 专有名词（`PROPN`）排除

2. 设定目标遮挡数：
- `target_mask_count = floor(mask_ratio(level) * ref_token_count)`

3. 最小可见量约束：
- `min_visible = max(2, ceil(0.2 * ref_token_count))`
- 最终遮挡数不得让可见 token 低于 `min_visible`

### 4.3 候选单元构造
1. `L1`（token 级）：
- 每个可遮挡 token 作为一个候选单元

2. `L2-L4`（短语级）：
- 以连续 token 窗口构造短语，长度建议 `2-4`
- 不跨强标点边界（句号、问号、感叹号等）
- 短语内含不可遮挡 token 则该候选失效

### 4.4 候选打分（确定性）
对每个候选单元计算分数（越高越优先遮挡）：
- `hotspot_score`：命中错误热区加分（主权重）
- `difficulty_score`：历史错误率高加分
- `position_score`：可选（句中位置微调）

建议权重：
- `hotspot_score * 0.6 + difficulty_score * 0.3 + position_score * 0.1`

确定性要求：
- 排序键固定为：`score desc -> first_token_order asc -> unit_length desc`
- 不使用随机数，保证同输入同输出

### 4.5 贪心选取
1. 按排序结果依次选择候选单元
2. `L2-L4` 下候选不可重叠（避免重复遮挡）
3. 达到目标遮挡数即停止
4. 若超过目标，优先保留高分单元并回退低分单元
5. 应用 `min_visible` 约束修正最终结果

### 4.6 输出
- 返回 `masked_token_indices`（0-based、升序、去重）
- 附带 `strategy=rule` 与 `reasons`

## 5. 等级与熟练度规则
### 5.1 升级推荐阈值
- 对“该段”最近 3 次尝试：
- 若其中至少 2 次 `accuracy_rate >= 90%`，建议升一级（上限 L4）

### 5.2 降级策略
- 不自动降级
- 用户可手动选择更低等级

### 5.3 段落独立性
- 每段独立维护：
- `attempt_count`
- `accuracy_ema`（建议 `alpha=0.3`）
- `consecutive_pass_count`
- `error_hotspots`

## 6. 数据落库建议
落 `mask_plans`：
- `id`
- `user_id`
- `segment_id`
- `level`
- `mask_ratio`
- `masked_token_indices`（jsonb）
- `strategy`（`rule|ai`）
- `reasons`（jsonb，可选）
- `created_at`

并更新 `segment_progress` 相关字段以支撑段落独立熟练度。

## 7. 前端契约
- 前端根据 `masked_token_indices` 在本地 token 渲染层执行遮挡
- 后端不返回拼接好的 `masked_text`
- 手动覆盖等级时，前端显式传 `manual_override=true`

## 8. 权限与校验
- 仅本人可生成/读取自己的遮挡计划
- `masked_token_indices` 必须：
- 0-based
- 升序
- 去重
- `level` 必须在 `0..4`

## 9. 性能与可观测性
### 9.1 性能目标
- `P50 < 40ms`
- `P95 < 100ms`
- `P99 < 200ms`
- 超过 `500ms` 记慢请求告警

### 9.2 监控指标
- `mask_plan_latency_ms`（P50/P95/P99）
- `mask_plan_error_rate`
- `mask_plan_timeout_count`
- `manual_override_rate`
- 等级分布与升级命中率

## 10. AI 插拔边界
- MVP 默认 `rule`
- 预留 `strategy=ai`：
- 输入：token、错误热区、目标比例、等级
- 输出：`masked_token_indices` + `reasons`
- 要求与 rule 输出契约一致，便于平滑切换
