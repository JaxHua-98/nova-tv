/**
 * NOVA TV 管理后台 · 探测层
 *
 * 四段式：取列表 → 判定 → 取播放（含分片）→ 指标汇总
 * 两个实测坑的处理都在这里：
 *   1) 采集站常把 JSON 标成 text/html —— 不看 content-type，直接 JSON.parse
 *   2) healthRecord 需要 ms —— 判定结果里带上 ms 再算分
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.resolve(here, "..", "..");
const H = require(path.join(previewDir, "site-health.js"));

export const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function parseLoose(text) {
  const t = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!t) return null;
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch (_) {
      return null;
    }
  }
  return null;
}

async function getText(url, { timeout = 12000, ua = DEFAULT_UA, headers = {} } = {}) {
  const started = Date.now();
  const res = await fetch(url, {
    headers: {
      "user-agent": ua,
      accept: "application/json,text/plain,*/*",
      "accept-encoding": "identity",
      ...headers
    },
    signal: AbortSignal.timeout(timeout),
    redirect: "follow"
  });
  const text = await res.text();
  return { status: res.status, text, ms: Date.now() - started, contentType: res.headers.get("content-type") || "" };
}

function baseOf(api) {
  return String(api || "").replace(/\?.*$/, "").replace(/\/+$/, "");
}

