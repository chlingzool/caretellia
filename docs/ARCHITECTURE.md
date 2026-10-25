# 架构与跨文件修改清单

## 运行结构

```text
src/main.ts
  └─ src/App.vue（页面状态、设置、路由式页面切换、CLC 文件打开事件）
       ├─ postcard-editor.vue（编辑、预览、HTML/CLC 导出）
       ├─ EnvelopeViewer.vue（历史/最近查看、本地 CLC 导入与预览）
       ├─ SettingsPage.vue（设置、字体、清空本机数据、桌面更新）
       ├─ TemplateGallery.vue → templates.ts
       └─ ThanksMenu.vue

共享前端模块：
  types/postcard.ts ← clc.ts ← letterHistory.ts
                      ↑           ↑
             编辑器/查看器/模板   设置/编辑器/查看器

Tauri 原生端：
  src-tauri/src/main.rs → lib.rs → commands/fonts.rs
  前端 invoke/event ↔ lib.rs 注册的命令与 CLC 文件打开事件
  tauri.conf.json + capabilities/*.json → 插件、文件关联与权限
```

图示为职责关系摘要，不是所有 import 的完整依赖图。

## 模块职责

| 模块 | 职责 | 主要依赖/消费者 |
| --- | --- | --- |
| `src/main.ts` | Vue 应用入口，挂载 `App` 与全局滚动条样式。 | `App.vue`、`scrollbars.css` |
| `src/App.vue` | 主页面协调、设置与主题持久化、页面间状态、启动/单实例转发的 CLC 打开事件。 | 编辑器、查看器、设置页、CLC、history、Tauri API |
| `src/postcard-editor.vue` | 信件/明信片编辑和渲染，模板载入，字体选择，CLC/HTML 导出及历史保存。 | `PostcardData`、CLC、history、共享展示 CSS、系统字体 |
| `src/EnvelopeViewer.vue` | 历史及最近查看列表、本地 CLC 文件读取/解码、查看记录与展示。 | CLC、history、Tauri dialog/invoke、展示 CSS |
| `src/SettingsPage.vue` | 设置界面、系统字体、清理数据、桌面更新。 | `AppSettings`、history、字体 composable、Tauri updater/process |
| `src/types/postcard.ts` | 信件、贴纸、模板、设置的共享 TypeScript 契约。 | 编辑器、模板、CLC、history、页面 |
| `src/clc.ts` | CLC 格式编码/解码、输入验证、长度与 SHA-256 校验。 | `PostcardData`、Web Compression Streams/Crypto |
| `src/letterHistory.ts` | IndexedDB 历史/最近查看、旧 localStorage 数据迁移与数据清除。 | CLC 编解码、`PostcardData` |
| `src/templates.ts` | 内置模板内容与语言映射。 | `LetterTemplate`、`i18n.ts` |
| `src/i18n.ts` | 当前语言选择、浏览器系统语言与简易中英文本函数。 | Vue 响应式状态；各页面/组件 |
| `src/composables/useSystemFonts.ts` | Tauri 原生、浏览器 Local Font Access、Canvas 与缓存的字体发现。 | Rust `get_system_fonts`、字体选择组件 |
| `src/postcard-display.css` | 编辑/预览共用的信件呈现样式；编辑器还将样式内联进导出 HTML。 | 编辑器、查看器、导出 HTML |
| `src-tauri/src/lib.rs` | 插件/命令注册、本地文件 I/O、CLC 文件关联与启动/单实例事件转发。 | Tauri 配置、前端 invoke/listen |
| `src-tauri/src/commands/fonts.rs` | Windows/macOS/Linux 原生系统字体枚举。 | Rust 平台依赖、前端字体 composable |
| `src-tauri/tauri.conf.json`、`capabilities/` | 应用标识、构建入口、文件类型、更新器端点和允许的插件权限。 | Tauri build、Rust 插件、前端平台能力 |

## 高耦合修改场景

