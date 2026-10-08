# 源码开发者说明

## 环境

- Node.js 22.19+ 或 24+。
- pnpm 11。
- 与 DSH `0.2.0-rc.2` 包线兼容的开发预览版本。官方桌面 App 自带该运行时；
  也可以直接安装 npm 上的 `@deepseek-ai/dsh-*@0.2.0-rc.2` 作为开发依赖。

## 从源码构建

```powershell
git clone https://github.com/supart/DSH-FHL-Image-Plugin.git
cd DSH-FHL-Image-Plugin
pnpm install --ignore-scripts
pnpm build
pnpm pack:check
```

`pnpm install` 只安装构建/测试用的 devDependencies。本包的 `package.json`
**没有** `prepare`/`postinstall` 脚本，安装包是预构建产物，所以发布出去的
`.tgz` 不会在别人机器上触发构建授权。

安装到命令行版 profile：

```powershell
dsh plugin --profile fhl-image add (Resolve-Path .\artifacts\fhl-plugins-dsh-fhl-image-0.2.1.tgz)
```

安装到官方桌面 App：用侧边栏「插件」页面，或让 Agent 用插件管理工具安装该
tarball 的绝对路径。注意 `--profile desktop` 由桌面 App 独占管理，从外部 shell
直接执行会被拒绝。

## 本地检查

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
git diff --check
```

`pnpm typecheck` 使用 `tsconfig.test.json`，同时检查 `src` 与 `tests`。构建用的
`tsconfig.json` 只包含 `src`，所以**不要**用它来当类型闸门——那样测试里的类型错误
不会被发现。

`pnpm test` 带 `pretest`，会先跑一遍构建，因为
`tests/bundle-entry.spec.ts` 要加载构建产物 `lib/index.js`，用来确认发布入口没有
被打包/导出配置改坏。因此单独执行 `pnpm test` 也是自洽的。

`pretest` 内联了构建命令而没有调用 `pnpm run build`：脚本执行时 PATH 上只有
`node_modules/.bin`，嵌套调用包管理器并不可移植。改动 `build` 时请同步 `pretest`。

测试使用本地 Mock，不连接真实 FHL 服务。其中
`tests/manifest.spec.ts` 会校验所有 `@deepseek-ai/dsh*` peer 范围是否满足目标
运行时 `0.2.0-rc.2`——这是官方桌面版的安装闸门，改了 peer 版本必须同时更新该
测试中的目标版本。

CI（`.github/workflows/ci.yml`）在 Node 22.19 与 24 上跑同一套闸门，并额外检查
发布包内是否含类 Key 文本、本机绝对路径，以及所有相对模块导入是否都随包发布。

模块划分：

- `src/index.ts`：插件入口、三个工具的注册与渲染。
- `src/types.ts`：跨模块共享的类型与产品限制常量（Worker 数、变体数、参考图数）。
- `src/session-images.ts`：编辑图片来源解析（派生消息历史 + 产物缓存）。
- `src/client.ts`：FHL Images HTTP 适配器（不持久化 Key 和图片字节）。
- `src/worker-pool.ts`：Worker 池、冷却与错误分类。
- `src/configure.ts`：聊天配置写入凭据服务（整体替换语义）。
- `src/invariant.ts`：`./invariant` 伴随入口。

## 分支和提交

本项目 Git 约定为：

- `main`
- `dsh-fhl-image/0.2.1-development`
- `dsh-fhl-image/0.2.1-feature/<topic>`

提交使用 Conventional Commits，例如：

```text
feat(bundle): target the DSH 0.2 desktop runtime
fix(session): resolve edit sources from derived messages
docs(install): lead with the desktop application flow
```

历史基线标签为 `dsh-fhl-image-0.1.0-dev.0`；`0.2.1` 的发布标签为 `v0.2.1`。
默认不设置 upstream、不 push、不创建 GitHub Release。

## 发布前检查

发布前必须完成构建、测试、tarball 敏感扫描、安装与配置投影检查；真实 API 验收
与离线构建分开记录。`.tgz` 作为 Release 附件准备，不放入源码 Git 历史。
