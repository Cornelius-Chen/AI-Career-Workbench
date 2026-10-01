# 本地模式、协作与 Agent 操作

[English](LOCAL-WORKBENCH.en.md) · 简体中文

首次单人安装见 [使用引导](GETTING-STARTED.md)。公开源码和独立私有数据仓库分开；个人资料、数据库、密钥、附件和邀请包都留在忽略的 `.local/` 中。不要提交原始资料到公开 GitHub。

## 从单人开启协作

先在页面「空间设置」选择协作模式。安装 GitHub CLI（Mac 可用 `brew install gh`），本人完成 `gh auth login`。保持本地网站运行，然后让 Agent 执行：

```sh
npm run local:share -- --repo 我的GitHub用户名/一个尚未存在的私有数据仓库名
```

这会创建私有仓库、生成本地加密密钥并上传初始共享数据；不会共享尚未开启共享的简历，也不会上传私人事实库。完成后关闭并重新启动工作台。不要使用项目作者的私有数据仓库作为自己的共享仓库。

邀请一个或多个伙伴，每次指定其实际 GitHub 用户名：

```sh
npm run local:invite -- --login 伙伴的GitHub用户名 --name "伙伴显示名称"
```

程序向私有数据仓库发出写入权限邀请，在本机登记成员并同步空白资料，生成 `.local/invitations/用户名/`。私下把这个目录交给受邀伙伴；目录内包含密钥，不要公开，不要发到公开聊天或提交到 GitHub。可选 `--email` 指定成员标识；不指定时使用对应 GitHub 的 noreply 地址作为内部标识，不会作为申请邮箱。

## 受邀成员安装

本人接受 `https://github.com/仓库所有者/数据仓库名/invitations`，用自己的 GitHub 账号登录 `gh`。克隆程序到新目录，安装 Node 22.13+、Git 与 GitHub CLI，再运行：

```sh
npm ci
npm run local:setup -- --member 我的GitHub用户名 --credentials /完整路径/career-local-credentials.json
npm run local:start
```

首次启动自动导入加密共享记录和已允许共享的附件。打开 http://127.0.0.1:4317/team ，检查本人身份、成员进度和同步按钮。成员分别填写自己的真实资料，不默认假定别人也找实习或相同年份。

协作空间成员可以查看共享申请、独立维护自己的申请计划、文件、推荐选择和 Agent 信息。完整私人事实库、申请联系方式、简历生成与自动投递规则目前属于独立单人工作台/共享数据所有者的个人数据库，不会复制给其他成员。如果需要另一个完全独立的私人工作台，在新目录单人安装，勿将已有共享数据库当作自己的私有记录。

既有 Cornelius-Chen / Anson-F 邀请文件继续兼容；无需重新发送密钥。既有全职和 2027 夏季目标继续保留。

## 日常同步

- 保存先留在本机。
- 「上传我的更新」将改动加密提交到私有仓库。
- 「拉取伙伴更新」合并成员已上传的更新。
- 「双向同步」先上传，再拉取。
- Agent 开始共享工作前、完成后分别运行 `npm run local:sync`。

同一条记录有不同修改时保留两个版本，成员明确选择后再同步；不同记录直接合并，不用整份数据库覆盖。简历共享默认关闭，由各成员自己开启。停止共享后不再新增共享下载，已经同步到成员电脑或 Git 历史的文件不能收回。单人模式不会上传或拉取。

资料经过 AES-256-GCM 加密后再推送。GitHub 登录由 `gh` 管理，登录令牌不进程序数据库。每次同步核对实际 GitHub 登录与安装成员一致。数据仓库必须私有；密钥只私下交给被邀请的人。

## Agent 操作

先读当前空间，按 `currentMemberEmail` 找本人，按每个成员的 `target_type` 和 `start_date` 推荐，不能写死帐号、全职/实习或年份：

```sh
npm run local:agent -- context
```

具备个人数据库权限时，读取私人事实、规则、简历与申请证据：

```sh
npm run local:agent -- workspace
```

写入文件放在 `.local/`，再执行：

```sh
npm run local:agent -- profile .local/profile.json
npm run local:agent -- note .local/agent-note.json
npm run local:agent -- recommend .local/recommendation.json
npm run local:agent -- task .local/agent-task.json
npm run local:agent -- execute .local/workspace-action.json
```

- `profile`：`{"profile":{"headline":"真实简介","location":"实际或期望地区","focus":"目标方向","skills":"真实技能","startDate":"本人确认的时间","targetType":"full_time"}}`。实习使用 `summer_intern`。
- `note`：需要 `finding`、`evidence`、`nextAction`，可加 `sourceUrl`。必须来自真实研究、资料或申请证据。
- `recommend`：需要 `company`、`title`、`url`、`location`、`lane`、`note`、`evidence`、`targetEmail`、`opportunityType`、`period`。推荐理由和证据写具体；目标邮箱从 context 读取，岗位类型与年份来自官网。`coapply` 仅在至少两位成员的类型与年份符合时开启。
- `task`：`title`、`details`、可选 `assignedToEmail`，分配对象从当前成员名单选择。
- `execute`：直接传 `/api/workspace` 原有操作格式，例如 `{"action":"task.request","kind":"verify_jobs","ids":["岗位ID"]}`；已有投递流程继续遵循真实证据和本人授权。

网页提供 WebMCP 的读取、有效留言、任务和推荐工具；Agent 未具备这些工具时用本地命令。不得把未实际执行的命令、排队任务或申请计划报告为完成。不得把旧云端内容覆盖到本地新记录。

## 更新程序

停止网站、提交自己的改动并拉取最新代码，再执行 `npm ci`、`npm run local:setup`、`npm run local:start`。保留 `.local/`。代码作者使用本人署名和正确仓库。其他成员拉取并重新构建后才会看到程序改动；数据同步不会自动更新程序。

## 历史入口

本项目旧云端已归档，不作为当前入口；旧数据库只留作迁移证据。实际求职记录以本地数据库、加密同步更新和官方证据为准。已有经确认的申请上限、条件不符和关闭岗位排除规则继续生效。
