# 开发、运行、构建与排障

## 项目技术栈

- 前端：Vue 3、TypeScript、Vite。
- 桌面与移动容器：Tauri 2；Rust 原生命令位于 `src-tauri/`。
- npm 包管理：npm，依赖清单为 `package.json`，可复现安装使用 `package-lock.json`。
- Rust 包管理：Cargo，清单/锁文件分别是 `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`。
- 项目没有声明单独的 `test` 或 lint 脚本；不要把构建通过描述成测试套件通过。

## 开始修改

1. 安装 Node.js（建议 LTS）与 npm。
2. 安装 Rust stable 工具链及 Cargo。
3. 按目标平台安装 Tauri 2 所需的系统依赖，参阅 [Tauri 2 前置条件](https://v2.tauri.app/start/prerequisites/)。
4. 在仓库根目录执行 `npm ci`，按锁文件安装前端依赖。
5. 启动桌面开发应用：`npm run tauri dev`。该命令由 Tauri 配置调用 `npm run dev`，Vite 开发服务使用 `http://localhost:1420`。
6. 只开发浏览器前端时，可执行 `npm run dev`；这不会启动 Rust/Tauri 原生端，原生命令、系统文件对话框和桌面 API 需在 Tauri 环境验证。

建议先查看 [架构与跨文件修改清单](./ARCHITECTURE.md)，避免只改共享模型、CLC 编解码器或 Rust 命令的一侧。

## 常用命令

从仓库根目录运行：

| 目的 | 命令 | 说明 |
| --- | --- | --- |
| 安装锁定的 npm 依赖 | `npm ci` | CI 和干净安装优先使用；不要用它更新锁文件。 |
| 仅启动 Vite | `npm run dev` | 浏览器前端开发服务。 |
| 启动 Tauri 桌面开发 | `npm run tauri dev` | 同时运行前端和本机桌面容器。 |
| 检查 TypeScript 并构建前端 | `npm run build` | 实际顺序为 `vue-tsc --noEmit` 后 `vite build`。 |
| 预览前端构建产物 | `npm run preview` | 预览 `dist/`；不包含原生容器行为。 |
| 构建桌面安装包 | `npm run tauri build` | 需要目标平台 Rust/Tauri 系统依赖。 |
| Rust 编译检查 | `cargo check --manifest-path src-tauri/Cargo.toml` | 检查当前主机目标；不能代替其他操作系统的交叉构建。 |
| 同步项目版本 | `npm run verup` | 交互式更新版本字段和锁文件；不会构建或执行 Git 操作。 |

Tauri 配置的 `beforeBuildCommand` 会先运行 `npm run build`，`frontendDist` 指向 `dist`。Vite 默认开发端口配置在 `vite.config.ts`，Tauri `devUrl` 在 `src-tauri/tauri.conf.json`；修改其中一处时需保持两处一致。

## Android 本地构建

Android 构建需要 Android SDK/NDK、Java、Rust Android target 以及 Tauri Android 工程。CI 当前使用 Java 17、NDK `27.2.12479018`、`aarch64-linux-android` target，并在干净 runner 上运行：

```sh
npm ci
npm run tauri -- android init --ci --skip-targets-install
npm run tauri -- android build --debug --apk --target aarch64 --ci
```

本地可按 Tauri 2 的 Android 指南安装平台工具并初始化工程。仓库中的 Android 生成目录为 `src-tauri/gen/android/`；初始化或升级 Tauri Android 工程后，检查生成配置是否需要纳入版本控制。CI 产物是 arm64 调试 APK，不是发布签名包。Windows PowerShell 下的设备安装/CDP 调试流程见现有 [tauri-android-build Skill](../.agents/skills/tauri-android-build/SKILL.md)；执行其中命令前核对实际包名 `com.chlingzool.caretellia`、APK 路径及本机环境。

## 平台与 CI 构建入口

平台工作流位于 `.github/workflows/`：

- `windows-build.yml`：Windows 桌面安装包。
- `linux-build.yml`：x64 与 arm64 Linux 桌面构建；安装 WebKitGTK 等系统开发包。
- `macos-ios-build.yml`：两个 macOS 桌面架构及 iOS Simulator 调试应用。
- `android-build.yml`：arm64 Android 调试 APK。
- `tauri-action.yml`：手动触发或 `release` 分支 push 时并行调用平台工作流，并将移动产物附加到 Release。

iOS 工作流只构建 Simulator 应用，不签名、不面向实体 iPhone 或 App Store 发布。桌面构建使用 Tauri bundle；本机产物位置受平台和 Tauri 配置影响，移动 CI 产物通过 Actions artifact 下载。

## 常见构建问题

| 现象 | 优先检查 |
| --- | --- |
| `npm ci` 报锁文件与清单不匹配 | 对比 `package.json` 与 `package-lock.json`。依赖变更应使用 `npm install` 更新锁文件并一并提交；不要手工编辑锁文件。 |
| `vue-tsc` 类型错误 | 先修复 `npm run build` 输出的首个类型错误；检查 `src/types/postcard.ts` 与所有构造/读取该类型的位置是否同步。 |
| Vite 端口冲突或 Tauri 页面无法连接 | 检查 `vite.config.ts` 的 server port 与 `src-tauri/tauri.conf.json` 的 `build.devUrl` 是否均为可用的同一地址。 |
| 桌面构建缺少系统库、WebView 或 linker | 按 Tauri 官方前置条件安装目标系统工具链/开发包；Rust 能安装并不代表系统依赖齐全。 |
| Cargo 提示缺少交叉编译 target | 为目标安装对应 Rust target；Android 还需 SDK/NDK 与 Java，并按工作流固定版本核对环境。 |
| Linux 字体相关链接错误 | 检查 Fontconfig 头文件/开发包和 `src-tauri/Cargo.toml` 的 Linux 条件依赖。 |
| 移动端构建没有 APK 或 iOS `.app` | 检查是否完成 `android init`/`ios init`、目标架构是否正确，以及平台 SDK 与 Rust target 是否安装；CI 会在未找到产物时失败。 |
| 更新器不能检查或安装更新 | 检查目标是否为支持 updater 的桌面平台、Release 是否已正式发布，以及签名私钥/密码 GitHub Actions secrets 是否配置正确。 |
| 本地更改生成目录但不清楚是否应提交 | 先检查 `src-tauri/.gitignore` 和现有跟踪状态；不要把 `target/`、`dist/` 或缓存产物当作源码。 |

## 验证命令

- 前端、Vue/TypeScript 改动：`npm run build`。
- Rust/Tauri 改动：`cargo check --manifest-path src-tauri/Cargo.toml`，再按需运行 `npm run tauri dev` 或目标平台构建。
- 依赖、插件、权限或移动平台改动：同时检查对应 lockfile、Tauri capability、平台条件编译和 CI 工作流。
- 文档/AI 指令改动：检查相对链接、YAML frontmatter 和 Skill 元数据；单纯文档变更无需运行应用构建。

当前 `package.json` 未提供自动化测试脚本；若某项验证因系统工具、平台或凭据不可用而未运行，应在结果中明确说明，不要声称已通过。
