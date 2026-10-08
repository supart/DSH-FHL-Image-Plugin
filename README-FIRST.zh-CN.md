# 第一次使用：给没有用过 DSH 的用户

[返回 GitHub 中文主页](README.md#fhl-zh)

## 先说清楚

`DSH FHL Image` 是 **DeepSeek Harness 的插件**，不是完整的 DSH 软件，也不能
双击 `.tgz` 文件直接运行。你需要先安装并能启动 DSH，再安装本插件。

本版本 `0.2.1` 对应**官方桌面版 DSH `0.2.0-rc.2` 包线**；旧 `0.1.x` 插件
不能装在 0.2 桌面版上，装了会被版本检查拒绝。

## 推荐下载

下载直链（整行复制）：

```text
https://github.com/supart/DSH-FHL-Image-Plugin/releases/download/v0.2.1/fhl-plugins-dsh-fhl-image-0.2.1.tgz
```

文件名是 `fhl-plugins-dsh-fhl-image-0.2.1.tgz`。这是插件包，不要双击。

> ⚠️ 别把仓库地址或 `.../releases/latest` 交给 Agent —— 那会被识别成 git 源去
> 克隆，而本仓库不含构建产物 `lib/`，装上也加载不了。必须是上面这条以 `.tgz`
> 结尾的直链。

## 最省事的装法：发一条提示词

在**你自己的 DSH 会话**里直接发送下面这段，Agent 会自己下载并安装：

```text
请用插件管理工具安装这个 FHL 图像插件包：
https://github.com/supart/DSH-FHL-Image-Plugin/releases/download/v0.2.1/fhl-plugins-dsh-fhl-image-0.2.1.tgz

安装完成后打开它的启用开关，然后让我完全退出并重新打开 App。
之后新建会话，确认工具列表里有 fhl_image_configure、fhl_image_generate、fhl_image_edit。
```

安装要改写 profile 文件，DSH 会向你申请授权，同意即可。

## 在官方桌面 App 里手动安装

如果你更想自己点：

1. 打开桌面 App，进入侧边栏「插件」页面。
2. 选择安装，填入 tarball 的**绝对路径**（建议先把文件放到不含空格的目录，
   例如 `~/Downloads/`）。
3. 安装完成后，在插件列表里打开 `@fhl-plugins/dsh-fhl-image` 的启用开关。
4. **完全退出并重新打开 App**。
5. 新建会话，确认工具列表里有：

   - `fhl_image_configure`
   - `fhl_image_generate`
   - `fhl_image_edit`

注意 `desktop` profile 由桌面 App 独占管理，不要从外部终端对它执行 `dsh plugin`。

完整判据、升级与卸载见 [安装说明](docs/INSTALL.zh-CN.md)。

## 在聊天窗口配置生图 API

先发送这条提示词：

```text
我想配置 FHL 生图专用 API。请使用 fhl_image_configure 工具，并先告诉我需要如何提供一个或多个 Worker Key；不要调用生图工具。
```

Agent 询问后，再把一个或多个 Worker Key 粘贴到聊天框。多个 Key 一行一个。
配置阶段只应看到 `fhl_image_configure`，不应调用生图工具。

重要：聊天配置会让 Key 随消息经过当前模型，并可能保留在 DSH 会话历史中。不能
接受这条链路的 Key，请改用 DSH 自身的凭据机制直接写入对应引用名
（`FHL_IMAGE_API_KEY` 等）；`apiKeyEnv` 只是引用名前缀，不是环境变量。

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

1. 在「插件」页面确认插件已安装且已启用。
2. 完全退出桌面 App 再重新打开（命令行版则停止旧 Host 后重启同一 profile）。
3. 新建会话，再检查三个工具。

不要在旧会话里继续测试；旧进程可能仍在用旧工具目录。

## 安装被拒绝怎么办

如果看到 `incompatible-version`，说明插件版本与当前 DSH 运行时不匹配。请换用与
当前 DSH 对应的插件版本，**不要**授予版本豁免——豁免会让不兼容的插件真的加载。
参考 [故障排查](docs/TROUBLESHOOTING.zh-CN.md)。

## 不要做的事

- 不要双击 `.tgz`。
- 不要把 API Key 发到 GitHub、Codex 主对话、截图或 Issue。
- 不要把整个 DSH 用户数据目录上传给别人。
- 不要把 `fhl_image_configure` 和生图请求写在同一条消息里。

详细说明：

- [安装说明（桌面 App 与命令行版）](docs/INSTALL.zh-CN.md)
- [聊天配置 API](docs/CONFIGURATION.zh-CN.md)
- [故障排查](docs/TROUBLESHOOTING.zh-CN.md)
- [安全边界](docs/SECURITY.zh-CN.md)
