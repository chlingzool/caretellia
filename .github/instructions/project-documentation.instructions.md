---
description: "Use when changing Caretellia source code, Rust/Tauri configuration, dependencies, scripts, or CI. Map the change to docs/ and update every affected guide in the same change."
applyTo:
  - "src/**"
  - "src-tauri/**"
  - "scripts/**"
  - "package.json"
  - "package-lock.json"
  - "vite.config.ts"
  - ".github/workflows/**"
---

# Caretellia 文档同步要求

修改匹配文件时，先查看 `docs/README.md` 与 `docs/ARCHITECTURE.md`，再根据影响范围核对 `docs/DEVELOPMENT.md`、`docs/DEPENDENCIES.md`、`docs/RELEASE.md`：

- 用户操作、开发命令、构建依赖、平台支持或排障变化 → 更新 `DEVELOPMENT.md`。
- npm/Cargo 依赖、插件接入或 capability 权限变化 → 更新 `DEPENDENCIES.md`，必要时更新 `DEVELOPMENT.md`。
- 模块职责、数据流、共享契约、持久化、格式或跨文件改动 → 更新 `ARCHITECTURE.md`。
- 版本同步、CI、签名、更新器或发布步骤变化 → 更新 `RELEASE.md`。
- 影响多个方面时逐一更新，不以只更新 README 或指令文件代替产品/开发文档。

只在行为、操作方式或维护责任变化时更新事实说明；纯格式/重命名等无行为变化可不改文档。修改完成后核对相对链接和命令准确性，按范围运行验证，并在答复中列明文档改动与未运行的检查。
