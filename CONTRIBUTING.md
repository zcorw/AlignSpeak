# AlignSpeak 贡献指南

## 1. 提交原则
- 单个 PR 只做一类变更
- 优先最小可验证改动
- 用户可见行为变更必须附带测试或验证步骤
- 涉及架构边界变更必须同步更新文档

## 2. 强制约束
以下任一不满足，不应合并：
- 分层架构
- 单向依赖
- 职责隔离
- 可测试优先
- 扩展优先
- 禁止万能工具类
- 禁止控制层写业务逻辑
- 禁止组件直接发请求
- 禁止隐式耦合

## 3. 分支与提交规范
分支建议：
- feat/<topic>
- fix/<topic>
- docs/<topic>
- refactor/<topic>

提交信息遵循 Conventional Commits：
- feat: ...
- fix: ...
- docs: ...
- refactor: ...
- test: ...
- chore: ...

## 4. PR 最低清单
- 背景与目标
- 实现方案与影响范围
- API/数据结构变更（如有）
- 测试结果或人工验证步骤
- 兼容性说明
- 文档同步说明

## 5. 评审重点
- 正确性
- 架构一致性
- 可维护性
- 安全性
- 可观测性

## 6. Docker Compose（强制）
开发、联调、CI 统一由 docker compose 管理。


## Encoding Convention
- All newly created or updated files must use UTF-8 (without BOM).
- Do not commit files encoded as GBK/ANSI/UTF-16.