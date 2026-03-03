# AlignSpeak Web（React + Vite + Yarn Berry）

## 运行
```bash
yarn
yarn dev
```

开发环境默认启用 MSW（Mock Service Worker），接口请求会被本地 mock 数据拦截。

## 构建与检查
```bash
yarn lint
yarn build
```

## 分层目录
```text
src/
  domain/           # 领域模型与纯业务结构
  application/      # usecase 与 ports
  infrastructure/   # API client / repository 实现
  components/       # 纯 UI 组件
  hooks/            # 页面编排与状态管理
  mocks/            # MSW 假数据和 handlers
```


## Mock Toggle
To call local backend API in development, disable MSW mock:

```bash
# PowerShell
$env:VITE_USE_MOCK="false"
yarn dev
```

Or create `.env.local` in `apps/web`:

```env
VITE_USE_MOCK=false
```

When mock is disabled, `/api/*` requests are proxied by Vite to `http://localhost:8000`.
