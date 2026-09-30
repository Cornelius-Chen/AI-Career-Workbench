# 交给 Anson 的 Agent

请帮我在这台 Mac 完整安装并启动双人求职工作台，我的 GitHub 账号是 `Anson-F`，求职目标是 **2027 年暑期实习**。

代码：https://github.com/Cornelius-Chen/AI-Career-Workbench

私有同步数据：https://github.com/Cornelius-Chen/AI-Career-Workbench-Data

哥哥发给我的 `Anson-local-setup.zip` 已放在本机，请找到并解压其中的 `career-local-credentials.json`，只用于本地安装，不输出密钥，不提交到 GitHub。

先读代码库 `AGENTS.md` 和 `docs/LOCAL-WORKBENCH.md`。检查 Node.js 22.13 或更高版本、Git 和 GitHub CLI；以 `Anson-F` 登录 GitHub 并接受私有数据仓库邀请。需要本人完成的登录或验证码让我输入。

在新的目录克隆代码，安装依赖，执行 `npm run local:setup -- --member Anson-F --credentials /密钥文件完整路径`，然后 `npm run local:start`。首次启动自动导入共享数据。用 Chrome 打开本机 `http://127.0.0.1:4317/team`，核对当前成员是 Anson-F、能看到哥哥的投递进度和双方资料、同步按钮可用。这个 localhost 地址在各自电脑上分别运行，两人不需要同一局域网。

安装后运行 `npm run local:sync` 和 `npm run local:agent -- context`。从我的真实简历和我确认的信息补全我自己的简介、所在地、技能和 2027 夏季实习目标，不猜联系方式、成绩、项目成果、工作授权或身份答案。简历共享默认由我决定。

读取哥哥和我的资料、两边 Agent 留下的有效发现，再查官方的 2027 暑期实习岗位。通过 `local:agent` 的 note、recommend 和 task 命令写入有依据的总结、适合我的岗位及下一步；只把真实的 Agent 发现放进协作区，不编造对话。让我决定加入申请计划或跳过。尚未出现官网成功页、申请编号或确认邮件时，不得记录为已经投递。

开始工作前拉取更新，结束后上传更新。可以修改公开代码仓库中的程序；完成构建、核验和本人署名的提交后推送，哥哥拉取并重建后能看到改动。资料只经私有仓库加密同步；不要恢复旧云端平台、覆盖新的本地数据库或把个人资料提交到公开仓库。

请把安装、首次导入、实际页面检查和同步做到完成，再告诉我日常如何启动。任何尚未完成的步骤要说明真实原因，不要把写了说明当作安装完成。
