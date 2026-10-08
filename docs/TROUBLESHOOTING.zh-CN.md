# 没有工具、安装被拒与路径问题

## 现象：桌面 App 安装插件时报 incompatible-version

说明插件的 `peerDependencies`（`@deepseek-ai/dsh*`）与 App 当前的 DSH 运行时不
匹配。**正确做法是换用与该 DSH 版本对应的插件版本**。授予版本豁免会让不兼容的
插件真的加载，可能崩溃或损坏数据，只应在你明确接受风险时使用。

对应关系见 [安装说明](INSTALL.zh-CN.md) 开头的版本对照表：本插件 `0.2.1` 对应
DSH `0.2.0-rc.2` 包线。

## 现象：Agent 说“没有工具”

按以下顺序排查，不要在旧会话里连续发送消息：

1. 打开侧边栏「插件」页面，确认 `@fhl-plugins/dsh-fhl-image` 已安装且已启用。
2. 命令行版执行：

   ```powershell
   dsh --profile fhl-image --dump-config
   ```

   检查是否存在 `fhl-image` bundle 层和 `@fhl-plugins/dsh-fhl-image`。

3. **完全退出**桌面 App（或停止旧 DSH Host）后重新启动。
4. 新建会话，再检查三个工具：

   - `fhl_image_configure`
   - `fhl_image_generate`
   - `fhl_image_edit`

修改插件源码或重新安装包后必须重启。旧进程可能仍然只暴露旧工具目录，即使磁盘上
的代码已经更新，模型也会继续回答“没有工具”。

## 现象：安装命令提示找不到 tarball

先确认 `artifacts` 中存在 `.tgz`：

```powershell
Get-ChildItem .\artifacts\*.tgz
```

桌面 App 的插件安装要求**绝对路径**；相对路径会被拒绝。如果路径含空格（例如
`/Volumes/My Disk/...`），Windows 命令行版可能因为上游 CLI 通过 `shell:true`
转发参数而失败，此时用项目辅助脚本：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 -Profile fhl-image
```

不要把带空格的绝对路径直接交给 Windows DSH CLI；桌面 App 里也建议先把 tarball
放到不含空格的目录。

## 现象：pnpm 要求允许 prepare/构建脚本

这是安装来源的供应链保护。优先使用 Release 中的预构建 `.tgz`：预构建包已经包含
`lib/`，不需要在安装时编译，也没有会要求授权的安装脚本。只有从源码目录安装时
才可能触发构建授权：

1. 先审查源码和锁文件。
2. 只允许 pnpm 输出的准确包名执行构建。
3. 使用固定 Git commit，而不是不受约束的分支。

## 现象：配置后仍提示没有 Worker

先确认本轮确实调用了 `fhl_image_configure`，且结果不是错误。然后完全退出并重开
桌面 App（命令行版则重启同一 profile），再打开新会话。不要把 Key 重新发送多次，
也不要在未确认工具目录时请求生图。

## 现象：编辑图片时提示 provide sources explicitly

`fhl_image_edit` 省略 `sources` 时会依次尝试：当前用户消息里的图片 → 更早的
用户上传图片 → 本插件在**同一会话、同一进程**内生成的最近一张图。第二项来自
0.2 的派生消息历史；第三项是插件自己的小缓存，不是持久数据。

因此以下情况会找不到图，需要显式传 `sources`：

- 刚重启过 Host / 桌面 App，而你想编辑的是重启前生成的图；
- 想编辑的图不是本插件生成的，也不在用户消息里；
- 会话被清理或属于另一个会话。

`fhl_image_generate` / `fhl_image_edit` 的返回结果里带有每张图的
`attachmentId` 等引用字段，可以直接把它们作为下一次 `sources` 传入。

## 现象：图片请求失败

只记录脱敏错误类型，例如凭据错误、请求超时、服务过载或 Worker 暂不可用。
不要复制 Authorization、完整请求体、图片 base64 或会话原文。已经成功生成的
图片不应因为后续文字收尾失败而重复请求。

## 仍无法恢复时收集什么

可以收集：

- 插件卡片或 `dsh --profile fhl-image --dump-config` 中的插件名与 bundle 名。
- 工具名称列表。
- 安装日志 `~/.dsh/profiles/desktop/.plugin-manager/logs/<操作>/pnpm.log` 中的
  错误行（先确认其中没有凭据内容）。
- 脱敏错误类型和时间。
- 插件版本 `0.2.1` 与 DSH 版本（桌面版 `0.2.0-rc.2`）。

不要收集：API Key、Key 前后缀、Authorization、用户图片、base64、完整会话或
包含私有路径的诊断包。
