# 0.1.0 发布说明

## 产品身份

`@fhl-plugins/dsh-fhl-image` 是独立 MIT 许可的 DSH 社区插件，不是官方
DeepSeek 或 FHL 产品。目标仓库为：

`https://github.com/supart/DSH-FHL-Image-Plugin`

## 本版本包含

- FHL Images 生成和编辑工具。
- 一至十个独立 Worker 的凭据池、冷却和错误隔离。
- `fhl_image_configure` 聊天配置工具。
- DSH 附件结果回显和多参考图编辑。
- Windows 路径含空格时的 tarball 安装辅助脚本。
- 中文安装、配置、故障排查和安全文档。

## 已验证范围

- TypeScript 类型检查。
- 构建和离线单元测试。
- tarball 内容和敏感信息扫描。
- 临时 DSH profile 安装。
- `dsh --profile fhl-image --dump-config` 的插件 bundle 检查。
- Loader/Include 三工具注册测试。

## 用户验收补充

- 2026-08-21，用户已在本机 DSH 聊天窗口确认 `fhl_image_configure` 配置成功。
- 本次只记录配置成功，不记录 Key、聊天原文或 Authorization。
- 本次没有确认发起生图请求；图片费用状态按用户实际 Worker 服务账单为准。

## 尚未宣称完成的内容

- 本批次没有真实生图或编辑请求。
- 没有上传 GitHub、创建 Release 或推送远程。
- Windows 全路径安装问题通过项目脚本绕过，未修改上游 DSH CLI。

因此当前文档可以写“用户已确认聊天配置成功”，但不能把它扩展为“真实生图或
编辑请求已经成功”。
