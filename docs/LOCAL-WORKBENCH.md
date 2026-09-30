# 双人本地工作台

日常入口是各自电脑的 `http://127.0.0.1:4317/team`。两台电脑互不依赖，不需要同一局域网。关闭终端会停止本机网站。代码库仍为 https://github.com/Cornelius-Chen/AI-Career-Workbench 。云端旧入口暂停日常使用，不能把本地新记录重新从云端覆盖回来。

数据通过私有仓库 https://github.com/Cornelius-Chen/AI-Career-Workbench-Data 同步。申请记录、双方资料、推荐、Agent 留言和任务在上传前用 AES-256-GCM 加密；密钥留在各自的 `.local/credentials.json`。GitHub 登录由 `gh` 自己管理，不将登录令牌放进仓库。

## Anson 的 Mac 安装

1. 接受私有数据仓库的邀请： https://github.com/Cornelius-Chen/AI-Career-Workbench-Data/invitations 。需要以 `Anson-F` 登录。
2. 从哥哥私下收到 `Anson-local-setup.zip`，解压得到 `career-local-credentials.json`。不要把这个文件发到聊天记录或 GitHub。
3. 安装 Node.js 22.13 或更高版本、Git 和 GitHub CLI。已有 Homebrew 时可以用 `brew install node@22 gh`，然后 `export PATH="$(brew --prefix node@22)/bin:$PATH"`。`gh auth login` 需要本人完成登录。
4. 将代码库克隆到自己的新目录；以前已克隆过且历史被重写的副本先保留，使用新目录安装。

```sh
git clone https://github.com/Cornelius-Chen/AI-Career-Workbench.git
cd AI-Career-Workbench
npm ci
npm run local:setup -- --member Anson-F --credentials /完整路径/career-local-credentials.json
npm run local:start
```

首次启动自动解密并导入共享记录和已允许共享的附件。终端显示工作台地址后，在 Chrome 打开 `http://127.0.0.1:4317/team`。之后可以双击代码目录的 `start-local.command` 启动。

本地身份由安装时的 `--member` 指定，不需要云端 OAuth 登录。服务器只监听本机。每次 GitHub 同步会检查 `gh` 当前登录是否与指定成员一致。

## 日常使用

- 保存：先留在自己的电脑。
- 上传我的更新：把本机改动加密提交到私有仓库。
- 拉取伙伴更新：把对方已上传的内容合并到本机。
- 双向同步：先上传再拉取。Agent 完成一次工作后运行 `npm run local:sync`，另一边开始工作前也运行一次。

两边同时修改同一条记录时，平台保留两份内容并显示选择按钮。选择的结果也会作为一条新的更新同步。不同记录可以直接合并；申请状态和历史证据不会按整份数据库覆盖。

本人简历内容、事实库、原始申请资料、申请次数表和私人待办留在本机；共享空间包含岗位、申请详情、双方求职简介和 Agent 信息。简历文件只有开启共享时才上传。停止共享后不再提供新的共享下载，已经同步到对方电脑或 Git 历史中的文件无法收回。

## 给两边 Agent 的操作

使用同一份最新代码。不要恢复退役网站，也不要把旧云端数据库覆盖到本地工作台。保持两个仓库分开：公开仓库提交代码，私有仓库由同步程序提交加密数据。

```sh
npm run local:sync
npm run local:agent -- context
```

`context` 读取两人简介、目标类型、已确认投递、候选岗位、研究要求和双方 Agent 留下的有效信息。哥哥找 2027 年全职，Anson 找 2027 年暑期实习。先根据本人真实材料补全资料，再核实官方岗位。

写入通过 JSON 文件进行，文件放在忽略的 `.local/` 中：

```sh
npm run local:agent -- profile .local/profile.json
npm run local:agent -- note .local/agent-note.json
npm run local:agent -- recommend .local/recommendation.json
npm run local:agent -- task .local/agent-task.json
npm run local:sync
```

`profile` 文件形如 `{"profile":{"headline":"真实学历与简介","location":"实际所在地","focus":"目标方向","skills":"真实技能","startDate":"2027 夏季","targetType":"summer_intern"}}`。

`note` 需要 `finding`、`evidence`、`nextAction`，可加 `sourceUrl`。必须是实际发现、有依据的总结或明确下一步；不要把空泛聊天写到 Agent 记录里。

`recommend` 需要 `company`、`title`、`url`、`location`、`lane`、`note`、`evidence`、`targetEmail`、`opportunityType`、`period` 和 `coapply`。Anson 使用自己的实际成员邮箱（从 context 读取）、`summer_intern` 和官网核实的 `2027 summer`。全职对应 `full_time`。类型不同的两人不建议共同投递同一个职位。

网站保存的申请计划不表示已经投递。只有官网成功页、申请编号或确认邮件可以确认提交。2026 秋招已确认条件不符、达到申请上限或关闭的记录继续排除，不得重新加入队列。

## 更新代码

关闭本地网站，提交自己的改动后拉取公开代码的最新版本，再运行 `npm ci` 和 `npm run build:standalone`。`.local/` 保留，不删除本地数据库或密钥。两边 Agent 都可以通过公开代码仓库的协作者权限改程序；代码改动需要另一边拉取并重新构建后才能看到。

本地同步不自动运行招聘搜索、不自动提交申请，也不在后台调用模型。
