# 演示动画 · Product demo

这支 40 秒动画使用 React / TypeScript 与 [Remotion](https://www.remotion.dev/docs/) 制作。展示求职目标 → Agent 研究 → 本人选择 → 申请筛选与地图 → 可选协作。

## 素材与真实范围

`public/*.jpg` 来自当前工作台的独立演示数据库：Alex 与 Sam 是虚构成员，Atlas、Northstar 与 Orbit 是虚构公司，所有岗位链接均使用 `example.invalid`。只加入一条申请计划，已投递数为零。没有使用作者或伙伴的个人资料、简历、真实申请、私有同步仓库或密钥。

这是基于真实界面截图的讲解动画，截图的移动、缩放和字幕由代码生成；不是全程操作录屏。协作段展示功能和设置后的同步方式，演示数据库没有配置远程同步。网页不会自动运行 Agent，计划投递不代表提交成功。

暗色画面是视频包装；工作台本身保持现有浅色界面。中文字体使用系统的 PingFang SC / Microsoft YaHei；导出电脑需有中文字体。

## 重新制作

视频依赖单独安装；日常使用工作台无需运行本节步骤。

```sh
cd docs/video
npm ci
npm run preview
```

渲染：

```sh
npm run render
npm run poster
npm run preview:gif
npm run social
```

预览和渲染前自动生成原创器乐背景音 `public/score.wav`，再导出 1920×1080、30 fps 的 `docs/media/career-demo.mp4`。`npm run poster` 导出 README 的封面。14 秒 GIF 预览与 1280×640 分享封面使用独立合成导出。视频和生成的音频不进入源码 Git 历史；MP4 作为 GitHub Release 附件发布。背景音可在 `generate-score.mjs` 中修改。

修改场景在 `src/CareerDemo.tsx`；时长、尺寸和帧率在 `src/index.tsx`。所有画面动画由帧数驱动，不依赖页面计时器。配乐由 `generate-score.mjs` 本地合成，无外部音频采样。

依赖版本固定在本目录的 lockfile 中。Remotion 保留其自身的 [许可条款](https://www.remotion.dev/docs/licensing)，不属于本项目 MIT 授权的第三方代码；使用该工具重新渲染时按其条款确认资格。

## English

A 40-second React / Remotion walkthrough using actual app screenshots and an isolated fictional dataset. The dark canvas belongs to the video; it does not change the light app UI. It is a screenshot-based explanatory animation, not a continuous screen recording or proof of real job research, submissions or remote sync. The soundtrack is generated locally without external samples.

Install the optional tooling with `npm ci` in this directory, use `npm run preview`, and export with `npm run render`. Video dependencies are separate from the workbench. Remotion retains its own license terms. Do not replace screenshots with private user records.
