# AlignSpeak — AI 朗读/背诵对齐训练系统（项目说明）

> AlignSpeak 是一个面向外语学习的“朗读/背诵训练”项目：用户输入文章，系统生成标准朗读音频（TTS）供跟读；用户朗读后通过语音识别（STT）得到文本，与原文进行对齐并输出词级差异高亮；同时提供“递进遮挡模式”，由 AI/规则生成遮挡方案，帮助用户逐步脱离文本完成朗读/背诵。

---

## 1. 目标与范围

### 1.1 目标
- **可训练**：以文章为单位进行朗读/背诵练习，支持分段训练。
- **可反馈**：将用户朗读结果与原文进行对齐，输出**正确/错误/缺失/多读（噪声）**等可解释反馈，并在界面高亮。
- **可进阶**：使用**递进遮挡**（progressive masking）策略，帮助用户从“看文跟读”过渡到“遮挡背诵”。
- **可扩展**：后续可扩展注音（假名/拼音）、更精细的发音评测（prosody/音素级）与在线多用户服务。

### 1.2 MVP 范围（第一阶段必须实现）
- 文章输入与分段管理
- 标准朗读音频生成（TTS）与播放
- 用户录音上传
- STT 转写
- 文本对齐与差异高亮（词级）
- 递进遮挡模式（规则驱动 + 可插拔 AI 方案）
- 基础训练记录（PostgreSQL）

### 1.3 非目标（第一阶段不做）
- 实时流式 STT（可作为第二阶段增强）
- 音素级强制对齐与发音打分（可作为第三阶段）
- 允许“意译/复述仍算正确”的语义容错（可作为第二阶段增强）

---

## 2. 核心功能构成（用户视角）

### 2.1 文章输入与管理
- 输入方式：粘贴文本 / 上传 txt、md（可扩展 docx） / 上传照片（OCR 解析）
- 自动处理：清洗、断句、分段（按句/段）
- 输出：全文展示、段落导航、每段独立练习入口
- 预留：注音显示（例如日语假名注音）

### 2.2 标准朗读音频（TTS）
- 对全文或按段生成标准朗读音频
- 支持缓存：相同文本不重复生成
- 前端播放：逐段播放，支持循环、变速（可选）

### 2.3 录音与识别（STT）
- 前端录音：用户按段朗读，录音结束后上传
- STT：将音频转写为文本（在线 STT）
- 返回：转写文本、置信度信息（可选）

### 2.4 文本对齐与差异高亮（关键）
- 将 STT 文本与原文进行对齐，输出 token 级差异：
  - `correct`：正确
  - `substitute`：替换（读成别的词）
  - `delete/missing`：缺失（漏读）
  - `insert`：多读（插入）
  - `noise`：噪声块（如卡壳重复造成的污染片段）
- 支持日语常见情况：**原文假名、识别汉字**——通过“读音归一”实现可对齐（见 4.2）。
- 前端高亮：绿色/红色/灰色等显示差异；噪声块可单独折叠或提示。

### 2.5 递进遮挡模式（progressive masking）
- 训练目标：从“全显示跟读”逐步提升到“高遮挡背诵”。
- 典型级别：
  - Level 0：全文显示
  - Level 1：遮挡 20%
  - Level 2：遮挡 40%
  - Level 3：遮挡 70%
  - Level 4：几乎全遮挡（仅保留标点/少量提示）
- 遮挡方案由**规则策略**生成；当用户卡关时可调用 AI 提供更精确遮挡建议（可插拔）。
- 支持“错误热区优先遮挡/保留”策略：例如错误多的词不遮挡，或相反（强化记忆），策略可配置。

### 2.6 训练记录与进度
- 记录每段练习：时间、遮挡级别、识别文本、对齐结果、得分（可选）
- 进度面板：段落完成度、平均准确率、常错词统计
- 导出（可选）：JSON/CSV 供后续分析

---

## 3. 模块构成（工程视角）

### 3.1 总体架构（推荐）
- **Web 前端**：文章展示、遮挡渲染、录音、结果高亮与进度
- **API 后端**：文章处理、TTS、STT、对齐、遮挡策略、存储
- **推理/任务 Worker（可选）**：执行 TTS/STT 等重任务与队列处理
- **存储层**：SQLite/Postgres + 文件存储（音频、缓存）

### 3.2 模块划分

#### A. 前端模块（Web App）
- ArticleInput：文章输入与预处理预览
- ArticleViewer：全文/分段展示（预留注音层）
- MaskRenderer：遮挡渲染（按 token/短语级遮挡）
- Recorder：录音与上传（MediaRecorder/WebAudio）
- PracticeSession：练习流程控制（段落/级别推进）
- DiffHighlighter：对齐结果可视化（词级高亮）
- ReportPanel：得分与错误统计、历史记录

#### B. 后端模块（API）
- Article Service：清洗、分段、tokenize、读音生成（可选）
- TTS Service：生成标准音频、缓存与拉取
- STT Service：音频转写（本地/在线适配）
- Align Service：文本对齐、噪声块检测、输出 spans
- Masking Service：递进遮挡策略生成与推进
- Storage Service：文章、音频、会话、缓存的存储抽象

#### C. Worker 模块（可选）
- 任务队列：TTS/STT 异步执行（提升响应速度与并发）
- 音频转码：统一音频格式（ffmpeg）
- 缓存清理：按策略清理过期音频与中间结果

---

## 4. 关键技术设计

### 4.1 分词与 Token 规范化
对齐与遮挡都依赖 token 化质量。
- 英语：空格 + 标点拆分（MVP 足够）
- 日语：推荐 **SudachiPy / MeCab+UniDic** 做分词
- 统一规范化：全/半角、空白、标点、长音等

