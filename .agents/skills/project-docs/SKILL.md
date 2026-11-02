---
name: project-docs
description: "Maintain Caretellia project documentation. Use when documenting architecture, dependencies, development/build troubleshooting, release workflows, or updating docs after a code/config change."
---

# Caretellia 项目文档维护

## 目标

让 `docs/` 准确反映 Caretellia 当前代码、配置和开发流程，并确保相关实现变更同步维护文档。

## 文档入口

- [文档索引](../../../docs/README.md)
- [开发与构建排障](../../../docs/DEVELOPMENT.md)
- [依赖说明](../../../docs/DEPENDENCIES.md)
- [架构与耦合清单](../../../docs/ARCHITECTURE.md)
- [版本与发布](../../../docs/RELEASE.md)

## 工作步骤

1. 先检查工作区状态，保留所有既有改动；不要覆盖用户修改或通过回退/清理命令移除文件。
2. 从实现和权威配置中确认事实：`package.json`/lock、`src-tauri/Cargo.toml`/lock、Tauri 配置/capabilities、源代码、脚本和 `.github/workflows/`。遇到相互矛盾时先报告或核实，不把猜测写成事实。
3. 用 [架构与耦合清单](../../../docs/ARCHITECTURE.md) 识别调用端、实现端、格式、持久化和平台条件；同步检查所有相关模块。
4. 按影响范围更新 `docs/` 对应页面。同一行为变化涉及多个主题时逐页更新，不复制大段重复内容，使用相对链接交叉引用。
5. 检查命令、路径、版本文件列表、支持平台和故障建议是否有代码/配置依据。涉及秘密时仅说明 secret 名称和配置位置，绝不输出或保存密钥值。
6. 验证新旧 Markdown 相对链接、指令 frontmatter 或 Skill frontmatter；按变更范围运行 `npm run build`、Cargo 检查或目标平台命令。项目没有专用测试脚本，不能虚报测试通过。
7. 汇报更新了哪些文档、验证结果，以及由于平台/工具/凭据限制未执行的检查。

## 变更到文档的路由

- Vue 组件、模型、CLC、历史数据、设置、语言和样式 → `ARCHITECTURE.md`；操作或行为变化时再更新 `DEVELOPMENT.md`。
- npm/Cargo 依赖、Tauri 插件和 capability → `DEPENDENCIES.md`；构建步骤/系统包变化时再更新 `DEVELOPMENT.md`。
- 版本脚本、平台 workflow、签名、更新器和发布 → `RELEASE.md`；本地开发/构建步骤变化时再更新 `DEVELOPMENT.md`。
- 新增或删除开发入口、命令、平台支持及排障知识 → `DEVELOPMENT.md`。
- 文档新增、重命名或导航调整 → `docs/README.md`。

纯格式或内部重命名且无行为、操作、依赖或维护影响时，不需要机械地改文档；需要在变更总结中交代判断。
