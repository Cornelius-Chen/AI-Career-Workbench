import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import reviewedResume from "@/data/manually-reviewed-resume.json";
import {
  db,
  bucket,
  owner,
  init,
  list,
  getSetting,
  setSetting,
  patchSetting,
  saveJob,
  task,
} from "@/lib/store";
import {
  canonical,
  requisitionKey,
  defaultProfile,
  defaultRules,
  evaluate,
  readiness,
  companyGroup,
  nyDay,
  reconcile,
  safeCsv,
  resumeCurrent,
  claimableApplication,
  applicationLimitMatches,
  applicationLimitIsReached,
  missingSpokenLanguage,
  type ApplicationLimit,
  type Fact,
} from "@/lib/domain";
import { refreshJob, discover, allowedUrl } from "@/lib/sources";
import { chooseFacts, renderResume } from "@/lib/resume";
export const dynamic = "force-dynamic";
const json = (data: any, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function failure(e: any) {
  const msg = e.message || "操作失败";
  return json(
    { error: msg },
    msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 400,
  );
}
const now = () => new Date().toISOString();
const str = z.string().max(8000);
const id = z.string().min(1).max(160);
async function getJob(id: string) {
  const r = await db()
    .prepare("SELECT data FROM jobs WHERE id=?")
    .bind(id)
    .first<any>();
  if (!r) throw Error("岗位不存在");
  return JSON.parse(r.data);
}
async function app(id: string) {
  const r = await db()
    .prepare("SELECT * FROM applications WHERE id=?")
    .bind(id)
    .first<any>();
  if (!r) throw Error("申请不存在");
  return { ...r, ...JSON.parse(r.data) };
}
async function applicationLimitReached(
  job: { title: string },
  group: string,
  limits: ApplicationLimit[],
) {
  for (const limit of limits.filter((item) => item.companyGroup === group)) {
    if (!applicationLimitMatches(limit, job.title)) continue;
    const since = new Date(
      Date.now() - limit.windowDays * 86400000,
    ).toISOString();
    const applications = await db()
      .prepare(
        "SELECT json_extract(j.data,'$.title') AS title FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.company_group=? AND (EXISTS (SELECT 1 FROM attempts t WHERE t.application_id=a.id AND t.created>=?) OR EXISTS (SELECT 1 FROM events e WHERE e.application_id=a.id AND e.occurred>=? AND json_extract(e.data,'$.stage')='submitted'))",
      )
      .bind(group, since, since)
      .all<{ title: string }>();
    if (applicationLimitIsReached(limit, job.title, applications.results.map((application) => application.title)))
      return `${group} 近 ${limit.windowDays} 天内该岗位系列已达到 ${limit.maxAttempts} 份申请上限：${limit.evidence}`;
  }
  return null;
}
async function trackedRequisitions() {
  const rows = await db()
    .prepare("SELECT a.id,a.status,a.updated,j.data AS job_data FROM applications a JOIN jobs j ON j.id=a.job_id")
    .all<{ id: string; status: string; updated: string; job_data: string }>();
  const tracked = new Map<string, { id: string; status: string; updated: string }>();
  const priority = (status: string) =>
    ["submitting", "uncertain", "submitted", "assessment", "interview", "offer", "rejected", "withdrawn"].includes(status)
      ? 3
      : status === "blocked"
        ? 2
        : status === "processing"
          ? 1
          : 0;
  for (const row of rows.results) {
    const key = requisitionKey(JSON.parse(row.job_data).url);
    const previous = tracked.get(key);
    if (!previous || priority(row.status) > priority(previous.status) ||
      (priority(row.status) === priority(previous.status) && row.updated < previous.updated))
      tracked.set(key, row);
  }
  return tracked;
}
async function snapshot() {
  const [
    jobs,
    facts,
    applications,
    events,
    resumes,
    tasks,
    profile,
    rules,
    files,
  ] = await Promise.all([
    list("jobs"),
    list("facts"),
    list("applications"),
    list("events"),
    list("resumes"),
    list("tasks"),
    getSetting("profile", defaultProfile),
    getSetting("rules", defaultRules),
    list("files"),
  ]);
  const count = await db()
    .prepare("SELECT COUNT(*) AS n FROM attempts WHERE day=?")
    .bind(nyDay())
    .first<any>();
  return {
    jobs: jobs
      .map((j) => ({
        ...j,
        description: undefined,
        eligibility: evaluate(j as any, rules),
      }))
      .sort((a, b) => b.score - a.score),
    facts,
    applications,
    events: events.sort((a, b) => b.occurred.localeCompare(a.occurred)),
    resumes,
    tasks,
    profile,
    rules,
    files,
    applicationLimits: await getSetting("applicationLimits", []),
    readiness: readiness(profile, rules, facts),
    attemptsToday: count.n,
    sourceReports: await getSetting("sourceReports"),
    seeded: await getSetting("seeded"),
  };
}
export async function GET(req: Request) {
  try {
    await owner(true);
    await init();
    const u = new URL(req.url);
    if (u.searchParams.has("job"))
      return json(await getJob(u.searchParams.get("job")!));
    if (u.searchParams.get("export") === "applications") {
      const s = await snapshot();
      const rows = [
        ["公司", "岗位", "进度", "申请链接", "更新时间", "简历版本"],
        ...s.applications.map((a) => {
          const j = s.jobs.find((j) => j.id === a.job_id);
          return [
            j?.company,
            j?.title,
            a.status,
            j?.url,
            a.updated,
            a.resume_id,
          ];
        }),
      ];
      return new Response(
        "\ufeff" + rows.map((r) => r.map(safeCsv).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="applications.csv"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    return json(await snapshot());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const principal = await owner(true);
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) throw Error("FORBIDDEN");
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw Error("只接受 JSON 请求");
    const raw = await req.text();
    if (raw.length > 4_000_000) throw Error("请求过大，请分批处理");
    const b = JSON.parse(raw);
    const action = z.string().parse(b.action);
    if (
      principal.kind === "worker" &&
      ["profile.save", "fact.save", "facts.curated", "rules.save"].includes(
        action,
      )
    )
      throw Error("本人资料、经历确认和投递规则只能由本人在网站修改");
    await init();
    if (action === "profile.save") {
      const p = z
        .object({
          name: z.string().min(1).max(100),
          email: z.string().email(),
          phone: z.string().min(7).max(50),
          location: z.string().max(150),
          linkedin: z.string().max(300),
          github: z.string().max(300),
          graduation: z.literal("2026-12-31"),
          startDate: z.string().regex(/^2027-\d{2}-\d{2}$/),
          degree: z.string().min(1).max(150),
          school: z.string().min(1).max(150),
          optStatus: z.enum(["planned", "pending", "approved"]),
          currentAuthorization: z.enum(["unknown", "yes", "no"]),
          futureSponsorship: z.enum(["unknown", "yes", "no"]),
          confirmed: z.boolean(),
        })
        .parse(b.profile);
      for (const u of [p.linkedin, p.github])
        if (u && !/^https:\/\//.test(u))
          throw Error("个人链接须以 https:// 开头");
      if (
        p.confirmed &&
        (p.currentAuthorization === "unknown" ||
          p.futureSponsorship === "unknown")
      )
        throw Error("请分别确认当前授权和未来 sponsorship 答案");
      await setSetting("profile", p);
      return json({ ok: true });
    }
    if (action === "rules.save") {
      const patch = z
        .object({
          paused: z.boolean().optional(),
          historyReviewed: z.boolean().optional(),
          minBase: z.number().int().min(90000).max(1000000).optional(),
          maxDaily: z.number().int().min(1).max(1000000).optional(),
          allowUnknownSponsorship: z.boolean().optional(),
        })
        .strict()
        .parse(b.patch);
      const r = await getSetting("rules", defaultRules);
      await patchSetting("rules", patch);
      return json({ ok: true });
    }
    if (action === "application.limit.record") {
      const input = z
        .object({
          company: z.string().min(1).max(160),
          titleKeywords: z.array(z.string().min(2).max(100)).max(12),
          maxAttempts: z.number().int().min(1).max(100),
          windowDays: z.number().int().min(1).max(365),
          evidence: z.string().min(10).max(2000),
          sourceUrl: z.string().url(),
          observedAt: z.string().datetime(),
        })
        .strict()
        .parse(b.limit);
      allowedUrl(input.sourceUrl);
      const limit: ApplicationLimit = {
        ...input,
        companyGroup: companyGroup(input.company),
      };
      const limits: ApplicationLimit[] = await getSetting("applicationLimits", []);
      const key = JSON.stringify([limit.companyGroup, limit.titleKeywords.map((x) => x.toLowerCase()).sort()]);
      await setSetting("applicationLimits", [
        ...limits.filter((item) => JSON.stringify([item.companyGroup, item.titleKeywords.map((x) => x.toLowerCase()).sort()]) !== key),
        limit,
      ]);
      return json({ ok: true, limit });
    }
    if (action === "facts.curated") {
      const markerKey = "manual-resume-review-v1";
      if (await getSetting(markerKey))
        return json({ ok: true, alreadyApplied: true });
      const current = await list("facts");
      const expected = z
        .array(z.object({ id, updated: z.string() }))
        .max(45)
        .parse(b.expected);
      if (
        current.length !== expected.length ||
        current.some(
          (f) =>
            !expected.some((e) => e.id === f.id && e.updated === f.updated),
        )
      )
        throw Error("经历刚刚发生变更，请刷新后再保存");
      const marker = JSON.stringify({
        at: now(),
        token: crypto.randomUUID(),
        source: "Manual visual review of latest FDE resume",
        previousIds: current.map((f) => f.id),
      });
      const guards =
        current
          .map(
            () =>
              "EXISTS(SELECT 1 FROM facts WHERE id=? AND json_extract(data,'$.updated')=?)",
          )
          .join(" AND ") || "1=1";
      const statements = [
        db()
          .prepare(
            "INSERT OR IGNORE INTO settings(id,value) SELECT ?,? WHERE " +
              guards,
          )
          .bind(
            markerKey,
            marker,
            ...current.flatMap((f) => [f.id, f.updated]),
          ),
      ];
      for (const f of reviewedResume as Fact[])
        statements.push(
          db()
            .prepare(
              "INSERT INTO facts(id,data) SELECT ?,? WHERE EXISTS(SELECT 1 FROM settings WHERE id=? AND value=?)",
            )
            .bind(
              f.id,
              JSON.stringify({ ...f, updated: now() }),
              markerKey,
              marker,
            ),
        );
      for (const f of current)
        statements.push(
          db()
            .prepare(
              "UPDATE facts SET data=json_set(data,'$.archived',1,'$.archiveReason','Superseded by manual visual resume review') WHERE id=? AND EXISTS(SELECT 1 FROM settings WHERE id=? AND value=?)",
            )
            .bind(f.id, markerKey, marker),
        );
      await db().batch(statements);
      if (!(await getSetting(markerKey)))
        throw Error("经历发生变更，尚未覆盖，请刷新后重试");
      return json({ ok: true, primary: 10, historical: 6 });
    }
    if (action === "fact.save") {
      const f = z
        .object({
          id: id.optional(),
          category: z.enum([
            "Education",
            "Experience",
            "Projects",
            "Research",
            "Publications",
            "Skills",
          ]),
          label: z.string().min(1).max(160),
          text: z.string().min(1).max(3000),
          source: z.string().min(1).max(1000),
          confirmed: z.boolean(),
          tags: z.array(z.string().max(50)).max(30).default([]),
        })
        .parse(b.fact);
      const previous = f.id
        ? await db()
            .prepare("SELECT data FROM facts WHERE id=?")
            .bind(f.id)
            .first<any>()
        : null;
      if (previous && JSON.parse(previous.data).archived)
        throw Error("此条目已合并，请编辑完整经历");
      const v = {
        ...(previous ? JSON.parse(previous.data) : {}),
        ...f,
        id: f.id || crypto.randomUUID(),
        updated: now(),
      };
      await db()
        .prepare(
          "INSERT INTO facts(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
        )
        .bind(v.id, JSON.stringify(v))
        .run();
      return json(v);
    }
    if (action === "job.detail") return json(await getJob(id.parse(b.id)));
    if (action === "jobs.refresh") {
      const ids = z.array(id).min(1).max(6).parse(b.ids);
      const results = [];
      for (const i of ids) results.push(await refreshJob(await getJob(i)));
      const rules = await getSetting("rules", defaultRules);
      await patchSetting("rules", { lastJobSync: now() });
      return json({ results });
    }
    if (action === "sources.discover") return json(await discover());
    if (action === "job.import") {
      const url = z.string().url().parse(b.url);
      allowedUrl(url);
      const key = canonical(url);
      const old = await db()
        .prepare("SELECT id FROM jobs WHERE canonical=?")
        .bind(key)
        .first<any>();
      if (old) return json({ id: old.id, duplicate: true });
      const j = {
        id: crypto.randomUUID(),
        url,
        company: z.string().min(1).max(150).parse(b.company),
        title: z.string().min(1).max(250).parse(b.title),
        location: "",
        description: "",
        salaryMin: null,
        salaryMax: null,
        salaryText: "",
        lane: "手动添加",
        fitReason: "待研究",
        founderValue: "",
        preparation: "",
        historicalChecked: "",
        historicalGrade: "",
        timing: "待核实",
        visa: "未知",
        active: "unknown",
        checkedAt: null,
        checks: {},
        score: 0,
        hidden: false,
      };
      await saveJob(j);
      return json(j);
    }
    if (action === "job.hide") {
      const j = await getJob(id.parse(b.id));
      j.hidden = z.boolean().parse(b.hidden);
      await saveJob(j);
      return json({ ok: true });
    }
    if (action === "job.verify") {
      const j = await getJob(id.parse(b.id));
      const check = z.object({
        value: z.enum(["pass", "fail", "unknown"]),
        evidence: z.string().min(8).max(3000),
        source: z.string().url(),
      });
      const input = z
        .object({
          checks: z.record(
            z.enum([
              "us",
              "fulltime",
              "timing",
              "base",
              "experience",
              "degree",
              "authorization",
            ]),
            check,
          ),
          salaryMin: z.number().min(0).nullable().optional(),
          salaryMax: z.number().min(0).nullable().optional(),
          salaryText: z.string().max(1000).optional(),
          active: z.enum(["active", "closed"]).optional(),
          activeEvidence: z.string().min(8).max(3000).optional(),
          activeSource: z.string().url().optional(),
          fitReason: z.string().max(2000).optional(),
          founderValue: z.string().max(2000).optional(),
          preparation: z.string().max(2000).optional(),
        })
        .parse(b.verification);
      for (const c of Object.values(input.checks)) allowedUrl(c.source);
      if (input.active) {
        if (!input.activeEvidence || !input.activeSource)
          throw Error("人工核验招聘状态需要官网证据和链接");
        allowedUrl(input.activeSource);
      }
      const previous = structuredClone(j.checks);
      Object.assign(j, input, {
        checkedAt: input.active ? now() : j.checkedAt,
        refreshError: input.active ? "" : j.refreshError,
        checks: {
          ...previous,
          ...Object.fromEntries(
            Object.entries(input.checks).map(([k, c]) => [
              k,
              { ...c, checkedAt: now() },
            ]),
          ),
        },
      });
      if (
        j.checks.base?.value === "pass" &&
        (j.salaryMin == null || !j.salaryText)
      )
        throw Error("确认基本工资需要数值和对应原文");
      await saveJob(j);
      return json(j);
    }
    if (action === "applications.queue") {
      const ids = z.array(id).min(1).max(100).parse(b.ids);
      const tracked = await trackedRequisitions();
      let queued = 0;
      let alreadyTracked = 0;
      for (const i of ids) {
        const j = await getJob(i);
        const key = requisitionKey(j.url);
        if (tracked.has(key)) {
          alreadyTracked++;
          continue;
        }
        const a = crypto.randomUUID();
        const result = await db()
          .prepare(
            "INSERT OR IGNORE INTO applications(id,job_id,company_group,status,updated,data) VALUES(?,?,?,?,?,?)",
          )
          .bind(
            a,
            j.id,
            companyGroup(j.company),
            "queued",
            now(),
            JSON.stringify({
              created: now(),
              notes: "",
              stageAt: "1970-01-01T00:00:00.000Z",
            }),
          )
          .run();
        if (result.meta.changes) {
          queued++;
          tracked.set(key, { id: a, status: "queued", updated: now() });
        } else alreadyTracked++;
      }
      return json({ queued, alreadyTracked });
    }
    if (action === "application.note") {
      const a = await app(id.parse(b.id));
      const data = {
        ...JSON.parse(
          (
            await db()
              .prepare("SELECT data FROM applications WHERE id=?")
              .bind(a.id)
              .first<any>()
          ).data,
        ),
        notes: str.parse(b.notes),
      };
      await db()
        .prepare("UPDATE applications SET data=?,updated=? WHERE id=?")
        .bind(JSON.stringify(data), now(), a.id)
        .run();
      return json({ ok: true });
    }
    if (action === "resume.generate") {
      const j = await getJob(id.parse(b.jobId));
      const profile = await getSetting("profile", defaultProfile);
      const facts = (await list("facts")) as Fact[];
      let selected: Fact[];
      if (b.factIds) {
        const ids = z.array(id).min(1).max(30).parse(b.factIds);
        selected = ids.map((i) => {
          const f = facts.find((f) => f.id === i);
          if (!f?.confirmed) throw Error("选中内容含未确认经历");
          return f;
        });
      } else {
        selected = chooseFacts(facts, j).slice(0, 12);
      }
      const result = await renderResume(profile, selected);
      const rid = crypto.randomUUID();
      const pdfId = rid + "-pdf",
        docxId = rid + "-docx";
      const created = now();
      const entries = [
        {
          id: pdfId,
          name: "Career_Resume.pdf",
          type: "application/pdf",
          bytes: result.pdf,
        },
        {
          id: docxId,
          name: "Career_Resume.docx",
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bytes: result.docx,
        },
      ];
      for (const f of entries) {
        await bucket().put(f.id, f.bytes, {
          httpMetadata: { contentType: f.type },
        });
        await db()
          .prepare(
            "INSERT INTO files(id,name,type,created,data) VALUES(?,?,?,?,?)",
          )
          .bind(
            f.id,
            f.name,
            f.type,
            created,
            JSON.stringify({ resumeId: rid, size: f.bytes.length }),
          )
          .run();
      }
      const data = {
        factIds: selected.map((f) => f.id),
        factSnapshots: selected,
        profileSnapshot: profile,
        pdfId,
        docxId,
        text: result.text,
        changes: "仅选择并重新排列已确认经历；保留原句，未添加新事实。",
        qa: "pending",
      };
      await db()
        .prepare("INSERT INTO resumes(id,job_id,created,data) VALUES(?,?,?,?)")
        .bind(rid, j.id, created, JSON.stringify(data))
        .run();
      await db()
        .prepare(
          "UPDATE applications SET resume_id=? WHERE job_id=? AND status IN ('queued','blocked')",
        )
        .bind(rid, j.id)
        .run();
      return json({ id: rid, ...data });
    }
    if (action === "resume.import") {
      const input = z
        .object({
          jobId: id,
          pdfId: id,
          docxId: id,
          factIds: z.array(id).min(1).max(30),
          text: z.string().min(100).max(20000),
          changes: z.string().min(15).max(2000),
        })
        .parse(b);
      const j = await getJob(input.jobId);
      const profile = await getSetting("profile", defaultProfile);
      if (!profile.confirmed) throw Error("先确认个人资料");
      const facts = (await list("facts")) as Fact[];
      const selected = [...new Set(input.factIds)].map((fid) => {
        const f = facts.find((x) => x.id === fid);
        if (!f?.confirmed) throw Error("选中内容含未确认经历");
        return f;
      });
      const types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      const sourceIds = [input.pdfId, input.docxId];
      const files = [];
      for (let i = 0; i < sourceIds.length; i++) {
        const meta = await db()
          .prepare("SELECT type FROM files WHERE id=?")
          .bind(sourceIds[i])
          .first<any>();
        if (meta?.type !== types[i]) throw Error("需要对应的 PDF 和 DOCX 文件");
        const obj = await bucket().get(sourceIds[i]);
        if (!obj || obj.size > 10 * 1024 * 1024)
          throw Error("文件不存在或过大");
        files.push(new Uint8Array(await obj.arrayBuffer()));
      }
      if ((await PDFDocument.load(files[0])).getPageCount() !== 1)
        throw Error("投递简历须为一页");
      if (files[1][0] !== 80 || files[1][1] !== 75)
        throw Error("DOCX 文件无效");
      const rid = crypto.randomUUID(),
        pdfId = rid + "-pdf",
        docxId = rid + "-docx",
        created = now();
      const data = {
        factIds: selected.map((f) => f.id),
        factSnapshots: selected,
        profileSnapshot: profile,
        pdfId,
        docxId,
        text: input.text,
        changes: input.changes,
        qa: "pending",
        sourceFileIds: sourceIds,
        method: "reviewed-original-layout-import",
      };
      const statements = [];
      for (let i = 0; i < files.length; i++) {
        const fid = i ? docxId : pdfId;
        await bucket().put(fid, files[i], {
          httpMetadata: { contentType: types[i] },
        });
        statements.push(
          db()
            .prepare(
              "INSERT INTO files(id,name,type,created,data) VALUES(?,?,?,?,?)",
            )
            .bind(
              fid,
              "Career_Resume." + (i ? "docx" : "pdf"),
              types[i],
              created,
              JSON.stringify({ resumeId: rid, size: files[i].length }),
            ),
        );
      }
      statements.push(
        db()
          .prepare(
            "INSERT INTO resumes(id,job_id,created,data) VALUES(?,?,?,?)",
          )
          .bind(rid, j.id, created, JSON.stringify(data)),
      );
      statements.push(
        db()
          .prepare(
            "UPDATE applications SET resume_id=? WHERE job_id=? AND status IN ('queued','blocked')",
          )
          .bind(rid, j.id),
      );
      await db().batch(statements);
      return json({ id: rid, ...data });
    }
    if (action === "resume.qa") {
      const rid = id.parse(b.id);
      const r = await db()
        .prepare("SELECT * FROM resumes WHERE id=?")
        .bind(rid)
        .first<any>();
      if (!r) throw Error("简历不存在");
      const evidence = z.string().min(15).max(2000).parse(b.evidence);
      const data = {
        ...JSON.parse(r.data),
        qa: "passed",
        qaEvidence: evidence,
        qaAt: now(),
      };
      await db()
        .prepare("UPDATE resumes SET data=? WHERE id=?")
        .bind(JSON.stringify(data), rid)
        .run();
      return json({ ok: true });
    }
    if (action === "task.request") {
      const kind = z
        .enum([
          "mail_sync",
          "discover",
          "refresh_all",
          "prepare_resumes",
          "verify_jobs",
          "application_help",
        ])
        .parse(b.kind);
      return json({
        id: await task(kind, {
          ids: z.array(id).max(100).optional().parse(b.ids) || [],
          note: z.string().max(1000).optional().parse(b.note) || "",
        }),
      });
    }
    if (action === "task.complete") {
      const tid = id.parse(b.id);
      const status = z.enum(["done", "blocked"]).parse(b.status);
      const r = await db()
        .prepare("SELECT data FROM tasks WHERE id=?")
        .bind(tid)
        .first<any>();
      if (!r) throw Error("任务不存在");
      await db()
        .prepare("UPDATE tasks SET status=?,data=? WHERE id=?")
        .bind(
          status,
          JSON.stringify({
            ...JSON.parse(r.data),
            result: str.parse(b.result),
            finished: now(),
          }),
          tid,
        )
        .run();
      return json({ ok: true });
    }
    if (action === "runner.heartbeat") {
      const input = z
        .object({
          gmailStatus: z
            .enum(["connected", "reauth_required", "error"])
            .optional(),
          mailSynced: z.boolean().optional(),
          mailProcessed: z.number().int().min(0).optional(),
          mailActionable: z.number().int().min(0).optional(),
          mailUnmatched: z.number().int().min(0).optional(),
          mailError: z.string().max(2000).nullable().optional(),
          jobsSynced: z.boolean().optional(),
          note: z.string().max(2000).optional(),
        })
        .parse(b);
      await patchSetting("rules", {
        lastRun: now(),
        ...(input.gmailStatus || input.mailSynced !== undefined
          ? { lastMailAttempt: now() }
          : {}),
        ...(input.gmailStatus ? { gmailStatus: input.gmailStatus } : {}),
        ...(input.mailSynced ? { lastMailSync: now() } : {}),
        ...(input.mailProcessed !== undefined
          ? { lastMailProcessed: input.mailProcessed }
          : {}),
        ...(input.mailActionable !== undefined
          ? { lastMailActionable: input.mailActionable }
          : {}),
        ...(input.mailUnmatched !== undefined
          ? { lastMailUnmatched: input.mailUnmatched }
          : {}),
        ...(input.mailError !== undefined
          ? { lastMailError: input.mailError }
          : {}),
        ...(input.jobsSynced ? { lastDiscoveryCycle: now() } : {}),
        runnerNote: input.note || "",
      });
      return json({ ok: true });
    }
    if (action === "applications.claim") {
      const requestedJobId = id.optional().parse(b.jobId);
      const [applicationRows, facts, profile, rules, applicationLimits, tracked] = await Promise.all([
        db()
          .prepare(
            "SELECT * FROM applications WHERE (status='queued' OR (status='blocked' AND ? IS NOT NULL) OR (status='processing' AND lease_until<?)) AND (? IS NULL OR job_id=?) ORDER BY CASE company_group WHEN 'sierra' THEN 0 WHEN 'pylon' THEN 0 WHEN 'valon' THEN 0 WHEN 'baseten' THEN 0 WHEN 'deepgram' THEN 0 WHEN 'langchain' THEN 0 WHEN 'decagon' THEN 0 WHEN 'tenex' THEN 0 WHEN 'modal' THEN 0 WHEN 'campfire' THEN 0 WHEN 'parafin' THEN 0 WHEN 'tessera' THEN 0 WHEN 'cerebras' THEN 0 WHEN 'etched' THEN 0 WHEN 'cohere' THEN 0 WHEN 'handshake' THEN 0 WHEN 'mercor' THEN 0 ELSE 1 END, updated DESC",
          )
          .bind(requestedJobId || null, now(), requestedJobId || null, requestedJobId || null)
          .all<any>(),
        list("facts") as Promise<Fact[]>,
        getSetting("profile", defaultProfile),
        getSetting("rules", defaultRules),
        getSetting("applicationLimits", []) as Promise<ApplicationLimit[]>,
        trackedRequisitions(),
      ]);
      const applications = applicationRows.results.map((row: any) => ({
        ...row,
        ...JSON.parse(row.data),
      }));
      const blocks = readiness(profile, rules, facts);
      if (blocks.length) return json({ claimed: null, blocks });
      const busy = await db()
        .prepare(
          "SELECT id FROM applications WHERE status='processing' AND lease_until>?",
        )
        .bind(now())
        .first();
      if (busy) return json({ claimed: null, blocks: ["已有申请正在处理"] });
      const fallbackResume = await db()
        .prepare("SELECT id,data FROM resumes ORDER BY created DESC LIMIT 1")
        .first<any>();
      const limitBlocks: string[] = [];
      for (const a of applications.filter((a) =>
        !requestedJobId || a.job_id === requestedJobId,
      )) {
        const j = await getJob(a.job_id);
        const prior = tracked.get(requisitionKey(j.url));
        if (prior && prior.id !== a.id) {
          const reason = `同一招聘编号已有申请记录（${prior.status}），不重复领取或提交。`;
          await db()
            .prepare("UPDATE applications SET status='blocked',updated=?,data=json_patch(data,?) WHERE id=? AND status='queued'")
            .bind(now(), JSON.stringify({ blockReason: reason, notes: reason }), a.id)
            .run();
          continue;
        }
        // The owner prefiltered the candidate library, but an explicitly
        // closed posting must leave the queue before another claim.
        if (j.active === "closed") {
          await db()
            .prepare(
              "UPDATE applications SET status='blocked',updated=?,data=json_patch(data,?) WHERE id=? AND status='queued'",
            )
            .bind(
              now(),
              JSON.stringify({ notes: "官网岗位已关闭，停止领取和投递。" }),
              a.id,
            )
            .run();
          continue;
        }
        const eligibility = evaluate(j, rules);
        if (eligibility.state === "excluded") {
          const reason = `官网硬性条件不符：${eligibility.reasons.join("；")}`;
          await db()
            .prepare("UPDATE applications SET status='blocked',updated=?,data=json_patch(data,?) WHERE id=? AND status='queued'")
            .bind(now(), JSON.stringify({ blockReason: reason, notes: reason }), a.id)
            .run();
          limitBlocks.push(reason);
          continue;
        }
        const missingLanguage = missingSpokenLanguage(j.title, facts);
        if (missingLanguage) {
          const reason = `岗位要求 ${missingLanguage} 语言能力，但已确认经历中没有该能力。`;
          await db()
            .prepare("UPDATE applications SET status='blocked',updated=?,data=json_patch(data,?) WHERE id=? AND status='queued'")
            .bind(now(), JSON.stringify({ blockReason: reason, notes: reason }), a.id)
            .run();
          limitBlocks.push(reason);
          continue;
        }
        const limitBlock = await applicationLimitReached(
          j,
          a.company_group,
          applicationLimits,
        );
        if (limitBlock) {
          await db()
            .prepare("UPDATE applications SET status='blocked',updated=?,data=json_patch(data,?) WHERE id=? AND status='queued'")
            .bind(now(), JSON.stringify({ blockReason: limitBlock, notes: limitBlock }), a.id)
            .run();
          limitBlocks.push(limitBlock);
          continue;
        }
        const resumeId = a.resume_id || fallbackResume?.id;
        const rr = resumeId
          ? await db()
            .prepare("SELECT data FROM resumes WHERE id=?")
            .bind(resumeId)
            .first<any>()
          : null;
        if (!rr) continue;
        if (!a.resume_id) {
          await db()
            .prepare("UPDATE applications SET resume_id=?,updated=? WHERE id=?")
            .bind(resumeId, now(), a.id)
            .run();
          a.resume_id = resumeId;
        }
        const token = crypto.randomUUID();
        const until = new Date(Date.now() + 15 * 60000).toISOString();
        const claimed = await db()
          .prepare(
            "UPDATE applications SET status='processing',lease=?,lease_until=?,updated=? WHERE id=? AND (status IN ('queued','blocked') OR (status='processing' AND lease_until<?)) AND NOT EXISTS(SELECT 1 FROM applications WHERE status='processing' AND lease_until>?) RETURNING id",
          )
          .bind(token, until, now(), a.id, now(), now())
          .first();
        if (claimed)
          return json({
            claimed: {
              ...a,
              lease: token,
              lease_until: until,
              job: j,
              resume: JSON.parse(rr.data),
              profile,
            },
          });
      }
      return json({
        claimed: null,
        blocks: limitBlocks.length
          ? [...new Set(limitBlocks)]
          : ["没有通过所有条件且简历已核验的待投岗位"],
      });
    }
    if (action === "application.begin") {
      const a = await app(id.parse(b.id));
      const token = id.parse(b.lease);
      const s = await snapshot();
      if (readiness(s.profile, s.rules, s.facts).length)
        throw Error("首次设置未完成或投递已暂停");
      if (
        a.lease !== token ||
        a.status !== "processing" ||
        a.lease_until < now()
      )
        throw Error("任务已过期，请重新领取");
      const j = await getJob(a.job_id);
      const prior = (await trackedRequisitions()).get(requisitionKey(j.url));
      if (prior && prior.id !== a.id)
        throw Error(`同一招聘编号已有申请记录（${prior.status}），禁止重复提交`);
      if (!j || j.active !== "active") throw Error("岗位已关闭");
      const eligibility = evaluate(j, s.rules);
      if (eligibility.state === "excluded")
        throw Error(`官网硬性条件不符：${eligibility.reasons.join("；")}`);
      const missingLanguage = missingSpokenLanguage(j.title, s.facts);
      if (missingLanguage)
        throw Error(`岗位要求 ${missingLanguage} 口语，但已确认经历中没有该语言能力`);
      const limitBlock = await applicationLimitReached(
        j,
        a.company_group,
        await getSetting("applicationLimits", []),
      );
      if (limitBlock) throw Error(limitBlock);
      const r = await db()
        .prepare("SELECT data FROM resumes WHERE id=?")
        .bind(a.resume_id)
        .first<any>();
      if (!r) throw Error("申请简历不存在");
      const attempt = crypto.randomUUID();
      const cap = a.company_group === "bytedance" ? 2 : 1000000;
      const inserted = await db()
        .prepare(
          "INSERT INTO attempts(id,application_id,day,company_group,created) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM attempts WHERE day=?)<? AND (SELECT COUNT(*) FROM attempts WHERE company_group=?)<? ON CONFLICT(application_id) DO NOTHING RETURNING id",
        )
        .bind(
          attempt,
          a.id,
          nyDay(),
          a.company_group,
          now(),
          nyDay(),
          s.rules.maxDaily,
          a.company_group,
          cap,
        )
        .first();
      if (!inserted)
        throw Error(
          "已存在提交尝试，或已达到每日 / 公司申请上限；禁止再次点击提交",
        );
      await db()
        .prepare(
          "UPDATE applications SET status='submitting',updated=? WHERE id=? AND lease=?",
        )
        .bind(now(), a.id, token)
        .run();
      return json({ attemptId: attempt, allowedToClickSubmit: true });
    }
    if (action === "application.block") {
      const a = await app(id.parse(b.id));
      if (a.lease !== id.parse(b.lease)) throw Error("任务凭证不匹配");
      if (
        [
          "submitted",
          "assessment",
          "interview",
          "offer",
          "rejected",
          "withdrawn",
        ].includes(a.status)
      )
        throw Error("已记录进度不能改为待处理");
      const status = ["submitting", "uncertain"].includes(a.status)
        ? "uncertain"
        : "blocked";
      const data = {
        ...JSON.parse(
          (
            await db()
              .prepare("SELECT data FROM applications WHERE id=?")
              .bind(a.id)
              .first<any>()
          ).data,
        ),
        blockReason: str.parse(b.reason),
      };
      await db()
        .prepare(
          "UPDATE applications SET status=?,lease_until=NULL,updated=?,data=? WHERE id=?",
        )
        .bind(status, now(), JSON.stringify(data), a.id)
        .run();
      return json({ ok: true });
    }
    if (action === "event.record") {
      const input = z
        .object({
          applicationId: id.optional(),
          jobId: id.optional(),
          stage: z.enum([
            "submitted",
            "assessment",
            "interview",
            "offer",
            "rejected",
            "withdrawn",
          ]),
          source: z.enum(["gmail", "portal", "manual"]),
          sourceKey: z.string().min(5).max(400),
          sourceUrl: z.string().url(),
          evidence: z.string().min(12).max(8000),
          occurred: z.string().datetime(),
          deadline: z.string().datetime().optional(),
          reference: z.string().max(200).optional(),
          company: z.string().max(200).optional(),
          title: z.string().max(300).optional(),
          subject: z.string().max(500).optional(),
          sender: z.string().max(500).optional(),
          threadId: z.string().max(300).optional(),
          classification: z
            .enum(["action_required", "status_update", "receipt"])
            .optional(),
          confidence: z.number().min(0).max(1).optional(),
          deadlineText: z.string().max(500).optional(),
          details: z
            .object({
              platform: z.string().min(1).max(120),
              actionUrl: z.string().url().optional(),
              actionLabel: z.string().min(1).max(120).optional(),
              emailExcerpt: z.string().min(1).max(4000),
              requirements: z.array(z.string().min(1).max(1000)).max(12),
              recommendations: z.array(z.string().min(1).max(1000)).max(12),
              limitations: z.array(z.string().min(1).max(1000)).max(12),
              unknowns: z.array(z.string().min(1).max(1000)).max(12),
            })
            .optional(),
        })
        .parse(b.event);
      if (Date.parse(input.occurred) > Date.now() + 300000)
        throw Error("事件时间不能在未来");
      if (!/^https:/.test(input.sourceUrl)) throw Error("证据须为 HTTPS 来源");
      const prev = await db()
        .prepare("SELECT id,data FROM events WHERE source_key=?")
        .bind(input.source + ":" + input.sourceKey)
        .first<any>();
      if (prev) {
        if (input.details) {
          const previous = JSON.parse(prev.data);
          await db()
            .prepare("UPDATE events SET data=? WHERE id=?")
            .bind(JSON.stringify({ ...previous, details: input.details }), prev.id)
            .run();
        }
        return json({ duplicate: true, enriched: !!input.details });
      }
      let a: any = null;
      if (input.applicationId) a = await app(input.applicationId);
      else if (input.jobId) {
        const r = await db()
          .prepare("SELECT id FROM applications WHERE job_id=?")
          .bind(input.jobId)
          .first<any>();
        if (r) a = await app(r.id);
      }
      const eid = crypto.randomUUID();
      let review = "尚未匹配到具体申请";
      let accepted = false;
      if (a) {
        const result = reconcile(
          a.status,
          input.stage,
          input.occurred,
          a.stageAt || "1970-01-01T00:00:00.000Z",
        );
        accepted = result.accept;
        review = result.reason;
      }
      const eventData = { ...input, accepted, review };
      const insertEvent = db()
        .prepare(
          "INSERT INTO events(id,application_id,source_key,occurred,data) VALUES(?,?,?,?,?)",
        )
        .bind(
          eid,
          a?.id || null,
          input.source + ":" + input.sourceKey,
          input.occurred,
          JSON.stringify(eventData),
        );
      if (a && accepted) {
        const patch = {
          blockReason: null,
          stageAt:
            Date.parse(input.occurred) >= Date.parse(a.stageAt || "1970-01-01")
              ? input.occurred
              : a.stageAt,
          ...(input.deadline ? { deadline: input.deadline } : {}),
          lastEvidence: input.evidence,
          lastSource: input.sourceUrl,
          ...(input.reference ? { reference: input.reference } : {}),
        };
        const statements = [
          insertEvent,
          db()
            .prepare(
              "UPDATE applications SET status=?,updated=?,data=json_patch(data,?) WHERE id=? AND status=? AND COALESCE(json_extract(data,'$.stageAt'),'1970-01-01T00:00:00.000Z')=?",
            )
            .bind(
              input.stage,
              now(),
              JSON.stringify(patch),
              a.id,
              a.status,
              a.stageAt || "1970-01-01T00:00:00.000Z",
            ),
        ];
        if (input.stage === "submitted")
          statements.push(
            db()
              .prepare(
                "INSERT OR IGNORE INTO attempts(id,application_id,day,company_group,created) VALUES(?,?,?,?,?)",
              )
              .bind(
                "historical-" + a.id,
                a.id,
                nyDay(new Date(input.occurred)),
                a.company_group,
                input.occurred,
              ),
          );
        const result = await db().batch(statements);
        if (!result[1].meta.changes) {
          accepted = false;
          review = "进度已在其他操作中更新，需要重新核对";
          await db()
            .prepare("UPDATE events SET data=? WHERE id=?")
            .bind(JSON.stringify({ ...eventData, accepted, review }), eid)
            .run();
        }
      } else await insertEvent.run();
      return json({ id: eid, accepted, review });
    }

    if (action === "event.match") {
      const eid = id.parse(b.id),
        aid = id.parse(b.applicationId);
      const er = await db()
        .prepare("SELECT * FROM events WHERE id=?")
        .bind(eid)
        .first<any>();
      if (!er) throw Error("事件不存在");
      const e = JSON.parse(er.data);
      const a = await app(aid);
      if (er.application_id && er.application_id !== aid && e.accepted)
        throw Error("已接受的事件不能改绑到另一份申请");
      const decision = reconcile(
        a.status,
        e.stage,
        e.occurred,
        a.stageAt || "1970-01-01T00:00:00.000Z",
      );
      if (!decision.accept) throw Error(decision.reason);
      const result = await db().batch([
        db()
          .prepare(
            "UPDATE applications SET status=?,updated=?,data=json_patch(data,?) WHERE id=? AND status=? AND COALESCE(json_extract(data,'$.stageAt'),'1970-01-01T00:00:00.000Z')=?",
          )
          .bind(
            e.stage,
            now(),
            JSON.stringify({
              blockReason: null,
              stageAt: e.occurred,
              lastEvidence: e.evidence,
              lastSource: e.sourceUrl,
              ...(e.deadline ? { deadline: e.deadline } : {}),
            }),
            aid,
            a.status,
            a.stageAt || "1970-01-01T00:00:00.000Z",
          ),
        db()
          .prepare("UPDATE events SET application_id=?,data=? WHERE id=?")
          .bind(
            aid,
            JSON.stringify({
              ...e,
              accepted: false,
              review: "匹配结果核对中",
              applicationId: aid,
            }),
            eid,
          ),
      ]);
      if (!result[0].meta.changes) throw Error("申请同时被更新，请重新核对");
      await db()
        .prepare("UPDATE events SET data=? WHERE id=?")
        .bind(
          JSON.stringify({
            ...e,
            accepted: true,
            review: "已匹配",
            applicationId: aid,
          }),
          eid,
        )
        .run();
      if (e.stage === "submitted")
        await db()
          .prepare(
            "INSERT OR IGNORE INTO attempts(id,application_id,day,company_group,created) VALUES(?,?,?,?,?)",
          )
          .bind(
            "historical-" + aid,
            aid,
            nyDay(new Date(e.occurred)),
            a.company_group,
            e.occurred,
          )
          .run();
      return json({ ok: true });
    }

    throw Error("不支持的操作");
  } catch (e) {
    return failure(e);
  }
}
