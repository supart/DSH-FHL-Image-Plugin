# 源码开发者说明

## 环境

- Node.js 22.19+ 或 24+。
- pnpm。
- 与 DSH `0.1.1-rc.1` 包线兼容的开发预览版本。

## 从源码安装

```powershell
git clone https://github.com/supart/DSH-FHL-Image-Plugin.git
cd DSH-FHL-Image-Plugin
pnpm install
pnpm build
dsh plugin --profile fhl-image add .
```

GitHub 源码安装可能触发 pnpm `prepare` 构建授权。先审查源码，再只允许 pnpm
提示的准确包名执行构建。不希望执行安装构建时，使用预构建 `.tgz`。

## 本地检查

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
git diff --check
```

测试使用本地 Mock，不连接真实 FHL 服务。

## 分支和提交

本项目本地 Git 约定为：

- `main`
- `dsh-fhl-image/0.1.0-development`
- `dsh-fhl-image/0.1.0-feature/<topic>`

提交使用 Conventional Commits，例如：

```text
feat(image): add multi-reference edit
fix(install): stage tarball for Windows paths
docs(config): clarify chat credential flow
```

本地基线标签为 `dsh-fhl-image-0.1.0-dev.0`。默认不设置 upstream、不 push、
不创建 GitHub Release。

## 发布前检查

发布前必须完成构建、测试、tarball 敏感扫描、安装和 `--dump-config` 检查；真实
API 验收与离线构建分开记录。`.tgz` 作为附件准备，不放入源码 Git 历史。
