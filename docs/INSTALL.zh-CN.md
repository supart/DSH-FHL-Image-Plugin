# 安装说明（官方桌面 App 与命令行版）

本插件不是完整 DSH 软件。请先安装并能启动 DeepSeek Harness，再安装本插件。

版本对应关系：

| 插件版本 | 目标 DSH |
| --- | --- |
| `0.2.1` | 官方桌面版 `0.2.0-rc.2` 包线（DSH 0.2） |
| `0.1.0` | 旧 `0.1.1-rc.1` 包线，**已不再支持** |

安装包文件名：`fhl-plugins-dsh-fhl-image-0.2.1.tgz`（从 Release 下载，或本项目
`pnpm build && pnpm pack` 后在 `artifacts/` 生成）。不要双击 `.tgz`。

---

## 1. 官方桌面 App 安装（推荐）

适用于 macOS 与 Windows 的官方桌面版。桌面 App 拥有自己托管的 `desktop`
profile，插件必须通过 App 自身的插件管理安装。

### 1.1 准备

- 已安装并能启动官方桌面 App。
- 下载直链（插件管理器可直接用）：

  ```text
  https://github.com/supart/DSH-FHL-Image-Plugin/releases/download/v0.2.1/fhl-plugins-dsh-fhl-image-0.2.1.tgz
  ```

- 若改为手动安装，请先把 `fhl-plugins-dsh-fhl-image-0.2.1.tgz` 放在**不含空格**
  的本地目录（例如 `~/Downloads/`、`~/.dsh/plugins/`）。路径含空格或中文可能
  导致安装失败。

### 1.2 方式 A：一条提示词让 Agent 安装（推荐）

在桌面 App 的会话里直接发送：

```text
请用插件管理工具安装这个 FHL 图像插件包：
https://github.com/supart/DSH-FHL-Image-Plugin/releases/download/v0.2.1/fhl-plugins-dsh-fhl-image-0.2.1.tgz

安装完成后打开它的启用开关，然后让我完全退出并重新打开 App。
之后新建会话，确认工具列表里有 fhl_image_configure、fhl_image_generate、fhl_image_edit。
```

也可以把上面那行 URL 换成 tarball 的**本地绝对路径**，效果相同。

#### 可安装来源只有四种，本项目只有两种可用

插件管理器的 `parseInstallSpec()` 只接受下列来源，请在给出提示词前确认：

| 提示词里给的内容 | 判定结果 | 本项目是否可用 |
| --- | --- | --- |
| 以 `.tgz` 结尾的 http(s) 直链 | `tarball` | ✅ 可用 |
| 本地**绝对**路径（文件或目录） | `tarball` / `path` | ✅ 可用 |
| 仓库地址 / `releases/latest` / `github:owner/repo` | `git` | ❌ **不可用** |
| `@fhl-plugins/dsh-fhl-image`（包名） | `registry` | ❌ 未发布到 npm |

**为什么 git 源不可用**：本仓库不跟踪构建产物（`.gitignore` 第 1 行即 `lib/`），
且 `package.json` **没有** `prepare` 安装期构建脚本（0.2.0 起刻意去掉，以免安装时
要求构建授权）。git 源装下来的包里 `main` 指向的 `lib/index.js` 不存在，插件无法
加载。**必须使用 `.tgz` 直链或本地 tarball。**

安装动作需要 `danger-full-access` 权限或当次授权；安装会改写当前 profile 的
`package.json`、`pnpm-lock.yaml` 与 `node_modules/`。

### 1.3 方式 B：图形界面安装

1. 打开 App，进入侧边栏的「插件」页面。
2. 选择安装，填入 tarball 的**绝对路径**，或粘贴上面那条 `.tgz` 直链。
3. 等待安装完成；若出现构建脚本授权提示，确认是否放行（本插件预构建，通常不会有）。
4. 在插件列表中找到 `@fhl-plugins/dsh-fhl-image`，打开启用开关。
5. **完全退出并重新打开 App**（bundle 层列表在启动时组装）。

