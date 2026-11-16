(() => {
  "use strict";

  const STORAGE_KEY = "nova.tvbox.sources.v1";
  const DEMO_SOURCE_ID = "nova-demo-tvbox";
  const CHANGE_EVENT = "nova:sources-changed";
  const REQUEST_TIMEOUT = 22000;
  const FALLBACK_IMAGES = [
    "./assets/images/dune.jpg",
    "./assets/images/interstellar.jpg",
    "./assets/images/joker.jpg",
    "./assets/images/peaky.jpg",
    "./assets/images/totoro.jpg",
    "./assets/images/lostyou.jpg",
    "./assets/images/avengers.jpg",
    "./assets/images/yourname.jpg"
  ];
  const CONTENT_TYPE_LABELS = {
    0: "Spider",
    1: "HTML 规则",
    2: "未知类型",
    3: "苹果 CMS",
    4: "CMS 变体"
  };
  const PUBLIC_SITE_ADAPTERS = [
    {
      id: "4kcz",
      label: "厂长资源网页直连",
      siteName: "厂长资源",
      baseUrl: "https://www.4kcz.com/",
      apiPatterns: [/^csp_NewCzGuard$/i],
      originKeys: ["厂长"]
    }
  ];
  const STRING_TYPE_MAP = {
    cms: 3,
    maccms: 3,
    apple: 3,
    apples: 3,
    "苹果cms": 3,
    api: 4,
    json: 4,
    html: 1,
    web: 1,
    rule: 1,
    rules: 1,
    page: 1,
    spider: 0,
    jar: 0,
    aggregate: 0,
    other: 2
  };

  let sources = [];
  let revision = 0;
  let liveCache = null;
  let libraryCache = new Map();
  const listeners = new Set();

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function safeString(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    return String(value).trim();
  }

  function safeFlag(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    const number = Number(value);
    if (Number.isFinite(number)) return number !== 0;
    return /^(true|yes|on|1)$/i.test(String(value));
  }

  function timeoutMilliseconds(value, fallback = REQUEST_TIMEOUT) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
  }

  function shortHash(input) {
    let hash = 0x811c9dc5;
    const text = String(input ?? "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  function makeId(prefix = "src") {
    if (window.crypto?.randomUUID) {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeApi(raw) {
    const api = safeString(raw);
    if (!api) return "";
    if (/^https?:\/\//i.test(api)) return api;
    if (/^(\/|\.\/|\.\.\/)/.test(api)) return api;
    if (/^(proxy|file|assets|clan|to):\/\//i.test(api)) return api;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(api)) return `https://${api}`;
    return api;
  }

  function normalizeType(raw, api, rules) {
    if (typeof raw === "number" && [0, 1, 2, 3, 4].includes(raw)) return raw;
    if (typeof raw === "string") {
      const key = raw.trim().toLowerCase();
      if (key) {
        if (STRING_TYPE_MAP[key] !== undefined) return STRING_TYPE_MAP[key];
        const number = Number(key);
        if (Number.isInteger(number) && number >= 0 && number <= 4) return number;
        return 2;
      }
    }
    if (rules && (rules.list || rules.search)) return 1;
    if (/provide\/vod|api\.php|\/vod\//i.test(api)) return 3;
    return api ? 4 : 2;
  }

  function adapterDefinitionFor(id) {
    return PUBLIC_SITE_ADAPTERS.find((adapter) => adapter.id === id) || null;
  }

  function detectSiteAdapter(api, originKey, name) {
    const value = safeString(api);
    const key = safeString(originKey);
    const siteName = safeString(name);
    return (
      PUBLIC_SITE_ADAPTERS.find((adapter) => {
        if (adapter.apiPatterns.some((pattern) => pattern.test(value))) return true;
        return (
          adapter.originKeys.includes(key) &&
          /(?:csp_|\.js(?:$|[?#])|spider)/i.test(value)
        );
      }) ||
      (siteName.includes("厂长") &&
      /csp_NewCzGuard/i.test(value)
        ? adapterDefinitionFor("4kcz")
        : null)
    );
  }

  function runtimeRequirementForApi(api, jar) {
    const value = safeString(api);
    if (/^csp_[a-z0-9_.:-]+$/i.test(value)) {
      return "API 指向 csp_* Spider 类，需要配套 JS/Spider 引擎执行";
    }
    let pathname = value;
    try {
      pathname = new URL(value, window.location.href).pathname;
    } catch (_) {
      // Keep the raw value for relative provider references.
    }
    if (/\.(?:js|jar|dex|py)(?:$|[?#])/i.test(`${value} ${pathname}`)) {
      return "API 指向脚本文件，需要动态加载 Spider 代码后才能执行";
    }
    if (
      value &&
      !/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(value)
    ) {
      return "API 不是可直接请求的 HTTP(S) 地址，而是 Spider/私有协议标识";
    }
    if (safeString(jar)) {
      return "站点声明了 jar 依赖，需要 Android Spider 内核才能执行";
    }
    return "";
  }

  function normalizeRules(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const pick = (...keys) => {
      for (const key of keys) {
        const value = safeString(raw[key]);
        if (value) return value;
      }
      return undefined;
    };
    const rules = {
      list: pick("list", "vodList", "listRule"),
      name: pick("name", "vodName", "title"),
      link: pick("link", "vodLink", "href"),
      pic: pick("pic", "vodPic", "image"),
      remarks: pick("remarks", "vodRemarks", "note"),
      search: pick("search", "searchUrl"),
      detailName: pick("detailName"),
      detailContent: pick("detailContent", "content"),
      playList: pick("playList", "playFrom"),
      playItem: pick("playItem", "playUrl")
    };
    Object.keys(rules).forEach((key) => {
      if (!rules[key]) delete rules[key];
    });
    return Object.keys(rules).length ? rules : undefined;
  }

  function normalizeHeaderMap(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const output = {};
    Object.entries(raw).forEach(([key, value]) => {
      const name = safeString(key);
      const headerValue = safeString(value);
      if (name && headerValue) output[name] = headerValue;
    });
    return output;
  }

  function normalizeHeaderRules(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const host = safeString(item.host);
        const header = normalizeHeaderMap(item.header);
        if (!host || !Object.keys(header).length) return null;
        return { host, header };
      })
      .filter(Boolean);
  }

  function normalizeLives(raw, sourceUrl) {
    if (!Array.isArray(raw)) return [];
    const output = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const url = safeString(item);
        if (url) {
          output.push({
            name: "直播源",
            type: 0,
            url: absolutize(url, sourceUrl),
            epg: undefined
          });
        }
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const url = safeString(item.url);
      if (!url || /^(proxy|assets|clan|file|to):/i.test(url)) continue;
      output.push({
        name: safeString(item.name, "直播源"),
        type: item.type ?? 0,
        url: absolutize(url, sourceUrl),
        epg: item.epg ? safeString(item.epg) : undefined
      });
    }
    return output;
  }

  function normalizeParses(raw, sourceUrl) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const url = safeString(item.url);
        if (!url) return null;
        return {
          name: safeString(item.name, "未命名解析"),
          type: Number(item.type ?? 1) || 1,
          url: absolutize(url, sourceUrl),
          ext: item.ext
        };
      })
      .filter(Boolean);
  }

  function normalizeHome(raw) {
    if (!raw || typeof raw !== "object") return undefined;
    const sections = Array.isArray(raw.sections)
      ? raw.sections
          .map((section) => {
            if (!section || typeof section !== "object") return null;
            const title = safeString(section.title);
            const site = safeString(section.site);
            if (!title && !site) return null;
            return {
              title: title || site,
              site,
              typeId: section.typeId ?? section.type_id ?? undefined
            };
          })
          .filter(Boolean)
      : [];
    return sections.length ? { sections } : undefined;
  }

  function parseConfig(rawInput, context = {}) {
    const raw =
      rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
        ? rawInput
        : {};
    const sourceId = context.sourceId || "source";
    const sourceName = context.sourceName || safeString(raw.name, "未命名配置");
    const sourceUrl = context.sourceUrl || "";
    const extension =
      raw.tvboxDesktop && typeof raw.tvboxDesktop === "object"
        ? raw.tvboxDesktop
        : {};
    const settings =
      raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    const defaultHeaders = {
      ...normalizeHeaderMap(settings.header),
      ...normalizeHeaderMap(raw.header)
    };
    const rawSites = Array.isArray(raw.sites) ? raw.sites : [];
    const seenKeys = new Set();
    const sites = [];

    rawSites.forEach((input) => {
      if (!input || typeof input !== "object") return;
      const name = safeString(input.name ?? input.title);
      const rawApi = normalizeApi(input.api ?? input.url ?? input.ext?.api);
      const api =
        sourceUrl && /^(\/|\.\/|\.\.\/)/.test(rawApi)
          ? absolutize(rawApi, sourceUrl)
          : rawApi;
      if (!name && !api) return;
      const rules = normalizeRules(input.rules ?? input.ext?.rules);
      const type = normalizeType(input.type, api, rules);
      const originKey = safeString(
        input.key ?? input.id ?? `site_${shortHash(`${name}|${api}`)}`
      );
      const adapter = detectSiteAdapter(api, originKey, name);
      let key = `${sourceId}::${originKey}`;
      if (seenKeys.has(key)) key = `${key}::${shortHash(`${name}|${api}`)}`;
      seenKeys.add(key);
      const runtimeRequirement = runtimeRequirementForApi(api, input.jar);
      let unsupported = adapter ? "" : runtimeRequirement;
      let runtimeKind = adapter
        ? "adapter"
        : runtimeRequirement
          ? "provider"
          : "direct";
      if (!api || /^(proxy|assets|file|clan|to):/i.test(api)) {
        unsupported = "依赖内置 Spider、本地资源或私有协议，当前预览版不能直接请求";
        runtimeKind = "provider";
      } else if (type === 0) {
        unsupported = "需要配套 Spider（jar/dex），Android Spider 内核尚未接入";
        runtimeKind = "spider";
      } else if (type === 2) {
        unsupported = unsupported || "未知站点类型，无法判断接口协议";
        runtimeKind = unsupported ? runtimeKind : "unknown";
      }
      sites.push({
        key,
        originKey,
        name: name || originKey,
        type,
        typeLabel: CONTENT_TYPE_LABELS[type],
        api,
        ext:
          typeof input.ext === "string"
            ? input.ext
            : input.ext
              ? JSON.stringify(input.ext)
              : undefined,
        jar: safeString(input.jar) || undefined,
        searchable: !unsupported && safeFlag(input.searchable, true),
        quickSearch:
          !unsupported && safeFlag(input.quickSearch, safeFlag(input.searchable, true)),
        filterable:
          !unsupported && safeFlag(input.filterable, type === 3 || type === 4),
        header: {
          ...defaultHeaders,
          ...normalizeHeaderMap(input.header)
        },
        adapter: adapter?.id,
        adapterLabel: adapter?.label,
        adapterBaseUrl: adapter?.baseUrl,
        requiresSpider: Boolean(runtimeRequirement),
        timeout: Number(input.timeout) || Number(extension.timeout) || 20,
        sourceId,
        sourceName,
        enabled: safeFlag(input.enabled, true),
        rules,
        runtimeKind,
        unsupported: unsupported || undefined
      });
    });

    const lives = normalizeLives(raw.lives, sourceUrl);
    const parses = normalizeParses(raw.parses, sourceUrl);
    const headers = normalizeHeaderRules(raw.headers ?? settings.headers);
    const flags = Array.isArray(raw.flags) ? raw.flags.map(String) : [];
    const home = normalizeHome(raw.home ?? extension.home);
    const format =
      safeString(raw.format) ||
      safeString(extension.format) ||
      (raw.tvboxDesktop ? "tvbox-desktop/1" : "TVBox A");
    const cmsSites = sites.filter(
      (site) =>
        !site.unsupported &&
        site.runtimeKind !== "adapter" &&
        (site.type === 3 || site.type === 4)
    );
    const htmlSites = sites.filter(
      (site) =>
        !site.unsupported &&
        site.runtimeKind !== "adapter" &&
        site.type === 1
    );
    const adaptedSites = sites.filter(
      (site) => !site.unsupported && site.runtimeKind === "adapter"
    );
    const spiderSites = sites.filter((site) => site.type === 0);
    const providerSites = sites.filter(
      (site) => site.type !== 0 && site.requiresSpider
    );
    const unknownSites = sites.filter((site) => site.type === 2);
    const warnings = [];
    if (spiderSites.length) {
      warnings.push(
        `${spiderSites.length} 个 Spider 站点已识别，但预览版不会运行 jar/dex`
      );
    }
    if (unknownSites.length) {
      warnings.push(`${unknownSites.length} 个站点类型未知，已跳过执行`);
    }
    if (providerSites.length) {
      warnings.push(
        `${providerSites.length} 个站点使用 csp_* / JS Spider 标识，预览版不执行其私有内核${
          adaptedSites.length
            ? `；其中 ${adaptedSites.length} 个已启用公开网页兼容直连`
            : ""
        }`
      );
    }
    if (
      !lives.length &&
      !cmsSites.length &&
      !htmlSites.length &&
      !adaptedSites.length
    ) {
      warnings.push("配置中没有当前可执行的直播源或影视站点");
    }
    if (headers.some((rule) => rule.header.Cookie || rule.header.cookie)) {
      warnings.push("配置包含 Cookie 请求头；界面会脱敏，代理默认不透传敏感 Cookie");
    }
    const compatibility = {
      format,
      dialect: /tvbox-desktop/i.test(format) ? "B" : "A",
      executableSites: cmsSites.length + htmlSites.length + adaptedSites.length,
      cmsSites: cmsSites.length,
      htmlSites: htmlSites.length,
      adaptedSites: adaptedSites.length,
      spiderSites: spiderSites.length,
      providerSites: providerSites.length,
      unknownSites: unknownSites.length,
      liveSources: lives.length,
      parses: parses.length,
      headerRules: headers.length,
      flags: flags.length,
      hasHome: Boolean(home?.sections?.length),
      status:
        cmsSites.length || lives.length || htmlSites.length || adaptedSites.length
          ? spiderSites.length ||
            providerSites.length ||
            unknownSites.length ||
            (lives.length &&
              !cmsSites.length &&
              !htmlSites.length &&
              !adaptedSites.length)
            ? "partial"
            : "ready"
          : "limited",
      warnings
    };
    return {
      name: safeString(raw.name ?? extension.name, sourceName),
      notice: raw.notice ? safeString(raw.notice) : undefined,
      defaultHeaders,
      sites,
      lives,
      parses,
      flags,
      headers,
      home,
      compatibility
    };
  }

  function parseLooseJson(input) {
    if (input && typeof input === "object") return input;
    let text = String(input ?? "").replace(/^\uFEFF/, "").trim();
    if (!text) throw new Error("配置内容为空");
    try {
      return JSON.parse(text);
    } catch (_) {
      let output = "";
      let inString = false;
      let escaped = false;
      let lineComment = false;
      let blockComment = false;
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];
        if (lineComment) {
          if (char === "\n" || char === "\r") {
            lineComment = false;
            output += char;
          }
          continue;
        }
        if (blockComment) {
          if (char === "*" && next === "/") {
            blockComment = false;
            index += 1;
          }
          continue;
        }
        if (!inString && char === "/" && next === "/") {
          lineComment = true;
          index += 1;
          continue;
        }
        if (!inString && char === "/" && next === "*") {
          blockComment = true;
          index += 1;
          continue;
        }
        output += char;
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
        } else if (char === '"') {
          inString = true;
        }
      }
      output = output.replace(/,\s*([}\]])/g, "$1").trim();
      try {
        return JSON.parse(output);
      } catch (error) {
        const first = output.indexOf("{");
        const last = output.lastIndexOf("}");
        if (first >= 0 && last > first) {
          return JSON.parse(output.slice(first, last + 1));
        }
        throw new Error(`JSON 解析失败：${error.message}`);
      }
    }
  }

  function demoRawConfig() {
    return {
      name: "NOVA TVBox 兼容演示源",
      notice: "本地桩配置，仅用于验证订阅导入、CMS 片库和 M3U 直播链路。",
      format: "tvbox-desktop/1",
      sites: [
        {
          key: "nova-demo-cms",
          name: "NOVA 开放演示 CMS",
          type: 3,
          api: "/api/demo/cms",
          searchable: 1,
          quickSearch: 1,
          filterable: 1
        },
        {
          key: "nova-demo-html",
          name: "HTML 规则兼容样例",
          type: 1,
          api: "/api/demo/html?wd={wd}",
          searchable: 1,
          rules: {
            list: ".result",
            name: ".title",
            link: "a@href",
            pic: "img@src",
            remarks: ".note"
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
          url: "/api/demo/live.m3u"
        }
      ],
      parses: [
        {
          name: "演示解析占位（不会自动调用）",
          type: 1,
          url: "/api/demo/parse?url={url}"
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

  function createSource(raw, options = {}) {
    const id = options.id || makeId();
    const kind = options.kind || "file";
    const name =
      safeString(options.name) ||
      safeString(raw?.name) ||
      (kind === "url" ? "远程 TVBox 订阅" : "本地 TVBox 配置");
    const url = safeString(options.url);
    const parsed = parseConfig(raw, {
      sourceId: id,
      sourceName: name,
      sourceUrl: url
    });
    return {
      id,
      name,
      url,
      kind,
      enabled: options.enabled !== false,
      createdAt: options.createdAt || Date.now(),
      lastSync: options.lastSync || 0,
      error: options.error || "",
      raw,
      parsed
    };
  }

  function createDemoSource() {
    const raw = demoRawConfig();
    return createSource(raw, {
      id: DEMO_SOURCE_ID,
      kind: "demo",
      name: raw.name,
      url: "/api/demo/config.json",
      enabled: true,
      lastSync: Date.now()
    });
  }

  function loadSources() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) {
        sources = stored
          .filter(
            (source) =>
              source &&
              typeof source === "object" &&
              safeString(source.id) &&
              source.parsed &&
              Array.isArray(source.parsed.sites)
          )
          .map((source) => {
            if (!source.raw || typeof source.raw !== "object") return source;
            try {
              const reparsed = createSource(source.raw, {
                id: source.id,
                kind: source.kind,
                name: source.name,
                url: source.url,
                enabled: source.enabled,
                createdAt: source.createdAt,
                lastSync: source.lastSync,
                error: source.error
              });
              if (source.runtime) reparsed.runtime = source.runtime;
              return reparsed;
            } catch (_) {
              return source;
            }
          });
      }
    } catch (_) {
      sources = [];
    }
    if (!sources.length) sources = [createDemoSource()];
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
      return true;
    } catch (error) {
      try {
        const compact = sources.map((source) => ({
          ...source,
          raw: {
            name: source.raw?.name,
            format: source.raw?.format,
            tvboxDesktop: source.raw?.tvboxDesktop
          }
        }));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
        return true;
      } catch (_) {
        console.warn("NOVA source storage is full", error);
        return false;
      }
    }
  }

  function notify(reason = "update") {
    revision += 1;
    liveCache = null;
    libraryCache.clear();
    const detail = { reason, revision, sources: clone(sources) };
    listeners.forEach((listener) => {
      try {
        listener(detail);
      } catch (error) {
        console.warn("NOVA source listener failed", error);
      }
    });
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));
  }

  function listSources() {
    return clone(sources);
  }

  function getSource(id) {
    const source = sources.find((item) => item.id === id);
    return source ? clone(source) : null;
  }

  function getEnabledSources() {
    return clone(sources.filter((source) => source.enabled));
  }

  function sourceView(source) {
    if (!source) return null;
    return {
      ...source,
      parsed: source.parsed,
      compatibility: source.parsed.compatibility
    };
  }

  function upsertRawSource(raw, options = {}) {
    const source = createSource(raw, options);
    const existingIndex = sources.findIndex((item) => item.id === source.id);
    if (existingIndex >= 0) sources[existingIndex] = source;
    else sources.unshift(source);
    persist();
    notify("add");
    return clone(source);
  }

  function importJson(text, options = {}) {
    const raw = parseLooseJson(text);
    return upsertRawSource(raw, {
      name: options.name,
      kind: options.kind || "file",
      url: options.url || "",
      enabled: true
    });
  }

  async function addRemote(url, options = {}) {
    const cleanUrl = safeString(url);
    if (!/^https?:\/\//i.test(cleanUrl)) {
      throw new Error("订阅地址必须以 http:// 或 https:// 开头");
    }
    const source = createSource(
      {
        name: options.name || "远程 TVBox 订阅",
        sites: [],
        lives: [],
        parses: []
      },
      {
        kind: "url",
        name: options.name || "远程 TVBox 订阅",
        url: cleanUrl,
        enabled: true
      }
    );
    sources.unshift(source);
    persist();
    notify("add-pending");
    try {
      return await syncSource(source.id);
    } catch (error) {
      return getSource(source.id);
    }
  }

  function toggleSource(id, enabled) {
    const source = sources.find((item) => item.id === id);
    if (!source) return null;
    source.enabled =
      typeof enabled === "boolean" ? enabled : !source.enabled;
    persist();
    notify("toggle");
    return clone(source);
  }

  function removeSource(id) {
    const before = sources.length;
    sources = sources.filter((source) => source.id !== id);
    if (sources.length === before) return false;
    persist();
    notify("remove");
    return true;
  }

  function restoreDemo() {
    sources = sources.filter((source) => source.id !== DEMO_SOURCE_ID);
    sources.unshift(createDemoSource());
    persist();
    notify("restore-demo");
    return getSource(DEMO_SOURCE_ID);
  }

  function sameOrigin(url) {
    return (
      window.location.protocol !== "file:" &&
      new URL(url, window.location.href).origin === window.location.origin
    );
  }

  function utf8ToBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return window.btoa(binary);
  }

  function proxySafeHeaders(headers) {
    const blocked = new Set([
      "cookie",
      "set-cookie",
      "authorization",
      "proxy-authorization",
      "host"
    ]);
    const output = {};
    Object.entries(headers || {}).forEach(([name, value]) => {
      const key = safeString(name);
      const headerValue = safeString(value);
      if (!key || !headerValue || blocked.has(key.toLowerCase())) return;
      if (headerValue.length > 2048) return;
      output[key] = headerValue;
    });
    return output;
  }

  function proxyUrl(url, headers = {}) {
    const target = new URL(url, window.location.href);
    if (window.location.protocol === "file:") {
      throw new Error("远程内容源需要通过 start-preview.cmd 启动本地预览服务");
    }
    const proxy = new URL("/api/proxy", window.location.origin);
    proxy.searchParams.set("url", target.href);
    const safeHeaders = proxySafeHeaders(headers);
    if (Object.keys(safeHeaders).length) {
      proxy.searchParams.set("headers", utf8ToBase64(JSON.stringify(safeHeaders)));
    }
    return proxy.href;
  }

  async function fetchText(url, options = {}) {
    const target = new URL(url, window.location.href);
    let requestUrl = target.href;
    const headers = proxySafeHeaders(options.headers);
    if (!sameOrigin(target.href)) requestUrl = proxyUrl(target.href, headers);
    const controller = new AbortController();
    const timeoutMs = timeoutMilliseconds(options.timeout, REQUEST_TIMEOUT);
    const timer = window.setTimeout(
      () => controller.abort(),
      timeoutMs
    );
    try {
      const response = await window.fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
        headers:
          sameOrigin(target.href) && Object.keys(headers).length
            ? headers
            : undefined
      });
      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = payload?.error || payload?.detail || "";
        } catch (_) {
          detail = "";
        }
        throw new Error(
          `请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ""}`
        );
      }
      return await response.text();
    } catch (error) {
      if (error.name === "AbortError") {
        if (controller.signal.aborted) {
          throw new Error("请求超时，请检查网络或订阅地址");
        }
        throw new Error(`请求被意外中断${error.message ? `：${error.message}` : ""}`);
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function headerForUrl(url, aggregateConfig = null) {
    const target = new URL(url, window.location.href);
    const headers = {};
    const configs = aggregateConfig
      ? [aggregateConfig]
      : aggregate().configs;
    configs.forEach((config) => {
      Object.assign(headers, config.defaultHeaders || {});
      (config.headerRules || []).forEach((rule) => {
        const host = safeString(rule.host);
        if (!host) return;
        if (
          target.hostname === host ||
          target.hostname.endsWith(`.${host}`) ||
          new RegExp(host.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).test(
            target.href
          )
        ) {
          Object.assign(headers, rule.header);
        }
      });
    });
    return headers;
  }

  function aggregate() {
    const enabled = sources.filter((source) => source.enabled);
    const sites = [];
    const lives = [];
    const parses = [];
    const configs = [];
    const seenSites = new Set();
    const seenLives = new Set();
    const seenParses = new Set();
    let errorCount = 0;

    enabled.forEach((source) => {
      const parsed = source.parsed || {};
      if (source.error) errorCount += 1;
      configs.push({
        sourceId: source.id,
        sourceName: source.name,
        defaultHeaders: parsed.defaultHeaders || {},
        headerRules: parsed.headers || []
      });
      (parsed.sites || []).forEach((site) => {
        if (seenSites.has(site.key)) return;
        seenSites.add(site.key);
        sites.push({
          ...site,
          sourceId: source.id,
          sourceName: source.name,
          sourceEnabled: source.enabled
        });
      });
      (parsed.lives || []).forEach((live) => {
        const key = live.url;
        if (!key || seenLives.has(key)) return;
        seenLives.add(key);
        lives.push({
          ...live,
          sourceId: source.id,
          sourceName: source.name
        });
      });
      (parsed.parses || []).forEach((parse) => {
        const key = `${parse.type}|${parse.url}`;
        if (!key || seenParses.has(key)) return;
        seenParses.add(key);
        parses.push({
          ...parse,
          sourceId: source.id,
          sourceName: source.name
        });
      });
    });

    const supportedSites = sites.filter((site) => !site.unsupported);
    return {
      sources: clone(enabled),
      sites: clone(sites),
      supportedSites: clone(supportedSites),
      lives: clone(lives),
      parses: clone(parses),
      configs,
      revision,
      stats: {
        enabledSources: enabled.length,
        totalSources: sources.length,
        errors: errorCount,
        sites: sites.length,
        supportedSites: supportedSites.length,
        cmsSites: supportedSites.filter(
          (site) =>
            site.runtimeKind !== "adapter" &&
            (site.type === 3 || site.type === 4)
        ).length,
        htmlSites: supportedSites.filter(
          (site) => site.runtimeKind !== "adapter" && site.type === 1
        ).length,
        adaptedSites: supportedSites.filter(
          (site) => site.runtimeKind === "adapter"
        ).length,
        spiderSites: sites.filter((site) => site.type === 0).length,
        providerSites: sites.filter(
          (site) => site.type !== 0 && site.requiresSpider
        ).length,
        liveSources: lives.length,
        parses: parses.length
      }
    };
  }

  async function syncSource(id, options = {}) {
    const index = sources.findIndex((source) => source.id === id);
    if (index < 0) throw new Error("内容源不存在");
    const source = sources[index];
    try {
      let raw;
      if (source.kind === "demo") {
        try {
          raw = parseLooseJson(
            await fetchText("/api/demo/config.json", {
              timeout: 8000
            })
          );
        } catch (_) {
          raw = demoRawConfig();
        }
      } else if (source.kind === "url" && source.url) {
        const text = await fetchText(source.url, {
          headers: headerForUrl(source.url, {
            defaultHeaders: {},
            headerRules: source.parsed?.headers || []
          }),
          timeout: Number(options.timeout || 22000)
        });
        raw = parseLooseJson(text);
      } else {
        raw = source.raw;
        if (!raw) throw new Error("本地配置内容不可用，请重新导入 JSON 文件");
      }
      const nextName =
        safeString(options.keepName) || source.name || safeString(raw.name);
      const next = createSource(raw, {
        id: source.id,
        kind: source.kind,
        name: nextName,
        url: source.url,
        enabled: source.enabled,
        createdAt: source.createdAt,
        lastSync: Date.now()
      });
      if (options.probe !== false) {
        try {
          next.runtime = await probeParsedSource(next, {
            timeout: Number(options.probeTimeout || 12000),
            maxSites: Number(options.maxProbeSites || 6),
            maxLives: Number(options.maxProbeLives || 8),
            limit: Number(options.probeLimit || 3)
          });
        } catch (error) {
          next.runtime = {
            status: "failed",
            checkedAt: Date.now(),
            fatalError: error.message || "运行检测失败"
          };
        }
      }
      sources[index] = next;
      persist();
      notify("sync");
      return clone(next);
    } catch (error) {
      source.error = error.message || "同步失败";
      persist();
      notify("sync-error");
      throw error;
    }
  }

  async function syncAll() {
    const results = [];
    for (const source of [...sources]) {
      try {
        results.push({ ok: true, source: await syncSource(source.id) });
      } catch (error) {
        results.push({ ok: false, source: getSource(source.id), error: error.message });
      }
    }
    return results;
  }

  function stripDecorator(raw) {
    return safeString(raw)
      .replace(/^[\s•·・*\-—]+/, "")
      .replace(/[「」【】《》[\]（）()]/g, "")
      .trim();
  }

  function normalizeGroup(raw) {
    const name = stripDecorator(raw);
    if (!name) return "其它";
    if (/^(未分组|其他|其它|默认|default|undefined|null)$/i.test(name)) {
      return "其它";
    }
    if (/^游戏/.test(name)) return "游戏赛事";
    if (/^影视/.test(name)) return "影视轮播";
    return name;
  }

  function parseM3u(text) {
    const output = [];
    let pending = null;
    String(text)
      .split(/\r?\n/)
      .forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) return;
        if (/^#EXTINF/i.test(line)) {
          const body = line.slice(line.indexOf(":") + 1);
          const comma = body.lastIndexOf(",");
          const attrs = comma >= 0 ? body.slice(0, comma) : body;
          const label = comma >= 0 ? body.slice(comma + 1).trim() : "";
          const pick = (key) => {
            const match = attrs.match(new RegExp(`${key}="([^"]*)"`, "i"));
            return match ? match[1].trim() : "";
          };
          pending = {
            name: pick("tvg-name") || label,
            group: pick("group-title"),
            logo: pick("tvg-logo") || undefined
          };
          return;
        }
        if (line.startsWith("#")) return;
        if (pending) {
          output.push({
            name: pending.name || line,
            url: line,
            group: normalizeGroup(pending.group),
            logo: pending.logo
          });
          pending = null;
        }
      });
    return output.filter((channel) => channel.name && channel.url);
  }

  function parseTxt(text) {
    const output = [];
    let group = "其它";
    String(text)
      .split(/\r?\n/)
      .forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line || line.startsWith("//")) return;
        if (/#genre#?/i.test(line)) {
          group = normalizeGroup(line.split(",")[0]);
          return;
        }
        if (line.startsWith("#")) return;
        const comma = line.indexOf(",");
        if (comma <= 0) return;
        const name = line.slice(0, comma).trim();
        const url = line.slice(comma + 1).trim();
        if (!name || !url) return;
        if (/^(https?|rtmp|rtsp|rtp|udp):\/\//i.test(url)) {
          output.push({ name, url, group });
          return;
        }
        url.split("#").forEach((piece) => {
          const item = piece.trim();
          if (item) output.push({ name, url: item, group });
        });
      });
    return output;
  }

  function parseLiveContent(text) {
    return /#EXTM3U|#EXTINF/i.test(text) ? parseM3u(text) : parseTxt(text);
  }

  function absolutize(url, baseUrl) {
    const value = safeString(url);
    if (!value) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    try {
      const base =
        baseUrl && !/^demo:/i.test(baseUrl) ? baseUrl : window.location.href;
      return new URL(value, base).href;
    } catch (_) {
      return value;
    }
  }

  function toneFor(value) {
    return ["coral", "violet", "mint", "gold"][
      Number.parseInt(shortHash(value), 36) % 4
    ];
  }

  function fallbackImage(value) {
    return FALLBACK_IMAGES[
      Number.parseInt(shortHash(value), 36) % FALLBACK_IMAGES.length
    ];
  }

  async function loadLiveChannels(options = {}) {
    if (!options.force && liveCache) {
      const age = Date.now() - liveCache.at;
      if (age < 5 * 60 * 1000 && liveCache.revision === revision) {
        return clone(liveCache.result);
      }
    }
    const config = aggregate();
    if (!config.lives.length) {
      throw new Error("没有启用的 M3U / TXT 直播源，请先在内容源管理中导入");
    }
    const stats = [];
    const rawChannels = [];
    await Promise.all(
      config.lives.map(async (live) => {
        try {
          const text = await fetchText(live.url, {
            headers: headerForUrl(live.url, {
              defaultHeaders: {},
              headerRules:
                sources.find((source) => source.id === live.sourceId)?.parsed
                  ?.headers || []
            })
          });
          const channels = parseLiveContent(text).map((channel) => ({
            ...channel,
            url: absolutize(channel.url, live.url),
            sourceName: live.sourceName,
            sourceLiveName: live.name
          }));
          if (!channels.length) throw new Error("没有解析出频道");
          rawChannels.push(...channels);
          stats.push({
            name: live.name,
            sourceName: live.sourceName,
            url: live.url,
            channels: channels.length
          });
        } catch (error) {
          stats.push({
            name: live.name,
            sourceName: live.sourceName,
            url: live.url,
            channels: 0,
            error: error.message
          });
        }
      })
    );
    if (!rawChannels.length) {
      const firstError =
        stats.find((item) => item.error)?.error || "直播源没有可用频道";
      throw new Error(firstError);
    }
    const merged = new Map();
    rawChannels.forEach((channel) => {
      const key = `${channel.group}::${channel.name}`;
      const hit = merged.get(key);
      if (hit) {
        if (!hit.urls.some((entry) => entry.url === channel.url)) {
          hit.urls.push({
            url: channel.url,
            sourceName: channel.sourceName,
            liveName: channel.sourceLiveName
          });
        }
        return;
      }
      merged.set(key, {
        key: `live_${shortHash(key)}`,
        name: channel.name,
        group: channel.group,
        logo: channel.logo,
        image: channel.logo || fallbackImage(key),
        tone: toneFor(key),
        urls: [
          {
            url: channel.url,
            sourceName: channel.sourceName,
            liveName: channel.sourceLiveName
          }
        ]
      });
    });
    const channels = [...merged.values()].map((channel) => {
        const sourcesForChannel = [
          ...new Set(channel.urls.map((entry) => entry.sourceName))
        ];
        return {
          ...channel,
          stream: channel.urls[0]?.url || "",
          sourceName: sourcesForChannel.join(" / "),
          sourceLabel:
            channel.urls.length > 1
              ? `${channel.urls.length} 条线路`
              : channel.urls[0]?.liveName || "标准直播源"
        };
      });
    const groups = [
      ...new Set(channels.map((channel) => channel.group))
    ].sort((left, right) => {
      if (left === "其它") return 1;
      if (right === "其它") return -1;
      return left.localeCompare(right, "zh-CN");
    });
    const result = {
      channels,
      groups,
      stats,
      sourceCount: config.lives.length,
      updatedAt: Date.now()
    };
    liveCache = { at: Date.now(), revision, result };
    return clone(result);
  }

  function isCmsOk(payload) {
    if (!payload || typeof payload !== "object") return false;
    const code = payload.code;
    if (code === undefined || code === null || code === "") return true;
    return /^(1|true|ok|success|200)$/i.test(String(code));
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  }

  function stripHtml(value) {
    return safeString(value)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildCmsUrl(site, query = {}) {
    const api = safeString(site.api);
    const values = {
      ac: query.ac,
      wd: query.wd,
      pg: query.pg,
      t: query.t,
      ids: query.ids
    };
    let templated = false;
    let output = api;
    const placeholders = [
      ["ac", /\{ac\}/g],
      ["wd", /\{(wd|kw|key|keyword)\}/g],
      ["pg", /\{(pg|page)\}/g],
      ["t", /\{(t|type|typeid|class)\}/g],
      ["ids", /\{(ids|id)\}/g]
    ];
    placeholders.forEach(([key, pattern]) => {
      if (!pattern.test(output)) return;
      templated = true;
      pattern.lastIndex = 0;
      output = output.replace(
        pattern,
        values[key] === undefined ? "" : encodeURIComponent(String(values[key]))
      );
    });
    if (templated) {
      if (query.ids !== undefined && !/[?&]ids=/.test(output)) {
        output += `${output.includes("?") ? "&" : "?"}ids=${encodeURIComponent(
          String(query.ids)
        )}`;
      }
      return output;
    }
    const params = new URLSearchParams();
    if (query.ac) params.set("ac", query.ac);
    if (query.wd !== undefined) params.set("wd", query.wd);
    if (query.pg !== undefined) params.set("pg", String(query.pg));
    if (query.t !== undefined && query.t !== "") params.set("t", String(query.t));
    if (query.ids !== undefined) params.set("ids", String(query.ids));
    const separator = output.includes("?")
      ? output.endsWith("?") || output.endsWith("&")
        ? ""
        : "&"
      : "?";
    return params.toString() ? `${output}${separator}${params}` : output;
  }

  function normalizeMediaGroup(typeName) {
    const value = safeString(typeName);
    if (/动画|动漫|少儿/.test(value)) return "动画";
    if (/综艺|真人秀|脱口秀/.test(value)) return "综艺";
    if (/剧|连续|电视|短片/.test(value)) return "剧集";
    if (/电影|片|动作|喜剧|爱情|科幻|恐怖|剧情/.test(value)) return "电影";
    return value || "影视";
  }

  function displayImage(url, headers, baseUrl = "") {
    const value = safeString(url);
    if (!value) return "";
    if (/^(data:|blob:)/i.test(value)) return value;
    const absolute = absolutize(value, baseUrl);
    if (!/^https?:\/\//i.test(absolute)) return absolute;
    if (sameOrigin(absolute)) return absolute;
    try {
      return proxyUrl(absolute, headers);
    } catch (_) {
      return absolute;
    }
  }

  function rawToLibraryItem(raw, site) {
    const id = safeString(raw.vod_id ?? raw.id);
    const name = safeString(raw.vod_name ?? raw.name);
    if (!id || !name) return null;
    const typeName = safeString(
      raw.type_name ?? raw.typeName ?? raw.class ?? raw.category,
      "影视"
    );
    const year = safeString(raw.vod_year ?? raw.year);
    const area = safeString(raw.vod_area ?? raw.area);
    const remarks = safeString(raw.vod_remarks ?? raw.remarks ?? raw.note);
    const score = safeString(raw.vod_score ?? raw.score);
    const meta = [year, area, remarks, score ? `${score} 分` : ""]
      .filter(Boolean)
      .join(" · ");
    const image = displayImage(
      raw.vod_pic ?? raw.pic ?? raw.image,
      site.header || {},
      site.api
    );
    const key = `${site.key}:::${id}`;
    return {
      key,
      siteKey: site.key,
      vodId: id,
      title: name,
      type: typeName,
      group: normalizeMediaGroup(typeName),
      meta: meta || `${site.sourceName} · ${site.name}`,
      image: image || fallbackImage(key),
      description:
        stripHtml(raw.vod_content ?? raw.vod_blurb ?? raw.content) ||
        `由“${site.name}”提供的影视条目。`,
      sourceName: site.sourceName,
      siteName: site.name,
      isDemo: site.sourceId === DEMO_SOURCE_ID,
      playbackNote: "苹果 CMS 内容源"
    };
  }

  function adapterForSite(site) {
    return adapterDefinitionFor(site?.adapter);
  }

  function adapterRequestHeaders(site, targetUrl) {
    const adapter = adapterForSite(site);
    const headers = {
      ...headerForUrl(targetUrl, {
        defaultHeaders: site?.header || {},
        headerRules:
          sources.find((source) => source.id === site?.sourceId)?.parsed
            ?.headers || []
      }),
      Referer: adapter?.baseUrl || targetUrl
    };
    if (!Object.keys(headers).some((name) => /^user-agent$/i.test(name))) {
      headers["User-Agent"] =
        "Mozilla/5.0 (Linux; Android 12; NOVA TV) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
    }
    return headers;
  }

  function streamRequestHeaders(site, targetUrl) {
    const headers = adapterRequestHeaders(site, targetUrl);
    // A page Referer can make public CDN video segments return 403.
    Object.keys(headers).forEach((name) => {
      if (/^referer$/i.test(name)) delete headers[name];
    });
    return headers;
  }

  async function fetchAdapterHtml(target, site, options = {}) {
    return fetchText(target, {
      headers: adapterRequestHeaders(site, target),
      timeout: Number(options.timeout || site?.timeout || REQUEST_TIMEOUT)
    });
  }

  function infer4kczType(title, badge) {
    const text = `${title} ${badge}`;
    if (/动漫|动画|剧场版|番剧/.test(text)) return "动画";
    if (/综艺|真人秀|脱口秀/.test(text)) return "综艺";
    if (
      /第\s*[一二三四五六七八九十0-9]+\s*[季部]/.test(text) ||
      /更新至|全\s*\d+\s*集|\d+\s*集全/.test(text)
    ) {
      return "剧集";
    }
    return "电影";
  }

  function imageFromCard(node) {
    const image = node?.querySelector("img[data-original], img[data-src], img[src]");
    if (!image) return "";
    const raw =
      image.getAttribute("data-original") ||
      image.getAttribute("data-src") ||
      image.getAttribute("src") ||
      "";
    if (!raw || /(?:blank|placeholder)\.(?:gif|png|jpg|webp)(?:$|\?)/i.test(raw)) {
      return "";
    }
    return raw;
  }

  function parse4kczList(html, site, limit, targetUrl) {
    const adapter = adapterForSite(site);
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const seen = new Set();
    return [...documentNode.querySelectorAll('h3.dytit a[href*="/movie/"]')]
      .map((link) => {
        const title = safeString(
          link.getAttribute("title") || link.textContent.replace(/\s+/g, " ")
        );
        const detailUrl = absolutize(link.getAttribute("href") || "", targetUrl);
        if (!title || !/^https?:\/\//i.test(detailUrl) || seen.has(detailUrl)) {
          return null;
        }
        seen.add(detailUrl);
        const card =
          link.closest("li") ||
          link.closest("article") ||
          link.parentElement?.parentElement;
        const badge = safeString(
          card?.querySelector(".jidi span, .remarks, .note")?.textContent
        );
        const type = infer4kczType(title, badge);
        const key = `${site.key}:::4kcz:${shortHash(detailUrl)}`;
        const image = displayImage(
          imageFromCard(card),
          site.header || {},
          targetUrl
        );
        return {
          key,
          siteKey: site.key,
          vodId: detailUrl,
          title,
          type,
          group: normalizeMediaGroup(type),
          meta: [badge, adapter?.siteName || "公开网页直连"]
            .filter(Boolean)
            .join(" · "),
          image: image || fallbackImage(key),
          description: `来自“${adapter?.siteName || site.name}”公开页面的影视条目。`,
          sourceName: site.sourceName,
          siteName: site.name,
          adapter: "4kcz",
          playbackNote: `${adapter?.label || "公开网页直连"} · 详情页解析 HLS`
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  }

  async function load4kczItems(site, query, limit, options = {}) {
    const adapter = adapterForSite(site);
    if (!adapter) return [];
    const target = adapter.baseUrl;
    let requestUrl = target;
    if (query) {
      const search = new URL("nimasile", target);
      search.searchParams.set("q", query);
      requestUrl = search.href;
    }
    const html = await fetchAdapterHtml(requestUrl, site, options);
    return parse4kczList(html, site, limit, requestUrl);
  }

  function extract4kczStream(html, pageUrl) {
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const iframe = documentNode.querySelector(
      'iframe.viframe[src], iframe[src*="url="]'
    );
    let candidate = "";
    if (iframe) {
      const iframeUrl = absolutize(iframe.getAttribute("src") || "", pageUrl);
      try {
        candidate = new URL(iframeUrl).searchParams.get("url") || "";
      } catch (_) {
        candidate = "";
      }
    }
    if (candidate && !/^(?:https?:)?\/\//i.test(candidate)) {
      try {
        candidate = decodeURIComponent(candidate);
      } catch (_) {
        // Keep the original value when it is already decoded.
      }
    }
    if (candidate.startsWith("//")) candidate = `https:${candidate}`;
    if (/^https?:\/\//i.test(candidate)) return candidate;

    const normalized = String(html || "").replace(/\\\//g, "/");
    const match = normalized.match(
      /https?:\/\/[^"'<>\\\s]+?\.m3u8(?:\?[^"'<>\\\s]*)?/i
    );
    return match?.[0] || "";
  }

  async function resolve4kczStream(playPageUrl, site) {
    const html = await fetchAdapterHtml(playPageUrl, site);
    const streamUrl = extract4kczStream(html, playPageUrl);
    if (!streamUrl) {
      throw new Error("厂长资源播放页未返回可播放的 HLS 地址");
    }
    return streamUrl;
  }

  async function load4kczDetail(item, site) {
    const adapter = adapterForSite(site);
    if (!adapter) throw new Error("公开网页适配器不可用");
    const detailUrl = safeString(item.vodId);
    if (!/^https?:\/\//i.test(detailUrl)) {
      throw new Error("厂长资源条目缺少详情页地址");
    }
    const html = await fetchAdapterHtml(detailUrl, site);
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const rawTitle = safeString(
      documentNode.querySelector(".dy_tit_big")?.childNodes?.[0]?.textContent ||
        documentNode.querySelector(".dy_tit_big")?.textContent ||
        item.title
    );
    const title =
      rawTitle.replace(/\s*[|｜]\s*\d{4}\s*$/, "").trim() || item.title;
    const year = safeString(
      documentNode.querySelector(".dy_tit_big span")?.textContent
    ).match(/\d{4}/)?.[0];
    const description =
      stripHtml(documentNode.querySelector(".yp_context")?.textContent) ||
      item.description;
    const image = displayImage(
      imageFromCard(documentNode.querySelector(".dyimg") || documentNode),
      site.header || {},
      detailUrl
    );
    const playLinks = [
      ...documentNode.querySelectorAll('.paly_list_btn a[href*="/v_play/"]')
    ].map((link, index) => ({
      name:
        link.textContent.replace(/\s+/g, " ").trim() || `第 ${index + 1} 集`,
      pageUrl: absolutize(link.getAttribute("href") || "", detailUrl),
      index
    }));
    if (!playLinks.length) {
      throw new Error("厂长资源详情页没有返回播放地址");
    }

    const episodeStyle =
      playLinks.length > 2 &&
      playLinks.filter((entry) => /第\s*\d+\s*[集话期]/.test(entry.name)).length >=
        2;
    const candidates = playLinks.slice(0, 2);
    const resolved = (
      await Promise.all(
        candidates.map(async (entry) => {
          try {
            const rawUrl = await resolve4kczStream(entry.pageUrl, site);
            return {
              ...entry,
              rawUrl,
              url: mediaUrl(
                rawUrl,
                streamRequestHeaders(site, rawUrl),
                /\.m3u8/i.test(rawUrl) ? "hls" : "file"
              )
            };
          } catch (_) {
            return null;
          }
        })
      )
    ).filter(Boolean);
    if (!resolved.length) {
      throw new Error("厂长资源未返回可直接播放的 HTTP(S) 片源");
    }

    const episodes = resolved.map((entry) => ({
      name: entry.name,
      url: entry.url,
      rawUrl: entry.rawUrl,
      pageUrl: entry.pageUrl,
      index: entry.index
    }));
    const lines = episodeStyle
      ? [{ name: "厂长资源线路", episodes }]
      : episodes.map((episode) => ({
          name: episode.name,
          episodes: [{ ...episode, name: "正片" }]
        }));
    const firstEpisode = episodes[0];
    const type = infer4kczType(title, item.meta);
    return {
      ...item,
      title,
      type,
      group: normalizeMediaGroup(type),
      image: image || item.image,
      description,
      meta: [year, type, adapter.siteName].filter(Boolean).join(" · "),
      lines,
      episodes,
      stream: firstEpisode.url,
      streamUrl: firstEpisode.rawUrl,
      lineName: lines[0]?.name || "",
      episodeName: firstEpisode.name,
      playbackNote: `${site.sourceName} · ${adapter.label} · 已取得公开 HLS`
    };
  }

  async function fetchCmsPayload(site, query, options = {}) {
    const url = buildCmsUrl(site, query);
    const text = await fetchText(url, {
      headers: {
        ...headerForUrl(url, {
          defaultHeaders: site.header || {},
          headerRules:
            sources.find((source) => source.id === site.sourceId)?.parsed
              ?.headers || []
        })
      },
      timeout: Number(options.timeout || site.timeout || REQUEST_TIMEOUT)
    });
    const payload = parseLooseJson(text);
    if (!isCmsOk(payload)) {
      throw new Error(`接口返回异常：${safeString(payload?.msg, "未知错误")}`);
    }
    return payload;
  }

  async function loadCmsItems(site, query, limit, options = {}) {
    const attempts =
      query.wd || query.ids
        ? [
            query,
            {
              ...query,
              ac: query.ac === "detail" ? "videolist" : "detail"
            }
          ]
        : [
            { ...query, ac: "videolist" },
            { ...query, ac: "list" }
          ];
    let lastError;
    for (const attempt of attempts) {
      try {
        const payload = await fetchCmsPayload(site, attempt, options);
        const list = asArray(payload.list)
          .slice(0, limit)
          .map((item) => rawToLibraryItem(item, site))
          .filter(Boolean);
        if (list.length) return list;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return [];
  }

  function extractHtmlRule($, scope, rule, baseUrl = "") {
    const raw = safeString(rule).split("||")[0].trim();
    if (!raw) return "";
    const attributeMatch = raw.match(/@(href|src|data-src|data-original|Text)\s*$/i);
    const attribute = attributeMatch ? attributeMatch[1].toLowerCase() : "text";
    const selector = attributeMatch ? raw.slice(0, attributeMatch.index).trim() : raw;
    const node = selector ? scope.querySelector(selector) : scope;
    if (!node) return "";
    if (attribute === "text") return node.textContent.replace(/\s+/g, " ").trim();
    const value = node.getAttribute(attribute) || "";
    return absolutize(value, baseUrl);
  }

  function htmlNodesToLibraryItems(
    documentNode,
    nodes,
    target,
    site,
    limit,
    indexOffset = 0
  ) {
    return nodes
      .slice(0, limit)
      .map((node, index) => {
        const name =
          extractHtmlRule(documentNode, node, site.rules?.name, target) ||
          node.textContent.replace(/\s+/g, " ").trim();
        if (!name) return null;
        const link = extractHtmlRule(documentNode, node, site.rules?.link, target);
        const key = `${site.key}:::html:${shortHash(
          `${link}|${name}|${indexOffset + index}`
        )}`;
        return {
          key,
          siteKey: site.key,
          vodId: link || name,
          title: name,
          type: "网页规则",
          group: "影视",
          meta: site.sourceName,
          image:
            extractHtmlRule(documentNode, node, site.rules?.pic, target) ||
            fallbackImage(key),
          description: `由 HTML 规则站“${site.name}”返回的条目。`,
          sourceName: site.sourceName,
          siteName: site.name,
          playbackNote: "HTML 规则源"
        };
      })
      .filter(Boolean);
  }

  async function loadHtmlSiteItems(site, limit, options = {}) {
    if (!site.rules?.list || !site.api) return [];
    const target = site.api;
    if (/\{(wd|kw|key|keyword)\}/i.test(target)) {
      return [];
    }
    const text = await fetchText(target, {
      headers: headerForUrl(target, {
        defaultHeaders: site.header || {},
        headerRules:
          sources.find((source) => source.id === site.sourceId)?.parsed
            ?.headers || []
      }),
      timeout: Number(options.timeout || site.timeout || REQUEST_TIMEOUT)
    });
    const documentNode = new DOMParser().parseFromString(text, "text/html");
    const nodes = [...documentNode.querySelectorAll(site.rules.list)];
    return htmlNodesToLibraryItems(
      documentNode,
      nodes,
      target,
      site,
      limit
    );
  }

  async function searchHtmlSite(site, keyword, limit, options = {}) {
    const ruleSearch = safeString(site.rules?.search);
    const template =
      ruleSearch && (/\{(wd|kw|key|keyword)\}/i.test(ruleSearch) || /^https?:\/\//i.test(ruleSearch))
        ? ruleSearch
        : site.api;
    if (!/\{(wd|kw|key|keyword)\}/i.test(template) && !keyword) {
      return [];
    }
    const target = /\{(wd|kw|key|keyword)\}/i.test(template)
      ? absolutize(
          template.replace(
            /\{(wd|kw|key|keyword)\}/gi,
            encodeURIComponent(keyword)
          ),
          site.api
        )
      : (() => {
          const url = new URL(absolutize(template, site.api), window.location.href);
          url.searchParams.set("wd", keyword);
          return url.href;
        })();
    const text = await fetchText(target, {
      headers: headerForUrl(target, {
        defaultHeaders: site.header || {},
        headerRules:
          sources.find((source) => source.id === site.sourceId)?.parsed
            ?.headers || []
      }),
      timeout: Number(options.timeout || site.timeout || REQUEST_TIMEOUT)
    });
    const documentNode = new DOMParser().parseFromString(text, "text/html");
    const nodes = [...documentNode.querySelectorAll(site.rules?.list || "body")];
    return htmlNodesToLibraryItems(
      documentNode,
      nodes,
      target,
      site,
      limit
    );
  }

  async function loadLibraryItems(options = {}) {
    const query = safeString(options.query);
    const limit = Number(options.limit || 24);
    const cacheKey = `${revision}|${query}|${limit}`;
    if (!options.force && libraryCache.has(cacheKey)) {
      return clone(libraryCache.get(cacheKey));
    }
    const config = aggregate();
    const configuredSites = config.siteItems
      ? config.siteItems
      : config.supportedSites.filter(
          (site) =>
            site.enabled &&
            site.searchable &&
            (site.runtimeKind === "adapter" ||
              site.type === 1 ||
              site.type === 3 ||
              site.type === 4)
        );
    const nonDemoSites = configuredSites.filter(
      (site) => site.sourceId !== DEMO_SOURCE_ID
    );
    const sites = nonDemoSites.length ? nonDemoSites : configuredSites;
    if (!sites.length) {
      throw new Error("没有可执行的影视站点，请导入苹果 CMS 或 HTML 规则配置");
    }
    const stats = [];
    const allItems = [];
    await Promise.all(
      sites.slice(0, 8).map(async (site) => {
        try {
          let items = [];
          if (site.runtimeKind === "adapter" && site.adapter === "4kcz") {
            items = await load4kczItems(site, query, limit);
          } else if (site.type === 3 || site.type === 4) {
            items = await loadCmsItems(
              site,
              query
                ? { ac: "detail", wd: query, pg: 1 }
                : { ac: "videolist", pg: 1 },
              limit
            );
          } else if (site.type === 1) {
            items = query
              ? await searchHtmlSite(site, query, limit)
              : await loadHtmlSiteItems(site, limit);
          }
          if (items.length) allItems.push(...items);
          stats.push({
            siteKey: site.key,
            siteName: site.name,
            sourceName: site.sourceName,
            type: site.type,
            adapter: site.adapter,
            count: items.length,
            error: ""
          });
        } catch (error) {
          stats.push({
            siteKey: site.key,
            siteName: site.name,
            sourceName: site.sourceName,
            type: site.type,
            adapter: site.adapter,
            count: 0,
            error: error.message
          });
        }
      })
    );
    if (!allItems.length) {
      const firstError =
        stats.find((stat) => stat.error)?.error || "内容源没有返回可展示的条目";
      const error = new Error(firstError);
      error.stats = clone(stats);
      error.siteCount = sites.length;
      throw error;
    }
    const seen = new Set();
    const items = allItems
      .filter((item) => {
        if (seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      })
      .slice(0, limit);
    const result = {
      items,
      stats,
      sourceCount: new Set(items.map((item) => item.sourceName)).size,
      siteCount: sites.length,
      query,
      updatedAt: Date.now()
    };
    libraryCache.set(cacheKey, clone(result));
    return result;
  }

  async function probeParsedSource(source, options = {}) {
    const parsed = source?.parsed || {};
    const timeout = Number(options.timeout || 12000);
    const limit = Number(options.limit || 3);
    const maxSites = Number(options.maxSites || 6);
    const maxLives = Number(options.maxLives || 8);
    const allSites = Array.isArray(parsed.sites) ? parsed.sites : [];
    const executableSites = allSites.filter(
      (site) =>
        site &&
        !site.unsupported &&
        (site.runtimeKind === "adapter" ||
          site.type === 1 ||
          site.type === 3 ||
          site.type === 4)
    );
    const providerSites = allSites.filter(
      (site) => site.type !== 0 && site.requiresSpider
    );
    const adaptedSites = allSites.filter(
      (site) => !site.unsupported && site.runtimeKind === "adapter"
    );
    const spiderSites = allSites.filter((site) => site.type === 0);
    const sitesToCheck = executableSites.slice(0, maxSites);
    const lives = Array.isArray(parsed.lives) ? parsed.lives : [];
    const livesToCheck = lives.slice(0, maxLives);

    const siteChecks = await Promise.all(
      sitesToCheck.map(async (site) => {
        try {
          let items = [];
          if (site.runtimeKind === "adapter" && site.adapter === "4kcz") {
            items = await load4kczItems(site, "", limit, { timeout });
          } else if (site.type === 3 || site.type === 4) {
            items = await loadCmsItems(
              site,
              { ac: "videolist", pg: 1 },
              limit,
              { timeout }
            );
          } else if (site.type === 1) {
            if (!site.rules?.list) {
              throw new Error("缺少 HTML 列表规则，当前只能通过搜索读取");
            }
            if (/\{(wd|kw|key|keyword)\}/i.test(site.api)) {
              items = await searchHtmlSite(site, "测试", limit, { timeout });
              return {
                name: site.name,
                type: site.type,
                adapter: site.adapter,
                ok: true,
                count: items.length,
                error: ""
              };
            }
            items = await loadHtmlSiteItems(site, limit, { timeout });
          }
          if (!items.length) {
            throw new Error("接口可访问，但没有返回可展示条目");
          }
          return {
            name: site.name,
            type: site.type,
            adapter: site.adapter,
            ok: true,
            count: items.length,
            error: ""
          };
        } catch (error) {
          return {
            name: site.name,
            type: site.type,
            adapter: site.adapter,
            ok: false,
            count: 0,
            error: error.message || "请求失败"
          };
        }
      })
    );

    const liveChecks = await Promise.all(
      livesToCheck.map(async (live) => {
        try {
          const text = await fetchText(live.url, {
            headers: headerForUrl(live.url, {
              defaultHeaders: parsed.defaultHeaders || {},
              headerRules: parsed.headers || []
            }),
            timeout
          });
          const channels = parseLiveContent(text);
          if (!channels.length) throw new Error("没有解析出频道");
          return {
            name: live.name,
            ok: true,
            count: channels.length,
            error: ""
          };
        } catch (error) {
          return {
            name: live.name,
            ok: false,
            count: 0,
            error: error.message || "请求失败"
          };
        }
      })
    );

    const checks = [...siteChecks, ...liveChecks];
    const successCount = checks.filter((check) => check.ok).length;
    const failureCount = checks.length - successCount;
    const itemCount = siteChecks.reduce((sum, check) => sum + check.count, 0);
    const channelCount = liveChecks.reduce(
      (sum, check) => sum + check.count,
      0
    );
    let status = "unsupported";
    if (checks.length) {
      if (successCount && failureCount) status = "partial";
      else if (successCount) status = "ok";
      else status = "failed";
    }
    return {
      status,
      checkedAt: Date.now(),
      executableSiteCount: executableSites.length,
      adaptedSiteCount: adaptedSites.length,
      checkedSiteCount: siteChecks.length,
      siteSuccessCount: siteChecks.filter((check) => check.ok).length,
      providerSiteCount: providerSites.length,
      spiderSiteCount: spiderSites.length,
      skippedSiteCount: allSites.length - executableSites.length,
      liveSourceCount: lives.length,
      checkedLiveCount: liveChecks.length,
      liveSuccessCount: liveChecks.filter((check) => check.ok).length,
      itemCount,
      channelCount,
      failureCount,
      omittedSiteCount: executableSites.length - sitesToCheck.length,
      omittedLiveCount: lives.length - livesToCheck.length,
      sites: siteChecks,
      lives: liveChecks
    };
  }

  async function probeSource(id, options = {}) {
    const index = sources.findIndex((source) => source.id === id);
    if (index < 0) throw new Error("内容源不存在");
    const source = sources[index];
    source.runtime = await probeParsedSource(source, options);
    persist();
    notify("probe");
    return clone(source);
  }

  function parsePlayLines(from, urls) {
    const fromParts = safeString(from).split("$$$");
    const urlParts = safeString(urls).split("$$$");
    const lines = [];
    urlParts.forEach((rawPart, lineIndex) => {
      const episodes = rawPart
        .split("#")
        .map((rawEpisode, episodeIndex) => {
          const separator = rawEpisode.indexOf("$");
          const label =
            separator >= 0 ? rawEpisode.slice(0, separator) : "";
          const url =
            separator >= 0 ? rawEpisode.slice(separator + 1) : rawEpisode;
          return {
            name:
              stripHtml(label) ||
              `第 ${episodeIndex + 1} 集`,
            url: safeString(url),
            index: episodeIndex
          };
        })
        .filter((episode) => /^https?:\/\//i.test(episode.url));
      if (episodes.length) {
        lines.push({
          name:
            stripHtml(fromParts[lineIndex]) ||
            `线路 ${lineIndex + 1}`,
          episodes
        });
      }
    });
    return lines;
  }

  function hydratedFromRaw(raw, site, base) {
    const item = rawToLibraryItem(raw, site);
    if (!item) throw new Error("详情接口没有返回有效影片");
    const content = stripHtml(
      raw.vod_content ?? raw.vod_blurb ?? raw.content ?? raw.description
    );
    const lines = parsePlayLines(
      raw.vod_play_from ?? raw.play_from,
      raw.vod_play_url ?? raw.play_url
    );
    const firstLine = lines.find((line) => line.episodes.length);
    const firstEpisode = firstLine?.episodes[0];
    const parsed = {
      ...base,
      ...item,
      description: content || item.description,
      lines,
      episodes: firstLine?.episodes || [],
      stream: firstEpisode?.url || base?.stream || "",
      lineName: firstLine?.name || "",
      episodeName: firstEpisode?.name || "",
      playbackNote: firstEpisode
        ? `${site.sourceName} · ${site.name} · ${firstLine.name}`
        : "站点未返回可直接播放的 HTTP(S) 片源，可能需要 TVBox 解析接口"
    };
    return parsed;
  }

  async function getLibraryDetail(item) {
    if (!item) throw new Error("缺少影片信息");
    if (!item.siteKey) return clone(item);
    const config = aggregate();
    const site = config.sites.find((entry) => entry.key === item.siteKey);
    if (!site) throw new Error("该影片对应的站点已停用或删除");
    if (site.unsupported) throw new Error(site.unsupported);
    if (site.runtimeKind === "adapter" && site.adapter === "4kcz") {
      return load4kczDetail(item, site);
    }
    if (site.type === 3 || site.type === 4) {
      const payload = await fetchCmsPayload(site, {
        ac: "detail",
        ids: item.vodId
      });
      const raw = asArray(payload.list)[0];
      if (!raw) throw new Error("详情接口没有返回影片");
      return hydratedFromRaw(raw, site, item);
    }
    if (site.type === 1) {
      if (!/^https?:\/\//i.test(item.vodId)) {
        throw new Error("HTML 规则条目缺少详情页地址");
      }
      const text = await fetchText(item.vodId, {
        headers: headerForUrl(item.vodId, {
          defaultHeaders: site.header || {},
          headerRules:
            sources.find((source) => source.id === site.sourceId)?.parsed
              ?.headers || []
        })
      });
      const documentNode = new DOMParser().parseFromString(text, "text/html");
      const episodes = [
        ...documentNode.querySelectorAll(site.rules?.playItem || "a")
      ]
        .map((node, index) => {
          const url = absolutize(node.getAttribute("href") || "", item.vodId);
          if (!/^https?:\/\//i.test(url)) return null;
          return {
            name:
              node.textContent.replace(/\s+/g, " ").trim() ||
              `第 ${index + 1} 集`,
            url,
            index
          };
        })
        .filter(Boolean);
      const firstEpisode = episodes[0];
      return {
        ...item,
        description:
          extractHtmlRule(
            documentNode,
            documentNode.body,
            site.rules?.detailContent,
            item.vodId
          ) || item.description,
        lines: episodes.length
          ? [{ name: "HTML 规则线路", episodes }]
          : [],
        episodes,
        stream: firstEpisode?.url || "",
        lineName: firstEpisode ? "HTML 规则线路" : "",
        episodeName: firstEpisode?.name || "",
        playbackNote: firstEpisode
          ? `${site.sourceName} · ${site.name}`
          : "HTML 规则没有解析出可直接播放的地址"
      };
    }
    throw new Error(site.unsupported || "该站点类型暂不支持详情");
  }

  function mediaUrl(url, headers = {}, kind = "hls") {
    const value = safeString(url);
    if (!value || !/^https?:\/\//i.test(value)) return value;
    if (sameOrigin(value)) return value;
    if (kind !== "hls") return value;
    try {
      return proxyUrl(value, headers);
    } catch (_) {
      return value;
    }
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  loadSources();

  window.NovaSources = {
    storageKey: STORAGE_KEY,
    demoSourceId: DEMO_SOURCE_ID,
    contentTypeLabels: clone(CONTENT_TYPE_LABELS),
    list: listSources,
    listEnabled: getEnabledSources,
    get: getSource,
    aggregate,
    parseConfig,
    parseLooseJson,
    parseLiveContent,
    importJson,
    addRemote,
    syncSource,
    syncAll,
    probeSource,
    toggleSource,
    removeSource,
    restoreDemo,
    loadLiveChannels,
    loadLibraryItems,
    getLibraryDetail,
    mediaUrl,
    proxyUrl,
    headerForUrl,
    onChange,
    get revision() {
      return revision;
    }
  };
})();
