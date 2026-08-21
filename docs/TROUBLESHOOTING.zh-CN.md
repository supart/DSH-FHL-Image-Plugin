# 没有工具、启动失败与路径问题

## 现象：Agent 说“没有工具”

按以下顺序排查，不要在旧 Host 页面连续发送消息：

1. 确认当前启动的是 `fhl-image` profile，而不是旧的 `web` 或其他 profile。
2. 执行：

   ```powershell
   dsh --profile fhl-image --dump-config
   ```

3. 检查是否存在 `fhl-image` bundle 层和
   `@fhl-plugins/dsh-fhl-image`。
4. 完全停止旧 DSH Host。
5. 重新运行：

   ```powershell
   dsh --profile fhl-image
   ```

6. 刷新浏览器或重新打开新的动态 loopback 地址。
7. 新建会话，再检查三个工具。

修改插件源码或重新安装包后必须重启 Host。旧 Host 可能仍然只暴露旧工具目录，
即使磁盘上的源码已经更新，模型也会继续回答“没有工具”。

## 现象：安装命令提示找不到 tarball

先确认 `artifacts` 中存在 `.tgz`：

```powershell
Get-ChildItem .\artifacts\*.tgz
```

如果项目路径含空格，使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-to-dsh.ps1 -Profile fhl-image
```

不要把带空格的绝对路径直接交给旧版 Windows DSH CLI。

## 现象：pnpm 要求允许 prepare/构建脚本

这是源码安装的供应链保护，不代表插件不能运行。优先使用预构建 `.tgz`。
如果必须从源码安装：

1. 先审查源码和锁文件。
2. 只允许 pnpm 输出的准确包名执行构建。
3. 使用固定 Git commit，而不是不受约束的分支。

## 现象：配置后仍提示没有 Worker

先确认本轮确实调用了 `fhl_image_configure`，且结果不是错误。然后完全重启
同一个 profile，再打开新会话。不要把 Key 重新发送多次，也不要在未确认工具
目录时请求生图。

## 现象：图片请求失败

只记录脱敏错误类型，例如凭据错误、请求超时、服务过载或 Worker 暂不可用。
不要复制 Authorization、完整请求体、图片 base64 或会话原文。已经成功生成的
Artifact 不应因为后续文字收尾失败而重复请求图片。

## 仍无法恢复时收集什么

可以收集：

- `dsh --profile fhl-image --dump-config` 中的插件名和 bundle 名。
- 工具名称列表。
- 脱敏错误类型和时间。
- 插件版本 `0.1.0`。

不要收集：API Key、Key 前后缀、Authorization、用户图片、base64、完整会话或
包含私有路径的诊断包。
