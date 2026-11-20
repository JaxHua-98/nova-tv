#!/usr/bin/env node
/**
 * NOVA TV 管理后台
 *
 *   node admin-server.mjs                 # http://127.0.0.1:4180/admin/
 *   node admin-server.mjs --port 4190
 *   node admin-server.mjs --data ../data/nova
 *
 * 只监听 127.0.0.1；写操作要 Bearer token（首次启动生成在 data/nova/token.txt）。
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStore, ensureToken } from "./admin/lib/store.mjs";
import { createNova } from "./admin/lib/nova.mjs";
import { createApi } from "./admin/lib/api.mjs";
import { createJobs } from "./admin/lib/jobs.mjs";
import { createInspector } from "./admin/lib/inspect.mjs";
import { proxyWithLimit, proxyStats } from "./admin/lib/proxy.mjs";
import { DEFAULT_SEEDS } from "./admin/lib/harvest.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function argOf(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const PORT = Number(argOf("port", process.env.NOVA_ADMIN_PORT || 4180));
const HOST = argOf("host", process.env.NOVA_ADMIN_HOST || "127.0.0.1");
const ALLOW_REMOTE_WRITE = process.argv.includes("--allow-remote-write");
const DATA_DIR = path.resolve(here, argOf("data", path.join("data", "nova")));
const WEB_DIR = path.join(here, "admin", "web");

fs.mkdirSync(DATA_DIR, { recursive: true });
const store = createStore(DATA_DIR);
const { token, created } = ensureToken(DATA_DIR);

// ---------- 载入数据 ----------
const sourcesFile = store.readJson("sources.json", { rev: 1, items: [] });
const sitesFile = store.readJson("sites.json", { rev: 1, items: {} });
const settingsFile = store.readJson("settings.json", {});
const parsesFile = store.readJson("parses.json", []);

const nova = createNova({
  sources: Array.isArray(sourcesFile.items) ? sourcesFile.items : Array.isArray(sourcesFile) ? sourcesFile : [],
  overrides: sitesFile.items || sitesFile || {},
  settings: settingsFile || {},
  parses: Array.isArray(parsesFile) ? parsesFile : parsesFile.items || []
});

const jobs = createJobs();
const metrics = { total: 0, byStatus: {}, latency: [] };
const state = {
  rev: Math.max(Number(sourcesFile.rev) || 1, Number(sitesFile.rev) || 1),
  candidates: store.readJson("candidates.json", { rev: 1, items: {} }),
  seeds: (store.readJson("harvest-seeds.json", { items: DEFAULT_SEEDS }).items || DEFAULT_SEEDS).map((s) => ({ ...s })),
  publish: store.readJson("publish.json", null),
  excludeRules: store.readJson("exclude.json", { rules: [] }).rules || [],
  lastWrite: null
};

const ctx = {
  version: "0.2.0",
  store,
  nova,
  jobs,
  metrics,
  state,
  token,
  allowRemoteWrite: ALLOW_REMOTE_WRITE,
  baseUrl: `http://127.0.0.1:${PORT}`,
  proxyStats
};

ctx.inspector = createInspector(ctx);

const api = createApi(ctx);

// ---------- 静态资源 ----------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function serveStatic(req, res, pathname) {
  let rel = pathname.replace(/^\/admin\/?/, "");
  if (!rel) rel = "index.html";
  const target = path.resolve(WEB_DIR, rel);
  if (!target.startsWith(WEB_DIR)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(target, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 " + rel);
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname;

  // 简单访问统计（不落盘，跟着进程走）
  res.on("finish", () => {
    metrics.total += 1;
    metrics.byStatus[res.statusCode] = (metrics.byStatus[res.statusCode] || 0) + 1;
    if (pathname.startsWith("/api/")) {
      metrics.latency.push(Date.now() - started);
      if (metrics.latency.length > 2000) metrics.latency.shift();
    }
  });

  // 发布地址要能被浏览器（TV 端）跨域拉取，预检直接放行
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, If-None-Match",
      "Access-Control-Max-Age": "600"
    });
    return res.end();
  }

  if (pathname === "/api/proxy") {
    return proxyWithLimit(req, res, url, {});
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/config/")) {
    try {
      await api.handle(req, res, url);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: String(error?.message || error) }));
      }
    }
    return;
  }

  if (pathname === "/" || pathname === "/admin") {
    res.writeHead(302, { Location: "/admin/" });
    return res.end();
  }

  if (pathname.startsWith("/admin/")) {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("NOVA TV admin");
});

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

function listen(port, attempt = 0) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attempt < 5) {
      console.log(`端口 ${port} 被占用，尝试 ${port + 1}`);
      listen(port + 1, attempt + 1);
      return;
    }
    console.error("启动失败:", error.message);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    const lan = HOST === "0.0.0.0" ? lanAddress() : "";
    ctx.baseUrl = `http://${lan || "127.0.0.1"}:${port}`;
    nova.setBaseUrl(`http://127.0.0.1:${port}`);
    const sources = nova.NovaSources.list();
    const sites = nova.NovaSources.listSites();
    console.log("");
    console.log("NOVA TV 管理后台");
    console.log(`  监听   ${HOST}:${port}${ALLOW_REMOTE_WRITE ? "（允许远程写）" : "（仅本机可写）"}`);
    console.log(`  地址   http://127.0.0.1:${port}/admin/`);
    if (lan) console.log(`  局域网 ${ctx.baseUrl}  ← TV / 手机端用这个拉订阅`);
    console.log(`  订阅   ${ctx.baseUrl}/config/<token>.json`);
    console.log(`  数据   ${DATA_DIR}`);
    console.log(`  规模   订阅 ${sources.length} · 站点 ${sites.length} · 候选 ${Object.keys(state.candidates.items || {}).length}`);
    console.log(`  token  ${token}${created ? "  (本次新生成)" : ""}`);
    if (created) {
      // 首次生成时顺手放进剪贴板，省得去翻文件
      try {
        const clip = spawn("cmd", ["/c", "clip"], { stdio: ["pipe", "ignore", "ignore"], windowsHide: true });
        clip.stdin.end(token);
        clip.on("error", () => {});
        console.log("         （已复制到剪贴板，直接 Ctrl+V 粘到后台页面左下角）");
      } catch (_) {
        /* 没有剪贴板就算了 */
      }
    }

    // 定时巡检：默认 6 小时；启动后 60 秒先跑一次，让看板立刻有数据
    const settings = nova.NovaSettings.get() || {};
    const hours = Number(settings.inspectIntervalHours) || 6;
    ctx.inspector.start(hours);
    console.log(`  巡检   每 ${hours} 小时一次（60 秒后跑首轮）`);
    const first = setTimeout(() => {
      ctx.inspector.runOnce({ limit: 40 }).catch((error) => {
        store.appendJsonl("inspect-runs.jsonl", { at: Date.now(), error: String(error?.message || error).slice(0, 200) });
      });
    }, 60000);
    if (first.unref) first.unref();
    console.log("");
  });
}

listen(PORT);
