# Windows 安装说明

本文面向第一次安装 DSH 插件的用户。命令默认在 Windows PowerShell 中执行，
并假设 `dsh` 已能在终端中运行。

## 1. 准备文件

需要以下内容：

- DSH 已安装并能运行 `dsh --help`。
- Node.js 22.19+ 或 Node.js 24+。
- pnpm（仅源码开发需要；安装预构建包时不需要自己编译）。
- `dsh-fhl-image-plugin-0.1.0.tgz` 预构建包。
- 本项目中的 `scripts/install-to-dsh.ps1`。

将 tarball 放入项目的 `artifacts` 目录（推荐）、项目根目录或 `scripts` 目录，
辅助脚本都会自动查找；也可以通过 `-TarballPath` 明确指定文件。
不要把用户数据、会话目录或凭据文件复制到插件项目。

## 2. 为什么推荐辅助脚本

Windows 版 DSH CLI 当前通过 `shell:true` 转发 `dsh plugin` 的参数。项目路径
如果包含空格，绝对 tarball 路径可能在到达 pnpm 前被拆成多个参数。这是上游
CLI 的参数转发问题，不是插件构建失败。

项目辅助脚本会：

1. 找到 `artifacts` 中最新的 `.tgz`。
2. 将 tarball 临时复制到系统临时目录。
3. 调用 DSH 安装命令。
4. 无论成功或失败都删除临时文件。

脚本不复制用户数据、凭据或 API Key，也不会调用模型或图片 API。

## 3. 推荐安装

在本项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 -Profile fhl-image
```

需要明确指定包时：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 `
  -Profile fhl-image -TarballPath .\dsh-fhl-image-plugin-0.1.0.tgz
```

默认使用 `--ignore-scripts` 安装预构建包，因此不会因为安装包的 `prepare`
脚本要求构建授权而中断。需要从源码构建时，再按开发者说明操作。

## 4. 安装后检查

先不要打开旧的 DSH 窗口，执行：

```powershell
dsh --profile fhl-image --dump-config
```

检查结果中至少应看到：

- `@fhl-plugins/dsh-fhl-image`。
- `fhl-image` bundle 层。
- `baseURL`、`apiKeyEnv`、超时和 Worker 冷却设置。
- 不出现任何 API Key 内容。

然后启动同一个 profile：

```powershell
dsh --profile fhl-image
```

如果当前 DSH 安装使用 Web 子命令，也可以使用对应的 `dsh web` 入口，但必须
确保它加载的是 `fhl-image` profile，而不是旧 profile。

## 5. 不含空格路径的直接命令

如果 tarball 的完整路径不含空格，可直接执行：

```powershell
dsh plugin --profile fhl-image add .\artifacts\dsh-fhl-image-plugin-0.1.0.tgz
```

路径含空格时仍建议使用辅助脚本。

## 6. 安装完成的定义

只有同时满足以下条件，才算安装完成：

- `--dump-config` 显示插件包和 `fhl-image` bundle。
- 重启 Host 后仍能看到同一 bundle。
- 新会话的工具目录出现 `fhl_image_configure`、`fhl_image_generate` 和
  `fhl_image_edit`。
- 安装过程没有真实 FHL 请求，也没有产生图片费用。

如果工具目录没有更新，先完全停止旧 Host，再重新启动并刷新浏览器；详见
[故障排查](TROUBLESHOOTING.zh-CN.md)。