function withQuery(url, query) {
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

/**
 * 探测一个苹果 CMS 兼容接口。
 * 多轮采样：默认 3 轮，延迟取中位数、连通取多数，避免网络抖一下就把源判死。
 * @returns 指标对象（不含评级）
 */
export async function probeSource(api, opts = {}) {
  const timeout = Number(opts.timeout) || 12000;
  const ua = opts.ua || DEFAULT_UA;
  const sampleLimit = Number(opts.sampleLimit) || 5;
  const playTimeout = Number(opts.playTimeout) || 8000;
  const rounds = Math.max(1, Math.min(5, Number(opts.rounds) || 3));
  const base = baseOf(api);
  const out = {
    api: base,
    ok: false,
    ms: null,
    msAll: [],
    rounds,
    items: 0,
    total: null,
    categories: 0,
    playRate: 0,
    playChecked: 0,
    playOk: 0,
    kind: "",
    sample: "",
    err: "",
    contentType: "",
    checkedAt: Date.now()
  };

  const attempts = [];
  let firstPayload = null;
  let listErr = "";

  for (let round = 0; round < rounds; round += 1) {
    try {
      const r = await getText(withQuery(base + "/", "ac=videolist&pg=1"), { timeout, ua });
      const payload = parseLoose(r.text);
      if (!payload) {
        listErr = `非 JSON 内容（${r.contentType || "无类型"}）`;
        attempts.push({ ok: false, ms: r.ms });
        continue;
      }
      const verdict = H.judgeCms(payload);
      attempts.push({ ok: Boolean(verdict.ok), ms: r.ms, count: verdict.count, total: Number(payload.total) || null, sample: verdict.sample });
      if (verdict.ok && !firstPayload) {
        firstPayload = payload;
        out.contentType = r.contentType;
      }
      if (!verdict.ok) listErr = verdict.message;
    } catch (error) {
      attempts.push({ ok: false, ms: null });
      listErr = `${error.name}:${error.message}`.slice(0, 120);
    }
    if (round < rounds - 1) await new Promise((r) => setTimeout(r, 400));
  }

  const okCount = attempts.filter((a) => a.ok).length;
  const msList = attempts.filter((a) => typeof a.ms === "number").map((a) => a.ms).sort((a, b) => a - b);
  out.msAll = msList;
  out.ms = msList.length ? msList[Math.floor(msList.length / 2)] : null;
  out.ok = okCount >= Math.ceil(rounds / 2);

  if (!out.ok || !firstPayload) {
    out.err = listErr || "接口无响应";
    // 兜底：有些站只认 ac=list
    try {
      const r2 = await getText(withQuery(base + "/", "ac=list"), { timeout, ua });
      const cls = parseLoose(r2.text);
      if (Array.isArray(cls?.class)) {
        out.categories = cls.class.length;
        out.kind = "class-only";
        out.err = "仅 ac=list 可用（列表拿不到条目）";
      }
    } catch (_) {
      /* ignore */
    }
    return out;
  }

  const firstOk = attempts.find((a) => a.ok) || {};
  out.items = firstOk.count || (Array.isArray(firstPayload.list) ? firstPayload.list.length : 0);
  out.total = firstOk.total || Number(firstPayload.total) || null;
  out.sample = firstOk.sample || "";

  // 分类数
  try {
    const rc = await getText(withQuery(base + "/", "ac=list"), { timeout, ua });
    const cls = parseLoose(rc.text);
    out.categories = Array.isArray(cls?.class) ? cls.class.length : 0;
  } catch (_) {
    out.categories = 0;
  }

  // 播放地址：列表里有就用，没有回退 detail&ids
  const list = Array.isArray(firstPayload.list) ? firstPayload.list.slice(0, sampleLimit) : [];
  let playUrls = [];
  for (const item of list) {
    const found = String(item?.vod_play_url || "").match(/https?:\/\/[^\s#$]+/g) || [];
    playUrls.push(...found.slice(0, 2));
  }
  if (!playUrls.length && list[0]?.vod_id) {
    try {
      const rd = await getText(withQuery(base + "/", `ac=detail&ids=${encodeURIComponent(list[0].vod_id)}`), { timeout, ua });
      const detail = parseLoose(rd.text)?.list?.[0];
      const found = String(detail?.vod_play_url || "").match(/https?:\/\/[^\s#$]+/g) || [];
      playUrls = found.slice(0, 2);
      if (playUrls.length) out.kind = "detail-playable";
    } catch (_) {
      /* ignore */
    }
  }

  out.playChecked = playUrls.length;
  let ok = 0;
  for (const url of playUrls) {
    try {
      const r = await getText(url, { timeout: playTimeout, ua, headers: { accept: "*/*" } });
      const head = r.text.slice(0, 400);
      let playable = head.includes("#EXTM3U");
      if (playable) {
        const seg = head
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("#") && /^https?:\/\//.test(line));
        if (seg) {
          try {
            const rs = await getText(seg, { timeout: playTimeout, ua, headers: { accept: "*/*" } });
            playable = rs.status === 200;
          } catch (_) {
            playable = false;
          }
        }
      }
      if (playable) ok += 1;
    } catch (_) {
      /* 单条失败不打断 */
    }
  }
  out.playOk = ok;
  out.playRate = out.playChecked ? Number((ok / out.playChecked).toFixed(2)) : 0;
  if (!out.kind) out.kind = out.playRate > 0 ? "hls-direct" : "list-only";
  return out;
}

/** 可解释评分：播放率 45% + 播放可用 25% + 延迟 20% + 目录规模 10% */
export function scoreOf(metrics = {}) {
  const playRate = Number(metrics.playRate) || 0;
  const stability = metrics.playRate > 0 ? 1 : 0;
  const ms = Number(metrics.ms);
  const latency = Number.isFinite(ms) ? Math.max(0, Math.min(1, 1 - (ms - 500) / 8000)) : 0;
  const catalog = Math.min(1, (Number(metrics.total) || 0) / 50000);
  return Number((0.45 * playRate + 0.25 * stability + 0.2 * latency + 0.1 * catalog).toFixed(2));
}

export function gradeOf(score, metrics = {}) {
  if (!metrics.ok) return "D";
  if (metrics.playRate === 0 && metrics.kind === "list-only") return "C";
  if (score >= 0.8) return "A";
  if (score >= 0.6) return "B";
  if (score >= 0.4) return "C";
  return "D";
}

/** 限并发 + 限速批量探测 */
export async function probeMany(apis, options = {}) {
  const concurrency = Math.max(1, Number(options.concurrency) || 4);
  const intervalMs = Math.max(0, Number(options.intervalMs) || 250);
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const list = [...new Set(apis.filter(Boolean))];
  const results = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      const api = list[index];
      let metrics;
      try {
        metrics = await probeSource(api, options);
      } catch (error) {
        metrics = { api, ok: false, ms: null, items: 0, total: null, categories: 0, playRate: 0, playChecked: 0, playOk: 0, kind: "", sample: "", err: String(error.message).slice(0, 120), checkedAt: Date.now() };
      }
      const score = scoreOf(metrics);
      const enriched = { ...metrics, score, grade: gradeOf(score, metrics) };
      results.push(enriched);
      done += 1;
      if (onProgress) onProgress({ done, total: list.length, current: api, result: enriched });
      if (intervalMs) await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return results;
}
