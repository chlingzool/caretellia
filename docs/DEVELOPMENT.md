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

## 应用内菜单与弹窗

移动端标题栏菜单以 Vue Drawer 展示；表单下拉、HSV 正方形颜色面板、Popconfirm、Dialog 和 Toast 也使用 Vue 组件，避免应用内依赖系统原生表单/确认控件。滚动条统一应用主题化的 CSS 样式，并使用 `scrollbar-gutter: stable` 在模态/抽屉锁定背景滚动时保留布局空间；页面仍使用浏览器滚动、键盘和触控行为。操作反馈按语义选型：保存、导入、导出等成功结果用底部 Toast，底部进度条显示剩余时间并在悬停/聚焦时暂停；失败原因留在对应页面的 Inline Alert，避免短时提示消失或与持久错误重复；桌面轻量危险操作用贴近触发控件的 Popconfirm，窄屏改为 Bottom Sheet；清空全部数据、安装更新等关键决策才使用居中 Dialog，点击遮罩不会取消，使用取消按钮、Escape 或 Android 返回键关闭。清除全部数据的确认按钮在 Dialog 打开后延迟 5 秒启用。新增交互时复用 `src/components/Popconfirm.vue`、`src/components/ToastHost.vue`、`src/components/AppSelect.vue`、`src/components/AppColorPicker.vue` 及 `src/composables/confirmationDialog.ts` / `src/composables/toast.ts`，保持键盘操作、焦点管理、Android 返回键与可访问状态播报。场景切换在主内容区播放短入场过渡而不重建包裹 `KeepAlive` 的编辑器，并尊重系统“减少动态效果”偏好。设置页分区导航会跟随页面滚动更新当前焦点分区。访问用户文件或保存路径仍使用 Tauri/浏览器文件选择器；这些系统文件界面用于授权本机文件访问。

## 标题栏与窄屏编辑器预览

“标题栏位置”设置控制应用顶部 Header（Caretellia 品牌栏）以及页面内的导航 command-bar：可将 Header 固定在上方、固定在下方，或仅在窄屏固定在下方；默认保持上方。为保留此前的页面导航栏位置行为，command-bar 也跟随该选项，在底部模式下与 Header 分层排列。设置页的大分类导航会在底部品牌栏模式下贴合到内容顶部，避免出现额外留白；窄屏编辑器的预览固定在保存、重置、另存为和导出操作栏上方，可折叠展开；“手机预览默认状态”设置选择打开编辑器时默认展开或折叠，桌面预览不受该设置影响。底部标题栏模式下，预览栏、编辑操作栏、command-bar 和 Header 从上至下堆叠，避免互相遮挡。预览定位相对于视口，而不是编辑器的容器；拖动预览宽度时会将尺寸锁定在可见区域内，避免在较窄窗口下被推出屏幕。预览宽度拖动柄及字号滑块不显示焦点边框，但键盘操作仍有焦点状态提示。

设置中的“接受不稳定更新”默认关闭。桌面版开启后，更新检查改为读取 GitHub `unstable` 预发布清单，关闭后恢复稳定 Release 通道；两种通道都使用 Tauri updater 的签名校验。该设置不改变已安装版本，Android/iOS 和浏览器版不提供应用内安装。

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
