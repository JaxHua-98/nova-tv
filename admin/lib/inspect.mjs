/**
 * NOVA TV 管理后台 · 站点巡检
 *
 * 定期测启用的站点，连续失败自动降级；状态存在独立文件，
 * 不写进前台的覆盖表（覆盖表只认 enabled/order/health/timeout/header/name 六个字段）。
 */
const FAIL_LIMIT = 3;

export function createInspector(ctx) {
  const { store } = ctx;
  let timer = null;
  let running = false;
  let currentIntervalHours = 6;

  function readStatus() {
    const file = store.readJson("site-status.json", { items: {} });
    return file.items || {};
  }

  function writeStatus(items) {
    store.writeJson("site-status.json", { rev: Date.now(), items });
  }

  function statusOf(key) {
    return readStatus()[key] || null;
  }

  function summarize() {
    const items = readStatus();
    const values = Object.values(items);
    return {
      total: values.length,
      ok: values.filter((v) => v.status === "ok").length,
      warn: values.filter((v) => v.status === "warn").length,
      degraded: values.filter((v) => v.status === "degraded").length,
      lastRunAt: Math.max(0, ...values.map((v) => v.lastChecked || 0)) || null
    };
  }

  /**
   * 跑一轮巡检。keys 为空表示所有启用的直连站点。
   */
  async function runOnce(options = {}) {
    if (running) return { skipped: true, reason: "巡检进行中" };
    running = true;
    const started = Date.now();
    const S = ctx.nova.NovaSources;
    const limit = Math.max(1, Number(options.limit) || 80);
    const all = S.listSites().filter((s) => s.enabled && !s.unsupported);
    const targets = Array.isArray(options.keys) && options.keys.length
      ? all.filter((s) => options.keys.includes(s.key))
      : all.slice(0, limit);

    const results = [];
    const statusItems = readStatus();

    for (const site of targets) {
      let record = null;
      try {
        record = await S.testSite(site.key);
      } catch (error) {
        record = { ok: false, message: String(error?.message || error).slice(0, 120), ms: -1 };
      }
      const ok = Boolean(record?.ok);
      const prev = statusItems[site.key] || { failStreak: 0 };
      const failStreak = ok ? 0 : (prev.failStreak || 0) + 1;
      const status = ok ? "ok" : failStreak >= FAIL_LIMIT ? "degraded" : "warn";
      statusItems[site.key] = {
        status,
        failStreak,
        lastChecked: Date.now(),
        lastOkAt: ok ? Date.now() : prev.lastOkAt || 0,
        message: String(record?.message || "").slice(0, 160),
        ms: typeof record?.ms === "number" ? record.ms : -1
      };
      store.appendJsonl("probe-history.jsonl", {
        ts: Date.now(),
        key: site.key,
        ok,
        ms: statusItems[site.key].ms,
        message: statusItems[site.key].message,
        origin: "inspect"
      });
      results.push({ key: site.key, name: site.name, ok, ms: statusItems[site.key].ms, status, failStreak });
    }

    writeStatus(statusItems);
    if (targets.length) ctx.persist?.("inspect");

    const summary = {
      at: Date.now(),
      durationMs: Date.now() - started,
      checked: targets.length,
      ok: results.filter((r) => r.ok).length,
      warn: results.filter((r) => r.status === "warn").length,
      degraded: results.filter((r) => r.status === "degraded").length
    };
    store.appendJsonl("inspect-runs.jsonl", summary);
    running = false;
    return summary;
  }

  function start(hours) {
    currentIntervalHours = Number(hours) || currentIntervalHours;
    if (timer) clearInterval(timer);
    const ms = Math.max(0.25, currentIntervalHours) * 3600 * 1000;
    timer = setInterval(() => {
      runOnce({ limit: 80 }).catch((error) => {
        store.appendJsonl("inspect-runs.jsonl", { at: Date.now(), error: String(error?.message || error).slice(0, 200) });
      });
    }, ms);
    if (timer.unref) timer.unref();
    return currentIntervalHours;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    runOnce,
    start,
    stop,
    statusOf,
    summarize,
    isRunning: () => running,
    intervalHours: () => currentIntervalHours,
    lastRuns: (n = 20) => store.readJsonl("inspect-runs.jsonl", n)
  };
}
