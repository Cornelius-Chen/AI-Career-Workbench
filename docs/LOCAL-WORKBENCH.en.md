# Local mode, collaboration and Agent commands

English · [简体中文](LOCAL-WORKBENCH.md)

For solo setup, see [Getting started](GETTING-STARTED.en.md). Public code and private data repositories are separate. Personal information, databases, keys, attachments and invitation packages stay in the ignored `.local/` directory. Never publish raw personal records on GitHub.

## Enable collaboration from solo

Select collaboration in **Space settings**. Install GitHub CLI (`brew install gh` on Mac) and complete `gh auth login` yourself. Keep the app running and ask your Agent to run:

```sh
npm run local:share -- --repo YOUR_GITHUB_USERNAME/NEW_PRIVATE_DATA_REPO
```

This creates a private repository, generates local encryption keys and uploads initial shared data. It does not share résumés whose sharing switch is off or upload the private fact library. Stop and restart the app afterward. Do not use the project author's private data repository.

Invite each partner's actual GitHub username:

```sh
npm run local:invite -- --login PARTNER_GITHUB_USERNAME --name "Partner display name"
```

This sends a private-repository write invitation, registers the member locally, syncs a blank profile and generates `.local/invitations/USERNAME/`. Privately send that directory to the partner. It contains keys: never publish it, post it in public chat or commit it to GitHub. Optional `--email` sets a member identifier; otherwise GitHub's noreply address is used internally, not as an application email.

## Invited member setup

Accept `https://github.com/OWNER/DATA_REPO/invitations`, then sign into `gh` using your own GitHub account. Clone the program into a new directory, install Node.js 22.13+, Git and GitHub CLI, and run:

```sh
npm ci
npm run local:setup -- --member YOUR_GITHUB_USERNAME --credentials /absolute/path/career-local-credentials.json
npm run local:start
```

First startup imports encrypted shared records and approved shared attachments. Open http://127.0.0.1:4317/team and check your identity, member progress and sync controls. Each member supplies their own real goals; do not assume the same employment type or target year.

Members can view shared applications and maintain their own plans, files, decisions and Agent notes. Full private facts, application contacts, résumé generation and automation rules currently belong to independent solo installations or the collaboration owner's personal database; they are not copied to invited members. Install solo in a separate directory for a fully independent private workbench. Do not treat a shared database as your own private history.

Existing invitation files remain compatible. Existing employment types and target dates are preserved; no key resend is required.

## Daily sync

- Save changes locally first.
- **Upload my updates** encrypts and commits updates to the private repository.
- **Pull partner updates** merges uploaded member updates.
- **Sync both ways** uploads, then pulls.
- Agents run `npm run local:sync` before and after authorized shared work.

Conflicts retain both versions until a member chooses. Different records merge without replacing the entire database. Résumé sharing is off by default. Disabling it stops future sharing but cannot recall files already downloaded or retained in Git history. Solo mode does not upload or pull.

Data is encrypted with AES-256-GCM before pushing. `gh` manages GitHub authentication; its token is not stored in the app database. Sync checks that the actual GitHub account matches the installed identity. The data repository must be private; keys go privately to invited members.

## Agent commands

Read the space first. Use `currentMemberEmail` for the current member and each profile's `target_type` and `start_date` to match jobs. Do not hard-code accounts, employment types or years.

```sh
npm run local:agent -- context
```

With authorized personal-database access, read facts, rules, résumés and evidence:

```sh
npm run local:agent -- workspace
```

Save input files in `.local/`, then run:

```sh
npm run local:agent -- profile .local/profile.json
npm run local:agent -- note .local/agent-note.json
npm run local:agent -- recommend .local/recommendation.json
npm run local:agent -- task .local/agent-task.json
npm run local:agent -- execute .local/workspace-action.json
```

| Command | Input |
| --- | --- |
| `profile` | `{"profile":{"headline":"Real summary","location":"Actual or preferred region","focus":"Target roles","skills":"Real skills","startDate":"Personally confirmed date","targetType":"full_time"}}`; use `summer_intern` for summer internships |
| `note` | Required `finding`, `evidence`, `nextAction`; optional `sourceUrl`. Use actual research, profile or application evidence |
| `recommend` | `company`, `title`, `url`, `location`, `lane`, `note`, `evidence`, `targetEmail`, `opportunityType`, `period`. Read target email from context; employment type and year come from official listings. Set `coapply` only when at least two members match the type and season |
| `task` | `title`, `details`, optional `assignedToEmail` chosen from current members |
| `execute` | Existing `/api/workspace` action format, such as `{"action":"task.request","kind":"verify_jobs","ids":["JOB_ID"]}`. Existing application rules, evidence requirements and authorization still apply |

WebMCP provides reading, evidence-backed notes, tasks and recommendations. Agents without those tools can use local commands. Never report an unexecuted command, queued task or application plan as complete. Never overwrite local records with archived cloud content.

## Language

The UI defaults to English. Choose **中文** in the top-right menu to switch; that browser remembers it. Built-in handoff prompts follow the selected language. Original documents, evidence and Agent-authored notes are preserved. Stored status codes and filter values do not change. Command names and JSON fields remain the same in both languages; existing CLI diagnostic messages may be in Chinese.

## Program updates

Stop the app, save your code changes and pull the latest source. Run `npm ci`, `npm run local:setup` and `npm run local:start`. Preserve `.local/`. Use your verified Git author and intended repository. Other members must pull and rebuild to see program changes; data sync does not update code.

## Retired entry points

Previous cloud sites are archived and no longer daily entry points. Archived databases serve only as migration evidence. Current status comes from the local database, encrypted sync and official evidence. Verified application caps, hard mismatches and closed-job exclusions remain in force.
