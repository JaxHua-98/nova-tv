/**
 * NOVA TV · 站点级覆盖存储（site overrides）
 *
 * 设计对齐 tvbox-desktop 的 sites.ts：订阅里的站点只是「配置原文」，
 * 用户对单个站点的启停 / 改名 / 排序 / 超时 / 请求头 / 健康度 全部写在
 * 独立的覆盖表里，重新同步订阅时原文被覆盖，但用户改动不会丢。
 *
 * 双键匹配：NOVA 的站点 key 是 `${sourceId}::${originKey}`，换订阅地址后
 * sourceId 会变，只按 key 匹配会让用户设置全部失配。所以记录里同时存
 * originKey，按 key 找不到时回退到 originKey 匹配（取最后写入的一条）。
 *
 * 运行环境：浏览器（localStorage）与 Node（注入 storage）通用，无外部依赖。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NovaSiteOverrides = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "nova.siteOverrides.v1";

  /** 允许被覆盖的字段；其它字段一律丢弃，避免脏数据写进存储 */
  const EDITABLE = ["enabled", "order", "health", "timeout", "header", "name"];

  function memoryStorage() {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key)
    };
  }

  function defaultStorage() {
    try {
      if (typeof localStorage === "object" && localStorage) return localStorage;
    } catch (_) {
      /* 隐私模式 / 服务端渲染时 localStorage 会抛错，退回内存存储 */
    }
    return memoryStorage();
  }

  function sanitize(patch) {
    const out = {};
    if (!patch || typeof patch !== "object") return out;
    for (const field of EDITABLE) {
      if (!(field in patch)) continue;
      const value = patch[field];
      if (field === "enabled") {
        if (typeof value === "boolean") out.enabled = value;
      } else if (field === "order" || field === "timeout" || field === "health") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) out[field] = parsed;
      } else if (field === "name") {
        const text = String(value ?? "").trim();
        if (text) out.name = text;
      } else if (field === "header") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const header = {};
          Object.entries(value).forEach(([name, raw]) => {
            const key = String(name).trim();
            const headerValue = String(raw ?? "").trim();
            if (key && headerValue) header[key] = headerValue;
          });
          if (Object.keys(header).length) out.header = header;
        }
      }
    }
    return out;
  }

  function createStore(options = {}) {
    const storage = options.storage || defaultStorage();
    const storageKey = options.storageKey || STORAGE_KEY;
    let cache = null;

    function readAll() {
      if (cache) return cache;
      let parsed = {};
      try {
        const text = storage.getItem(storageKey);
        if (text) {
          const data = JSON.parse(text);
          if (data && typeof data === "object" && !Array.isArray(data)) parsed = data;
        }
      } catch (_) {
        parsed = {};
      }
      cache = parsed;
      return cache;
    }

    function persist(map) {
      cache = map;
      try {
        storage.setItem(storageKey, JSON.stringify(map));
      } catch (_) {
        /* 存储写满 / 被禁用时保持内存态，界面仍然可操作 */
      }
      return map;
    }

    /** 按 key 命中记录；未命中时回退到 originKey（跨订阅复用用户设置） */
    function lookup(site) {
      if (!site) return { override: null, key: "", via: "" };
      const map = readAll();
      const key = String(site.key || "").trim();
      if (key && map[key]) return { override: map[key], key, via: "key" };
      const originKey = String(site.originKey || "").trim();
      if (!originKey) return { override: null, key, via: "" };
      const candidates = Object.entries(map).filter(
        ([, record]) => record && record.originKey === originKey
      );
      if (!candidates.length) return { override: null, key, via: "" };
      const [hitKey, record] = candidates[candidates.length - 1];
      return { override: record, key: hitKey, via: "originKey" };
    }

    /**
     * 合并到站点对象上，返回一个新对象（不改入参）。
     * site.enabled 是配置里的默认值，override.enabled 是用户选择，后者优先。
     */
    function apply(site) {
      if (!site) return site;
      const { override, via } = lookup(site);
      const merged = { ...site };
      merged.enabled = typeof override?.enabled === "boolean" ? override.enabled : Boolean(site.enabled);
      merged.health = typeof override?.health === "number" ? override.health : site.health;
      if (override?.name) merged.name = override.name;
      if (typeof override?.timeout === "number") merged.timeout = override.timeout;
      if (override?.header) merged.header = { ...(site.header || {}), ...override.header };
      merged.order = typeof override?.order === "number" ? override.order : undefined;
      merged.overridden = Boolean(override);
      merged.overrideVia = via;
      return merged;
    }

    function patch(key, nextPatch, meta = {}) {
      const map = { ...readAll() };
      const cleanKey = String(key || "").trim();
      if (!cleanKey) return { override: null, key: "" };
      const merged = {
        ...(map[cleanKey] || {}),
        ...sanitize(nextPatch)
      };
      if (meta.originKey) merged.originKey = String(meta.originKey);
      if (meta.sourceId) merged.sourceId = String(meta.sourceId);
      merged.updatedAt = Date.now();
      map[cleanKey] = merged;
      persist(map);
      return { override: merged, key: cleanKey };
    }

    function patchMany(entries) {
      const map = { ...readAll() };
      entries.forEach(({ key, patch: nextPatch, originKey, sourceId }) => {
        const cleanKey = String(key || "").trim();
        if (!cleanKey) return;
        map[cleanKey] = {
          ...(map[cleanKey] || {}),
          ...sanitize(nextPatch),
          ...(originKey ? { originKey: String(originKey) } : {}),
          ...(sourceId ? { sourceId: String(sourceId) } : {}),
          updatedAt: Date.now()
        };
      });
      persist(map);
      return map;
    }

    function remove(key) {
      const map = { ...readAll() };
      const cleanKey = String(key || "").trim();
      if (!cleanKey || !(cleanKey in map)) return false;
      delete map[cleanKey];
      persist(map);
      return true;
    }

    function clear() {
      persist({});
      return true;
    }

    return {
      storageKey,
      readAll: () => ({ ...readAll() }),
      lookup,
      apply,
      patch,
      patchMany,
      remove,
      clear,
      counts() {
        const map = readAll();
        const records = Object.values(map);
        return {
          total: records.length,
          disabled: records.filter((record) => record?.enabled === false).length,
          ordered: records.filter((record) => typeof record?.order === "number").length,
          healthy: records.filter((record) => typeof record?.health === "number" && record.health >= 0).length
        };
      }
    };
  }

  const defaultStore = createStore();

  return {
    STORAGE_KEY,
    EDITABLE,
    createStore,
    memoryStorage,
    sanitize,
    // 默认单例：浏览器里直接操作 localStorage，测试里用 createStore 注入。
    apply: (site) => defaultStore.apply(site),
    lookup: (site) => defaultStore.lookup(site),
    patch: (key, patch, meta) => defaultStore.patch(key, patch, meta),
    patchMany: (entries) => defaultStore.patchMany(entries),
    remove: (key) => defaultStore.remove(key),
    clear: () => defaultStore.clear(),
    readAll: () => defaultStore.readAll(),
    counts: () => defaultStore.counts()
  };
});
