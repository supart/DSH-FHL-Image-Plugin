# 0.2.1 发布说明

## 产品身份

`@fhl-plugins/dsh-fhl-image` 是独立 MIT 许可的 DSH 社区插件，不是官方
DeepSeek 或 FHL 产品。目标仓库为：

`https://github.com/supart/DSH-FHL-Image-Plugin`

## 0.2.1 修复与改进

### 缺陷修复

- **缩减 Worker 数量现在真的会清除旧 Key**：0.2.0 只会写入、从不删除，所以先配
  10 个 Key 再配 1 个，第 2–10 号槽位仍留着旧 Key 并被继续调度，而结果却报告
  “Configured 1”。现在 `fhl_image_configure` 是**整体替换**：超出本次 Key 数量的
  槽位会被清除。由启动环境提供的引用名无法删除，会被跳过而不是让整次调用失败。
- **确定性错误不再重试整池 Worker**：0.2.0 把本地参数校验也标成可重试，导致空
  prompt 这类必然失败的输入最多触发 9 × 10 次无意义请求，最后报“所有 Worker 都
  失败了”，掩盖了真正的原因。校验错误现在有独立错误码并直接失败。
- **不再把整批生成结果当作编辑参考**：省略 `sources` 时，插件此前会把最近一次
  生成的全部变体（最多 9 张）一起作为编辑参考，而提示词和文档一直承诺的是“最近
  一张图”。现在只取最新那一张。
- **接受不带填充、base64url 和带 data-URI 前缀的响应**：0.2.0 要求严格的标准
  base64 填充，遇到可解码的变体就报 `invalid-image`，进而触发上面那条重试风暴。
- **错误响应体不再整份缓冲**：0.2.0 会先把响应体读完（上限 64 MiB）再截断成 512
  个字符。现在只读取有界的诊断前缀并立即取消流。
- **脱敏覆盖到最后一跳**：`task-fatal` 分支此前会把原始错误消息原样抛出。现在
  该路径也会移除已知 Worker Key；客户端的脱敏同时覆盖带空白的 Key 形态。
- `skipped` 计数现在与提示文案一致（包含重复项，而不只是超限项）。

### 工程改进

- **测试从 20 个增加到 71 个**，新增 `worker-pool`（23 个用例，此前这个并发核心
  零覆盖）、工具执行体、`lib/` 构建产物入口和客户端边界用例。
- **测试文件现在会被类型检查**。`tsconfig.json` 只包含 `src`，测试此前从未被检查；
  接入 `tsconfig.test.json` 后立刻暴露并修复了 4 个真实类型错误。
- **新增 GitHub Actions CI**：每次 push / PR 在 Node 22.19 与 24 上跑
  typecheck / test / build / pack，并扫描发布包中的类 Key 文本、本机绝对路径，
  以及所有相对模块导入是否都随包发布。
- 补齐 `publishConfig`、`homepage`、`bugs` 元数据；`@deepseek-ai/cordis` peer 由
  精确的 `4.0.4` 放宽为 `~4.0.4`，与 DSH 官方包的写法一致。
- 发布包现在包含 README 引用的六份中文文档（此前只带 `docs/assets`，装完后
  README 里的文档链接全是死链）。
- 加入 `.gitattributes`，仓库统一 LF 行尾。
- 产品限制（10 个 Worker、9 张生成变体、4 张编辑变体、10 张参考图）收敛到单一
  常量表，工具描述也由这些常量生成，避免文案与实际限制漂移。

## 本版本包含

- 适配官方桌面版 DSH `0.2.0-rc.2` 包线，可通过桌面 App 的插件管理直接安装，
  不需要版本豁免。
- FHL Images 生成和编辑工具。
- 一至十个独立 Worker 的凭据池、冷却和错误隔离。
- `fhl_image_configure` 聊天配置工具（整体替换语义）。
- DSH 附件结果回显和多参考图编辑。
- 中文安装、配置、故障排查和安全文档（桌面版为主线）。