### 4.2 日语“假名↔汉字”对齐：读音归一（推荐默认）
由于 STT 常输出汉字，而原文可能是假名（或相反），对齐建议使用：
- token.surface：原表记（用于 UI 展示）
- token.yomi：读音（カタカナ/かな，用于对齐键）

对齐默认以 `yomi` 作为 key：
- 表记不同但读音一致：可判为正确（适合朗读训练）
- 若需要严格背诵：可切换为 `surface` 对齐（表记必须一致）

### 4.3 文本对齐算法（MVP）
- 输入：ref_tokens（原文）、hyp_tokens（识别）
- 算法：编辑距离 DP（Levenshtein / Needleman–Wunsch 全局对齐）
- 输出：对齐路径 + token 状态
  - correct / substitute / insert / missing(delete)

#### 4.3.1 噪声块（重复/卡壳）检测与切分（增强鲁棒）
针对“局部重复污染导致前缀错乱、但后半段正确”的典型情况：
- 从尾部寻找稳定“锚点 n-gram”
- 以锚点切分后半段先对齐（确保正确部分不被污染影响）
- 对前缀执行局部对齐，并将高重复相似片段标记为 `noise_span`（可折叠）

### 4.4 递进遮挡策略（规则优先，AI 可插拔）
MVP 采用规则策略：
- 依据遮挡级别设定目标遮挡比例
- 选择遮挡单位：token 或短语（建议 token 级起步）
- 遮挡优先级可配置：
  - 高频功能词（助词等）优先遮挡（强化语法）
  - 或错误热区优先保留（减少挫败感）
- 生成遮挡方案：返回需要遮挡的 token index 列表

AI 插拔点（第二阶段）：
- 输入：文章、分词、错词统计、目标遮挡比例
- 输出：遮挡 token 列表 + 简要原因（可选）

---

## 5. API 设计（示例）

### 5.1 文章
- `POST /articles`
  - body: `{ "text": "...", "lang": "ja|en|zh" }`
  - return: `{ "article_id": "...", "segments": [...] }`
- `GET /articles/{article_id}`：获取全文与分段信息

### 5.2 TTS
- `POST /articles/{article_id}/tts`
  - 可选按段：`segment_id`
  - return: `{ "audio_url": "...", "cached": true|false }`

### 5.3 STT + 对齐（按段练习）
- `POST /practice/attempts`
  - body: `{ "article_id": "...", "segment_id": "...", "audio_file": ... }`
  - return:
    ```json
    {
      "segment_id": "seg-03",
      "recognized_text": "...",
      "alignment": {
        "ref_tokens": [{"surface":"...", "status":"correct"}],
        "hyp_tokens": [{"surface":"...", "status":"insert"}],
        "noise_spans": [{"start": 3, "end": 8, "reason":"repeat"}]
      }
    }
    ```

### 5.4 遮挡
- `POST /masking/plan`
  - body: `{ "article_id": "...", "segment_id": "...", "level": 2, "history": {...} }`
  - return: `{ "level": 2, "masked_token_indices": [1,5,7,...] }`

---

## 6. 数据结构（建议）

### 6.1 Token
```json
{
  "surface": "親御さん",
  "yomi": "オヤゴサン",
  "pos": "NOUN",
  "start": 12,
  "end": 16
}
```

### 6.2 对齐输出（spans）
- 以 token 状态驱动 UI 高亮：
```json
{
  "tokens": [
    {"t":"私", "status":"correct"},
    {"t":"のみならず", "status":"substitute", "ref":"のみならず"},
    {"t":"、", "status":"correct"}
  ],
  "noise_spans": [{"start": 1, "end": 6}]
}
```

---

## 7. 技术选型建议

### 7.1 MVP 推荐栈
- 前端：React + Vite + TypeScript
- 后端：FastAPI + Pydantic
- 音频：MediaRecorder（前端）、ffmpeg（后端转码）
- STT：
  - 本地：Whisper（CPU/GPU）
  - 在线：按需接入（成本低、工程简单）（第一版以此方案）
- TTS：
  - 本地：轻量 TTS（质量一般）
  - 在线：高质量 TTS（成本可控）（第一版以此方案）（优先 edge-tts）
- DB：Postgres（线上）
- 部署：Docker Compose（本地/服务器）

---

## 8. 代码组织（建议目录）

```
project-root/
  apps/
    web/                  # React/Vite 前端
    api/                  # FastAPI 后端
  docker/
    docker-compose.yml
  data/
    articles/
    audio/
    sessions/
  README.md
```

---

## 9. 迭代路线图

### Phase 1（MVP）
- 分段 + TTS 缓存
- 录音上传 + STT
- 读音归一 + 文本对齐 + 高亮
- 递进遮挡（规则）
- 训练记录（Postgres）

### Phase 2（增强体验）
- 准实时（切片识别）
- 遮挡 AI 建议（可插拔）
- 常错词卡片、复习计划（艾宾浩斯）
- 注音展示（假名）

### Phase 3（评测级能力）
- forced alignment（音频↔文本）
- 更细的发音/重音/停顿评分
- 多用户与教师端（可选）

---

## 10. 成功标准（MVP 验收）
- 能输入文章并自动分段
- 能生成并播放标准朗读音频
- 能录音并完成 STT 转写
- 能在 UI 上将正确/错误/缺失/多读高亮展示
- 在日语场景下支持假名↔汉字对齐（读音归一）
- 能使用递进遮挡完成从 Level0 推进到更高遮挡级别的训练闭环

---

## 11. 品牌信息
- 项目名：**AlignSpeak**
- 核心关键词：Alignment（对齐） / Speak（朗读） / Progressive Masking（递进遮挡）
