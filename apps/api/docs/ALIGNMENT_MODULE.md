# AlignSpeak 文本对齐与纠错反馈模块说明（MVP 基线）

## 1. 目标与范围
本模块负责将“原文段落”与“STT 识别文本”进行对齐，输出可用于前端高亮与统计的结构化差异结果。

MVP 输出目标：
- token 级差异：`correct / missing / insert / substitute`
- 噪声片段：`noise_spans`（重复、卡壳污染）
- 对比块：`compare_blocks`（前端行对行展示）
- 准确率：`accuracy_rate`

## 2. 核心决策（全按推荐）
1. 对齐粒度：`token` 级  
2. 默认对齐键：`yomi`  
3. 差异集合固定：`correct / missing / insert / substitute`  
4. MVP 启用噪声片段：`noise_spans`  
5. 算法：全局编辑距离 + 锚点增强  
6. 统一规范化：空白/标点/大小写/全半角  
7. 多语言：统一主 pipeline，语言特化插件  
8. 输入边界：只接收 `recognized_text`（不依赖 STT 原始 payload）  
9. 输出结构：`ref_tokens + hyp_tokens + compare_blocks + noise_spans`  
10. 准确率：`correct / ref_total`  
11. 语气词：默认记 `insert`；高重复污染片段归 `noise`  
12. 性能目标：单段最多 500 tokens，P95 < 300ms  
13. 持久化：全量 token 明细落库  
14. 可解释性：保存对齐 trace  
15. 前后端契约：字段与状态码冻结

## 3. 技术栈（MVP）
### 3.1 服务与框架
- Python 3.11+
- FastAPI（API 接口）
- Pydantic（请求/响应模型）

### 3.2 对齐核心实现
- 动态规划：Needleman-Wunsch / Levenshtein 全局对齐
- 自定义代价函数：
  - match = 0
  - substitute = 1
  - insert = 1
  - delete(missing) = 1
- 回溯生成 edit path（trace）

### 3.3 分词与语言插件
- 日语：SudachiPy 或 MeCab + UniDic（优先输出 `surface` 和 `yomi`）
- 英语：规则分词（空白+标点）起步，后续可换 spaCy
- 中文：规则分词起步，后续可替换 jieba/pkuseg

### 3.4 数据持久化
- PostgreSQL
- 使用既有表：
  - `attempt_compare_blocks`
  - `attempt_compare_tokens`
  - `attempt_noise_spans`
  - `practice_attempts.accuracy_rate`

## 4. 执行逻辑（端到端）
### 4.1 输入
- `segment_id`
- 原文段落 token（来自 `segment_tokens`）
- STT 输出 `recognized_text`

### 4.2 处理步骤
1. 文本规范化  
- 统一空白、标点样式、全半角；英文转小写（可配置）。

2. 识别文本 token 化  
- 按语言插件把 `recognized_text` 切成 `hyp_tokens`。

3. 构建对齐键  
- 每个 token 生成：
  - `surface`（展示）
  - `key`（默认 `yomi`，无 yomi 时回落 `surface`）

4. 噪声锚点检测（增强鲁棒）  
- 从尾部检索稳定 n-gram 作为锚点。  
- 先对齐稳定后缀，再处理前缀，减少“重复卡壳”污染对全局路径的影响。

5. 全局对齐计算（DP）  
- 在 `ref_keys` 与 `hyp_keys` 上跑编辑距离。  
- 回溯得到逐 token 对齐操作。

6. 差异标注  
- 根据对齐路径生成：
  - `correct`
  - `missing`
  - `insert`
  - `substitute`

7. 噪声片段提取  
- 对高重复、低信息密度片段打 `noise_span`。  
- `noise_span` 是片段级标签，不替代 token 差异标签。

8. 结果组装  
- 组装 `ref_tokens / hyp_tokens / compare_blocks / noise_spans`。  
- 计算 `accuracy_rate = correct / ref_total`。

9. 落库与返回  
- 全量差异明细落库。  
- 返回给前端用于高亮和统计。

## 5. 数据结构契约（核心）
### 5.1 token 差异
```json
{
  "text": "あけぼの",
  "status": "missing"
}
```

### 5.2 输出示例
```json
{
  "accuracy_rate": 0.88,
  "ref_tokens": [
    { "text": "春は、", "status": "correct" },
    { "text": "あけぼの", "status": "missing" }
  ],
  "hyp_tokens": [
    { "text": "春は、", "status": "correct" },
    { "text": "えっと", "status": "insert" }
  ],
  "compare_blocks": [
    {
      "block_order": 1,
      "reference": [
        { "text": "春は、", "status": "correct" },
        { "text": "あけぼの", "status": "missing" }
      ],
      "recognized": [
        { "text": "春は、", "status": "correct" },
        { "text": "えっと", "status": "insert" }
      ]
    }
  ],
  "noise_spans": [
    { "start_token": 10, "end_token": 15, "reason": "repeat" }
  ]
}
```

## 6. API 建议（与 STT 串联）
推荐在 STT 完成后调用：

`POST /practice/attempts/{attempt_id}/align`

Request:
```json
{
  "segment_id": "seg_xxx",
  "recognized_text": "..."
}
```

Response:
- 返回第 5.2 节结构

## 7. 错误码建议
- `VALIDATION_ERROR`
- `SEGMENT_NOT_FOUND`
- `ALIGNMENT_INPUT_EMPTY`
- `ALIGNMENT_TOO_LONG`（超过 500 tokens）
- `ALIGNMENT_INTERNAL_ERROR`
- `FORBIDDEN`

## 8. 性能与可观测性
### 8.1 性能
- 输入上限：500 tokens
- 目标：P95 < 300ms（不含数据库写入）

### 8.2 可观测性
- 记录 trace：DP 路径摘要、代价、token 数
- 指标：
  - 对齐成功率
  - 平均耗时（P50/P95）
  - `missing/insert/substitute` 分布
  - `noise_span` 命中率