## 与 0.1.0 的差异

- **目标线变更**：0.2.0 只支持 DSH 0.2 桌面线；`0.1.x` 的 `0.1.1-rc.1`
  兼容声明不再保留。
- **会话图片来源重写**：DSH 0.2 移除了 `Session.events`。编辑来源改为读取派生
  消息历史（`Session.deriveMessages()`），并新增插件自持的、按会话的内存缓存来
  记住最近生成的图片。缓存不持久：重启 App 后若省略 `sources`，会按“请显式提供
  参考图”的方式报错，而不是猜测引用。
- **配置更确定**：bundle 层不再求值 `process.env`；默认值写死在补丁层，可在
  profile 补丁中覆盖。
- **提示词分区**：从 0.1 的 `order: 119` 改到 0.2 工具区间的 `2500`。
- **安装更省事**：去掉 `prepare` 脚本，发布包不含安装期构建脚本，因此不会弹
  构建授权。

## 已验证范围

- `pnpm typecheck`（覆盖 `src` 与 `tests`）、`pnpm test`（9 个测试文件 / 71 个
  用例）、`pnpm build`、`pnpm pack`。
- `tests/manifest.spec.ts` 校验所有 `@deepseek-ai/dsh*` peer 范围满足目标运行时
  `0.2.0-rc.2`（含 prerelease），并校验补丁层不含 `process.env`。
- `tests/bundle-entry.spec.ts` 直接加载构建产物 `lib/index.js`，确认发布入口仍带
  插件身份、`inject`、`apply`、Config schema 与公开导出。
- tarball 内容与敏感信息扫描：只包含 `lib/`、补丁、README、六份中文文档、
  LICENSE、CHANGELOG 和文档插图，无凭据、无 `.env`、无本机路径，且所有相对模块
  导入都能在包内解析。
- 在 macOS 官方桌面版 `0.2.0-rc.2` 的 `desktop` profile 实测安装成功：
  未出现 `incompatible-version`，未授予版本豁免（无 `compatibility.json`），
  安装后本会话工具目录即时出现 `fhl_image_configure`、`fhl_image_generate`、
  `fhl_image_edit`，配置投影返回 `baseURL`/`apiKeyEnv`/`timeoutMs`/
  `maxResponseBytes`/`workerCooldownMs` 的 schema，且不含任何 Key。
- **已完成一次真实生图链路验收**：在桌面 App 会话内用真实 Worker Key 调用
  `fhl_image_generate`，返回 1088×1920 PNG 并由 DSH 附件服务落盘，工具结果不含
  Key。这是 0.2.0 遗留的最后一个未验收项。
- profile 的既有内容未被破坏：原有 bundle 顺序不变，
  `cordis.patch.yml`（本机微信工具）逐字节未变，`dsh-orb` 及其依赖仍可用。

## 升级提示

同名的**同版本**包已经安装时，再执行一次安装会报
`ambiguous-install`（`pnpm add` 成功，但管理器无法判断是哪一个依赖发生了变化）。
升级请先用插件管理器的移除功能卸载，再安装新的 tarball；发布新版本时请提升版本号。

## 尚未宣称完成的内容

- 真实链路只验收了**生成**；编辑工具的真实请求与计费状态未单独验收。
- 未验证跨重启后 `fhl_image_edit` 省略 `sources` 的行为——这是有意收窄，已在
  故障排查文档中说明。
- 没有 Windows 桌面版的实测记录；Windows 相关说明沿用命令行版脚本，待补充。
- 未提供桌面设置面板（client 插件）；配置覆盖通过 profile 补丁层完成。
- 已知但本批次未处理：编辑请求的 multipart 字段名为首图 `image`、其余 `image[]`。
  该形状已由 `tests/client.spec.ts` 固定，改动它属于协议变更，需对真实接口验证。
