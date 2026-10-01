# Contributing · 参与项目

欢迎提交能帮助实际求职流程的 Bug 修复、功能建议、文档和翻译。

## 反馈问题

使用 [Issue 模板](https://github.com/Cornelius-Chen/AI-Career-Workbench/issues/new/choose)，提供复现步骤、系统与 Node.js 版本、预期结果、实际结果。截图和报错中隐藏私人资料；数据库、密钥与邀请包不公开。

## 修改代码

1. 先读 `AGENTS.md` 与 `docs/LOCAL-WORKBENCH.md`，保持默认单人、本地保存、可选协作的使用方式。
2. Fork 并创建自己的分支。开发数据留在忽略的 `.local/` 中；界面截图使用独立虚构数据。
3. 提交前检查与变更相关的行为。涉及代码时运行适用检查：

```sh
npm ci
npm exec tsc -- --noEmit
npm run test:sync
npm run test:team
npm run build:standalone
```

4. Pull Request 说明改了什么、为什么、如何核验，以及是否影响安装、已有数据或协作权限。单纯文档修改检查链接与说明即可。

工作台整理资料；自己的 Agent 进行实际研究；本人确认事实与选择。保留这个分工，不将任务排队或申请计划展示为已完成。程序更新与数据同步是独立流程。不要写任何防御性代码。

本项目代码采用 MIT 许可证。第三方代码保留原署名与许可。视频工具在 `docs/video/` 中独立安装，不增加日常工作台的依赖。

## English

Read `AGENTS.md` and the local workflow documentation before changing code. Use fictional development data, keep `.local/` private, and preserve solo-first behavior and optional encrypted collaboration. Describe the change and verification in your pull request. Documentation-only changes need link and content checks; code changes should pass the applicable checks above. Do not write defensive code. Project contributions use the MIT license; third-party components keep their original notices.
