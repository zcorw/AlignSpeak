# AlignSpeak Web 与已确认需求差异记录

更新日期：2026-03-03  
对照基线：
- `apps/api/docs/AUTH_MODULE.md`
- `apps/api/docs/ARTICLE_MODULE.md`
- `apps/api/docs/TTS_MODULE.md`
- `apps/api/docs/STT_MODULE.md`
- `apps/api/docs/ALIGNMENT_MODULE.md`
- `apps/api/docs/MASKING_MODULE.md`
- `apps/api/docs/PROGRESS_HISTORY_MODULE.md`
- `apps/api/docs/BFF_MODULE.md`

## 1. 结论概览
- 当前 `apps/web` 以 Mock 演示为主，尚未接入已确定的 API 契约与关键业务链路。
- 主要缺口集中在：认证、文章创建/OCR、TTS/STT 异步任务、遮挡 plan 契约、BFF 接入。
- 首页/我的页有若干展示逻辑与新需求不一致（如首页进度 KPI、refresh token 展示）。

## 2. 差异清单（按优先级）

### P0（必须优先补齐）
1. BFF 未接入，仍调用旧接口
- 现状：调用 `/api/home-summary`、`/api/practice-bundle` 等。
- 目标：切到 `/api/bff/v1/*` 页面聚合接口。
- 影响：前后端契约不一致，后续联调成本高。

2. 认证模块缺失
- 现状：无登录/注册路由，无 token 注入。
- 目标：接入 `register/login/me`，统一 `Authorization: Bearer <token>`。
- 影响：无法满足用户隔离与真实鉴权链路。

3. 文章管理链路缺失
- 现状：首页“自动分段/生成TTS”按钮无真实动作；无文件上传/OCR。
- 目标：接入 `POST /articles`（文本、txt/md、OCR）及文章查询。
- 影响：首页核心能力不可用。

4. STT 录音与识别链路不符合方案
- 现状：仅 UI 状态切换；无麦克风采集、无 chunk 上传、无 finish->job。
- 目标：`start/chunks/finish/stt-jobs` 完整链路，`webm/opus`，10 分钟上限。
- 影响：练习流程为假闭环，无法落到真实识别。

5. TTS 异步任务链路缺失
- 现状：仅按钮 UI，无 `tts-jobs` 调用与轮询。
- 目标：按段生成、`job_id` 查询、本地音频访问。
- 影响：标准音频播放能力缺失。

6. 遮挡契约不一致
- 现状：前端本地按比例重算 `hidden`。
- 目标：后端生成 `masked_token_indices`，前端按 index 渲染。
- 影响：规则中心与可复现性被破坏。

### P1（应尽快对齐）
7. 对齐结果结构不完整
- 现状：仅 `blocks`，缺少 `noise_spans`、`accuracy_rate`、trace 支撑。
- 目标：按对齐模块输出完整结构。
- 影响：前端反馈能力和后续分析能力不足。

8. 进度历史接口与页面口径未对齐
- 现状：仍用旧 `progress-summary/me-summary`。
- 目标：接入 `/progress/summary`、`/me/history-docs`、`/progress/hotwords`、`/progress/export`。
- 影响：无法体现已定“我的页集中展示进度历史”设计。

9. 首页展示与新策略冲突
- 现状：首页仍展示进度 KPI（目标段数/完成段数）。
- 目标：首页以文章创建为主，不展示进度 KPI。
- 影响：产品信息架构偏离已确认方案。

10. `refreshTokenStatus` 字段遗留
- 现状：我的页与类型中仍存在 refresh token 状态展示。
- 目标：移除该展示（当前认证方案为 Access Token only）。
- 影响：与认证文档冲突，误导开发与用户。

### P2（优化项）
11. Mock 契约未迁移到 BFF 结构
- 现状：MSW 仍是旧路径和旧 DTO。
- 目标：Mock 与 `/api/bff/v1/*` 对齐，避免“假联调通过”。

12. 错误处理与降级能力缺失
- 现状：全局 `error` 文案较粗，缺少页面级 warnings 降级展示。
- 目标：对齐 BFF 的统一错误与局部降级策略。

## 3. 模块映射状态
| 模块 | 当前状态 | 与需求匹配 |
|---|---|---|
| 账号与认证 | 基本缺失 | 否 |
| 文章管理 | UI 壳为主 | 否 |
| TTS | 未实现任务链路 | 否 |
| STT | 未实现录音上传与识别链路 | 否 |
| 文本对齐 | 仅展示简化结果 | 部分 |
| 递进遮挡 | 前端本地策略 | 否 |
| 进度与历史 | 旧接口+旧口径 | 部分 |
| BFF 聚合 | 未接入 | 否 |

## 4. 建议改造顺序
1. 接入认证与 HTTP 鉴权拦截。
2. 首页改造为文章创建主流程（文本/文件/OCR）。
3. 接入 BFF v1 契约并同步更新 MSW。
4. 打通 TTS 异步任务链路。
5. 打通 STT 录音分片 + finish + 任务轮询。
6. 迁移遮挡为 `masked_token_indices`。
7. 迁移对齐结果结构与进度历史新接口。
8. 收尾：错误降级、导出、监控埋点。

## 5. 备注
- 本文档只记录“差异与缺失”，不替代详细实施设计。
- 如后续需求有调整，请同步更新本文件与对应模块文档。
