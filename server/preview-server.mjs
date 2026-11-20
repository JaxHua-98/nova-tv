import { createServer } from "node:http";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { spawn } from "node:child_process";
import os from "node:os";

const root = fileURLToPath(new URL(".", import.meta.url));
const startPort = Number(process.env.PORT || 4178);
// 默认只给本机用；--host / NOVA_HOST=0.0.0.0 才放开给局域网（电视浏览器、手机）
const HOST = process.env.NOVA_HOST || (process.argv.includes("--host") ? "0.0.0.0" : "127.0.0.1");

function lanAddress() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(net.address)) {
          return net.address;
        }
      }
    }
  } catch (_) {
    /* ignore */
  }
  return "";
}
const maxProxyBytes = 24 * 1024 * 1024;
const proxyTimeoutMs = 22000;
const allowedIncomingHeaders = new Set([
  "accept",
  "accept-language",
  "origin",
  "referer",
  "user-agent",
  "x-requested-with"
]);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m3u": "application/vnd.apple.mpegurl; charset=utf-8",
  ".m3u8": "application/vnd.apple.mpegurl; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8"
};

const demoItems = [
  {
    vod_id: "nova-1",
    vod_name: "星际穿越",
    type_name: "科幻电影",
    vod_year: "2014",
    vod_area: "美国",
    vod_remarks: "开放测试片源",
    vod_score: "9.4",
    vod_pic: "/assets/images/interstellar.jpg",
    vod_actor: "马修·麦康纳 / 安妮·海瑟薇",
    vod_director: "克里斯托弗·诺兰",
    vod_content:
      "宇航员库珀穿过虫洞寻找人类新家园。该条目用于验证 NOVA TV 的 TVBox 苹果 CMS 导入、片库聚合与详情读取链路。",
    vod_play_from: "NOVA 开放测试线路",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/video/movie_300.mp4"
  },
  {
    vod_id: "nova-2",
    vod_name: "沙丘 II",
    type_name: "科幻电影",
    vod_year: "2024",
    vod_area: "美国",
    vod_remarks: "HDR · 演示",
    vod_score: "8.8",
    vod_pic: "/assets/images/dune.jpg",
    vod_actor: "提莫西·查拉梅 / 赞达亚",
    vod_director: "丹尼斯·维伦纽瓦",
    vod_content:
      "保罗·厄崔迪与弗雷曼人并肩作战。条目信息来自本地 CMS 桩，播放地址为 W3C 开放授权测试片。",
    vod_play_from: "NOVA 开放测试线路",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/sintel/trailer.mp4"
  },
  {
    vod_id: "nova-3",
    vod_name: "小丑",
    type_name: "剧情电影",
    vod_year: "2019",
    vod_area: "美国",
    vod_remarks: "高清",
    vod_score: "8.7",
    vod_pic: "/assets/images/joker.jpg",
    vod_actor: "华金·菲尼克斯",
    vod_director: "托德·菲利普斯",
    vod_content:
      "一条用于验证 CMS 分类、搜索和播放器返回路径的本地演示记录。",
    vod_play_from: "NOVA 开放测试线路",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/bunny/trailer.mp4"
  },
  {
    vod_id: "nova-4",
    vod_name: "浴血黑帮 第6季",
    type_name: "犯罪剧集",
    vod_year: "2022",
    vod_area: "英国",
    vod_remarks: "全 6 集",
    vod_score: "9.1",
    vod_pic: "/assets/images/peaky.jpg",
    vod_actor: "基里安·墨菲",
    vod_director: "安东尼·拜恩",
    vod_content:
      "用于验证剧集条目、详情接口以及首集播放选择的本地演示记录。",
    vod_play_from: "NOVA 剧集线路",
    vod_play_url:
      "第1集$https://media.w3.org/2010/05/sintel/trailer.mp4#第2集$https://media.w3.org/2010/05/video/movie_300.mp4#第3集$https://media.w3.org/2010/05/bunny/trailer.mp4"
  },
  {
    vod_id: "nova-5",
    vod_name: "龙猫",
    type_name: "动画电影",
    vod_year: "1988",
    vod_area: "日本",
    vod_remarks: "治愈",
    vod_score: "9.2",
    vod_pic: "/assets/images/totoro.jpg",
    vod_actor: "日高法子 / 坂本千夏",
    vod_director: "宫崎骏",
    vod_content:
      "用于验证动画分类和本地 CMS 数据规范化的演示条目。",
    vod_play_from: "NOVA 开放测试线路",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/bunny/trailer.mp4"
  },
  {
    vod_id: "nova-6",
    vod_name: "你的名字。",
    type_name: "动画电影",
    vod_year: "2016",
    vod_area: "日本",
    vod_remarks: "青春",
    vod_score: "8.5",
    vod_pic: "/assets/images/yourname.jpg",
    vod_actor: "神木隆之介 / 上白石萌音",
    vod_director: "新海诚",
    vod_content:
      "用于验证 TVBox 配置来源、苹果 CMS 分类和详情数据映射的演示条目。",
    vod_play_from: "NOVA 开放测试线路",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/bunny/trailer.mp4"
  },
  {
    // 采集站常见的二创条目：用来验证「结果过滤解说 / 速看 / 混剪」是否真的生效
    vod_id: "nova-7",
    vod_name: "星际穿越 电影解说（12 分钟看完）",
    type_name: "影视解说",
    vod_year: "2024",
    vod_area: "中国",
    vod_remarks: "二创 · 演示",
    vod_score: "8.1",
    vod_pic: "/assets/images/interstellar.jpg",
    vod_actor: "解说 UP 主",
    vod_director: "—",
    vod_content:
      "演示用二创条目：默认会被「设置 → 通用 → 结果过滤解说」挡掉，关掉开关后才会出现在片库里。",
    vod_play_from: "NOVA 开放测试线路",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/video/movie_300.mp4"
  },
  {
    // 两条线路，第一条故意 404：用来验证「播放失败自动切换线路」
    vod_id: "nova-8",
    vod_name: "双线路演示（自动切线路）",
    type_name: "犯罪剧集",
    vod_year: "2026",
    vod_area: "演示",
    vod_remarks: "2 条线路 · 第一条失效",
    vod_score: "—",
    vod_pic: "/assets/images/peaky.jpg",
    vod_actor: "NOVA 演示",
    vod_director: "—",
    vod_content:
      "验证线路聚合与自动切换：第一条线路指向不存在的地址，播放器会自动切到第二条可用线路。播放中按 N 可手动切下一条。",
    vod_play_from: "演示线路 A（失效）$$$演示线路 B（可用）",
    vod_play_url:
      "正片$https://media.w3.org/2010/05/video/not-found-demo.mp4$$$正片$https://media.w3.org/2010/05/sintel/trailer.mp4"
  }
];

