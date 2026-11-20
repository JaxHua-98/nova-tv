/* NOVA TV · EPG 节目单
 * 解析标准 XMLTV（支持 gzip），按频道归一化匹配，提供当前/下一档查询。
 * 数据源默认使用 epg.112114.xyz（覆盖央视、卫视与地方台）。
 */
(function () {
  "use strict";

  const DEFAULT_SOURCES = ["https://epg.112114.xyz/pp.xml"];
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const SUFFIX = /(综合|频道|高清|超清|标清|hd|sd|uhd|4k|剧场|影视频道|电视剧)$/g;

  let cache = null;
  let loading = null;

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s\-_·—]/g, "")
      .replace(SUFFIX, "");
  }

  function parseXmltvTime(raw) {
    // 20261118004500 +0800
    const text = String(raw || "").trim();
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/.exec(text);
    if (!match) return 0;
    const [, y, mo, d, h, mi, s, tz] = match;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : "Z"}`;
    return Date.parse(iso) || 0;
  }

  function parseXmltv(text) {
    const byId = new Map();
    for (const match of String(text).matchAll(
      /<channel id="([^"]+)"[^>]*>\s*<display-name[^>]*>([^<]*)</g
    )) {
      const id = match[1];
      const names = byId.get(id)?.names || [];
      names.push(match[2]);
      byId.set(id, { id, names, programmes: byId.get(id)?.programmes || [] });
    }

    const lookup = new Map();
    byId.forEach((entry) => {
      [entry.id, ...entry.names].forEach((name) => {
        const key = normalize(name);
        if (key && !lookup.has(key)) lookup.set(key, entry.id);
      });
    });

    const orphans = new Map();
    const pattern =
      /<programme\s+channel="([^"]+)"\s+start="([^"]+)"\s+stop="([^"]+)"[^>]*>\s*<title[^>]*>([^<]*)</g;
    for (const match of String(text).matchAll(pattern)) {
      const [, channelId, start, stop, title] = match;
      const entry = byId.get(channelId);
      const item = {
        channelId,
        start: parseXmltvTime(start),
        stop: parseXmltvTime(stop),
        title: String(title || "").trim()
      };
      if (!item.start || !item.title) continue;
      if (entry) entry.programmes.push(item);
      else {
        if (!orphans.has(channelId)) orphans.set(channelId, []);
        orphans.get(channelId).push(item);
      }
    }

    // 只有节目、没有 channel 声明的，也建一条
    orphans.forEach((programmes, channelId) => {
      if (byId.has(channelId)) return;
      byId.set(channelId, { id: channelId, names: [], programmes });
    });

    byId.forEach((entry) => {
      entry.programmes.sort((left, right) => left.start - right.start);
    });

    return { channels: byId, lookup };
  }

  async function fetchText(url) {
    const proxied = `/api/proxy?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(proxied, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`EPG 拉取失败（HTTP ${response.status}）`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function load(options = {}) {
    if (!options.force && cache && Date.now() - cache.at < CACHE_TTL) return cache;
    if (loading) return loading;
    const sources = options.sources || DEFAULT_SOURCES;
    loading = (async () => {
      let lastError = null;
      for (const url of sources) {
        try {
          const text = await fetchText(url);
          if (!/<tv[\s>]/.test(text)) throw new Error("返回内容不是 XMLTV");
          const parsed = parseXmltv(text);
          cache = {
            at: Date.now(),
            url,
            channels: parsed.channels,
            lookup: parsed.lookup,
            programmeCount: [...parsed.channels.values()].reduce(
              (sum, entry) => sum + entry.programmes.length,
              0
            )
          };
          return cache;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("EPG 加载失败");
    })();
    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  function matchChannel(data, tvgId, name) {
    if (!data) return null;
    const candidates = [tvgId, name].map(normalize).filter(Boolean);
    for (const key of candidates) {
      const id = data.lookup.get(key);
      if (id) return data.channels.get(id) || null;
    }
    // 前缀兜底：CCTV1综合 ↔ CCTV1
    for (const key of candidates) {
      if (key.length < 3) continue;
      for (const [mapKey, id] of data.lookup) {
        if (mapKey.startsWith(key) || key.startsWith(mapKey)) {
          return data.channels.get(id) || null;
        }
      }
    }
    return null;
  }

  /** 当前正在播出的节目 + 进度 */
  function current(entry, at = Date.now()) {
    if (!entry?.programmes?.length) return null;
    const index = entry.programmes.findIndex(
      (item) => item.start <= at && item.stop > at
    );
    if (index < 0) return null;
    const item = entry.programmes[index];
    const total = Math.max(1, item.stop - item.start);
    return {
      ...item,
      next: entry.programmes[index + 1] || null,
      progress: Math.min(1, Math.max(0, (at - item.start) / total))
    };
  }

  function next(entry, at = Date.now()) {
    if (!entry?.programmes?.length) return null;
    return entry.programmes.find((item) => item.start > at) || null;
  }

  function timeline(entry, at = Date.now(), count = 3) {
    if (!entry?.programmes?.length) return [];
    return entry.programmes.filter((item) => item.stop > at).slice(0, count);
  }

  function stats() {
    if (!cache) return null;
    return {
      url: cache.url,
      channels: cache.channels.size,
      programmes: cache.programmeCount,
      loadedAt: cache.at
    };
  }

  window.NovaEpg = {
    load,
    matchChannel,
    current,
    next,
    timeline,
    stats,
    normalize
  };
})();
