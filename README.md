# Caretellia

[![publish](https://github.com/chlingzool/caretellia/actions/workflows/tauri-action.yml/badge.svg)](https://github.com/chlingzool/caretellia/actions/workflows/tauri-action.yml)
[![mobile-build](https://github.com/chlingzool/caretellia/actions/workflows/mobile-build.yml/badge.svg)](https://github.com/chlingzool/caretellia/actions/workflows/mobile-build.yml)

**Caretellia** 是一款使用 Tauri 2、Vue 3 和 Vite 构建的信件与明信片创作工具。你可以设计信封、明信片和信纸，在应用中预览，并保存为 CLC 或 HTML 文件。

## 功能

### 创作与个性化

- 提供信封、明信片和单面信纸版式；信纸正文和明信片背面支持富文本编辑。
- 自定义字体、字号、颜色、边框、图片和邮票，也可以使用本机字体。
- 信纸支持添加贴纸，并可拖动、缩放和旋转；贴纸布局会随信件保存。
- 通过模板库浏览信封、明信片、信纸版式和文案。
- 信封预览按“打开信封、抽出信纸”的顺序展开，并支持收回。
- 编辑预览支持调整大小；窄屏界面提供折叠菜单。Android 端适配系统返回键、安全区域和触控操作，表单输入与贴纸控件也针对触屏优化。

### 保存、导出与导入

- **CLC 是 Caretellia 的信件文件格式**，默认导出格式为 `.clc`，用于保存信件内容和样式。
- 可从历史信件导入 CLC。导入时会检查格式版本、数据长度、SHA-256 摘要和信件字段；历史缓存也以压缩的 CLC 数据保存在本机。
- 编辑时选择“另存为”，可指定保存位置和 **CLC 或 HTML** 格式。快捷导出仍提供默认 CLC 导出，也可从导出菜单选择 HTML。
- 导出的信件居中显示；HTML 文件支持浅色、深色或跟随系统主题，并适配移动屏幕。

### 查看信件与管理历史
- 自定义字体、字号、卡片背景、图片和邮票；可选择本机字体。
- 在独立模板库中按明信片、信封、信纸或文案风格筛选模板；文案风格提供温柔、商务两种示例内容，可直接套用后继续编辑。
- 信纸支持上传贴纸，并可拖动、缩放、旋转或移除；贴纸显示在文字下方，布局可随信件保存和导出。

- 首页的“查看信封”用于浏览已保存的历史信件，或打开本地 CLC 文件预览；打开的文件不会自动加入历史信件。
- 查看页的“历史信件”和“最近查看”列表可分别折叠。历史信件的删除仍统一在“历史信件”页面进行，查看页不提供删除历史信件的操作。
- 最近查看数量可在设置中限制，默认 **10 封**，可选 5、10、20 或 30 封。文件已不存在时会显示占位记录，可从最近查看中移除。
- 桌面应用会检查最近查看的本地文件是否仍存在；浏览器开发运行时会保存导入文件的本机浏览器副本。

### 应用设置

- 界面语言支持简体中文、英文和跟随系统。
- 支持深色/浅色模式、界面字体与字号，以及 HTML 导出主题设置。
- 应用数据保存在本机，不会上传到网络。

## 开发环境

- Node.js 和 npm
- Rust 工具链（包含 Cargo）
- 当前操作系统所需的 Tauri 2 开发依赖

安装 Tauri 所需的系统依赖前，请参阅 [Tauri 2 前置条件文档](https://v2.tauri.app/start/prerequisites/)。

## 运行与构建

在仓库根目录安装前端依赖并启动桌面开发模式：

```bash
npm install
npm run tauri dev
```

检查 TypeScript 并构建前端资源：

```bash
npm run build
```

构建 Tauri 桌面应用及当前平台可用的安装包：

```bash
npm run tauri build
```

## 移动端构建

在 GitHub Actions 的 `mobile-build` 工作流中手动运行，可构建并下载 Android arm64 调试 APK 和 iOS arm64 Simulator 调试应用。工作流会在 CI 中初始化 Tauri 移动工程；构建产物保留 7 天。

Android APK 可安装到 arm64 Android 设备用于测试；iOS 产物仅用于 Simulator。安装到实体 iPhone 或发布到 App Store 仍需 Apple 开发者签名证书和 provisioning profile，本工作流不处理签名或商店发布。

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `src/` | Vue 前端页面、组件与样式 |
| `src-tauri/` | Tauri 桌面端配置与 Rust 代码 |
| `public/` | 前端公共静态资源 |
| `src/assets/` | 前端资源文件 |

## 许可

许可条款请参阅 [LICENSE](./LICENSE)。
