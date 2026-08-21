# 2026-08-21 DSH FHL Image 新手用户包

阶段：P8
状态：已完成本地整理，待远程 Release 更新
范围：第一次使用说明 / Windows 用户包 / 发布附件

## 目标

让没有使用过 DSH 的用户能分清“完整 DSH 软件”和“FHL Image 插件”，并按一条
可复制的 Windows 路径完成安装、工具检查和聊天配置。

## 改动

- 新增 `README-FIRST.zh-CN.md`，用中文说明前置条件、安装、工具检查、聊天配置、
  首次生图和“没有工具”排障。
- 新增根目录 `install-fhl-image-plugin.cmd` 和 `scripts/install-fhl-image-plugin.cmd`，
  用户可直接双击根目录入口调用 PowerShell 安装脚本。
- README 中英文首页明确说明 `.tgz` 不是独立应用，并指向 Windows 用户包。
- 更新安装文档，说明 DSH 必须先安装，且推荐下载用户包。
- 重新构建 `0.1.0` tarball，使新手说明进入包内。
- 准备 `DSH-FHL-Image-Plugin-0.1.0-Windows-User-Bundle.zip`，包含 tarball、脚本、
  中文文档和许可证。

## 验证

- `pnpm typecheck`：通过。
- `pnpm test`：通过，6 个文件 / 9 个测试。
- `pnpm build`：通过。
- `pnpm pack:check`：通过；tarball 包含 `README-FIRST.zh-CN.md` 和两张说明插图。
- `git diff --check`：通过。
- 未调用真实模型、图片 API 或计费服务。

## 用户边界

用户仍需先安装 DSH、Node.js 和 pnpm；本用户包不包含完整 DSH，也不会自动安装
Node.js 或注册系统服务。聊天配置 Key 仍可能经过模型并保留在 DSH 会话历史中，
不能接受该链路的用户应改用宿主凭据或环境变量方案。

## 回退

保留已发布 `v0.1.0` 标签不变。若新附件有问题，只替换 Release 附件或建立新的
修订提交，不重写历史、不强推、不删除已有 Release。
