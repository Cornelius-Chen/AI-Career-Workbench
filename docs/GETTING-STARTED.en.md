# Start solo

[English](GETTING-STARTED.en.md) · [简体中文](GETTING-STARTED.md)

AI Career Workbench runs on your own computer. Solo use needs no GitHub login, Cloudflare account, API key or partner. Your own Codex / ChatGPT Agent reads materials, verifies jobs and writes results; the webpage does not run a model automatically.

## Install on Mac

Install Node.js 22.13+ and Git. With Homebrew, use `brew install node@22 git` and add Node 22 to your terminal PATH.

```sh
git clone https://github.com/Cornelius-Chen/AI-Career-Workbench.git
cd AI-Career-Workbench
npm ci
npm run local:setup -- --name "Your name"
npm run local:start
```

Open http://127.0.0.1:4317/team . Fresh installations start at **Getting started**, with a blank database and no author's personal information or sample jobs. Double-click `start-local.command` for later launches; closing the terminal stops the app. This address belongs to your computer, not a remote shared website.

The interface defaults to English. Use the top-right **English / 中文** menu to switch. The browser remembers your choice; partners have separate preferences. Original documents, jobs and Agent notes retain their original language.

For updates, preserve `.local/`, stop the app, pull code, run `npm ci` and `npm run local:setup`, then start. Setup reuses your identity, keys and database. Never delete `.local/` or reimport archived cloud records.

## Four onboarding steps

1. **Set goals:** use **Getting started → Edit career goals** for your summary, region, roles, skills, full-time / internship, year and timing.
2. **Upload material:** use **Résumés & files** for original PDF / DOCX. In **My workbench → Résumé & personal profile**, personally confirm email, phone, education, status answers and experience. Uploading does not mean parsing or confirmation is complete.
3. **Contact your Agent:** copy the prompt in Getting started and send it to your Agent. It should read goals and source material, research official jobs and write useful findings, tasks and recommendations. No model API purchase is required. If WebMCP tools are unavailable, use `npm run local:agent` commands.
4. **Choose:** accept or skip jobs in **Job recommendations**. Plans appear in **My applications**. Only an official success page, application ID or confirmation email establishes a submission. A plan is not a submitted application.

**Agent notes → Save request** records a request without automatically waking an Agent. Send that request to your Agent too.

Private experience, application rules, résumé generation and verification currently focus on U.S. job searches. Your Agent must verify other markets' requirements separately. The app does not answer assessments or confirm identity details on your behalf.

## Collaboration is optional

Switch modes in **Space settings**. Solo mode shows only your own information and stops local shared uploads and pulls without deleting history. Information already sent to members cannot be recalled.

For two or more people, follow [collaboration and command instructions](LOCAL-WORKBENCH.en.md). Create your own private data repository and invite members. Everyone runs locally and chooses their own résumé sharing setting. Data invitations and source write access are separate: code collaborators need a separate invitation or a shared fork.
