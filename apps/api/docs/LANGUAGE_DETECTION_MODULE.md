# AlignSpeak 语种检测模块说明（MVP）

更新时间：2026-03-04

## 1. 目标与范围
- 在文章创建链路中自动检测输入文本语种。
- 为前端提供“输入中实时检测语种”的能力。
- 语种检测核心实现为内部模块函数，不单独对外暴露独立公开模块接口。

## 2. 技术方案
- 检测库：`CLD2`（Python 绑定 `pycld2`）。
- 模块位置：`app/services/language_detection_service.py`
- 核心函数：`detect_language(text: str) -> LanguageDetectionResult`

`LanguageDetectionResult` 字段：
- `detected_language`: `ja | en | zh | unknown`
- `raw_language`: CLD2 原始语言码（或回退标记）
- `confidence`: 0~1（可能为空）
- `reliable`: 是否可靠

## 3. 设计约束
- 语种检测服务函数为内部调用，不新增独立公共路由。
- 文章模块负责对外暴露检测能力（作为文章管理的一部分）。
- 输入过短文本（<8）返回 `unknown`，避免误判。

## 4. 文章管理接口扩展
在文章模块新增接口：

`POST /articles/detect-language`

用途：
- 用户手动输入文本时，前端可实时调用检测语种。
- 用户上传文件时，后端先抽取文本后检测语种并返回。

鉴权：
- 需要登录（Bearer Token）。

请求格式：
1. `application/json`（手动文本）
```json
{
  "text": "Two roads diverged in a yellow wood..."
}
```

2. `multipart/form-data`（文件）
- `source_type=upload`：`file` 为 `txt/md`
- `source_type=ocr`：`file` 为图片，先 OCR 提取文本后检测

响应示例：
```json
{
  "detected_language": "en",
  "detected_confidence": 0.96,
  "detected_reliable": true,
  "detected_raw_language": "en",
  "text_length": 128
}
```

## 5. 文章创建接口扩展
`POST /articles` 响应新增：
- `detected_language`
- `detected_confidence`
- `detected_reliable`
- `detected_raw_language`

用于在“创建文章”提交后将自动检测结果返回前端展示。

## 6. 错误与边界
- `VALIDATION_ERROR`：请求格式错误、空内容、不支持类型。
- `OCR_EMPTY_TEXT`：OCR 未提取到有效文本。
- 对未知语种或置信度过低返回 `unknown`，由前端提示用户手动确认语言。

## 7. Adjustment (2026-03-04)
- `POST /articles/detect-language` now supports **text-only JSON** payload:
  - `application/json` with `{ "text": "..." }`
- File parsing is no longer handled by this endpoint.
- File language detection is unified in `POST /articles`:
  - Backend auto-detects file type by extension.
  - Text files (`txt/md`) -> text parser.
  - Image files (`png/jpg/jpeg/webp`) -> OCR parser.
  - Creation response returns `detected_language` and related detection fields.
