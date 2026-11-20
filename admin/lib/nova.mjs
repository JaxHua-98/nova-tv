/**
 * NOVA TV 管理后台 · 复用层
 *
 * 直接 require 预览版的浏览器模块（UMD），靠最小 DOM 垫片让它们跑在 Node 里。
 * 好处：后台与前台共用同一份解析/判定/线路逻辑，不存在“后台说能用、TV 上跑不起来”。
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const previewDir = path.resolve(here, "..", "..");

const KEYS = {
  sources: "nova.tvbox.sources.v1",
  overrides: "nova.siteOverrides.v1",
  settings: "nova.settings.v1",
  parses: "nova.parses.v1"
};

function installShims(memory) {
  // 标记 headless：sources.js 会据此跳过「启动自动同步」这类浏览器专属行为
  globalThis.__NOVA_HEADLESS__ = true;
  const storage = {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
    clear: () => memory.clear(),
    key: (i) => Array.from(memory.keys())[i] ?? null,
    get length() {
      return memory.size;
    }
  };

  globalThis.localStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.window = globalThis;
  globalThis.self = globalThis;
  // 浏览器里 window 就是事件目标；Node 的 globalThis 没这些方法，补上空的
  if (typeof globalThis.addEventListener !== "function") globalThis.addEventListener = () => {};
  if (typeof globalThis.removeEventListener !== "function") globalThis.removeEventListener = () => {};
  if (typeof globalThis.dispatchEvent !== "function") globalThis.dispatchEvent = () => true;
  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
    body: { appendChild() {} },
    readyState: "complete"
  };
  if (!globalThis.CustomEvent) {
    globalThis.CustomEvent = class CustomEvent {
      constructor(type, opts) {
        this.type = type;
        this.detail = opts?.detail;
      }
    };
  }
  if (!globalThis.navigator) globalThis.navigator = { userAgent: "NOVA-Admin" };
  return storage;
}

let cached = null;

/** sources.js 会用 window.location 拼同源判断与代理地址，这里给一份可更新的 */
function applyBaseUrl(baseUrl) {
  const u = new URL(baseUrl);
  const location = {
    href: u.href,
    origin: u.origin,
    protocol: u.protocol,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: "/",
    search: "",
    hash: "",
    toString() {
      return u.href;
    }
  };
  globalThis.location = location;
  if (globalThis.window) globalThis.window.location = location;
  return location;
}

/**
 * @param {{ sources?: any[], overrides?: any, settings?: any, parses?: any[] }} seed 从磁盘读到的数据
 */
export function createNova(seed = {}) {
  const memory = new Map();
  memory.set(KEYS.sources, JSON.stringify(seed.sources ?? []));
  memory.set(KEYS.overrides, JSON.stringify(seed.overrides ?? {}));
  memory.set(KEYS.settings, JSON.stringify(seed.settings ?? {}));
  memory.set(KEYS.parses, JSON.stringify(seed.parses ?? []));

  installShims(memory);
  applyBaseUrl(seed.baseUrl || "http://127.0.0.1:4180");

  const load = (f) => require(path.join(previewDir, f));
  load("site-overrides.js");
  load("site-health.js");
  load("nova-settings.js");
  load("lines.js");
  load("presets.js");
  load("sources.js");

  const api = {
    NovaSources: globalThis.NovaSources,
    NovaSettings: globalThis.NovaSettings,
    NovaSiteOverrides: globalThis.NovaSiteOverrides,
    NovaLines: globalThis.NovaLines,
    NovaPresets: globalThis.NovaPresets,
    NovaSiteHealth: globalThis.NovaSiteHealth,
    memory,
    keys: KEYS,
    setBaseUrl(baseUrl) {
      applyBaseUrl(baseUrl);
    },
    readKey(name) {
      const raw = memory.get(KEYS[name]);
      if (!raw) return name === "overrides" || name === "settings" ? {} : [];
      try {
        return JSON.parse(raw);
      } catch (_) {
        return name === "overrides" || name === "settings" ? {} : [];
      }
    },
    /** 把内存里的四个 key 读出来，交给调用方落盘 */
    snapshot() {
      return {
        sources: api.readKey("sources"),
        overrides: api.readKey("overrides"),
        settings: api.readKey("settings"),
        parses: api.readKey("parses")
      };
    }
  };

  if (!api.NovaSources) throw new Error("sources.js 未导出 NovaSources");
  cached = api;
  return api;
}

export function getNova() {
  if (!cached) throw new Error("NovaCtx 尚未初始化");
  return cached;
}

export { KEYS, previewDir };
