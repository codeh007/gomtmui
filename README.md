# gomtmui

`gomtmui` 正在从私有 monorepo 迁移为可独立安装、构建、部署的公开真实项目。

## Current Status

- 当前仓库不再定位为最小公开演示壳。
- 真实应用源码已经迁入 `src/` 与 `public/`。
- 依赖、构建、部署与环境变量边界仍在迁移收敛中。
- 运行时 secrets 必须通过外部注入，真实凭据不得提交到仓库。

## Migration Status

- 公开仓仍在迁移中，但当前最小验收链已经收敛为可重复执行的 `typecheck -> build -> build:worker`。
- 构建是否通过取决于是否显式注入当前仓实际需要的 public env；仓库代码本身不再伪造占位公开配置。
- README 只记录已经验证过的命令链与环境边界，不把未验证通过的状态表述成既成事实。
- 仓库入口以 `src/app/` 为准，不再使用旧的根级 `app/` 目录。

## Local Development

```bash
cp .env.example .env.local
bun install
bun run typecheck
bun run build
bun run build:worker
```

`cp .env.example .env.local` 是本地运行的前置步骤；示例文件只保留变量名，不包含任何真实凭据。复制后必须填写 `.env.local` 中当前构建实际需要的变量，至少包括 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`，以及至少一种服务端基地址来源：`NEXT_PUBLIC_SITE_URL`、`NEXT_PUBLIC_BASE_URL`、`BASE_URL`，或 `CODESPACE_NAME` + `PORT` 组合。若要使用公开 `/wiki` 页面，还需要提供 `GOMTM_SERVER_URL`（或等价的 `NEXT_PUBLIC_GOMTM_SERVER_URL`）指向可访问的 gomtm server。构建期不会在代码中伪造这些值，缺少必需 env 时 `bun run build` 与 `bun run build:worker` 会直接失败。

公开仓当前采用 `bun` 作为包管理器，并使用 `bun run tsgo --noEmit` 作为显式类型检查入口。`next build` 已关闭重复的内建类型校验，避免在大体量依赖图上重复做第二次类型检查；因此标准验收顺序必须先跑 `bun run typecheck`，再跑 `bun run build`。

当前目标自定义域名为 `https://gomtmui-dev.yuepa8.com`；`workers.dev` 地址只作为 Cloudflare 默认回退入口保留。

## Sensitive Secrets

以下变量属于服务端敏感值，应通过 GitHub Actions secrets 或 Cloudflare secret store 注入，不应写入仓库：

- `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDFLARE_API_TOKEN`

## Cloudflare Secrets

部署配置遵循“仓内仅保留非敏感声明，真实 secrets 全部外置注入”的边界。

- CI/CD 使用 GitHub repository secrets。
- Cloudflare Worker 运行时 secrets 可通过 `wrangler secret put` 手动注入；GitHub Actions 部署链则使用 `wrangler deploy --secrets-file` 临时同步真正需要进入 Worker 运行时的 secret。
- `wrangler.jsonc` 只保留公开仓需要的非敏感 Worker 配置，不提交真实域名、token、私有 service 或 bucket 绑定。
- `CLOUDFLARE_ACCOUNT_ID` 属于部署时必须提供的标识符，但不是 secret；应通过外部环境变量或平台变量注入，而不是硬编码到仓库。

示例：

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

如果通过 GitHub Actions 部署，请在仓库 `Settings -> Secrets and variables -> Actions` 中为敏感值配置 secrets，并为公开变量或标识符配置对应的 variables / environment variables。当前部署工作流只会把真正需要给 Worker 运行时消费的 secret 同步到 `--secrets-file`；`CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` 仅保留在部署作业环境中供 `wrangler` 使用，不再注入到 Worker 运行时。

## Public Runtime Variables

以下变量可以公开给客户端或作为公开运行时配置，不应放入 secret store：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_GOMTM_SERVER_URL`
- `NEXT_PUBLIC_GITHUB_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_QWEN_CLIENT_ID`
- `NEXT_PUBLIC_LANGFUSE_BASE_URL`

## Optional Local Helper Variables

- `BASE_URL`
- `GOMTM_SERVER_URL`
- `PORT`

`BASE_URL` 用于显式指定服务端基地址；若未提供，则只有在同时提供 `CODESPACE_NAME` 与 `PORT` 时才会自动拼出 Codespaces URL，否则运行时会直接报错。`.env.example` 仅包含当前仓库实际读取且需要由开发者显式提供的环境变量；像 `CODESPACE_NAME` 这类平台注入变量不放入示例文件，但仍由运行时代码处理。

## SDK Dependency

- 当前公开仓直接使用 npm 发布版 `mtmsdk`。
- `mtmsdk` 需要先在主仓 `/workspace/gomtm` 中通过 `gomtm publish --filter mtmsdk` 完成正式发布，再由公开仓按普通 npm 版本安装。
- 遇到类似共享包依赖问题时，优先修正主仓发布真相并重新发布，而不是回退到 `file:` 或 vendored 本地包方案。

## Deployment Note

当前部署链仍在整理中；公开仓的目标运行形态为 `Next.js + OpenNext + Cloudflare Workers`。

## Verification

- 本地最小验收链：`bun install --frozen-lockfile`、`bun run typecheck`、`bun run build`、`bun run build:worker`
- GitHub Actions `CI` 会按同样顺序执行 checkout、setup-node、setup-bun、缓存恢复、`bun install --frozen-lockfile`、typecheck、Next build 与 `opennextjs-cloudflare build --skipNextBuild`
- GitHub Actions `Deploy` 在上述校验链通过后，继续执行 `wrangler deploy --secrets-file ... --var ...`，并把 Worker 绑定到 `gomtmui-dev.yuepa8.com`
- 部署工作流中的敏感值来自 GitHub Secrets，公开运行时配置与 Cloudflare 标识符来自 GitHub Variables

## License

This project is licensed under the MIT License. See `LICENSE` for details.
