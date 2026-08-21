# 2026-08-21 FHL Image DSH 插件 GitHub 首次公开发布

阶段：P7
状态：已完成
范围：standalone DSH plugin / GitHub repository / v0.1.0 Release

## 发布结果

- 公开仓库：`https://github.com/supart/DSH-FHL-Image-Plugin`
- 默认分支：`main`
- 开发分支：`dsh-fhl-image/0.1.0-development`
- 基线标签：`dsh-fhl-image-0.1.0-dev.0`
- 正式标签：`v0.1.0`
- Release：`https://github.com/supart/DSH-FHL-Image-Plugin/releases/tag/v0.1.0`
- GitHub 发布提交：`398f7718da393ea2711ecf322321d971ca5ef497`

Git transport 在本机网络中多次被重置，因此首次源码树、分支和标签通过 GitHub
Git Data API 写入；使用的仍是本机 Git Credential Manager，未输出或记录 Token。

## Release 附件

- `dsh-fhl-image-plugin-0.1.0.tgz`
- `SHA256SUMS.txt`
- `RELEASE_MANIFEST.json`
- `VERIFICATION_REPORT.md`
- `INSTALL.md`

正式 tarball SHA-256：

`FB6AC375C32B73A9B2ABE75C584FB0D202E251E54C347A9F72A37D1EB66FC3E5`

## 在线验证

- 仓库公开且默认分支为 `main`。
- `main` 与开发分支均指向发布源码树。
- 两个标签均指向发布提交。
- README 中英文和两张 `docs/assets` 插图路径存在。
- Release 五个附件均显示为 `uploaded`。
- 公开下载 tarball 的 SHA-256 与本地一致。
- 公开下载 tarball 在全新的临时 DSH profile 中安装成功。
- `--dump-config` 显示 `@fhl-plugins/dsh-fhl-image` 和 `fhl-image` bundle 层。
- 未调用真实聊天、生图或编辑 API。

## 公开内容安全

源码、README、Release 附件和验证报告不包含 API Key、DPAPI 密文、Authorization、
用户会话、用户图片或图片 base64。两张 README 插图只作为用户提供的项目说明图。

## 未完成的可选验收

- 用户配置成功后的重启持久化尚未单独复核。
- 未进行新的真实生图或编辑请求。

## 回退

不删除已发布历史、不强制推送、不重写 `v0.1.0`。若发现附件问题，只修复后建立
新的提交或后续 Release，不修改已发布标签指向。
