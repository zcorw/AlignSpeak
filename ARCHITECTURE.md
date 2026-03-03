# AlignSpeak 架构说明

## 1. 目标
AlignSpeak 是一个面向朗读训练的应用，MVP 闭环包括：文本导入、录音识别、对齐高亮、遮挡训练、记录沉淀。

## 2. 分层架构
- presentation：路由、参数校验、鉴权入口
- application：用例编排与业务流程
- domain：领域模型、领域规则、纯算法
- infrastructure：仓储实现、数据库、安全组件

依赖方向：
- presentation -> application -> domain
- infrastructure -> application/domain

禁止：
- 控制层写业务逻辑
- 反向依赖与跨层直连
- 隐式耦合

## 3. 核心模块
- 账号模块：注册、登录、登出、当前用户
- 文章模块：创建文章、段落切分、详情查询、TTS
- 练习模块：提交识别、对齐计算、准确率、历史记录
- 遮挡模块：按等级生成遮挡计划
- 前端聚合模块（BFF）：首页、练习页、进度页、我的页面

## 4. 核心流程
1. 用户登录获取 access token
2. 选择文档与段落进入练习
3. 录音后提交识别
4. 后端返回对齐结果
5. 前端展示差异高亮并支持继续练习

## 5. 数据与持久化现状
- 业务仓储当前默认是 InMemory 实现
- PostgreSQL 与 SQLAlchemy 已接入并自动建表
- 当前阶段是“表已创建，业务默认不落库”

## 6. 工程原则
- 可测试优先
- 扩展优先
- 禁止万能工具类
- 禁止组件直接发请求

## 7. Docker Compose（强制）
开发、联调、CI 统一使用 docker compose。

常用命令：
- docker compose up -d --build
- docker compose down
- docker compose up -d --build <service>
- docker compose logs -f <service>