function json(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  const buffer = Buffer.from(body);
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(buffer);
}

function isPrivateAddress(address) {
  const value = String(address || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (value.startsWith("::ffff:")) return isPrivateAddress(value.slice(7));
  if (isIP(value) === 4) {
    const parts = value.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(value) === 6) {
    return (
      value === "::" ||
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb")
    );
  }
  return false;
}

async function validateTarget(rawUrl) {
  const target = new URL(rawUrl);
  if (!/^https?:$/.test(target.protocol)) {
    throw new Error("代理只允许 http/https 地址");
  }
  if (target.username || target.password) {
    throw new Error("代理地址不能包含用户名或密码");
  }
  const hostname = target.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("代理禁止访问本机或内网地址");
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("代理禁止访问本机或内网地址");
    }
    return target;
  }
  // 走上游代理时由代理解析目标：本地 DNS 可能被污染，误判成内网会把正常站点全部挡掉
  if (upstreamProxyConfig()) return target;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("代理禁止访问解析到内网的主机");
  }
  return target;
}

function parseProxyHeaders(searchParams) {
  const encoded = searchParams.get("headers");
  if (!encoded || encoded.length > 4096) return {};
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    const headers = {};
    Object.entries(payload).forEach(([name, value]) => {
      const key = String(name).trim().toLowerCase();
      const headerValue = String(value ?? "").trim();
      if (!allowedIncomingHeaders.has(key)) return;
      if (!headerValue || headerValue.length > 2048) return;
      headers[key] = headerValue;
    });
    return headers;
  } catch {
    return {};
  }
}

function proxyUrlFor(targetUrl, encodedHeaders) {
  const proxy = new URL("/api/proxy", "http://127.0.0.1");
  proxy.searchParams.set("url", targetUrl);
  if (encodedHeaders) proxy.searchParams.set("headers", encodedHeaders);
  return `${proxy.pathname}${proxy.search}`;
}

