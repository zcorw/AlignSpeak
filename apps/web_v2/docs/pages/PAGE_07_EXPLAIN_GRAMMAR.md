# 页面 07：AI 释义与语法页（独立路由）

## 页面功能
- 为“当前段落”提供 AI 释义，帮助用户理解语义与语境。
- 允许用户手动选择一个句子，提取句内语法点（结构、用法、例句）。
- 与听读练习页并列存在，支持双向切换，但不与练习页混排。

## 路由与切换
- 新增独立路由：`/explain`
- 建议沿用练习上下文参数：`/explain?a={articleId}&seg={segmentOrder}&lv={level}`
- 入口建议：
  - 练习页增加“语法解析”按钮，跳转到 `/explain`（携带当前上下文）。
  - 释义页顶部保留“返回听读”按钮，回到 `/practice`（保留 `a/seg/lv`）。
- 约束：
  - 不在 `/practice` 页面内嵌解释面板，避免页面职责混杂。

## 页面布局（功能区）
- 顶部导航区：
  - 标题、语言、返回按钮、模式切换按钮（“听读练习 / 语法解析”）。
- 段落信息区：
  - 文章名、段落序号、原文段落（只读）。
- AI 释义区：
  - 段落整体释义（简洁版）。
  - 关键词解释（可折叠）。
- 句子选择区：
  - 段落原文按句切分并渲染为可点击句子（沿用听读页文本展示形态）。
  - 当前选中句高亮，支持重复点击切换选中句。
- 底部操作区（固定）：
  - 主按钮：`分析该句语法`。
  - 未选句时按钮禁用，并显示“请先选择一句”提示。
- 语法点结果区：
  - 基于已选句返回语法点列表（语法名称、解释、句内片段、补充例句）。
  - 支持“重新分析”与“复制要点”。

## 手动选句交互方案
- 推荐主交互（MVP）：
  - 句子自动切分后，直接在段落原文中点击目标句。
  - 用户单击某句即选中，点击底部 `分析该句语法` 触发分析。
  - 同一时间仅允许一个选中句，降低复杂度。
- 增强交互（迭代）：
  - 选中句自动滚动至可视区域中心，减少误触。
  - 支持“上一句 / 下一句”快捷切换，便于连续查阅。
- 兜底交互（异常场景）：
  - 若自动切分质量差，提供“手动编辑句子文本后再分析”输入框。
- 移动端展示约束：
  - 句子保持完整展示，不做局部折叠，避免语义断裂。
  - 仅做自然换行与行高优化，保证长句可读性。

## 可复用组件与建议抽取
- 可直接复用：
  - `PageTopBar`：页面顶部结构与操作按钮。
  - `PracticeTopBar` 的模式：可参考动作区布局，新增 `ExplainTopBar`。
  - `PracticeStatusBanners`：加载/错误态提示模式可复用。
  - `feedbackHooks`（`useNotifier` / `useConfirm`）：提示与确认交互。
  - `timelineText.ts`：句子切分与句子范围工具可复用。
- 建议抽取为通用组件：
  - `ArticleContextHeader`：文章标题、语言、段落信息头。
  - `SentenceSelectableParagraph`：正文句子选择器（单选、高亮、滚动定位）。
  - `StickyAnalyzeActionBar`：底部固定分析操作区。
  - `AiInsightPanel`：统一展示“释义/语法点/关键词”的结果容器。
- 保持风格一致：
  - 与练习页使用一致的卡片、边框、间距和按钮语义。
  - 保留“主区 + 可扩展区”的信息层级，减少学习成本。

## 前后端接口建议（MVP）
- `POST /bff/v1/explain/segment`
  - 入参：`article_id`, `segment_order`, `language`
  - 出参：`summary`, `keywords[]`
- `POST /bff/v1/explain/grammar`
  - 入参：`article_id`, `segment_order`, `sentence_text`, `language`
  - 出参：`grammar_points[]`（名称、解释、片段、示例）
- 约束：
  - 响应需包含 `warnings` 字段，保持与现有 BFF 风格一致。
  - 失败时返回可读错误码，前端统一走非阻塞提示。

## 状态与缓存建议
- 页面状态：
  - `selectedSentence`
  - `segmentExplanation`
  - `grammarPoints`
  - `loading/error/retry`
- 缓存策略：
  - `segmentExplanation` 可按 `articleId:segment` 缓存。
  - `grammarPoints` 可按 `articleId:segment:sentenceHash` 缓存。
  - 当文章文本发生版本变化时，相关缓存失效。
