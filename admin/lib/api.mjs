/**
 * NOVA TV 管理后台 · REST 路由
 * 写操作统一要求 Authorization: Bearer <token>；所有写操作落盘并记审计。
 */
import { probeMany, scoreOf, gradeOf } from "./probe.mjs";
import { runHarvest, DEFAULT_SEEDS, DEFAULT_EXCLUDE, keyOf, brandOf, applyExclude } from "./harvest.mjs";

const MAX_BODY = 2 * 1024 * 1024;

function json(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

export function createApi(ctx) {
  const { store, token } = ctx;

  const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

  function isLoopback(req) {
    const ip = String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
    return LOOPBACK.has(ip) || ip === "::ffff:127.0.0.1" || ip === "127.0.0.1";
  }

  function authed(req) {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return false;
    if (header.slice(7).trim() !== token) return false;
    // 默认只允许本机写入；显式开 --allow-remote-write 才放开
    if (!ctx.allowRemoteWrite && !isLoopback(req)) return false;
    return true;
  }

  function audit(req, path, note) {
    store.appendJsonl("audit.jsonl", {
      ts: Date.now(),
      method: req.method,
      path,
      note: note || "",
      ip: req.socket?.remoteAddress || ""
    });
  }

  function persist(note) {
    const snap = ctx.nova.snapshot();
    store.writeJson("sources.json", { rev: (ctx.state.rev || 1) + 1, items: snap.sources });
    store.writeJson("sites.json", { rev: (ctx.state.rev || 1) + 1, items: snap.overrides });
    store.writeJson("settings.json", snap.settings || {});
    store.writeJson("parses.json", snap.parses || []);
    if (note) ctx.state.lastWrite = { at: Date.now(), note };
  }
  // 巡检等模块也会用到落盘
  ctx.persist = persist;

  function siteRows() {
    const S = ctx.nova.NovaSources;
    const sites = S.listSites();
    return sites.map((s) => {
      const st = ctx.inspector ? ctx.inspector.statusOf(s.key) : null;
      return {
        key: s.key,
        name: s.name,
        type: s.type,
        api: s.api,
        sourceName: s.sourceName || "",
        enabled: s.enabled !== false,
        order: s.order,
        health: typeof s.health === "number" ? s.health : null,
        healthText: s.health === -1 ? "失败" : typeof s.health === "number" && s.health > 0 ? `${s.health}ms` : "未测",
        unsupported: s.unsupported || "",
        runtimeKind: s.runtimeKind || "",
        overridden: Boolean(s.overridden),
        lastChecked: s.lastChecked || 0,
        testStatus: st?.status || "",
        failStreak: st?.failStreak || 0,
        lastInspectAt: st?.lastChecked || 0,
        inspectMessage: st?.message || "",
        classes: Array.isArray(s.classes) ? s.classes.length : 0
      };
    });
  }

  function candidateList(query) {
    const pool = ctx.state.candidates;
    let items = Object.values(pool.items || {});
    const grade = query.get("grade") || "";
    const q = (query.get("q") || "").toLowerCase();
    const promoted = query.get("promoted");
    if (grade) items = items.filter((c) => (c.grade || "?") === grade);
    if (promoted === "0") items = items.filter((c) => !c.promotedSourceId);
    if (promoted === "1") items = items.filter((c) => c.promotedSourceId);
    if (q) items = items.filter((c) => `${c.api} ${c.brand} ${c.host}`.toLowerCase().includes(q));
    items.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.probe?.ms || 9e9) - (b.probe?.ms || 9e9));
    const page = Math.max(1, Number(query.get("page")) || 1);
    const size = Math.min(200, Math.max(10, Number(query.get("size")) || 50));
    const total = items.length;
    const slice = items.slice((page - 1) * size, page * size);
    const counts = { A: 0, B: 0, C: 0, D: 0, "?": 0, total: 0, promoted: 0 };
    Object.values(pool.items || {}).forEach((c) => {
      counts.total += 1;
      const g = c.grade || "?";
      counts[g] = (counts[g] || 0) + 1;
      if (c.promotedSourceId) counts.promoted += 1;
    });
    return { items: slice, total, page, size, counts };
  }

  function reportMarkdown() {
    const items = Object.values(ctx.state.candidates.items || {})
      .filter((c) => c.grade === "A" || c.grade === "B")
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    const lines = ["# NOVA TV 候选源报告", "", `生成时间：${new Date().toISOString()}`, "", "| 评级 | 品牌 | 接口 | 延迟 | 播放率 | 条数 | 分类 | 来源数 |", "|---|---|---|---|---|---|---|---|"];
    items.forEach((c) => {
      lines.push(`| ${c.grade} | ${c.brand} | \`${c.api}\` | ${c.probe?.ms ?? "-"} ms | ${c.probe?.playRate ?? "-"} | ${c.probe?.total ?? "-"} | ${c.probe?.categories ?? "-"} | ${c.sources?.length ?? 1} |`);
    });
    lines.push("", `合计 ${items.length} 个 A/B 级候选。`);
    return lines.join("\n");
  }

  async function handle(req, res, url) {
    const path = url.pathname;
    const query = url.searchParams;
    const method = req.method || "GET";

    // ---------- 只读 ----------
    if (method === "GET" && path === "/api/health") {
      return json(res, 200, {
        ok: true,
        version: ctx.version,
        uptimeSec: Math.round(process.uptime()),
        dataDir: store.dir,
        sources: ctx.nova.NovaSources.list().length,
        sites: ctx.nova.NovaSources.listSites().length,
        candidates: Object.keys(ctx.state.candidates.items || {}).length,
        lastWrite: ctx.state.lastWrite || null,
        jobs: ctx.jobs.summary()
      });
    }

    if (method === "GET" && path === "/api/bootstrap") {
      return json(res, 200, {
        sources: ctx.nova.NovaSources.list(),
        sites: siteRows(),
        parses: ctx.nova.NovaSources.listParses(),
        settings: ctx.nova.NovaSettings.get(),
        presets: ctx.nova.NovaPresets.list(),
        stats: ctx.nova.NovaSources.aggregate().stats,
        seeds: ctx.state.seeds,
        candidates: Object.values(ctx.state.candidates.items || {}).length,
        publish: ctx.state.publish
      });
    }

    if (method === "GET" && path === "/api/sites") {
      let rows = siteRows();
      const q = (query.get("q") || "").toLowerCase();
      const enabled = query.get("enabled");
      const onlyBroken = query.get("broken") === "1";
      if (q) rows = rows.filter((r) => `${r.name} ${r.api} ${r.key}`.toLowerCase().includes(q));
      if (enabled === "1") rows = rows.filter((r) => r.enabled);
      if (enabled === "0") rows = rows.filter((r) => !r.enabled);
      if (onlyBroken) rows = rows.filter((r) => r.health === -1);
      const page = Math.max(1, Number(query.get("page")) || 1);
      const size = Math.min(200, Math.max(10, Number(query.get("size")) || 50));
      return json(res, 200, { items: rows.slice((page - 1) * size, page * size), total: rows.length, page, size });
    }

    if (method === "GET" && path.startsWith("/api/sites/") && path.endsWith("/history")) {
      const key = decodeURIComponent(path.slice("/api/sites/".length, -"/history".length));
      const rows = store.readJsonl("probe-history.jsonl", 4000).filter((r) => r.key === key);
      return json(res, 200, { key, items: rows.slice(-60) });
    }

    if (method === "GET" && path === "/api/candidates") {
      return json(res, 200, candidateList(query));
    }

    if (method === "GET" && path === "/api/harvest/seeds") {
      return json(res, 200, { items: ctx.state.seeds });
    }

    if (method === "GET" && path === "/api/harvest/runs") {
      return json(res, 200, { items: store.readJsonl("harvest-runs.jsonl", 30) });
    }

    if (method === "GET" && path === "/api/harvest/runs/current") {
      return json(res, 200, ctx.jobs.current("harvest") || { running: false });
    }

    if (method === "GET" && path === "/api/audit") {
      return json(res, 200, { items: store.readJsonl("audit.jsonl", Number(query.get("limit")) || 100) });
    }

    if (method === "GET" && path === "/api/jobs/current") {
      const name = query.get("name") || "probe";
      return json(res, 200, ctx.jobs.current(name) || { running: false, name });
    }

    if (method === "GET" && path === "/api/inspect/status") {
      return json(res, 200, {
        running: ctx.inspector ? ctx.inspector.isRunning() : false,
        intervalHours: ctx.inspector ? ctx.inspector.intervalHours() : 0,
        summary: ctx.inspector ? ctx.inspector.summarize() : {},
        lastRuns: ctx.inspector ? ctx.inspector.lastRuns(10) : []
      });
    }

    if (method === "GET" && path === "/api/profiles") {
      const file = store.readJson("profiles.json", { items: {} });
      return json(res, 200, { items: file.items || {} });
    }

    if (method === "GET" && path === "/api/backup") {
      return json(res, 200, {
        format: "nova-admin-backup/1",
        generatedAt: new Date().toISOString(),
        sources: ctx.nova.NovaSources.list(),
        overrides: ctx.nova.NovaSiteOverrides.snapshot ? ctx.nova.NovaSiteOverrides.snapshot() : ctx.nova.readKey("overrides"),
        settings: ctx.nova.NovaSettings.get(),
        parses: ctx.nova.NovaSources.listParses(),
        candidates: ctx.state.candidates,
        seeds: ctx.state.seeds,
        siteStatus: store.readJson("site-status.json", { items: {} }).items,
        profiles: store.readJson("profiles.json", { items: {} }).items,
        publish: ctx.state.publish ? { token: ctx.state.publish.token, version: ctx.state.publish.version, publishedAt: ctx.state.publish.publishedAt } : null
      });
    }

    if (method === "GET" && path === "/api/metrics") {
      const m = ctx.metrics || { total: 0, byStatus: {}, latency: [] };
      const latency = (m.latency || []).slice(-500).sort((a, b) => a - b);
      const p95 = latency.length ? latency[Math.floor(latency.length * 0.95)] : 0;
      const avg = latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : 0;
      return json(res, 200, {
        uptimeSec: Math.round(process.uptime()),
        requests: { total: m.total || 0, byStatus: m.byStatus || {} },
        latencyMs: { avg, p95, samples: latency.length },
        proxy: ctx.proxyStats ? ctx.proxyStats() : null,
        jobs: ctx.jobs.summary(),
        inspect: ctx.inspector ? ctx.inspector.summarize() : null,
        candidates: Object.keys(ctx.state.candidates.items || {}).length,
        sites: ctx.nova.NovaSources.listSites().length,
        sources: ctx.nova.NovaSources.list().length
      });
    }

    if (method === "GET" && path === "/api/config") {
      return json(res, 200, ctx.nova.NovaSources.exportConfig());
    }

    if (method === "GET" && path === "/api/report") {
      const format = query.get("format") || "json";
      if (format === "md") {
        const md = reportMarkdown();
        res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
        return res.end(md);
      }
      if (format === "csv") {
        const items = Object.values(ctx.state.candidates.items || {});
        const header = "grade,brand,api,ms,playRate,total,categories,sources,score\n";
        const body = items
          .map((c) => [c.grade, c.brand, c.api, c.probe?.ms ?? "", c.probe?.playRate ?? "", c.probe?.total ?? "", c.probe?.categories ?? "", (c.sources || []).length, c.score ?? ""].join(","))
          .join("\n");
        res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8" });
        return res.end(header + body);
      }
      return json(res, 200, { items: Object.values(ctx.state.candidates.items || {}) });
    }

    if (method === "GET" && path.startsWith("/config/") && path.endsWith(".json")) {
      const name = path.slice("/config/".length, -".json".length);
      const pub = ctx.state.publish;
      if (!pub || pub.token !== name) return json(res, 404, { error: "订阅不存在" });
      const etag = `"${pub.version}"`;
      const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag" };
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, { ETag: etag, ...cors });
        return res.end();
      }
      return json(res, 200, pub.config, { ETag: etag, ...cors });
    }

    // ---------- 写操作需要 token ----------
    if (method !== "GET" && !authed(req)) {
      return json(res, 401, { error: "缺少或错误的 token", hint: "Authorization: Bearer <data/nova/token.txt>" });
    }

    if (method === "POST" && path === "/api/sources") {
      const body = await readBody(req);
      const S = ctx.nova.NovaSources;
      let source;
      try {
        if (body.url) source = await S.addRemote(body.url, { name: body.name });
        else if (typeof body.json === "string") source = S.importJson(body.json, { name: body.name, kind: "paste" });
        else if (body.config) source = S.importJson(JSON.stringify(body.config), { name: body.name, kind: "paste" });
        else return json(res, 400, { error: "需要 url 或 json/config" });
      } catch (error) {
        return json(res, 409, { error: error.message });
      }
      persist("add-source");
      audit(req, path, `add ${source.id}`);
      return json(res, 200, { source, sites: siteRows().length });
    }

    if (method === "POST" && path.match(/^\/api\/sources\/[^/]+\/sync$/)) {
      const id = decodeURIComponent(path.split("/")[3]);
      try {
        const source = await ctx.nova.NovaSources.syncSource(id);
        persist("sync-source");
        audit(req, path, `sync ${id}`);
        return json(res, 200, { source });
      } catch (error) {
        return json(res, 409, { error: error.message });
      }
    }

    if (method === "POST" && path.startsWith("/api/sources/preset/")) {
      const presetId = decodeURIComponent(path.split("/")[4]);
      try {
        const source = ctx.nova.NovaSources.addPreset(presetId);
        persist("add-preset");
        audit(req, path, `preset ${presetId}`);
        return json(res, 200, { source });
      } catch (error) {
        return json(res, 409, { error: error.message });
      }
    }

    if (method === "PATCH" && path.startsWith("/api/sources/")) {
      const id = decodeURIComponent(path.split("/")[3]);
      const body = await readBody(req);
      const S = ctx.nova.NovaSources;
      if (typeof body.enabled === "boolean") S.toggleSource(id, body.enabled);
      if (body.name) S.renameSource?.(id, body.name);
      persist("patch-source");
      audit(req, path, JSON.stringify(body).slice(0, 120));
      return json(res, 200, { source: S.get(id) });
    }

    if (method === "DELETE" && path.startsWith("/api/sources/")) {
      const id = decodeURIComponent(path.split("/")[3]);
      ctx.nova.NovaSources.removeSource(id);
      persist("delete-source");
      audit(req, path, `remove ${id}`);
      return json(res, 200, { ok: true, sites: siteRows().length });
    }

    if (method === "PATCH" && path.startsWith("/api/sites/")) {
      const key = decodeURIComponent(path.split("/")[3]);
      const body = await readBody(req);
      const S = ctx.nova.NovaSources;
      const overrideApi = ctx.nova.NovaSiteOverrides;
      if (typeof body.enabled === "boolean") S.setSiteEnabled(key, body.enabled);
      if (body.order !== undefined || body.name || body.timeout || body.header) {
        const patch = {};
        if (body.order !== undefined) patch.order = Number(body.order);
        if (body.name) patch.name = String(body.name);
        if (body.timeout !== undefined) patch.timeout = Number(body.timeout);
        if (body.header && typeof body.header === "object") patch.header = body.header;
        overrideApi.patch(key, patch);
        S.touchSites?.();
      }
      persist("patch-site");
      audit(req, path, JSON.stringify(body).slice(0, 120));
      return json(res, 200, { site: siteRows().find((s) => s.key === key) || null });
    }

    if (method === "POST" && path === "/api/sites/test") {
      const body = await readBody(req);
      const keys = Array.isArray(body.keys) ? body.keys.slice(0, 40) : [];
      const S = ctx.nova.NovaSources;
      const results = [];
      for (const key of keys) {
        const site = S.listSites().find((s) => s.key === key);
        if (!site) {
          results.push({ key, ok: false, message: "站点不存在" });
          continue;
        }
        const record = await S.testSite(key);
        store.appendJsonl("probe-history.jsonl", { ts: Date.now(), key, ok: Boolean(record?.ok), ms: record?.ms ?? -1, message: record?.message || "" });
        results.push({ key, name: site.name, ...record });
      }
      persist("test-sites");
      audit(req, path, `${keys.length} sites`);
      return json(res, 200, { results });
    }

    if (method === "POST" && path === "/api/sites/bulk") {
      const body = await readBody(req);
      const keys = Array.isArray(body.keys) ? body.keys : [];
      const S = ctx.nova.NovaSources;
      if (body.action === "enable") keys.forEach((k) => S.setSiteEnabled(k, true));
      else if (body.action === "disable") keys.forEach((k) => S.setSiteEnabled(k, false));
      else if (body.action === "reset") S.resetSiteOverrides();
      else if (body.action === "move") {
        keys.forEach((k) => S.moveSite(k, body.dir === "down" ? "down" : "up"));
      } else return json(res, 400, { error: "未知 action" });
      persist("bulk-" + body.action);
      audit(req, path, `${body.action} ${keys.length}`);
      return json(res, 200, { ok: true, sites: siteRows().length });
    }

    if (method === "POST" && path === "/api/parses") {
      const body = await readBody(req);
      try {
        const parse = ctx.nova.NovaSources.addParse({ name: body.name, url: body.url, type: body.type });
        persist("add-parse");
        audit(req, path, body.url || "");
        return json(res, 200, { parse });
      } catch (error) {
        return json(res, 409, { error: error.message });
      }
    }

    if (method === "DELETE" && path.startsWith("/api/parses/")) {
      const id = decodeURIComponent(path.split("/")[3]);
      const ok = ctx.nova.NovaSources.removeParse(id);
      persist("remove-parse");
      audit(req, path, id);
      return json(res, 200, { ok });
    }

    if (method === "POST" && path === "/api/publish") {
      const config = ctx.nova.NovaSources.exportConfig();
      const prev = ctx.state.publish;
      const version = String((Number(prev?.versionNum) || 0) + 1);
      const token = prev?.token || ("pub_" + Math.random().toString(36).slice(2, 12));
      const payload = {
        token,
        version,
        versionNum: Number(version),
        publishedAt: Date.now(),
        sites: config.sites?.length || 0,
        lives: config.lives?.length || 0,
        config
      };
      ctx.state.publish = payload;
      store.writeJson("publish.json", payload);
      store.writeJson(`publish-snapshot-${version}.json`, config);
      audit(req, path, `publish v${version}`);
      return json(res, 200, { token, version, url: `${ctx.baseUrl}/config/${token}.json`, sites: payload.sites });
    }

    if (method === "POST" && path === "/api/harvest/seeds") {
      const body = await readBody(req);
      const seeds = ctx.state.seeds;
      if (body.remove) {
        ctx.state.seeds = seeds.filter((s) => s.id !== body.remove);
      } else if (body.id) {
        const existing = seeds.find((s) => s.id === body.id);
        if (existing) Object.assign(existing, body);
        else seeds.push({ id: body.id, name: body.name || body.id, kind: body.kind || "url", url: body.url, enabled: body.enabled !== false });
      } else {
        seeds.push({
          id: "seed_" + Math.random().toString(36).slice(2, 8),
          name: body.name || "自定义种子",
          kind: body.kind || "url",
          url: body.url,
          enabled: true
        });
      }
      store.writeJson("harvest-seeds.json", { items: ctx.state.seeds });
      audit(req, path, JSON.stringify(body).slice(0, 100));
      return json(res, 200, { items: ctx.state.seeds });
    }

    if (method === "POST" && path === "/api/harvest/run") {
      if (ctx.jobs.isRunning("harvest")) return json(res, 409, { error: "正在收集中" });
      ctx.jobs.start("harvest", async (api) => {
        const { pool, report } = await runHarvest(
          { seeds: ctx.state.seeds, candidates: ctx.state.candidates, excludeRules: ctx.state.excludeRules },
          { onProgress: (p) => api.progress(p) }
        );
        ctx.state.candidates = pool;
        store.writeJson("candidates.json", pool);
        store.writeJson("harvest-seeds.json", { items: ctx.state.seeds });
        store.appendJsonl("harvest-runs.jsonl", report);
        return { added: report.added, updated: report.updated, found: report.found, errors: report.errors.length, durationMs: report.durationMs };
      });
      audit(req, path, "harvest");
      return json(res, 202, { ok: true, job: "harvest" });
    }

    if (method === "POST" && path === "/api/candidates/probe") {
      const body = await readBody(req);
      if (ctx.jobs.isRunning("probe")) return json(res, 409, { error: "正在探测中，稍后再试" });
      const pool = ctx.state.candidates;
      let targets = [];
      if (Array.isArray(body.keys) && body.keys.length) {
        targets = body.keys.map((k) => pool.items[k]).filter(Boolean);
      } else if (body.scope === "all") {
        targets = Object.values(pool.items).slice(0, 200);
      } else {
        const ttl = Number(body.ttlHours ?? 24) * 3600 * 1000;
        const now = Date.now();
        targets = Object.values(pool.items)
          .filter((c) => !c.excluded && (!c.probe || now - (c.probe.checkedAt || 0) > ttl))
          .slice(0, 200);
      }
      if (!targets.length) return json(res, 200, { results: [], note: "没有需要探测的候选" });

      const rounds = Math.max(1, Math.min(5, Number(body.rounds) || 3));
      const rules = [...DEFAULT_EXCLUDE, ...(ctx.state.excludeRules || [])];
      ctx.jobs.start("probe", async (api) => {
        const results = await probeMany(targets.map((t) => t.api), {
          concurrency: 4,
          intervalMs: 250,
          rounds,
          onProgress: (p) => api.progress({ done: p.done, total: p.total, current: p.current })
        });
        const byApi = new Map(results.map((r) => [r.api, r]));
        let updated = 0;
        for (const t of targets) {
          const metrics = byApi.get(t.api.replace(/\?.*$/, "").replace(/\/+$/, ""));
          if (!metrics) continue;
          t.probe = metrics;
          t.score = metrics.score;
          t.grade = metrics.grade;
          t.excluded = applyExclude(t.api, rules);
          if (t.excluded) t.grade = "D";
          updated += 1;
          store.appendJsonl("probe-history.jsonl", {
            ts: Date.now(),
            key: t.key,
            ok: metrics.ok,
            ms: metrics.ms ?? -1,
            playRate: metrics.playRate,
            items: metrics.items,
            grade: t.grade,
            origin: "candidate"
          });
        }
        pool.rev = (pool.rev || 1) + 1;
        store.writeJson("candidates.json", pool);
        return { probed: updated, rounds };
      });
      audit(req, path, `async probe ${targets.length}`);
      return json(res, 202, { ok: true, job: "probe", queued: targets.length, rounds });
    }

    if (method === "POST" && path === "/api/candidates/promote") {
      const body = await readBody(req);
      const pool = ctx.state.candidates;
      const picks = (body.keys || []).map((k) => pool.items[k]).filter((c) => c && c.grade !== "D");
      if (!picks.length) return json(res, 400, { error: "没有可入池的候选（D 级不能入池）" });
      // 按品牌归并：同品牌只保留一个主源，其余标备用
      const byBrand = new Map();
      picks.forEach((c) => {
        const arr = byBrand.get(c.brand) || [];
        arr.push(c);
        byBrand.set(c.brand, arr);
      });
      const sites = [];
      for (const [brand, arr] of byBrand) {
        arr.sort((a, b) => (b.score || 0) - (a.score || 0));
        arr.forEach((c, index) => {
          sites.push({
            key: keyOf(c.api),
            name: index === 0 ? brand : `${brand}·备用`,
            type: 3,
            api: c.api,
            searchable: 1,
            quickSearch: 1,
            ext: ""
          });
        });
      }
      const config = {
        format: "tvbox-desktop/1",
        name: body.name || `收集池入池 ${new Date().toISOString().slice(0, 10)}`,
        notice: "由 NOVA TV 管理后台的收集器入池；探测指标可在后台查看。",
        sites,
        lives: [],
        parses: [],
        flags: ["nova", "harvest"]
      };
      let source;
      try {
        source = ctx.nova.NovaSources.importJson(JSON.stringify(config), { name: config.name, kind: "paste" });
      } catch (error) {
        return json(res, 409, { error: error.message });
      }
      picks.forEach((c) => {
        c.promotedSourceId = source.id;
        c.promotedKey = keyOf(c.api);
      });
      pool.rev = (pool.rev || 1) + 1;
      store.writeJson("candidates.json", pool);
      persist("promote");
      audit(req, path, `${picks.length} → ${source.id}`);
      return json(res, 200, { source, sites: sites.length, brands: byBrand.size });
    }

    if (method === "POST" && path === "/api/candidates/exclude") {
      const body = await readBody(req);
      const pool = ctx.state.candidates;
      const keys = body.keys || [];
      const reason = String(body.reason || "手动排除");
      keys.forEach((k) => {
        const c = pool.items[k];
        if (c) {
          c.excluded = reason;
          c.grade = "D";
        }
      });
      pool.rev = (pool.rev || 1) + 1;
      store.writeJson("candidates.json", pool);
      audit(req, path, `${keys.length} excluded`);
      return json(res, 200, { ok: true, excluded: keys.length });
    }

    if (method === "POST" && path === "/api/inspect/run") {
      if (!ctx.inspector) return json(res, 503, { error: "巡检未启用" });
      if (ctx.inspector.isRunning()) return json(res, 409, { error: "巡检进行中" });
      const body = await readBody(req);
      const summary = await ctx.inspector.runOnce({ keys: body.keys, limit: body.limit });
      audit(req, path, `inspect ${summary.checked} sites`);
      return json(res, 200, summary);
    }

    if (method === "POST" && path === "/api/sites/profile") {
      const body = await readBody(req);
      const keys = Array.isArray(body.keys) ? body.keys.slice(0, 20) : [];
      const all = ctx.nova.NovaSources.listSites();
      const file = store.readJson("profiles.json", { items: {} });
      const items = file.items || {};
      const results = [];
      for (const key of keys) {
        const site = all.find((s) => s.key === key);
        if (!site || !site.api) continue;
        try {
          const url = String(site.api).replace(/\?.*$/, "").replace(/\/+$/, "") + "/?ac=list";
          const res2 = await fetch(url, {
            headers: {
              "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
              accept: "application/json,text/plain,*/*",
              "accept-encoding": "identity"
            },
            signal: AbortSignal.timeout(12000)
          });
          const text = await res2.text();
          let payload = null;
          const trimmed = text.replace(/^\uFEFF/, "").trim();
          if (trimmed.startsWith("{")) payload = JSON.parse(trimmed);
          const classes = Array.isArray(payload?.class)
            ? payload.class.map((c) => ({ id: String(c.type_id ?? c.id ?? ""), name: String(c.type_name ?? c.name ?? "") })).filter((c) => c.id)
            : [];
          items[key] = { name: site.name, api: site.api, classes, fetchedAt: Date.now() };
          results.push({ key, name: site.name, classes: classes.length, sample: classes.slice(0, 4) });
        } catch (error) {
          results.push({ key, name: site.name, classes: 0, error: String(error?.message || error).slice(0, 80) });
        }
      }
      store.writeJson("profiles.json", { rev: Date.now(), items });
      audit(req, path, `${results.length} profiled`);
      return json(res, 200, { results, total: Object.keys(items).length });
    }

    if (method === "POST" && path === "/api/restore") {
      const body = await readBody(req);
      if (body.format !== "nova-admin-backup/1") return json(res, 400, { error: "不是本后台的备份文件" });
      const summary = { sources: 0, candidates: 0, seeds: 0 };
      try {
        if (Array.isArray(body.sources) && body.sources.length) {
          for (const src of body.sources) {
            try {
              ctx.nova.NovaSources.importJson(JSON.stringify(src.raw || { sites: [] }), { name: src.name || "恢复的订阅", kind: "paste" });
              summary.sources += 1;
            } catch (_) {
              /* 已存在就跳过 */
            }
          }
        }
        if (body.candidates?.items) {
          ctx.state.candidates = body.candidates;
          store.writeJson("candidates.json", body.candidates);
          summary.candidates = Object.keys(body.candidates.items).length;
        }
        if (Array.isArray(body.seeds)) {
          ctx.state.seeds = body.seeds;
          store.writeJson("harvest-seeds.json", { items: body.seeds });
          summary.seeds = body.seeds.length;
        }
        if (body.siteStatus) store.writeJson("site-status.json", { rev: Date.now(), items: body.siteStatus });
        if (body.profiles) store.writeJson("profiles.json", { rev: Date.now(), items: body.profiles });
        if (body.settings && typeof body.settings === "object") ctx.nova.NovaSettings.patch(body.settings);
        persist("restore");
        audit(req, path, JSON.stringify(summary));
        return json(res, 200, { ok: true, summary });
      } catch (error) {
        return json(res, 500, { error: String(error?.message || error) });
      }
    }

    if (method === "POST" && path === "/api/settings") {
      const body = await readBody(req);
      ctx.nova.NovaSettings.patch(body || {});
      persist("settings");
      audit(req, path, JSON.stringify(body).slice(0, 120));
      return json(res, 200, { settings: ctx.nova.NovaSettings.get() });
    }

    return json(res, 404, { error: "没有这个接口", path });
  }

  return { handle, persist, siteRows };
}
