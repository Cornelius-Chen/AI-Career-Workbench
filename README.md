# AI 求职工作台

A single-owner AI career workspace built with React, Vinext, Cloudflare Workers, D1 and R2. It tracks jobs, application evidence, resumes and user-confirmed profile facts. The source code is public; personal records and production configuration are excluded.

## Run locally

Use Node.js 22.13 or newer. Install dependencies with `npm ci`, then run `npm run dev`. The local starter supplies a mock identity. D1 and R2 bindings are required for persistence and file storage.

## Configure your own deployment

Set `CAREER_OWNER_EMAIL` to the email used by the authenticated owner. Configure the `DB` D1 binding and `BUCKET` R2 binding in your deployment. If you use the authorized worker API, set `CAREER_WORKER_TOKEN_SHA256` to the SHA-256 digest of its site-scoped token. Deploy this source as a new site with your own project configuration. Never commit tokens, resumes, application history, database state or production IDs.

The repository includes empty seed arrays in `data/jobs.json` and `data/manually-reviewed-resume.json`. Add jobs and confirmed facts through your own private deployment. The application does not include an autonomous scheduler or Gmail credentials; those require a separately configured, authenticated worker.

## Checks

Run `npm exec tsc -- --noEmit` for type checking and `node --experimental-strip-types --test tests/*.test.mjs` for unit tests.
