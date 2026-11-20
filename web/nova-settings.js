/**
 * NOVA TV · 设置存储与校验
 *
 * 并发 / 超时 / User-Agent / 解说过滤 四项核心设置，外加界面开关。
 * 纯逻辑，不依赖 DOM，可在 Node 下测试（tools/verify-settings.mjs）。
 * 浏览器里通过 window.NovaSettings 使用。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.NovaSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const UA_DESKTOP =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const UA_TV =
    "Mozilla/5.0 (Linux; Android 11; Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const UI_TOGGLE_KEYS = ["showRecent", "musicLossless", "focusOutline", "showWeather", "autoplayNext"];

  const LIMITS = {
    concurrency: [1, 32],
    maxSites: [1, 32],
    timeout: [3, 120]
  };

  const DEFAULTS = {
    concurrency: 8,
    maxSites: 8,
    timeout: 20,
    filterCommentary: true,
    userAgent: UA_DESKTOP,
    showRecent: true,
    musicLossless: false,
    focusOutline: true,
    showWeather: true,
    autoplayNext: true
  };

  const PRESETS = {
    concurrency: [
      { id: "steady", label: "稳健", detail: "少站点，慢一点但更稳", patch: { concurrency: 4, maxSites: 6 } },
      { id: "standard", label: "标准", detail: "默认平衡", patch: { concurrency: 8, maxSites: 8 } },
      { id: "fast", label: "激进", detail: "多站点并发，速度快", patch: { concurrency: 16, maxSites: 16 } },
      { id: "max", label: "极速", detail: "吃满带宽", patch: { concurrency: 32, maxSites: 24 } }
    ],
    timeout: [
      { id: "quick", label: "快速", detail: "8 秒放弃", patch: { timeout: 8 } },
      { id: "standard", label: "标准", detail: "20 秒", patch: { timeout: 20 } },
      { id: "patient", label: "耐心", detail: "40 秒，慢源也能出结果", patch: { timeout: 40 } }
    ],
    userAgent: [
      { id: "desktop", label: "桌面浏览器", detail: "默认 UA", patch: { userAgent: UA_DESKTOP } },
      { id: "androidtv", label: "Android TV", detail: "部分源只对 TV 放行", patch: { userAgent: UA_TV } }
    ]
  };

  const PRESET_KIND_FIELD = {
    concurrency: "concurrency",
    timeout: "timeout",
    userAgent: "userAgent"
  };

  function clamp(value, [min, max]) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeNumber(value, fallback, limits) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return clamp(Math.round(number), limits);
  }

  function normalize(patch, base) {
    const next = { ...base };
    if (!patch || typeof patch !== "object") return next;

    if ("concurrency" in patch) next.concurrency = normalizeNumber(patch.concurrency, base.concurrency, LIMITS.concurrency);
    if ("maxSites" in patch) next.maxSites = normalizeNumber(patch.maxSites, base.maxSites, LIMITS.maxSites);
    if ("timeout" in patch) next.timeout = normalizeNumber(patch.timeout, base.timeout, LIMITS.timeout);

    if ("filterCommentary" in patch) next.filterCommentary = Boolean(patch.filterCommentary);

    if ("userAgent" in patch) {
      const ua = typeof patch.userAgent === "string" ? patch.userAgent.trim() : "";
      next.userAgent = ua || base.userAgent;
    }

    UI_TOGGLE_KEYS.forEach((key) => {
      if (key in patch) next[key] = Boolean(patch[key]);
    });

    return next;
  }

  function memoryStorage() {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value));
      },
      removeItem: (key) => {
        map.delete(key);
      }
    };
  }

  const STORAGE_KEY = "nova.settings.v1";

  function createStore(options = {}) {
    const storage = options.storage || (typeof window !== "undefined" ? window.localStorage : memoryStorage());
    const listeners = new Set();

    function read() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        return normalize(JSON.parse(raw), DEFAULTS);
      } catch {
        return { ...DEFAULTS };
      }
    }

    let current = read();

    function write(next) {
      current = next;
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {
        /* 存储满或隐私模式，保持在内存里 */
      }
      listeners.forEach((fn) => {
        try {
          fn(current);
        } catch {
          /* ignore */
        }
      });
    }

    return {
      get: () => ({ ...current }),
      patch(patch) {
        write(normalize(patch, current));
        return { ...current };
      },
      reset() {
        write({ ...DEFAULTS });
        return { ...current };
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      presetOf(kind) {
        const list = PRESETS[kind] || [];
        const field = PRESET_KIND_FIELD[kind];
        if (!field) return "";
        const hit = list.find((preset) => current[field] === preset.patch[field]);
        if (hit) return hit.id;
        return list[0]?.id || "";
      }
    };
  }

  function timeoutMs(settings) {
    const value = Number(settings?.timeout);
    if (!Number.isFinite(value) || value <= 0) {
      const fallback = Number.isFinite(value) ? 3000 : 20000;
      return clamp(value === 0 ? 3000 : fallback, LIMITS.timeout.map((n) => n * 1000));
    }
    return clamp(Math.round(value * 1000), [3000, 120000]);
  }

  // 二创/解说识别：分集标记优先，带集数的一律当作正片
  const EPISODE_HINT = /第\s*\d+\s*[集期话回]|全\s*\d+\s*集|\d+\s*集全/;
  const COMMENTARY_HINT = /解说|速看|混剪|讲解|影评|预告|盘点|吐槽|片段|高光|一口气/;

  function isCommentaryTitle(title) {
    const text = String(title || "").trim();
    if (!text) return false;
    if (EPISODE_HINT.test(text)) return false;
    return COMMENTARY_HINT.test(text);
  }

  function filterItems(items, settings) {
    const list = Array.isArray(items) ? items : [];
    if (!settings?.filterCommentary) return list;
    return list.filter((item) => !isCommentaryTitle(item?.title || item?.name || ""));
  }

  function describe(settings) {
    const value = settings || DEFAULTS;
    const uaLabel =
      value.userAgent === UA_TV
        ? "Android TV"
        : value.userAgent === UA_DESKTOP
          ? "桌面浏览器"
          : "自定义";
    return {
      concurrency: `${value.concurrency} 并发`,
      timeout: `${value.timeout} 秒`,
      userAgent: uaLabel,
      commentary: value.filterCommentary ? "已过滤解说" : "全部显示"
    };
  }

  // 默认单例：sources.js / app.js / pages.js 直接调 NovaSettings.get()
  const defaultStore = createStore();

  return {
    DEFAULTS,
    LIMITS,
    get: () => defaultStore.get(),
    patch: (next) => defaultStore.patch(next),
    reset: () => defaultStore.reset(),
    subscribe: (fn) => defaultStore.subscribe(fn),
    presetOf: (kind) => defaultStore.presetOf(kind),
    UA_DESKTOP,
    UA_TV,
    UI_TOGGLE_KEYS,
    PRESETS,
    createStore,
    memoryStorage,
    normalize,
    timeoutMs,
    isCommentaryTitle,
    filterItems,
    describe
  };
});
