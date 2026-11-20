/**
 * NOVA TV 管理后台 · 候选收集
 * 种子（镜像/订阅/本地）→ 抽取 api → 归一化去重 → 候选池（含品牌、来源、出现次数）
 */
export const DEFAULT_SEEDS = [
  { id: "seed_juhe", name: "juhe-tvapi", kind: "jsdelivr", url: "https://cdn.jsdelivr.net/gh/ccAzy/juhe-tvapi@main/config.json", enabled: true },
  { id: "seed_xptv", name: "XPTV", kind: "jsdelivr", url: "https://cdn.jsdelivr.net/gh/fangkuia/XPTV@main/CMS/XPTV.json", enabled: true },
  { id: "seed_lg5798", name: "lg5798/tvbox", kind: "jsdelivr", url: "https://cdn.jsdelivr.net/gh/lg5798/tvbox@master/0821.json", enabled: true },
  { id: "seed_rtian", name: "rtian001/tvbox", kind: "jsdelivr", url: "https://cdn.jsdelivr.net/gh/rtian001/tvbox@main/README.md", enabled: false }
];

export const BRANDS = [
  ["zuidazy", "最大资源"],
  ["zuidapi", "最大资源"],
  ["wujinapi", "无尽资源"],
  ["yayazy", "丫丫点播"],
  ["niuniuzy", "牛牛点播"],
  ["sdzyapi", "闪电资源"],
  ["guangsuapi", "光速资源"],
  ["tyyszy", "天涯资源"],
  ["mdzyapi", "魔都资源"],
  ["moduapi", "魔都资源"],
  ["360zy", "360资源"],
  ["hongniuzy", "红牛资源"],
  ["jinyingzy", "金鹰点播"],
  ["jyzyapi", "鲸鱼资源"],
  ["huyaapi", "虎牙资源"],
  ["jszyapi", "极速资源"],
  ["haohuazy", "豪华资源"],
  ["ukuapi", "U酷资源"],
  ["hhzyapi", "海豚资源"]
];

export const DEFAULT_EXCLUDE = [
  { match: "apilsbzy1", reason: "成人向内容" },
  { match: "ckzy", reason: "分类极少、内容偏成人" },
  { match: "apiyhzy", reason: "延迟过高、分片下载失败" }
];

/** api 归一化成稳定 key：host + 路径尾段 */
export function keyOf(api) {
  const clean = String(api || "").replace(/\?.*$/, "").trim().toLowerCase();
  if (!clean) return "";
  const host = clean.replace(/^https?:\/\//, "").split("/")[0];
  return host.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function brandOf(api) {
  const low = String(api || "").toLowerCase();
  for (const [needle, name] of BRANDS) {
    if (low.includes(needle)) return name;
  }
  return String(api || "").replace(/^https?:\/\//, "").split("/")[0] || "未知";
}

/** 从配置里抽出所有苹果 CMS 形态的 api */
export function extractApis(raw) {
  const out = [];
  const push = (api) => {
    const a = String(api || "").trim();
    if (!a.startsWith("http")) return;
    if (!/api\.php|provide\/vod/.test(a)) return;
    out.push(a);
  };
  if (!raw) return out;
  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") push(item.api);
    });
    return out;
  }
  if (typeof raw === "object") {
    (Array.isArray(raw.sites) ? raw.sites : []).forEach((s) => push(s?.api));
    (Array.isArray(raw.urls) ? raw.urls : []).forEach((s) => push(s?.api || s));
  }
  return out;
}

export function parseConfigText(text) {
  const t = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch (_) {
    return null;
  }
}

/** 拉一个种子：JSON 配置直接解析；README 之类退化为正则抽 URL */
export async function fetchSeed(seed, options = {}) {
  const timeout = Number(options.timeout) || 20000;
  const res = await fetch(seed.url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "*/*"
    },
    signal: AbortSignal.timeout(timeout)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = parseConfigText(text);
  if (json) return { apis: extractApis(json), bytes: text.length, mode: "json" };
  const urls = text.match(/https?:\/\/[^\s)\]"'`，。、]+/g) || [];
  return { apis: extractApis(urls.map((u) => ({ api: u }))), bytes: text.length, mode: "text" };
}

export function applyExclude(api, rules = DEFAULT_EXCLUDE) {
  const low = String(api || "").toLowerCase();
  for (const rule of rules) {
    if (rule.match && low.includes(String(rule.match).toLowerCase())) return rule.reason;
  }
  return "";
}

/**
 * 跑一轮收集。ctx = { store, candidates, logger }
 * 返回 { seeds: [...], found, added, updated }
 */
export async function runHarvest(ctx, options = {}) {
  const seeds = (ctx.seeds || DEFAULT_SEEDS).filter((s) => s.enabled !== false);
  const rules = [...DEFAULT_EXCLUDE, ...(ctx.excludeRules || [])];
  const pool = ctx.candidates || { rev: 1, items: {} };
  const now = Date.now();
  const report = { startedAt: now, seeds: [], found: 0, added: 0, updated: 0, errors: [] };

  for (const seed of seeds) {
    const entry = { id: seed.id, name: seed.name, ok: false, apis: 0, added: 0, error: "" };
    try {
      const got = await fetchSeed(seed, options);
      entry.ok = true;
      entry.apis = got.apis.length;
      entry.mode = got.mode;
      entry.bytes = got.bytes;
      for (const api of got.apis) {
        const key = keyOf(api);
        if (!key) continue;
        report.found += 1;
        const existing = pool.items[key];
        if (existing) {
          existing.lastSeen = now;
          existing.seenCount = (existing.seenCount || 1) + 1;
          if (!existing.sources.includes(seed.id)) existing.sources.push(seed.id);
          report.updated += 1;
        } else {
          pool.items[key] = {
            key,
            api: api.replace(/\?.*$/, "").replace(/\/+$/, "") + "/",
            host: String(api).replace(/^https?:\/\//, "").split("/")[0],
            brand: brandOf(api),
            sources: [seed.id],
            seenCount: 1,
            firstSeen: now,
            lastSeen: now,
            probe: null,
            score: 0,
            grade: "",
            excluded: applyExclude(api, rules),
            promotedSourceId: "",
            promotedKey: ""
          };
          entry.added += 1;
          report.added += 1;
        }
      }
      seed.lastRun = now;
      seed.found = got.apis.length;
    } catch (error) {
      entry.error = String(error.message || error).slice(0, 120);
      report.errors.push({ seed: seed.id, error: entry.error });
    }
    report.seeds.push(entry);
  }

  pool.rev = (pool.rev || 1) + 1;
  report.finishedAt = Date.now();
  report.durationMs = report.finishedAt - report.startedAt;
  return { pool, report };
}
