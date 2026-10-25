# 版本、CI 与发布

## 项目版本

项目版本必须保持在以下文件中一致：

1. `package.json` 的 `version`。
2. `package-lock.json` 的顶层版本及根 package 记录。
3. `src-tauri/tauri.conf.json` 的 `version`。
4. `src-tauri/Cargo.toml` 的 package `version`。
5. `src-tauri/Cargo.lock` 中 Caretellia package 的版本。

在仓库根目录运行 `npm run verup` 并输入 SemVer。`scripts/update_version.py` 会校验当前项目名/版本字段、原子写入上述五个文件，不更改依赖版本，也不会构建、暂存、提交、推送或创建 PR。若新增或移除版本源文件，需同步修改脚本、这里的清单及 README 中的版本说明。

## GitHub Actions 工作流

工作流定义在 `.github/workflows/`：

- `tauri-action.yml` 可手动触发，也会在 push 到 `release` 分支时运行。
- 它调用 `windows-build.yml`、`linux-build.yml`、`macos-ios-build.yml`、`android-build.yml`。
- Windows/Linux/macOS 桌面构建使用 `tauri-apps/tauri-action`，创建 `app-v<version>` 命名的草稿 Release；Linux 同时构建 x64/arm64，macOS 构建 Intel/Apple Silicon。
- Android 生成 arm64 debug APK；iOS 生成 arm64 Simulator debug app。两者不提供面向商店的签名发布。
- `tauri-action.yml` 等待所有平台构建后将 Android/iOS artifact 附加到对应 Release。

具体系统依赖、初始化步骤和构建产物限制见 [开发文档](./DEVELOPMENT.md)。

## 应用内更新器

- `src-tauri/tauri.conf.json` 配置桌面 updater 公钥和 GitHub latest release endpoint；不要将私钥写入仓库或文档。
- 桌面工作流读取 `TAURI_SIGNING_PRIVATE_KEY`，可选读取 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
- 签名私钥应配置在仓库 Actions secrets，并妥善备份；更换密钥需要协调新公钥和现有安装的升级路径。
- 工作流创建的是草稿 Release。确认产物和签名后，必须在 GitHub 上正式发布，稳定版更新检查才会获取到该版本。
- 配置更新功能时，同时检查 `src/SettingsPage.vue` 中的平台限制、Rust `tauri-plugin-updater` 注册和 Cargo target 条件。

不要把当前仓库里的公钥当作私钥，也不要复制、输出或提交任何私钥、密码或签名密钥内容。

## 发布前检查

1. 确认要发布的代码已进入 `release` 分支/正确提交。
2. 用 `npm run verup` 更新版本，并审阅五个版本位置及 lockfile 差异。
3. 运行 `npm ci`、`npm run build`；Rust、平台或权限变更按 [开发文档验证清单](./DEVELOPMENT.md#验证命令) 增加验证。
4. 检查目标平台 workflow、Tauri bundle 与文件关联、更新器签名配置、移动产物类型。
5. 检查 Actions 各平台构建与 Release 草稿附件；发布前验证更新签名和用户可安装产物。
6. 在 GitHub 正式发布草稿 Release 后，再确认应用内更新通道。

文档或工作流规则变更时，同步维护本页和 [开发文档](./DEVELOPMENT.md) 中相应的命令/平台说明。
