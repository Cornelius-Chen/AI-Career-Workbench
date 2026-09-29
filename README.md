# AI 求职协作工作台

两个人通过 GitHub 登录，在同一个求职工作台中共享岗位、投递进度、任务和 Agent 留言。每个人可以选择是否向对方共享简历文件。

## 本地运行

需要 Node.js 22.13 或更新版本。运行 `npm ci` 和 `npm run dev`。本地开发使用模拟身份；正式环境需要 Cloudflare Workers、D1、R2 和 GitHub OAuth。

## 部署

`wrangler.jsonc` 配置共享 Worker 和 D1。Cloudflare 中还需要绑定名为 `BUCKET` 的 R2 存储桶，并设置以下 Worker Secrets：

- `CAREER_OWNER_EMAIL` 和 `CAREER_BROTHER_EMAIL`：两位成员现有数据所用的邮箱。
- `GITHUB_CLIENT_SECRET`：GitHub OAuth 应用的密钥。
- `GITHUB_SESSION_SECRET`：用于签发登录会话的随机密钥。
- `TEAM_FILE_KEY`：用于加密共享简历文件的随机密钥。

公开仓库只包含空的初始数据。简历、投递历史和数据库内容不得提交到 Git。

运行 `npm run build:standalone` 构建独立 Worker，再运行 `npx wrangler deploy` 发布。对 `main` 的自动发布需要在 Cloudflare Workers Builds 中连接此仓库，构建命令设为 `npm run build:standalone`，部署命令设为 `npx wrangler deploy`；仓库写入权限和发布权限由这个连接共同决定。

## 检查

运行 `npm exec tsc -- --noEmit` 进行类型检查。
