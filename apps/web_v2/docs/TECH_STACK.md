# AlignSpeak Web V2 技术栈文档

本文档记录 web_v2 项目的技术栈选型和配置说明。

---

## 1. 核心框架

### 1.1 前端框架
- **React 18+**
- **TypeScript**
- **Vite** - 构建工具

### 1.2 路由
- **React Router v6**
- 使用 `push` 模式进行页面导航
- 支持浏览器返回能力

---

## 2. 状态管理

### 2.1 全局状态
- **Zustand**
- 轻量（~1KB）
- TypeScript 类型安全
- 支持 Redux DevTools

### 2.2 管理范围
- 用户认证状态（access_token, refresh_token）
- 当前文章上下文（article_id, segment_id, level）
- 流程恢复状态（current_step, flow_version）
- 未同步数据队列

---

## 3. UI 组件库

### 3.1 组件库
- **Material-UI (MUI)**
- 成熟稳定，社区活跃
- TypeScript 支持完善
- 组件丰富，覆盖大部分需求
- 自定义主题能力强

### 3.2 样式方案
- 参考 previews 样式（深色主题、圆角、渐变等）
- 允许根据 MUI 框架特色进行调整
- MVP 阶段仅支持暗色主题

---

## 4. 国际化

### 4.1 UI 文案
- **react-i18next**
- 支持中英文切换
- 默认语言：根据浏览器语言自动选择，默认中文

### 4.2 文章语种
- 支持日语、中文、英语文章
- 日语注音使用 HTML `<ruby>` 标签渲染
- 数据来源：后端返回的 `yomi` 字段

---

## 5. 音频处理

### 5.1 录音方案
- **AudioContext + AudioWorklet**
- 降级方案：ScriptProcessorNode
- 音频格式：PCM 分片上传
- 分片策略：建议每 2 秒一片
- 上传方式：FormData multipart

### 5.2 音频播放
- 原生 HTML5 Audio
- 点击播放时才加载（不预加载）
- 依赖浏览器 HTTP 缓存

---

## 6. API 调用

### 6.1 HTTP 客户端
- **Axios** 或 **Fetch API**
- 调用 BFF 聚合接口（`/api/bff/v1/*`）
- 字段转换：后端 snake_case → 前端 camelCase

### 6.2 数据同步
- 关键动作即刻保存
- 同步失败不阻断用户操作
- 后台自动重试（指数退避：1s, 2s, 4s, 8s, 16s, 32s，最多 6 次）
- 未同步数据存储在 localStorage

---

## 7. 测试

### 7.1 测试框架
- **Vitest** - 单元测试
- **React Testing Library** - 组件测试
- 与 Vite 无缝集成

### 7.2 覆盖率目标
- 核心业务逻辑：80%+
- 整体覆盖率：60%+
- MVP 阶段不实现 E2E 测试

### 7.3 Mock 数据
- 存放位置：`src/__mocks__/fixtures/`
- 按模块分类：`articles.ts`, `practice.ts`, `alignment.ts`
- 必须与 BFF 契约保持一致

---

## 8. 开发工具

### 8.1 代码规范
- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **TypeScript** - 类型检查

### 8.2 版本控制
- Git
- 提交规范：Conventional Commits

---

## 9. 浏览器兼容性

### 9.1 目标浏览器
- Chrome/Edge 最新版
- Firefox 最新版
- Safari 最新版（包括 iOS Safari）

### 9.2 特殊处理
- iOS Safari 不支持 webm 格式
- 通过 PCM 方案统一处理音频格式
- 后端统一编码为 wav 格式

---

## 10. 性能优化

### 10.1 MVP 阶段不实现
- 虚拟滚动
- 音频预加载
- 前端音频缓存（IndexedDB）

### 10.2 依赖优化
- 按需加载 MUI 组件
- 代码分割（React.lazy + Suspense）
- 生产环境压缩和 Tree Shaking

---

## 文档版本

- **创建时间**：2026-03-05
- **最后更新**：2026-03-05
- **状态**：已完成
