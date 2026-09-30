# AI Career Workbench · AI 求职工作台

以单人为默认的本地求职工作台，也可以开启两人或多人协作。整理个人资料和简历、研究官网岗位、选择申请计划、记录真实投递证据，并让自己的 Agent 留下有依据的发现与建议。

## 单人开始

需要 Node.js 22.13+ 与 Git，无需 GitHub 登录、Cloudflare 账号或 API 密钥：

```sh
git clone https://github.com/Cornelius-Chen/AI-Career-Workbench.git
cd AI-Career-Workbench
npm ci
npm run local:setup -- --name "我的名字"
npm run local:start
```

打开 http://127.0.0.1:4317/team ，按「使用引导」填写目标、上传 PDF / DOCX、复制指令给自己的 Agent，再查看岗位推荐。以后双击 `start-local.command` 启动。新安装是空白数据库，不带作者的资料、简历、投递历史或示例岗位。

可以把 [Agent 安装与接手指令](docs/AGENT-START.md) 直接交给自己的 Agent。

完整说明：[开始使用](docs/GETTING-STARTED.md) · [可选协作与 Agent 操作](docs/LOCAL-WORKBENCH.md)。

## 使用方式

- **个人工作台**：本人申请、分类筛选、测评与面试、私人资料与简历版本。
- **岗位推荐**：Agent 核实官方来源、类型和时间后给出建议；本人选择加入申请计划或跳过。
- **岗位地图**：推荐/投递可切换，无法定位的岗位保留在列表；当前底图覆盖美国。
- **Agent 信息**：只展示真实发现、依据和下一步；研究要求单独保存。网页不会自动运行或唤醒 Agent。
- **空间设置**：默认单人，协作可开启；切回单人停止本机共享同步并保留原有记录。
- **可选协作**：成员数量不固定，各自维护目标、申请计划和简历共享选择；私有 GitHub 数据仓库交换加密更新，有冲突时保留不同版本供选择。

单人数据保存在 `.local/`。公开仓库只提交源码；协作数据经过 AES-256-GCM 加密后写入另一个私有仓库，密钥私下交给受邀成员。数据邀请不等于源代码写入权限。

当前完整私人经历与投递规则面向美国求职，协作成员共享的范围见安装说明。计划、待确认与没有成功凭证的操作不算已投递。简历上传不自动确认其中事实，也不开始提交申请。

## 更新与检查

更新前停止网站，保留 `.local/`，拉取代码后执行 `npm ci`、`npm run local:setup`，再启动。同步只更新资料，程序改动需要各自拉取并重新构建。

```sh
npm exec tsc -- --noEmit
npm run test:sync
npm run build:standalone
```

本项目旧云端和 `chatgpt.site` 入口已退役，不覆盖本地新记录。日常修改仅使用当前代码库。
