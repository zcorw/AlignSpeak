# AlignSpeak 前端组件结构说明（移动端单页基准）

## 1. 目标
本文档定义基于 `previews/index.html` 的前端组件结构，用于将已确认的静态样式落地为可维护的 React + TypeScript 实现。

## 2. 页面形态
- 单页应用（SPA）形态
- 移动端优先
- 底部 Tab 切换四个主区块：`首页`、`练习`、`进度`、`我的`
- 练习区内部再切分两种状态：`录音前`、`识别结果`

## 3. 强制实现约束
- 分层架构：前端按 `View(组件) -> UseCase(应用层) -> Domain(纯业务) -> Infra(API/存储)` 实现。
- 单向依赖：组件只能依赖 hooks/usecase，不能反向依赖 infra。
- 职责隔离：UI 只负责展示和交互，业务计算进入 usecase/domain。
- 可测试优先：domain/usecase 必须可脱离 UI 测试。
- 扩展优先：新增模式通过策略或配置扩展，不直接改动已有核心流程。
- 禁止万能工具类：禁止创建聚合多域逻辑的 `utils.ts`。
- 禁止控制层写业务逻辑：Screen 组件不写业务规则。
- 禁止组件直接发请求：请求统一在 infra repository 中封装。
- 禁止隐式耦合：跨组件状态必须走显式 props/context/store。

## 4. 组件树
```text
App
  ├─ AppShell
  │  ├─ AppTopBar
  │  ├─ ScreenContainer
  │  │  ├─ HomeScreen
  │  │  │  ├─ DailyGoalCard
  │  │  │  └─ ArticleInputCard
  │  │  ├─ PracticeScreen
  │  │  │  ├─ PracticeModeSwitch
  │  │  │  ├─ PracticePreRecordView
  │  │  │  │  └─ MaskedArticlePanel
  │  │  │  └─ PracticeResultView
  │  │  │     ├─ CompareBlockList
  │  │  │     ├─ ErrorLegend
  │  │  │     └─ PracticeActionBar
  │  │  ├─ ProgressScreen
  │  │  │  ├─ KpiCardGroup
  │  │  │  └─ HotspotListCard
  │  │  └─ MeScreen
  │  │     ├─ AccountInfoCard
  │  │     └─ HistoryDocList
  │  │        └─ HistoryDocItem
  │  └─ BottomTabBar
  └─ AppStateProvider（可选）
```

## 5. 核心状态模型
```ts
type MainTab = "home" | "practice" | "progress" | "me";
type PracticeMode = "pre_record" | "result";

interface AppUIState {
  activeTab: MainTab;
  practiceMode: PracticeMode;
}
```

扩展业务状态（建议）：
```ts
interface PracticeContext {
  articleId: string;
  segmentId: string;
  level: number; // 0-4
  maskRatio: number;
}
```

## 6. 组件职责
### 6.1 AppShell
- 挂载顶部栏、屏幕容器、底部 Tab
- 维护 `activeTab` 并分发切换事件

### 6.2 BottomTabBar
- 渲染 4 个 tab 按钮
- 仅做 UI 和事件触发，不持有业务状态

### 6.3 PracticeScreen
- 维护 `practiceMode`（录音前/识别结果）
- 管理练习动作按钮事件：
  - `播放标准音频`
  - `开始录音` / `重新录音`
  - `提交识别` / `下一段`
- 不直接请求接口，不做对齐规则计算。

### 6.4 PracticePreRecordView
- 只展示整段原文（不按句切分）及遮罩效果
- 展示当前 level 和遮挡比例

### 6.5 PracticeResultView
- 展示行对行对比：
  - 上行原文
  - 下行识别文本
- 通过样式高亮 `漏读/多读/替换`

### 6.6 MeScreen + HistoryDocList
- 展示账号信息和历史文档
- 点击 `继续练习` 触发：
  - 切换主 tab 到 `practice`
  - 可选：切换练习模式到 `pre_record` 或保留当前

## 7. 事件流（最小闭环）
1. 用户在 `我的` 页点击某条历史文档“继续练习”
2. 设置 `activeTab = "practice"`
3. 设置当前 `articleId/segmentId`
4. 默认显示 `practiceMode = "pre_record"`
5. 点击 `开始录音` 后进入录音流程
6. 识别返回后设置 `practiceMode = "result"` 并渲染对比结果

## 8. 建议目录结构
```text
apps/web/src/
  domain/
    practice/
      entities.ts
      policies.ts
    article/
      entities.ts
  application/
    usecases/
      startPractice.ts
      submitRecognition.ts
      resumeHistoryDoc.ts
    ports/
      PracticeRepository.ts
  infrastructure/
    api/
      httpClient.ts
    repositories/
      PracticeApiRepository.ts
  components/
    layout/
      AppShell.tsx
      AppTopBar.tsx
      BottomTabBar.tsx
    screens/
      HomeScreen.tsx
      PracticeScreen.tsx
      ProgressScreen.tsx
      MeScreen.tsx
    practice/
      PracticeModeSwitch.tsx
      PracticePreRecordView.tsx
      MaskedArticlePanel.tsx
      PracticeResultView.tsx
      CompareBlockList.tsx
      ErrorLegend.tsx
      PracticeActionBar.tsx
    history/
      HistoryDocList.tsx
      HistoryDocItem.tsx
  hooks/
    useAppUIState.ts
    usePracticeState.ts
  types/
    ui.ts
    practice.ts
  pages/
    App.tsx
```

## 9. Props 设计建议
```ts
interface BottomTabBarProps {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}

interface PracticeModeSwitchProps {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}

interface HistoryDocItemProps {
  id: string;
  title: string;
  progress: number;
  level: number;
  lastPracticedAt: string;
  onResume: (docId: string) => void;
}
```

## 10. 实施顺序（建议）
1. 完成 `AppShell + BottomTabBar + 4 Screen` 空壳
2. 先实现 `domain + application(usecase)` 并补单测
3. 完成 `PracticeScreen` 双状态切换
4. 接入 `HistoryDocList -> 继续练习` 跳转到练习 tab
5. 接入假数据渲染（本地 mock）
6. 再接 API（auth/articles/practice）