function rewritePlaylist(body, finalUrl, encodedHeaders) {
  const rewrite = (rawValue) => {
    const value = rawValue.trim();
    if (!value || value.startsWith("data:") || value.startsWith("skd:")) return value;
    try {
      const absolute = new URL(value, finalUrl).href;
      return proxyUrlFor(absolute, encodedHeaders);
    } catch {
      return value;
    }
  };
  return body
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          return `URI="${rewrite(uri)}"`;
        });
      }
      return rewrite(line);
    })
    .join("\n");
}

async function readLimitedBody(response, limit) {
  const body = response?.body;
  if (!body) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;

  // 直连走 Web Stream（有 getReader），走代理隧道时是 Node Readable
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("远程响应超过预览代理大小限制");
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limit) {
      body.destroy?.();
      throw new Error("远程响应超过预览代理大小限制");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

// 上游代理（本机系统代理）。设 NOVA_UPSTREAM_PROXY="" 可强制直连。
function upstreamProxyConfig() {
  const raw = process.env.NOVA_UPSTREAM_PROXY ?? "http://127.0.0.1:10808";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return { host: url.hostname, port: Number(url.port) || 80 };
  } catch {
    return null;
  }
}

function proxyFetch(targetUrl, init = {}) {
  const proxy = upstreamProxyConfig();
  const url = new URL(targetUrl);
  if (!proxy || url.protocol !== "https:") {
    return fetch(url, init);
  }
  return new Promise((resolve, reject) => {
    const port = Number(url.port) || 443;
    const tunnel = http.request({
      host: proxy.host,
      port: proxy.port,
      method: "CONNECT",
      path: `${url.hostname}:${port}`,
      headers: {
        // 部分代理（Clash 等）按 Host 头判定目标，缺省会直接拒绝 CONNECT
        Host: `${url.hostname}:${port}`,
        "Proxy-Connection": "Keep-Alive"
      }
    });
    tunnel.once("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`代理连接失败：${res.statusCode}`));
        return;
      }
      const request = https.request(
        {
          host: url.hostname,
          port,
          path: `${url.pathname}${url.search}`,
          method: init.method || "GET",
          headers: init.headers || {},
          createConnection: () =>
            tls.connect({
              socket,
              servername: url.hostname,
              // 部分采集站证书链不完整，隧道里统一放开校验（仅本地预览代理）
              rejectUnauthorized: false,
              ALPNProtocols: ["http/1.1"]
            })
        },
        (upstream) => {
          resolve({
            status: upstream.statusCode,
            headers: { get: (name) => upstream.headers[String(name).toLowerCase()] ?? null },
            body: upstream
          });
        }
      );
      request.on("error", reject);
      if (init.signal) {
        init.signal.addEventListener("abort", () => request.destroy(new Error("AbortError")), { once: true });
      }
      request.end();
    });
    tunnel.once("error", reject);
    tunnel.end();
  });
}

