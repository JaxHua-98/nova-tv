/* ============================================================
   NOVA MUSIC SOURCES · 音乐源适配层
   ------------------------------------------------------------
   统一对外接口，内部按 provider 排队，失败自动下一个：

     NovaMusicSources.radio.list({ country, tag, limit })
     NovaMusicSources.radio.search(keyword, { limit })
     NovaMusicSources.search(keyword, { limit, providers })
     NovaMusicSources.getUrl(track)      → { url, type }
     NovaMusicSources.getLyric(track)    → lrc 字符串
     NovaMusicSources.status()           → 各源状态（设置页用）

   约定：
   · 所有远端请求都走本地 /api/proxy，绕开 CORS / Referer / mixed content
   · 8 秒超时，失败不抛错，返回空数组并记状态
   · 结果统一成 Track：{ id, provider, title, artist, album, cover,
                        duration, isLive, lrc, url, extra }
   ============================================================ */

(function () {
  "use strict";

  const TIMEOUT = 8000;
  const CACHE_TTL = 10 * 60 * 1000;
  const URL_TTL = 5 * 60 * 1000;

  const cache = new Map();
  const providerState = new Map();

  /* ---------- 工具 ---------- */

  function proxied(url) {
    if (!url) return "";
    if (url.startsWith("/api/proxy") || url.startsWith("data:")) return url;
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  function cacheGet(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > (hit.ttl || CACHE_TTL)) {
      cache.delete(key);
      return null;
    }
    return hit.value;
  }

  function cacheSet(key, value, ttl) {
    cache.set(key, { value, at: Date.now(), ttl });
    if (cache.size > 120) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cache.delete(oldest[0]);
    }
  }

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || TIMEOUT);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { Accept: "application/json,text/plain,*/*", ...(options.headers || {}) }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJson(url, options) {
    const response = await fetchWithTimeout(url, options);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("响应不是 JSON");
    }
  }

  function mark(provider, ok, note) {
    providerState.set(provider, { ok, note, at: Date.now() });
  }

  function firstString(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return "";
  }

  /* ---------- Radio Browser ---------- */

  const RADIO_HOSTS = [
    "https://de1.api.radio-browser.info",
    "https://nl1.api.radio-browser.info",
    "https://at1.api.radio-browser.info",
    "https://fr1.api.radio-browser.info"
  ];

  async function radioRequest(path) {
    let lastError = null;
    for (const host of RADIO_HOSTS) {
      try {
        const data = await fetchJson(proxied(`${host}${path}`));
        if (Array.isArray(data)) {
          mark("radio", true, host);
          return data;
        }
      } catch (error) {
        lastError = error;
      }
    }
    mark("radio", false, lastError?.message || "全部镜像不可用");
    return [];
  }

  function radioToTrack(station) {
    const url = firstString(station.url_resolved, station.url);
    if (!url) return null;
    const tags = Array.isArray(station.tags) ? station.tags.slice(0, 3).join(" / ") : firstString(station.tags);
    return {
      id: `radio:${station.stationuuid || url}`,
      provider: "radio",
      title: firstString(station.name, "未命名电台"),
      artist: [firstString(station.country), tags].filter(Boolean).join(" · ") || "网络电台",
      album: firstString(station.tags),
      cover: firstString(station.favicon),
      duration: 0,
      isLive: true,
      lrc: "",
      url,
      extra: {
        codec: firstString(station.codec),
        bitrate: station.bitrate || 0,
        homepage: firstString(station.homepage),
        clicks: station.clickcount || 0
      }
    };
  }

  const radio = {
    async list({ country = "CN", tag = "", limit = 24, order = "clickcount" } = {}) {
      const key = `radio:list:${country}:${tag}:${limit}:${order}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const params = new URLSearchParams({
        limit: String(limit),
        order,
        reverse: "true",
        hidebroken: "true"
      });
      if (country) params.set("countrycode", country);
      if (tag) params.set("tag", tag);
      const rows = await radioRequest(`/json/stations/search?${params.toString()}`);
      const tracks = rows.map(radioToTrack).filter(Boolean);
      cacheSet(key, tracks);
      return tracks;
    },

    async search(keyword, { limit = 24 } = {}) {
      const term = String(keyword || "").trim();
      if (!term) return [];
      const key = `radio:search:${term}:${limit}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const params = new URLSearchParams({
        limit: String(limit),
        order: "clickcount",
        reverse: "true",
        hidebroken: "true",
        name: term
      });
      const rows = await radioRequest(`/json/stations/search?${params.toString()}`);
      const tracks = rows.map(radioToTrack).filter(Boolean);
      cacheSet(key, tracks);
      return tracks;
    }
  };

  /* ---------- 聚合 API（网易 / QQ / 酷狗 / 咪咕） ---------- */

  // 公共实例随时可能失效，设置页可以换成自建地址
  const AGGREGATOR_KEY = "nova.music.aggregator.v1";
  const DEFAULT_AGGREGATOR = "https://music-api.gdstudio.xyz/api.php";

  function aggregatorBase() {
    try {
      const saved = window.localStorage.getItem(AGGREGATOR_KEY);
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    return DEFAULT_AGGREGATOR;
  }

  function setAggregatorBase(base) {
    try {
      window.localStorage.setItem(AGGREGATOR_KEY, String(base || "").trim());
    } catch {
      /* ignore */
    }
    cache.clear();
  }

  function aggregatorUrl(params) {
    const base = aggregatorBase();
    const query = new URLSearchParams(params).toString();
    return proxied(`${base}?${query}`);
  }

  const AGGREGATOR_SOURCES = ["netease", "tencent", "kugou", "migu"];

  function pickArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    for (const key of ["data", "result", "songs", "list", "items"]) {
      if (Array.isArray(payload[key])) return payload[key];
      if (payload[key] && typeof payload[key] === "object") {
        const nested = pickArray(payload[key]);
        if (nested.length) return nested;
      }
    }
    return [];
  }

  function aggregatorToTrack(row, source) {
    if (!row || typeof row !== "object") return null;
    const id = firstString(row.id, row.songid, row.song_id, row.rid, row.hash);
    if (!id) return null;
    const artist = Array.isArray(row.artist)
      ? row.artist.join(" / ")
      : firstString(row.artist, row.singer, row.artists, row.author);
    return {
      id: `${source}:${id}`,
      provider: source,
      title: firstString(row.name, row.title, row.songname, "未知曲目"),
      artist: artist || "未知艺人",
      album: firstString(row.album, row.alname, row.albumname),
      cover: proxied(firstString(row.pic, row.cover, row.picUrl, row.img, row.albumPic)),
      duration: Number(row.duration || row.interval || 0) || 0,
      isLive: false,
      lrc: "",
      url: "",
      extra: { rawId: id, source }
    };
  }

  async function aggregatorSearch(keyword, { limit = 20, source = "netease" } = {}) {
    const term = String(keyword || "").trim();
    if (!term) return [];
    const key = `agg:search:${source}:${term}:${limit}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    try {
      const payload = await fetchJson(
        aggregatorUrl({ types: "search", source, name: term, count: String(limit), pages: "1" })
      );
      const rows = pickArray(payload);
      const tracks = rows.map((row) => aggregatorToTrack(row, source)).filter(Boolean);
      mark(source, tracks.length > 0, tracks.length ? `${tracks.length} 条` : "无结果");
      cacheSet(key, tracks);
      return tracks;
    } catch (error) {
      mark(source, false, error.message || "请求失败");
      return [];
    }
  }

  async function aggregatorUrlFor(track, br = 320) {
    const source = track.extra?.source || track.provider;
    const id = track.extra?.rawId || track.id.split(":").slice(1).join(":");
    const key = `agg:url:${source}:${id}:${br}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    try {
      const payload = await fetchJson(
        aggregatorUrl({ types: "url", source, id, br: String(br) })
      );
      const url = firstString(payload?.url, payload?.data?.url, payload?.data);
      if (!url) throw new Error("没有可用直链");
      const result = { url: url.startsWith("http") ? proxied(url) : url, type: "audio/mpeg" };
      cacheSet(key, result, URL_TTL);
      mark(source, true, "直链可用");
      return result;
    } catch (error) {
      mark(source, false, error.message || "取流失败");
      return null;
    }
  }

  async function aggregatorLyric(track) {
    const source = track.extra?.source || track.provider;
    const id = track.extra?.rawId || track.id.split(":").slice(1).join(":");
    try {
      const payload = await fetchJson(
        aggregatorUrl({ types: "lyric", source, id })
      );
      return firstString(payload?.lyric, payload?.data?.lyric, payload?.data);
    } catch {
      return "";
    }
  }

  /* ---------- 榜单 / 曲库 ---------- */

  const FEED_PLAYLISTS = [
    { source: "netease", id: "3778678", label: "热歌榜" },
    { source: "netease", id: "3779629", label: "新歌榜" },
    { source: "netease", id: "19723756", label: "飙升榜" }
  ];

  function neteaseRawToTrack(row) {
    if (!row || typeof row !== "object") return null;
    const id = firstString(row.id);
    if (!id) return null;
    const artists = Array.isArray(row.ar)
      ? row.ar.map((a) => a?.name).filter(Boolean)
      : Array.isArray(row.artists)
        ? row.artists.map((a) => a?.name).filter(Boolean)
        : [];
    const album = row.al || row.album || {};
    const cover = firstString(album.picUrl, row.picUrl);
    return {
      id: `netease:${id}`,
      provider: "netease",
      title: firstString(row.name, row.songname, "未知曲目"),
      artist: artists.join(" / ") || "未知艺人",
      album: firstString(album.name, ""),
      cover: cover ? proxied(cover) : "",
      duration: Math.round(Number(row.dt || 0) / 1000) || 0,
      isLive: false,
      lrc: "",
      url: "",
      extra: { rawId: id, source: "netease" }
    };
  }

  async function playlist(source, id, { limit = 20 } = {}) {
    const key = `pl:${source}:${id}:${limit}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    try {
      const payload = await fetchJson(aggregatorUrl({ types: "playlist", source, id }));
      const rows = payload?.playlist?.tracks || payload?.playlist?.playlist?.tracks || [];
      const tracks = rows
        .slice(0, limit)
        .map(neteaseRawToTrack)
        .filter(Boolean);
      mark(source, tracks.length > 0, tracks.length ? `榜单 ${tracks.length} 首` : "榜单为空");
      cacheSet(key, tracks);
      return tracks;
    } catch (error) {
      mark(source, false, error.message || "榜单请求失败");
      return [];
    }
  }

  async function feed({ limit = 20 } = {}) {
    for (const item of FEED_PLAYLISTS) {
      const rows = await playlist(item.source, item.id, { limit });
      if (rows.length) return rows;
    }
    // 榜单全挂时退化成关键词搜索，保证页面有内容
    return search("热歌", { limit });
  }
  /* ---------- 对外聚合 ---------- */

  async function search(keyword, { limit = 20, providers = ["netease", "tencent", "kugou", "migu"] } = {}) {
    for (const provider of providers) {
      if (!AGGREGATOR_SOURCES.includes(provider)) continue;
      const rows = await aggregatorSearch(keyword, { limit, source: provider });
      if (rows.length) return rows;
    }
    return [];
  }

  async function getUrl(track) {
    if (!track) return null;
    if (track.url) return { url: track.url, type: "audio/mpeg" };
    if (track.provider === "radio") return { url: track.url, type: "audio/mpeg" };
    if (track.provider === "local") return { url: track.url, type: "audio/wav" };
    return aggregatorUrlFor(track);
  }

  async function getLyric(track) {
    if (!track) return "";
    if (track.lrc) return track.lrc;
    if (track.provider === "radio" || track.provider === "local") return "";
    return aggregatorLyric(track);
  }

  function status() {
    const rows = [...providerState.entries()].map(([provider, info]) => ({
      provider,
      ok: info.ok,
      note: info.note,
      at: info.at
    }));
    return {
      aggregator: aggregatorBase(),
      radioHosts: RADIO_HOSTS.length,
      providers: rows
    };
  }

  window.NovaMusicSources = {
    radio,
    feed,
    playlist,
    search,
    getUrl,
    getLyric,
    status,
    setAggregatorBase,
    aggregatorBase,
    proxied,
    _cache: cache
  };
})();
