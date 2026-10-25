# 依赖清单与升级联动

本文按仓库当前 `package.json` 与 `src-tauri/Cargo.toml` 记录直接依赖；锁文件中还包含传递依赖，不在这里逐项推测其用途。

## npm 直接依赖

### 运行依赖

| 依赖 | 用途/使用位置 |
| --- | --- |
| `vue` | 前端视图、响应式状态和组件。 |
| `@tauri-apps/api` | 前端访问 Tauri 核心 API（invoke、事件、应用生命周期）。 |
| `@tauri-apps/plugin-dialog` | 原生文件打开/保存与确认对话框。 |
| `@tauri-apps/plugin-opener` | Rust 端注册的 opener 插件；前端需使用该能力时遵循 Tauri 插件接线方式。 |
| `@tauri-apps/plugin-process` | 进程/重启操作；设置页使用重启 API。 |
| `@tauri-apps/plugin-updater` | 桌面端应用内检查和安装更新；移动/浏览器运行时不提供相同更新能力。 |

### 开发依赖

| 依赖 | 用途 |
| --- | --- |
| `@tauri-apps/cli` | `npm run tauri` 使用的 Tauri 命令行工具。 |
| `@vitejs/plugin-vue` | Vite 中处理 Vue 单文件组件。 |
| `typescript` | TypeScript 编译器和类型系统。 |
| `vite` | 前端开发服务器与资源构建。 |
| `vue-tsc` | Vue 单文件组件的类型检查；`npm run build` 先运行它。 |

## Cargo 直接依赖

| 依赖 | 条件/用途 |
| --- | --- |
| `tauri` | 桌面/移动应用运行时。 |
| `tauri-build` | 构建时读取和生成 Tauri 配置。 |
| `serde`、`serde_json` | Rust 与前端命令之间的数据序列化。 |
| `tauri-plugin-dialog`、`tauri-plugin-opener`、`tauri-plugin-process` | 原生对话框、打开器和进程能力。 |
| `tauri-plugin-updater` | Windows/macOS/Linux 桌面端更新插件。 |
| `tauri-plugin-single-instance` | Windows/Linux 单实例与文件打开转发。 |
| `windows` | Windows 系统字体枚举所需 Win32 API。 |
| `cocoa`、`objc` | macOS 系统字体枚举。 |
| `fontconfig`、`yeslogic-fontconfig-sys` | Linux Fontconfig 初始化和系统字体枚举。 |

平台条件依赖定义在 `src-tauri/Cargo.toml`。插件也必须在 `src-tauri/src/lib.rs` 注册；Rust 目标依赖应使用正确的 target 条件，不能只因 Windows 构建通过就推断所有平台可编译。

## 更新依赖的步骤

### npm

1. 用 npm 命令添加/升级依赖，不直接手改 `package-lock.json`。
2. 将 `package.json` 与 `package-lock.json` 一起检查并提交。
3. 运行 `npm ci` 和 `npm run build`。
4. 若新增 Tauri 插件，继续完成下方插件联动检查。

### Cargo

1. 更新 `src-tauri/Cargo.toml` 中的依赖和平台条件。
2. 用 Cargo 更新 `src-tauri/Cargo.lock`，并核对 lockfile 变化是否符合预期。
3. 运行 `cargo check --manifest-path src-tauri/Cargo.toml`；对 target-specific 依赖按其目标平台验证。
4. 如果依赖影响 CI 系统包、Rust target 或 Android/iOS 环境，更新 `.github/workflows/` 与 [开发/构建文档](./DEVELOPMENT.md)。

## 新增或移除 Tauri 插件检查表

Tauri 插件通常横跨数个层次。逐项确认是否需要修改：

1. npm 前端 API 依赖（`package.json`、`package-lock.json`）。
2. Rust 插件 crate 与 Cargo 锁文件（`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`）。
3. 插件初始化/平台条件（`src-tauri/src/lib.rs`）。
4. 前端调用点与运行环境限制（`src/`）。
5. Capability 权限（`src-tauri/capabilities/*.json`），只授予实际需要的权限。
6. 相关功能、平台支持、CI 和本目录文档。

移除插件时也需搜索前端 import/invoke、Rust 注册和 capability permission，避免留下失效权限或构建引用。

## 版本号与锁文件不是依赖升级

`npm run verup` 只同步项目自身版本，不升级库依赖。它更新 `package.json`、`package-lock.json` 根项目记录、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock`；参阅 [版本与发布](./RELEASE.md)。
