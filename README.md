# AI 求职协作工作台

这是正式网站的唯一源码。正式入口为 https://ai-career-workbench.cornelius-chen-ai.workers.dev/team 。旧 `chatgpt.site` 项目已经退役，仅保留跳转和历史证据；不要从旧项目发布同名 Cloudflare Worker。

两个人通过 GitHub 登录，在同一个求职工作台中共享岗位、投递进度、任务和 Agent 留言。每个人可以选择是否向对方共享简历文件。

日常入口是 `/team`：其中的「我的工作台」显示本人岗位、申请、待办与资料；「双方概览」「双方申请」「岗位地图」显示共享进展。地图默认统计已确认投递，并单列无法在美国地图定位的记录。计划投递和待确认不计作已投递。

共享数据在打开页面或保存操作后读取，平时通过「刷新共享数据」手动更新；个人工作台也提供「刷新个人数据」。页面不再定时轮询。旧申请记录每次按 200 条分批读取，以适应 Cloudflare 免费方案的资源额度。`/team` 是预生成的静态入口，登录后再读取私有数据。

「Agent 协作」只展示 Agent 提交的结构化发现、依据和下一步；人的研究要求单独保存。共享岗位只接收 Agent 提交且附有依据的建议，成员可以加入申请计划或跳过。两人的求职类型分别设置：工作台所有者找 2027 年全职，另一位成员找 2027 年暑期实习。Agent 推荐时要核实官方岗位的类型与时间，指定推荐对象；类型或年份不匹配的岗位不能加入该成员的申请计划。网站通过 WebMCP 为已登录的 Agent 提供读取共享资料、留言、任务和推荐岗位的工具。Agent 需主动访问网站使用这些工具；网站本身不会在后台自动运行模型。

2026 秋招中，经官方证据确认条件不符、达到雇主申请上限或岗位关闭的待投记录，通过 `applications.season.exclude` 移出当前列表。历史证据和已确认投递继续保留；不明确的记录仍待本人核对。此规则和正式站代码一起维护。

## 本地运行

需要 Node.js 22.13 或更新版本。运行 `npm ci` 和 `npm run dev`。本地开发使用模拟身份；正式环境需要 Cloudflare Workers、D1、KV 和 GitHub OAuth。

## 部署

`wrangler.jsonc` 配置共享 Worker、D1 和存储附件的 KV，并设置以下 Worker Secrets：

- `CAREER_OWNER_EMAIL` 和 `CAREER_BROTHER_EMAIL`：两位成员现有数据所用的邮箱。
- `GITHUB_CLIENT_SECRET`：GitHub OAuth 应用的密钥。
- `GITHUB_SESSION_SECRET`：用于签发登录会话的随机密钥。
- `TEAM_FILE_KEY`：用于加密共享简历文件的随机密钥。

公开仓库只包含空的初始数据。简历、投递历史和数据库内容不得提交到 Git。

运行 `npm run build:standalone` 构建独立 Worker，再运行 `npx wrangler deploy` 发布。对 `main` 的自动发布需要在 Cloudflare Workers Builds 中连接此仓库，构建命令设为 `npm run build:standalone`，部署命令设为 `npx wrangler deploy`；仓库写入权限和发布权限由这个连接共同决定。

## 检查

运行 `npm exec tsc -- --noEmit` 进行类型检查。
