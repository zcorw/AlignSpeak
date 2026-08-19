# iOS 后台循环 TTS · TodoList

本文件是该功能唯一的执行状态来源。状态：`[ ]` 未开始、`[~]` 进行中、`[x]` 完成、`[!]` 阻塞、`[?]` 待确认。

执行规则：严格按顺序一次推进一个任务；每项必须先更新状态、运行列出的验证、审查 diff，通过后单独提交。不得把两个任务合并到同一提交。

## T00 · 需求与实施文档

- [x] 冻结产品、架构、API/数据、测试发布文档和本清单。

范围：`docs/features/ios-background-tts/` 与规划确认 HTML；根 `TODO.md` 已被仓库忽略，不纳入提交。
依赖：第 1–7 轮规划确认。
验收：文档交叉链接有效；冻结选择、整篇 MP3 方案、更新音频语义和支持边界完整。
验证：Markdown 链接检查、`git diff --check`、文档 diff 审查。

## T01 · 后端数据模型与仓储边界

- [x] 新增整篇任务、资产、资产分段映射模型与基础仓储。

范围：SQLAlchemy 模型、schema bootstrap/兼容迁移、repository、对应测试。
依赖：T00。
验收：约束/索引/所有权字段齐全；可按输入哈希、文章和用户查询；不包含 Worker 领取算法。
验证：目标后端测试、完整 `pytest -q`、`python -m compileall app`。

## T02 · 持久化任务生命周期与 Worker 租约

- [ ] 实现幂等任务创建、PostgreSQL 原子领取、心跳、过期回收、进度、失败和重试。

范围：job use case/repository、Worker 调度骨架、配置、单元/并发测试。
依赖：T01。
验收：API 进程重启不丢任务；两个 Worker 不会同时持有有效租约；失败可回到队列且次数有上限。
验证：任务状态与并发测试、完整后端测试、compileall。

## T03 · 分段准备与输入版本

- [ ] 复用现有分段 TTS 缓存并实现整篇输入快照、稳定哈希和逐段重试。

范围：共享 TTS 输入构造、默认音色/1.0、读音覆盖、edge-tts 7.2.8、缓存解析、测试。
依赖：T02。
验收：正文/读音/版本变化失效；缓存命中不重合成；失败准确记录段落且重试只补缺失段；长段时间轴回归。
验证：哈希/缓存/override/长段测试、完整后端测试。

## T04 · 整篇 MP3 合并与全局时间轴

- [ ] 用 FFmpeg 合并分段音频、插入版本化静音并原子发布整篇资产。

范围：合并服务、ffprobe、临时文件、全局 timeline、缓存键、对应测试/媒体 fixture。
依赖：T03。
验收：750 ms 段间和 1500 ms 尾部停顿；24 kHz/mono/48 kbps；真实时长/大小；时间轴单调；失败不发布半文件。
验证：服务单测、FFmpeg smoke test、ffprobe 检查、完整后端测试。

## T05 · 整篇 TTS API 与媒体所有权

- [ ] 实现任务创建/查询、当前资产查询和受保护的整篇媒体下载。

范围：FastAPI router/schema/use case、Range/文件响应、授权、API 测试。
依赖：T04。
验收：接口遵循 `API_AND_DATA.md`；幂等、进度/失败段、预计大小可用；跨用户资产返回不泄漏；缺失/过期语义稳定。
验证：路由与授权测试、Range 测试、完整后端测试。

## T06 · Worker 部署、FFmpeg 与资产清理

- [ ] 让开发/生产 Worker 真正运行，并加入音频工具、共享卷、健康与清理机制。

范围：Dockerfile、Compose、Worker entrypoint、配置、TTL/orphan cleanup、运维文档和测试。
依赖：T05。
验收：API 与 Worker 共享媒体卷；Worker 可恢复任务；FFmpeg/ffprobe 存在；清理不删除活动资产；Compose 配置有效。
验证：Compose config/build、Worker smoke、清理测试、完整后端测试。

## T07 · 前端整篇服务与全局播放器内核

- [ ] 建立 API service、应用级 Provider、单一 Audio 元素、状态机和前端测试基础。

范围：TypeScript 类型/service/store/provider/audio adapter、测试框架与单测；不做最终 UI。
依赖：T05。
验收：准备/轮询/失败/完整下载/ready/play/pause/stop 状态可测试；路由切换不销毁；Blob 可控释放；不自动播放。
验证：前端单测、lint、build。

## T08 · 全局迷你播放器与页面入口

- [ ] 在文章列表和练习页接入准备/播放，并实现迷你播放器全部准备态交互。

范围：组件、样式、应用 Shell、入口、文章切换确认、失败重试、大小确认、更新音频。
依赖：T07。
验收：全文就绪且下载完成前不可播；>20 MB 确认；站内切页继续；更新立即停止旧版；现有单段/句子功能保留。
验证：组件/交互测试、lint、build。

## T09 · 循环、睡眠、恢复、跨标签页与 Media Session

- [ ] 完成播放策略和 iOS Web 兼容增强。

范围：循环、本轮结束、墙上时间定时、本机 24h 精确恢复、BroadcastChannel/storage、Media Session、audio focus。
依赖：T08。
验收：最后播放标签页接管；重开必须手动恢复；定时暂停也倒计时；录音/分段/单句触发后整篇保持暂停；不支持 API 时安全降级。
验证：fake timers/多标签页/media session/audio focus 测试、lint、build。

## T10 · 端到端回归、兼容清单与交付

- [ ] 完成全链路验收、运维/兼容文档同步和最终回归。

范围：后端集成测试、前端回归、媒体 smoke、文档校准、真机执行模板；只修复本功能回归。
依赖：T06、T09。
验收：所有自动化与构建通过；API/表/配置和文档一致；现有单段/句子 TTS 无回归；发布状态明确标注真机验证结果。
验证：完整后端 pytest/compileall、前端 test/lint/build、Compose config、FFmpeg smoke、`git diff --check`。

## 执行记录

| 任务 | 提交 | 验证摘要 |
| --- | --- | --- |
| T00 | 见对应 Git 提交 | 文档链接、diff 检查 |
| T01 | 见对应 Git 提交 | 仓储目标测试 6 passed；后端完整测试 22 passed；PostgreSQL DDL 与 Python compileall 通过 |
