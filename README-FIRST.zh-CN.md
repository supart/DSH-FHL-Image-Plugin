# 第一次使用：给没有用过 DSH 的用户

[返回 GitHub 中文主页](README.md#fhl-zh)

## 先说清楚

`DSH FHL Image` 是 **DeepSeek Harness 的插件**，不是完整的 DSH 软件，也不能
双击 `.tgz` 文件直接运行。你需要先安装并能启动 DSH，再安装本插件。

## 推荐下载

在 GitHub Release 页面下载：

```text
DSH-FHL-Image-Plugin-0.1.0-Windows-User-Bundle.zip
```

解压后，你会看到：

- `dsh-fhl-image-plugin-0.1.0.tgz`：插件包，不要双击。
- `install-fhl-image-plugin.cmd`：Windows 安装入口，直接双击即可。
- `README-FIRST.zh-CN.md`：本说明。
- `docs/`：详细安装、聊天配置和安全说明。

## 使用前准备

1. 安装 DeepSeek Harness（`dsh`），并确认在 PowerShell 中能运行：

   ```powershell
   dsh --help
   ```

2. 准备 Node.js 22.19+ 或 Node.js 24+。
3. 准备 pnpm，并确认：

   ```powershell
   pnpm --version
   ```

如果你已经在使用 DSH Desktop 或本机 DSH 开发预览版，可以直接进入下一步。

## 安装插件

1. 解压 `DSH-FHL-Image-Plugin-0.1.0-Windows-User-Bundle.zip`。
2. 双击解压目录根部的 `install-fhl-image-plugin.cmd`。
3. 如果 Windows 阻止脚本，右键该文件所在文件夹，选择“在终端中打开”，运行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 `
     -Profile fhl-image -TarballPath .\dsh-fhl-image-plugin-0.1.0.tgz
   ```

4. 安装结束后检查：

   ```powershell
   dsh --profile fhl-image --dump-config
   ```

看到下面两项才算安装成功：

- `@fhl-plugins/dsh-fhl-image`
- `fhl-image` bundle

## 启动 DSH

完全关闭旧的 DSH 窗口后运行：

```powershell
dsh --profile fhl-image
```

打开 DSH 页面，新建会话，并确认工具列表中有：

- `fhl_image_configure`
- `fhl_image_generate`
- `fhl_image_edit`

## 在聊天窗口配置生图 API

先发送这条提示词：

```text
我想配置 FHL 生图专用 API。请使用 fhl_image_configure 工具，并先告诉我需要如何提供一个或多个 Worker Key；不要调用生图工具。
```

Agent 询问后，再把一个或多个 Worker Key 粘贴到 DSH 聊天框。多个 Key 一行一个。
配置阶段只应看到 `fhl_image_configure`，不应调用生图工具。

重要：聊天配置会让 Key 随消息经过当前模型，并可能保留在 DSH 会话历史中。不能
接受这条链路的 Key，请改用 DSH 宿主凭据或环境变量方式。

## 第一次生图

确认配置成功后，发送一条新的请求：

```text
请使用 FHL 生图工具生成一张极简现代建筑的全彩效果图，生成 1 张，比例 16:9，2K。
```

有参考图时，可以把图片拖入聊天框，然后发送：

```text
请使用这张参考图进行编辑，保留主体特征，生成一张全彩效果图。
```

## 看到“没有工具”怎么办

1. 完全关闭旧 DSH Host。
2. 确认启动的是 `fhl-image` profile。
3. 重新运行：

   ```powershell
   dsh --profile fhl-image
   ```

4. 刷新浏览器并新建会话。

不要在旧窗口继续测试；旧 Host 可能还在使用旧工具目录。

## 不要做的事

- 不要双击 `.tgz`。
- 不要把 API Key 发到 GitHub、Codex 主对话、截图或 Issue。
- 不要把整个 DSH 用户数据目录上传给别人。
- 不要把 `fhl_image_configure` 和生图请求写在同一条消息里。

详细说明：

- [Windows 安装说明](docs/INSTALL.zh-CN.md)
- [聊天配置 API](docs/CONFIGURATION.zh-CN.md)
- [故障排查](docs/TROUBLESHOOTING.zh-CN.md)
- [安全边界](docs/SECURITY.zh-CN.md)
