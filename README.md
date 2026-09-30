# AI 求职协作工作台

这是双人平台的唯一源码。当前日常入口为各自电脑的 http://127.0.0.1:4317/team 。云端工作台已暂停读写，保留迁移时的历史数据库；旧 `chatgpt.site` 项目已经退役。不要从旧项目恢复源码或覆盖本地新记录。

两个人各自运行本地工作台，通过独立私有 GitHub 仓库交换加密更新，共享岗位、投递进度、任务和 Agent 留言。本机身份在安装时指定，GitHub 同步时校验本人账号。每个人可以选择是否向对方共享简历文件。安装和 Agent 使用步骤见 [双人本地工作台](docs/LOCAL-WORKBENCH.md)。

日常入口是 `/team`：其中的「我的工作台」显示本人岗位、申请、待办与资料；「双方概览」「双方申请」「岗位地图」显示共享进展。地图默认统计已确认投递，并单列无法在美国地图定位的记录。计划投递和待确认不计作已投递。

页面读取本机数据库，不消耗云端 D1 额度。点击「上传我的更新」「拉取伙伴更新」或「双向同步」与另一台电脑交换数据；冲突保留双方版本，选择后再同步。申请记录每次按 200 条读取，页面使用分类、筛选和分页。

「Agent 协作」只展示 Agent 提交的结构化发现、依据和下一步；人的研究要求单独保存。共享岗位只接收 Agent 提交且附有依据的建议，成员可以加入申请计划或跳过。两人的求职类型分别设置：工作台所有者找 2027 年全职，另一位成员找 2027 年暑期实习。Agent 推荐时要核实官方岗位的类型与时间，指定推荐对象；类型或年份不匹配的岗位不能加入该成员的申请计划。网站通过 WebMCP 为已登录的 Agent 提供读取共享资料、留言、任务和推荐岗位的工具。Agent 需主动访问网站使用这些工具；网站本身不会在后台自动运行模型。

2026 秋招中，经官方证据确认条件不符、达到雇主申请上限或岗位关闭的待投记录，通过 `applications.season.exclude` 移出当前列表。历史证据和已确认投递继续保留；不明确的记录仍待本人核对。此规则和正式站代码一起维护。

## 本地运行

需要 Node.js 22.13 或更新版本、Git 和 GitHub CLI。哥哥的本机已迁入正式 D1 导出的数据。弟弟接受私有数据仓库邀请、接收私下传递的密钥安装包后，按 [安装说明](docs/LOCAL-WORKBENCH.md) 运行 `npm ci`、`npm run local:setup -- --member Anson-F --credentials /完整路径/career-local-credentials.json`、`npm run local:start`。以后双击 `start-local.command` 即可启动。

代码更新后重新构建，保留 `.local/`，其中包含本机数据库、密钥、附件和同步状态。

## 云端归档与部署

`CAREER_ARCHIVED=1` 使云端旧工作台停止数据库读写并显示本地入口。当前不把云端数据库作为日常数据来源。`wrangler.jsonc` 配置共享 Worker、D1 和存储附件的 KV，并设置以下 Worker Secrets：

- `CAREER_OWNER_EMAIL` 和 `CAREER_BROTHER_EMAIL`：两位成员现有数据所用的邮箱。
- `GITHUB_CLIENT_SECRET`：GitHub OAuth 应用的密钥。
- `GITHUB_SESSION_SECRET`：用于签发登录会话的随机密钥。
- `TEAM_FILE_KEY`：用于加密共享简历文件的随机密钥。

公开代码仓库只包含空的初始数据。简历、投递历史、数据库内容和密钥不得提交到公开代码仓库；同步程序只把加密的数据提交到独立私有仓库，密钥不进任何 Git 仓库。

运行 `npm run build:standalone` 构建独立 Worker，再运行 `npx wrangler deploy` 发布。对 `main` 的自动发布需要在 Cloudflare Workers Builds 中连接此仓库，构建命令设为 `npm run build:standalone`，部署命令设为 `npx wrangler deploy`；仓库写入权限和发布权限由这个连接共同决定。

## 检查

运行 `npm exec tsc -- --noEmit` 进行类型检查，`npm run test:sync` 验证两份独立副本合并、并发冲突、冲突解决与简历共享过滤。