async function handleProxy(request, response, requestUrl) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    json(response, 405, { error: "只支持 GET / HEAD" });
    return;
  }
  const rawTarget = requestUrl.searchParams.get("url");
  if (!rawTarget) {
    json(response, 400, { error: "缺少 url 参数" });
    return;
  }
  const headers = parseProxyHeaders(requestUrl.searchParams);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), proxyTimeoutMs);
  try {
    let target = await validateTarget(rawTarget);
    let upstream;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      upstream = await proxyFetch(target, {
        method: request.method,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          ...headers,
          // 部分采集站会拦空 UA（凤凰、电影天堂），统一补一个浏览器标识
          "user-agent":
            headers["user-agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          accept: headers.accept || "*/*",
          "accept-encoding": "identity",
          ...(request.headers.range ? { range: request.headers.range } : {})
        }
      });
      if (upstream.status < 300 || upstream.status >= 400) break;
      const location = upstream.headers.get("location");
      if (!location) break;
      if (redirects === 5) throw new Error("远程地址重定向次数过多");
      target = await validateTarget(new URL(location, target).href);
    }
    if (!upstream) throw new Error("远程请求没有返回响应");
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const isPlaylist =
      /mpegurl/i.test(contentType) ||
      /\.m3u8?(?:$|\?)/i.test(target.href);
    let body = request.method === "HEAD" ? Buffer.alloc(0) : await readLimitedBody(upstream, maxProxyBytes);
    const encodedHeaders = requestUrl.searchParams.get("headers") || "";
    const skipRewrite = requestUrl.searchParams.get("norewrite") === "1";
    if (isPlaylist && request.method !== "HEAD" && !skipRewrite) {
      body = Buffer.from(
        rewritePlaylist(body.toString("utf8"), target.href, encodedHeaders)
      );
    }
    response.writeHead(upstream.status, {
      "Content-Type": isPlaylist
        ? "application/vnd.apple.mpegurl; charset=utf-8"
        : contentType,
      "Content-Length": body.length,
      "Cache-Control": isPlaylist ? "no-store" : "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges, X-Nova-Proxy",
      ...(upstream.headers.get("content-range")
        ? { "Content-Range": upstream.headers.get("content-range") }
        : {}),
      ...(upstream.headers.get("accept-ranges")
        ? { "Accept-Ranges": upstream.headers.get("accept-ranges") }
        : {}),
      "X-Nova-Proxy": "1"
    });
    response.end(body);
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "远程请求超时"
        : error?.message || "远程请求失败";
    console.error(`[proxy] ${requestUrl.searchParams.get("url")} -> ${error?.code || ""} ${message}`);
    json(response, 502, { error: message });
  } finally {
    clearTimeout(timer);
  }
}

function demoConfig(origin) {
  return {
    name: "NOVA TVBox 兼容演示源",
    notice:
      "由 NOVA 本地预览服务提供的桩配置，用于验证 TVBox 订阅和 CMS 链路。内容不等于正式授权片库。",
    format: "tvbox-desktop/1",
    sites: [
      {
        key: "nova-demo-cms",
        name: "NOVA 开放演示 CMS",
        type: 3,
        api: `${origin}/api/demo/cms`,
        searchable: 1,
        quickSearch: 1,
        filterable: 1
      },
      {
        key: "nova-demo-html",
        name: "HTML 规则兼容样例",
        type: 1,
        api: `${origin}/api/demo/html?wd={wd}`,
        searchable: 1,
        rules: {
          list: ".result",
          name: ".title",
          link: "a@href",
          pic: "img@src",
          remarks: ".note",
          playList: ".episodes",
          playItem: "a@href"
        }
      },
      {
        key: "nova-demo-spider",
        name: "Spider 兼容性检查样例",
        type: 0,
        api: "csp_XMLDemo",
        jar: "demo.jar"
      }
    ],
    lives: [
      {
        name: "NOVA 演示直播",
        type: 0,
        url: `${origin}/api/demo/live.m3u`
      }
    ],
    parses: [
      {
        name: "演示解析占位（不会自动调用）",
        type: 1,
        url: `${origin}/api/demo/parse?url={url}`
      }
    ],
    flags: ["nova", "demo", "tvbox"],
    tvboxDesktop: {
      format: "tvbox-desktop/1",
      timeout: 20,
      home: {
        sections: [
          {
            title: "NOVA 本地演示",
            site: "nova-demo-cms",
            typeId: 1
          }
        ]
      }
    }
  };
}

function handleDemoApi(request, response, requestUrl) {
  if (requestUrl.pathname === "/api/demo/config.json") {
    const origin = `http://${request.headers.host || "127.0.0.1:4178"}`;
    json(response, 200, demoConfig(origin));
    return true;
  }
  if (requestUrl.pathname === "/api/demo/cms") {
    const ids = requestUrl.searchParams.get("ids");
    const keyword = (requestUrl.searchParams.get("wd") || "").trim().toLowerCase();
    let list = demoItems;
    if (ids) list = list.filter((item) => item.vod_id === ids);
    if (keyword) {
      list = list.filter((item) =>
        `${item.vod_name} ${item.vod_actor} ${item.vod_director} ${item.type_name}`
          .toLowerCase()
          .includes(keyword)
      );
    }
    const origin = `http://${request.headers.host || "127.0.0.1:4178"}`;
    const normalized = list.map((item) => ({
      ...item,
      vod_pic: item.vod_pic.startsWith("http")
        ? item.vod_pic
        : `${origin}${item.vod_pic}`
    }));
    json(response, 200, {
      code: 1,
      msg: "数据列表",
      page: 1,
      pagecount: 1,
      limit: 24,
      total: normalized.length,
      class: [
        { type_id: 1, type_name: "电影" },
        { type_id: 2, type_name: "剧集" },
        { type_id: 3, type_name: "动画" }
      ],
      list: normalized
    });
    return true;
  }
  if (requestUrl.pathname === "/api/demo/live.m3u") {
    const body = `#EXTM3U
#EXTINF:-1 tvg-name="NOVA 演示一台" group-title="演示",NOVA 演示一台
https://test-streams.mux.dev/pts_shift/master.m3u8
#EXTINF:-1 tvg-name="NOVA 演示二台" group-title="演示",NOVA 演示二台
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8
#EXTINF:-1 tvg-name="电影轮播" group-title="影视",电影轮播
https://test-streams.mux.dev/tos_ismc/main.m3u8
#EXTINF:-1 tvg-name="音乐现场" group-title="音乐",音乐现场
https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8
`;
    text(response, 200, body, "application/vnd.apple.mpegurl; charset=utf-8");
    return true;
  }
  if (requestUrl.pathname === "/api/demo/html") {
    const keyword = requestUrl.searchParams.get("wd") || "";
    text(
      response,
      200,
      `<!doctype html><html><body>
        <article class="result">
          <a href="/api/demo/cms?ac=detail&ids=nova-1"><span class="title">星际穿越${keyword ? ` · ${keyword}` : ""}</span></a>
          <img src="/assets/images/interstellar.jpg" />
          <span class="note">HTML 规则样例</span>
        </article>
      </body></html>`,
      "text/html; charset=utf-8"
    );
    return true;
  }
  if (requestUrl.pathname === "/api/demo/parse") {
    json(response, 501, {
      error: "演示解析接口不会自动调用，未接入真实解析服务"
    });
    return true;
  }
  return false;
}

async function serveStatic(request, response, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    text(response, 400, "Bad request");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const filePath = resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(root)) {
    text(response, 403, "Forbidden");
    return;
  }
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    text(response, 404, "Not found");
    return;
  }
  if (!stat.isFile()) {
    text(response, 404, "Not found");
    return;
  }
  const contentType =
    mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
  try {
    if (requestUrl.pathname === "/api/health") {
      json(response, 200, {
        ok: true,
        name: "NOVA TV Preview Server",
        proxy: "/api/proxy",
        demo: "/api/demo/config.json"
      });
      return;
    }
    if (requestUrl.pathname === "/api/proxy") {
      await handleProxy(request, response, requestUrl);
      return;
    }
    if (requestUrl.pathname.startsWith("/api/demo/")) {
      if (handleDemoApi(request, response, requestUrl)) return;
      json(response, 404, { error: "Unknown demo endpoint" });
      return;
    }
    await serveStatic(request, response, requestUrl);
  } catch (error) {
    json(response, 500, { error: error.message || "Internal server error" });
  }
});

function openBrowser(url) {
  if (process.env.NOVA_NO_OPEN === "1" || process.argv.includes("--no-open")) {
    return;
  }
  if (process.platform === "win32") {
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
    return;
  }
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

async function listenWithFallback(port, attemptsLeft = 8) {
  return new Promise((resolveListen, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      if (error.code === "EADDRINUSE" && attemptsLeft > 1) {
        resolveListen(listenWithFallback(port + 1, attemptsLeft - 1));
      } else {
        reject(error);
      }
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen(port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, HOST);
  });
}

try {
  const port = await listenWithFallback(startPort);
  const localUrl = `http://127.0.0.1:${port}/`;
  console.log(`NOVA TV preview: ${localUrl}`);
  console.log(`TVBox proxy:    ${localUrl}api/proxy`);
  if (HOST === "0.0.0.0") {
    const lan = lanAddress();
    if (lan) {
      console.log(`LAN:            http://${lan}:${port}/   ← 电视/手机浏览器用这个`);
    }
    console.log("监听 0.0.0.0：同局域网设备可访问（含代理与演示接口，仅在你信任的网络里这样跑）");
  }
  console.log("Press Ctrl+C to stop.");
  openBrowser(localUrl);
} catch (error) {
  console.error(`NOVA TV preview failed to start: ${error.message}`);
  process.exitCode = 1;
}
