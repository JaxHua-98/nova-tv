/**
 * NOVA TV 管理后台 · 反向代理（带缓存与限流）
 *
 * 语义与前台一致，另加三件事：
 *   1. 内存 LRU 缓存：m3u8 30 秒、分片 20 分钟、总量上限 300MB
 *   2. 同 URL 请求合并（in-flight），多设备同时拉同一分片只回源一次
 *   3. 单域名并发上限（默认 4），超限排队而不是拒绝
 * SSRF 防护：只允许 http/https，拒绝回环与私有网段。
 */

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;
const CACHE_MAX_BYTES = 300 * 1024 * 1024;
const TTL_PLAYLIST = 30 * 1000;
const TTL_SEGMENT = 20 * 60 * 1000;
const HOST_CONCURRENCY = 4;

const cache = new Map(); // key -> { body, contentType, status, etag, at, ttl, size }
const inflight = new Map(); // key -> Promise
const hostQueue = new Map(); // host -> { active, waiters: [] }
const stats = { hits: 0, misses: 0, coalesced: 0, bytesCached: 0, evicted: 0, queued: 0 };

function isPrivateHost(host) {
  const h = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

function validate(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new Error("地址不合法");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("只允许 http/https");
  if (isPrivateHost(url.hostname)) throw new Error("不允许访问本机或内网地址");
  return url;
}

function rewritePlaylist(body, target, encodedHeaders) {
  const base = new URL(target);
  const suffix = encodedHeaders ? `&headers=${encodeURIComponent(encodedHeaders)}` : "";
  const toProxy = (ref) => {
    try {
      return `/api/proxy?url=${encodeURIComponent(new URL(ref, base).href)}${suffix}`;
    } catch (_) {
      return ref;
    }
  };
  return body
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${toProxy(uri)}"`);
      }
      return toProxy(t);
    })
    .join("\n");
}

async function withHostSlot(host, fn) {
  let slot = hostQueue.get(host);
  if (!slot) {
    slot = { active: 0, waiters: [] };
    hostQueue.set(host, slot);
  }
  if (slot.active >= HOST_CONCURRENCY) {
    stats.queued += 1;
    await new Promise((resolve) => slot.waiters.push(resolve));
  }
  slot.active += 1;
  try {
    return await fn();
  } finally {
    slot.active -= 1;
    const next = slot.waiters.shift();
    if (next) next();
  }
}

function cacheKey(url, referer) {
  return url + "|" + (referer || "");
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    stats.bytesCached -= hit.size;
    return null;
  }
  // 触摸一下，维持 LRU 顺序
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cachePut(key, entry) {
  const existing = cache.get(key);
  if (existing) stats.bytesCached -= existing.size;
  cache.set(key, entry);
  stats.bytesCached += entry.size;
  while (stats.bytesCached > CACHE_MAX_BYTES && cache.size > 1) {
    const oldestKey = cache.keys().next().value;
    const removed = cache.get(oldestKey);
    cache.delete(oldestKey);
    stats.bytesCached -= removed ? removed.size : 0;
    stats.evicted += 1;
  }
}

export function proxyStats() {
  const list = [...cache.values()];
  return {
    entries: cache.size,
    bytes: stats.bytesCached,
    hits: stats.hits,
    misses: stats.misses,
    coalesced: stats.coalesced,
    evicted: stats.evicted,
    queued: stats.queued,
    hitRate: stats.hits + stats.misses ? Number((stats.hits / (stats.hits + stats.misses)).toFixed(3)) : 0,
    playlists: list.filter((e) => e.isPlaylist).length,
    segments: list.filter((e) => !e.isPlaylist).length
  };
}

export function proxyClear() {
  cache.clear();
  stats.bytesCached = 0;
  return proxyStats();
}

async function fetchUpstream(target, req, headers, ua, signal) {
  return fetch(target.href, {
    method: req.method === "HEAD" ? "HEAD" : "GET",
    redirect: "manual",
    signal,
    headers: {
      ...headers,
      "user-agent": headers["user-agent"] || ua,
      accept: headers.accept || "*/*",
      "accept-encoding": "identity",
      ...(req.headers.range ? { range: req.headers.range } : {})
    }
  });
}