### 1.4 验证成功

同时满足以下条件才算安装完成：

- 插件卡片显示已安装、已启用，没有报错标签。
- `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 中出现
  `@fhl-plugins/dsh-fhl-image`，且原有条目（`@deepseek-ai/dsh-base`、
  `@deepseek-ai/dsh-web-app`、`dsh-orb`）顺序不变。
- `~/.dsh/profiles/desktop/node_modules/@fhl-plugins/dsh-fhl-image/` 存在。
- 新会话的工具列表出现 `fhl_image_configure`、`fhl_image_generate`、
  `fhl_image_edit`。
- 安装日志 `~/.dsh/profiles/desktop/.plugin-manager/logs/<操作>/pnpm.log` 无错误。
- 安装过程没有真实 FHL 请求，也没有产生图片费用。

### 1.5 关于不兼容报错

如果安装或启动报 `incompatible-version`，说明插件的
`peerDependencies`（`@deepseek-ai/dsh*`）与当前 DSH 运行时不匹配。**正确做法是
换用与当前 DSH 版本对应的插件版本**，而不是授予版本豁免：豁免会让不兼容的插件
真的跑起来，可能崩溃或损坏数据。桌面 App 的插件管理器提供的版本豁免只应在你
明确接受风险时使用。

---

## 2. 命令行版 DSH 安装（进阶）

如果你用的是命令行/自托管 DSH 而不是官方桌面 App：

```powershell
dsh plugin --profile fhl-image add .\artifacts\fhl-plugins-dsh-fhl-image-0.2.1.tgz
```

路径必须是**绝对路径**且不含空格时最稳。安装后检查：

```powershell
dsh --profile fhl-image --dump-config
```

输出中至少应看到：

- `@fhl-plugins/dsh-fhl-image`
- `fhl-image` bundle 层
- `baseURL`、`apiKeyEnv`、超时与 Worker 冷却设置
- 不出现任何 API Key 内容

然后启动同一个 profile：

```powershell
dsh --profile fhl-image
```

注意：`--profile desktop` 被官方独占管理，从外部 shell 直接执行
`dsh plugin --profile desktop ...` 会被拒绝；桌面 App 的插件只能按第 1 节安装。

本插件的安装包是预构建产物，不需要在安装时编译，也没有会要求构建授权的安装脚本。

## 3. Windows 命令行辅助脚本

Windows 下 `dsh plugin` 的参数转发经过 `shell:true`，路径含空格时绝对路径可能被
拆成多个参数。项目提供辅助脚本规避该问题：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 -Profile fhl-image
```

脚本会：在 `artifacts/`、项目根目录、`scripts/` 中查找最新的 `.tgz`；把 tarball
复制到系统临时目录后调用 DSH 安装命令；无论成功失败都清理临时文件。脚本不复制
用户数据、凭据或 API Key，也不会调用模型或图片 API。

需要明确指定包时：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 `
  -Profile fhl-image -TarballPath .\artifacts\fhl-plugins-dsh-fhl-image-0.2.1.tgz
```

## 4. 升级与卸载

- **桌面 App**：在「插件」页面**先卸载/移除**旧版本，再按第 1 节安装新 tarball，
  然后完全退出并重开 App。
- **命令行版**：用同样的 `dsh plugin --profile <profile> add <新 tarball>` 覆盖安装，
  或先 `remove` 再 `add`。

注意：如果包名和版本号都没变（例如只是重新打包了同一个 `0.2.1`），桌面版插件
管理器会报 `ambiguous-install`（安装命令本身成功，但管理器无法判断哪个依赖发生
了变化）。正确做法是先卸载再安装；发布新版时请提升版本号。

升级前请确认新插件版本的目标 DSH 线与你正在运行的 DSH 一致（见本文开头的对照表）。

如果安装后工具目录没有出现三个工具，先完全退出再重新启动并新建会话；详见
[故障排查](TROUBLESHOOTING.zh-CN.md)。