| 修改内容 | 同步检查/修改 |
| --- | --- |
| 增加、重命名或改变信件字段 | `src/types/postcard.ts`；`src/clc.ts` 字段验证/兼容；编辑器输入和预览、查看器、模板默认值；`src/letterHistory.ts` 的旧数据迁移/默认值；导入导出和文档。旧 CLC 数据必须有明确兼容策略。 |
| 更改信件/贴纸布局或导出显示 | `src/postcard-editor.vue`、`src/EnvelopeViewer.vue`、`src/postcard-display.css`；该 CSS 也通过 `?inline` 用于 HTML 导出，预览和导出需同时核对。 |
| 改变 CLC 二进制格式、版本、校验或限制 | `src/clc.ts` 的头部/编码/解码/校验；`PostcardData` 类型；`src/letterHistory.ts` 的 IndexedDB 与旧缓存迁移；Rust `read_clc_file`/保存命令的大小和扩展名限制；导入、导出、最近查看与历史旧文件验证。格式变化须定义旧版本读取/拒绝行为。 |
| 修改历史或最近查看存储 | `src/letterHistory.ts` 的 DB 名称、版本、object store、迁移和容量限制；`src/App.vue`、`src/EnvelopeViewer.vue`、`src/SettingsPage.vue` 的使用与清理；修改存储结构时更新升级路径，不能只改 UI。 |
| 新增 Tauri command 或变更参数 | Rust command 定义及 `src-tauri/src/lib.rs` 的 `generate_handler!` 注册；前端 `invoke()` 名称/参数序列化和返回类型；需要时更新 Cargo 平台依赖、capability 权限、错误展示和构建文档。 |
| 新增/调整 Tauri 插件或权限 | npm/Cargo 清单与 lockfile；`lib.rs` 注册及 target 条件；`src-tauri/capabilities/*.json` 最小权限；调用页面、平台边界和 [依赖说明](./DEPENDENCIES.md)。 |
| 更改系统字体发现 | `src-tauri/src/commands/fonts.rs` 与 Rust 平台依赖；`src-tauri/src/lib.rs` command 注册；`src/composables/useSystemFonts.ts` 的 invoke、浏览器回退、缓存格式；字体选择组件和设置/编辑器消费者。 |
| 增加设置项/持久化键 | `AppSettings` 类型、`src/App.vue` 默认值/读取/写入与迁移、`src/SettingsPage.vue` UI、对应语言文案及 `clearAllLocalData()` 清理逻辑；需要时更新数据清除/设置文档。 |
| 增加语言或更改本地化 | `src/i18n.ts` 的 locale 类型与解析、`src/App.vue` 设置值、页面的中英文文本、`src/templates.ts` 的模板翻译，以及 README/文档中提到的支持语言。 |
| 更改启动时打开 CLC 文件 | `src-tauri/tauri.conf.json` 文件关联；`src-tauri/src/lib.rs` 参数解析、队列/事件及命令；`src/App.vue` 事件监听/初始队列；`src/EnvelopeViewer.vue` 初始路径打开与错误展示。 |
| 修改项目版本同步方式 | `scripts/update_version.py` 的文件映射/校验；npm/Tauri/Cargo 五处版本字段与锁文件；README、发布工作流及本页 [版本文档](./RELEASE.md)。 |
| 更改开发地址或构建目标 | `vite.config.ts` 与 `src-tauri/tauri.conf.json` 的 dev URL/构建路径；对应平台 workflow、Rust target/系统依赖和 [开发文档](./DEVELOPMENT.md)。 |

## Rust 命令和前端调用的契约

当前前端通过 `@tauri-apps/api/core` 使用 `invoke()` 调用 `src-tauri/src/lib.rs` 注册的文件操作及初始 CLC 文件命令；字体命令定义在 `commands/fonts.rs` 并经 `lib.rs` 注册。修改命令名或参数时，两侧必须在同一变更中更新。Tauri 前端传入的多词参数使用驼峰字段（如 `filePath`），Rust 端参数以实际 Tauri 命令映射为准；以调用点、命令签名和构建结果共同核对。

打开 `.clc` 文件还经过操作系统文件关联、启动参数/单实例回调、待处理队列和 `caretellia-open-clc` 事件；只改前端文件选择器不能覆盖桌面双击打开流程。

## 关键数据格式和持久化

- `PostcardData` 是前端共享信件模型。
- CLC 当前为带版本头、gzip 压缩 JSON 载荷和 SHA-256 校验的二进制格式；相关大小限制与字段校验位于 `src/clc.ts`，原生文件操作也有大小/扩展名检查。
- 历史记录保存在 IndexedDB（`caretellia-letter-history`，schema version 2）；旧 localStorage 历史通过一次性迁移转入 IndexedDB。调整结构时维护迁移并保留旧用户数据。
- 设置、主题和字体缓存位于独立 localStorage 键；`clearAllLocalData()` 负责集中清理，新增键需明确是否随“清除所有本机数据”删除。
- 浏览器运行时与 Tauri 原生端能力不同：文件路径存在性、系统字体、文件对话框和 updater 需要按运行环境回退或限制。