export async function handleProxy(req, res, url, options = {}) {
  const raw = url.searchParams.get("url");
  const ua = options.ua || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  if (!raw) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "缺少 url 参数" }));
  }

  let headers = {};
  const encoded = url.searchParams.get("headers");
  if (encoded) {
    try {
      const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      if (parsed && typeof parsed === "object") headers = parsed;
    } catch (_) {
      /* 忽略坏的 headers */
    }
  }

  const noCache = url.searchParams.get("cache") === "0" || req.headers["cache-control"] === "no-cache";
  let target;
  try {
    target = validate(raw);
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: String(error.message) }));
  }

  const key = cacheKey(target.href, headers.referer || headers.Referer || "");
  if (!noCache) {
    const hit = cacheGet(key);
    if (hit) {
      stats.hits += 1;
      res.writeHead(hit.status, {
        "Content-Type": hit.contentType,
        "Content-Length": String(hit.body.length),
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": hit.isPlaylist ? "no-store" : "public, max-age=60",
        "X-Cache": "hit",
        ...(hit.etag ? { ETag: hit.etag } : {})
      });
      return res.end(hit.body);
    }
  }
  stats.misses += 1;

  // 同一个地址已经被别的请求拉着，直接等它的结果
  const pendingKey = key;
  if (!noCache && inflight.has(pendingKey)) {
    stats.coalesced += 1;
    try {
      const shared = await inflight.get(pendingKey);
      if (shared) {
        res.writeHead(shared.status, {
          "Content-Type": shared.contentType,
          "Content-Length": String(shared.body.length),
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "coalesced"
        });
        return res.end(shared.body);
      }
    } catch (_) {
      /* 落到下面自己拉 */
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const task = (async () => {
    let upstream = null;
    let cursor = target;
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
      upstream = await fetchUpstream(cursor, req, headers, ua, controller.signal);
      if (upstream.status < 300 || upstream.status >= 400) break;
      const location = upstream.headers.get("location");
      if (!location) break;
      cursor = validate(new URL(location, cursor).href);
    }
    if (!upstream) throw new Error("上游没有响应");

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const isPlaylist = /mpegurl/i.test(contentType) || /\.m3u8?(?:$|\?)/i.test(cursor.href);
    const buf = req.method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await upstream.arrayBuffer()).subarray(0, MAX_BYTES);
    const body = isPlaylist ? Buffer.from(rewritePlaylist(buf.toString("utf8"), cursor.href, encoded)) : buf;
    const entry = {
      status: upstream.status,
      body,
      contentType: isPlaylist ? "application/vnd.apple.mpegurl; charset=utf-8" : contentType,
      etag: upstream.headers.get("etag") || "",
      isPlaylist,
      ttl: isPlaylist ? TTL_PLAYLIST : TTL_SEGMENT,
      at: Date.now(),
      size: body.length
    };
    // 只缓存成功且不太大的响应
    if (!noCache && upstream.status === 200 && !req.headers.range && body.length <= MAX_BYTES) {
      cachePut(key, entry);
    }
    return entry;
  })();

  if (!noCache) inflight.set(pendingKey, task);

  try {
    const entry = await task;
    res.writeHead(entry.status, {
      "Content-Type": entry.contentType,
      "Content-Length": String(entry.body.length),
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": entry.isPlaylist ? "no-store" : "public, max-age=60",
      "X-Cache": "miss"
    });
    res.end(entry.body);
  } catch (error) {
    const message = error?.name === "AbortError" ? "上游超时" : String(error?.message || error);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: message }));
  } finally {
    clearTimeout(timer);
    inflight.delete(pendingKey);
  }
}

/** 带单域并发的代理入口（server 层调用这个） */
export async function proxyWithLimit(req, res, url, options = {}) {
  let host = "";
  try {
    host = new URL(url.searchParams.get("url")).hostname;
  } catch (_) {
    host = "unknown";
  }
  return withHostSlot(host, () => handleProxy(req, res, url, options));
}
