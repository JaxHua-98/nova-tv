(() => {
  "use strict";

  const STORAGE_KEY = "nova.tvbox.sources.v1";
  // 独立直播源：不依附任何订阅，在「设置 → 电视直播源」里单独管理
  const LIVE_STORAGE_KEY = "nova.tvbox.lives.v1";
  const LIVE_SOURCE_ID = "__live_store__";
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

  // 站点级覆盖（启停 / 排序 / 健康）与检测判定放在独立模块，见 site-overrides.js、site-health.js
  const siteOverrides = window.NovaSiteOverrides || null;
  const siteHealth = window.NovaSiteHealth || null;
  // 用户设置（并发 / 超时 / UA / 过滤解说）见 nova-settings.js
  const settingsApi = window.NovaSettings || null;
  // 内置订阅预设见 presets.js
  const presetsApi = window.NovaPresets || null;
  const FALLBACK_SETTINGS = {
    concurrency: 8,
    maxSites: 8,
    timeout: 20,
    userAgent: "",
    filterCommentary: true
  };

  function currentSettings() {
    if (settingsApi) return settingsApi.get();
    return { ...FALLBACK_SETTINGS };
  }

  function settingsTimeoutMs() {
    const seconds = Number(currentSettings().timeout);
    return (Number.isFinite(seconds) ? seconds : FALLBACK_SETTINGS.timeout) * 1000;
  }

  /** 有上限的并发池：站点/直播源一多，Promise.all 会把请求一次性打满 */
  async function pool(items, limit, worker) {
    const list = Array.isArray(items) ? items : [];
    const size = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
    const results = new Array(list.length);
    let cursor = 0;
    await Promise.all(
      new Array(size).fill(0).map(async () => {
        while (cursor < list.length) {
          const index = cursor;
          cursor += 1;
          // eslint-disable-next-line no-await-in-loop
          results[index] = await worker(list[index], index);
        }
      })
    );
    return results;
  }

  let sources = [];
  let liveSources = [];
  let revision = 0;
  let liveCache = null;
  let libraryCache = new Map();
  // 最近一次站点检测的完整结果（含 message / sample），重启后只保留 overrides 里的耗时数字
  const siteTestCache = new Map();
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

  /* ---------- 首次启动 / 内置订阅「只送一次」 ---------- */

  const BUNDLED_FLAG = "nova.tvbox.bundledServed.v1";

  function bundledServed() {
    try {
      return window.localStorage.getItem(BUNDLED_FLAG) === "1";
    } catch (_) {
      return false;
    }
  }

  function markBundledServed() {
    try {
      window.localStorage.setItem(BUNDLED_FLAG, "1");
    } catch (_) {
      /* 存储被禁用时保持内存态即可 */
    }
  }

  function hasSourceId(id) {
    return sources.some((source) => source.id === id);
  }

  function findSourceByUrl(url) {
    const target = safeString(url).replace(/\/+$/, "");
    if (!target) return null;
    return (
      sources.find((source) => safeString(source.url).replace(/\/+$/, "") === target) || null
    );
  }

  /** 内容指纹：同一份配置换个文件名/地址再导入，也能识别成重复 */
  function fingerprint(raw) {
    const sites = Array.isArray(raw?.sites)
      ? raw.sites.map((site) => safeString(site?.key ?? site?.name ?? site?.api)).filter(Boolean)
      : [];
    const lives = Array.isArray(raw?.lives)
      ? raw.lives.map((live) => safeString(live?.url ?? live)).filter(Boolean)
      : [];
    return shortHash(JSON.stringify({ sites, lives }));
  }

  function findByFingerprint(raw) {
    const target = fingerprint(raw);
    return (
      sources.find((source) => source.raw && fingerprint(source.raw) === target) || null
    );
  }

  /* ---------- 内置源播种 ---------- */

  const BUILTIN_SEED_FLAG = "nova.tvbox.builtinSeeded.v2";

  function builtinSeeded() {
    try {
      return window.localStorage.getItem(BUILTIN_SEED_FLAG) === "1";
    } catch (_) {
      return false;
    }
  }

  /** 首次启动把所有内置订阅按「开启」写进本地列表；只做一次 */
  function seedBuiltinSources(force) {
    if (!force && builtinSeeded()) return;
    const presets = presetsApi;
    if (!presets?.list) return;
    presets.list().forEach((preset) => {
      try {
        const url = presets.presetUrl(preset.id);
        if (findSourceByUrl(url)) {
          // 已存在：确保是开启状态（老用户升级上来的情况）
          const existing = findSourceByUrl(url);
          if (existing && existing.enabled === false) existing.enabled = true;
          return;
        }
        upsertRawSource(presets.buildConfig(preset.id), {
          id: `preset:${preset.id}`,
          kind: "preset",
          name: preset.name,
          url,
          enabled: true
        });
      } catch (_) {
        /* 单个内置源失败不影响其它 */
      }
    });
    try {
      window.localStorage.setItem(BUILTIN_SEED_FLAG, "1");
    } catch (_) {
      /* 存储被禁用时下次再试 */
    }
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
    // 内置订阅只播种一次：首次启动把全部内置源按「开启」装进去，
    // 之后用户的开关状态（含删除）以本地存储为准，重启不再覆盖
    // 列表为空（清过数据/删光了）时重新播种，保证内容源不会丢
    seedBuiltinSources(sources.length === 0);
    markBundledServed();
  }

  function loadLiveSources() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(LIVE_STORAGE_KEY) || "[]");
      liveSources = Array.isArray(stored)
        ? stored
            .filter((item) => item && typeof item === "object" && safeString(item.url))
            .map((item, index) => ({
              id: safeString(item.id) || `live_${index}_${shortHash(item.url)}`,
              name: safeString(item.name) || "独立直播源",
              url: safeString(item.url),
              enabled: item.enabled !== false,
              createdAt: item.createdAt || Date.now(),
              lastChannels: Number(item.lastChannels) || 0,
              lastError: safeString(item.lastError)
            }))
        : [];
    } catch (_) {
      liveSources = [];
    }
  }

  function persistLiveSources() {
    try {
      window.localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(liveSources));
      return true;
    } catch (_) {
      console.warn("NOVA live source storage is full");
      return false;
    }
  }

  function listLiveSources() {
    return clone(liveSources);
  }

  function addLiveSource(input = {}) {
    const url = safeString(input.url);
    if (!/^https?:\/\//i.test(url)) throw new Error("直播源必须是 http(s) 地址");
    if (liveSources.some((item) => item.url === url)) throw new Error("这个直播源已经添加过了");
    const source = {
      id: `live_${Date.now().toString(36)}_${shortHash(url)}`,
      name: safeString(input.name) || "独立直播源",
      url,
      enabled: true,
      createdAt: Date.now(),
      lastChannels: 0,
      lastError: ""
    };
    liveSources.push(source);
    persistLiveSources();
    notify("live-add");
    return clone(source);
  }

  function removeLiveSource(id) {
    const index = liveSources.findIndex((item) => item.id === id);
    if (index < 0) return false;
    liveSources.splice(index, 1);
    persistLiveSources();
    notify("live-remove");
    return true;
  }

  function setLiveSourceEnabled(id, enabled) {
    const target = liveSources.find((item) => item.id === id);
    if (!target) return false;
    target.enabled = Boolean(enabled);
    persistLiveSources();
    notify("live-toggle");
    return true;
  }

  function markLiveSourceResult(id, channels, error) {
    const target = liveSources.find((item) => item.id === id);
    if (!target) return;
    target.lastChannels = Number(channels) || 0;
    target.lastError = safeString(error);
    persistLiveSources();
  }

  async function testLiveSource(id) {
    const target = liveSources.find((item) => item.id === id);
    if (!target) throw new Error("找不到这个直播源");
    try {
      const text = await fetchText(target.url, {});
      const channels = parseLiveContent(text);
      if (!channels.length) throw new Error("没有解析出频道");
      markLiveSourceResult(id, channels.length, "");
      return { name: target.name, channels: channels.length };
    } catch (error) {
      markLiveSourceResult(id, 0, error.message || "拉取失败");
      throw error;
    }
  }

  loadLiveSources();

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
    // 注意：事件必须发在 document 上并允许冒泡。
    // 之前发在 window 上，document 上的监听收不到，改设置后片库不会重新拉取。
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail, bubbles: true }));
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
    if (!options.allowDuplicate) {
      const duplicate = findByFingerprint(raw);
      if (duplicate) {
        const error = new Error(`同一份配置已经在列表里了：${duplicate.name}`);
        error.duplicateOf = duplicate.id;
        throw error;
      }
    }
    return upsertRawSource(raw, {
      id: options.id,
      name: options.name,
      kind: options.kind || "file",
      url: options.url || "",
      enabled: true
    });
  }

  /** 添加内置订阅预设：内容落进本地订阅表，之后走正常同步链路 */
  function addPreset(id) {
    const presets = presetsApi;
    if (!presets) throw new Error("内置订阅模块未加载");
    const preset = presets.get(id);
    if (!preset) throw new Error("没有这个内置订阅");
    const url = presets.presetUrl(id);
    const existing = findSourceByUrl(url);
    if (existing) {
      const error = new Error("这个内置订阅已经添加过了");
      error.duplicateOf = existing.id;
      throw error;
    }
    const source = upsertRawSource(presets.buildConfig(id), {
      id: `preset:${id}`,
      kind: "preset",
      name: preset.name,
      url,
      enabled: true
    });
    markBundledServed();
    return source;
  }

  function listPresets() {
    return presetsApi ? presetsApi.list() : [];
  }

  /** 把当前启用的订阅合并成一个 JSON，方便换机或交给别人复现 */
  function exportConfig(options = {}) {
    const enabled = sources.filter((source) => source.enabled && source.raw && typeof source.raw === "object");
    const sites = [];
    const lives = [];
    const parses = [];
    const seenSite = new Set();
    const seenLive = new Set();
    const seenParse = new Set();

    enabled.forEach((source) => {
      const raw = source.raw;
      (Array.isArray(raw.sites) ? raw.sites : []).forEach((site) => {
        const key = safeString(site?.key ?? site?.name ?? site?.api);
        if (!key || seenSite.has(key)) return;
        seenSite.add(key);
        sites.push(site);
      });
      (Array.isArray(raw.lives) ? raw.lives : []).forEach((live) => {
        const value = typeof live === "string" ? { name: "直播源", type: 0, url: live } : live;
        const url = safeString(value?.url);
        if (!url || seenLive.has(url)) return;
        seenLive.add(url);
        lives.push(value);
      });
      (Array.isArray(raw.parses) ? raw.parses : []).forEach((parse) => {
        const url = safeString(parse?.url);
        if (!url || seenParse.has(url)) return;
        seenParse.add(url);
        parses.push(parse);
      });
    });

    return {
      format: "tvbox-desktop/1",
      name: safeString(options.name, "NOVA TV 合并订阅"),
      notice: `由 NOVA TV 导出 · ${enabled.length} 个订阅合并 · 站点 ${sites.length} · 直播 ${lives.length}`,
      sites,
      lives,
      parses,
      flags: ["nova", "export"],
      tvboxDesktop: {
        format: "tvbox-desktop/1",
        timeout: currentSettings().timeout
      }
    };
  }

  async function addRemote(url, options = {}) {
    const cleanUrl = safeString(url);
    if (!/^https?:\/\//i.test(cleanUrl)) {
      throw new Error("订阅地址必须以 http:// 或 https:// 开头");
    }
    const duplicate = findSourceByUrl(cleanUrl);
    if (duplicate) {
      const error = new Error(`这个订阅已经在列表里了：${duplicate.name}`);
      error.duplicateOf = duplicate.id;
      throw error;
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
      // probe:false 可以让「加订阅」先秒出站点列表，检测留给后续异步做
      return await syncSource(source.id, { probe: options.probe });
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

  function clearAllSources() {
    const removed = sources.length;
    sources = [];
    persist();
    notify("clear-all");
    try {
      window.localStorage.setItem(STORAGE_KEY, "[]");
    } catch (_) {
      /* ignore */
    }
    return removed;
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

  /**
   * 本机 / 局域网地址（例如同网段的管理后台发布地址）直连，不走 /api/proxy。
   * 代理对私网地址有 SSRF 防护，硬走代理会被直接拒掉；这类地址由我们自己控制，
   * 直连 + 服务端 CORS 即可。
   */
  function isDirectTarget(url) {
    try {
      const host = new URL(url, window.location.href).hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
      if (host.endsWith(".local")) return true;
      if (/^10\./.test(host)) return true;
      if (/^192\.168\./.test(host)) return true;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
      return false;
    } catch (_) {
      return false;
    }
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

  function proxyUrl(url, headers = {}, options = {}) {
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
    // 直播频道列表本身就是 m3u，拉列表时不能把里面的频道地址改写成代理地址
    if (options.raw) proxy.searchParams.set("norewrite", "1");
    return proxy.href;
  }

  async function fetchText(url, options = {}) {
    const target = new URL(url, window.location.href);
    let requestUrl = target.href;
    const requested = { ...(options.headers || {}) };
    const hasHeader = (name) =>
      Object.keys(requested).some((key) => key.toLowerCase() === name);
    if (!hasHeader("user-agent")) {
      // 同源 fetch 改不了 UA（浏览器禁止的请求头），但经本地代理转发的请求会真正生效。
      const agent = safeString(currentSettings().userAgent);
      if (agent) requested["User-Agent"] = agent;
    }
    const headers = proxySafeHeaders(requested);
    if (!sameOrigin(target.href) && !isDirectTarget(target.href)) {
      requestUrl = proxyUrl(target.href, headers, { raw: options.raw });
    }
    const controller = new AbortController();
    const timeoutMs = timeoutMilliseconds(options.timeout, settingsTimeoutMs());
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

    // 独立直播源：不依赖任何订阅，可在设置里单独开关
    liveSources
      .filter((item) => item.enabled && item.url)
      .forEach((item) => {
        if (seenLives.has(item.url)) return;
        seenLives.add(item.url);
        lives.push({
          name: item.name || "独立直播源",
          type: 0,
          url: item.url,
          sourceId: LIVE_SOURCE_ID,
          sourceName: "独立直播源"
        });
      });

    // 站点级覆盖：用户启停/排序/健康度写在这里，配置原文不动。
    // index 是配置里的原始顺序，未被用户调整的站点保持原顺序。
    const decorated = sites.map((site, index) => {
      const withIndex = { ...site, index };
      return siteOverrides ? siteOverrides.apply(withIndex) : withIndex;
    });
    const orderedSites = siteHealth ? siteHealth.sortSites(decorated) : decorated;

    const supportedSites = orderedSites.filter((site) => !site.unsupported);
    const enabledSites = orderedSites.filter((site) => site.enabled);
    return {
      sources: clone(enabled),
      sites: clone(orderedSites),
      supportedSites: clone(supportedSites),
      enabledSites: clone(enabledSites),
      lives: clone(lives),
      parses: clone(parses),
      configs,
      revision,
      stats: {
        enabledSources: enabled.length,
        totalSources: sources.length,
        errors: errorCount,
        sites: orderedSites.length,
        sitesEnabled: enabledSites.length,
        sitesDisabled: orderedSites.length - enabledSites.length,
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
        spiderSites: orderedSites.filter((site) => site.type === 0).length,
        providerSites: orderedSites.filter(
          (site) => site.type !== 0 && site.requiresSpider
        ).length,
        liveSources: lives.length,
        parses: parses.length,
        overrides: siteOverrides ? siteOverrides.counts() : { total: 0, disabled: 0, ordered: 0, healthy: 0 }
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

  // iptv-org 用英文台名，跟国内源的中文名对不上；这里把常见卫视映射成中文名，重复的台就自动合并成一条
  const LIVE_ALIAS = {
    "anhui tv": "安徽卫视",
    "beijing satellite tv": "北京卫视",
    "dragon tv international": "东方卫视",
    "guangdong satellite tv": "广东卫视",
    "guizhou tv": "贵州卫视",
    "hebei tv": "河北卫视",
    "heilongjiang tv": "黑龙江卫视",
    "hunan tv": "湖南卫视",
    "jiangsu satellite tv": "江苏卫视",
    "jiangxi tv": "江西卫视",
    "liaoning tv": "辽宁卫视",
    "nei monggol tv": "内蒙古卫视",
    "ningxia satellite channel": "宁夏卫视",
    "qinghai tv": "青海卫视",
    "shandong satellite tv": "山东卫视",
    "shenzhen satellite tv": "深圳卫视",
    "sichuan satellite tv": "四川卫视",
    "tianjin tv": "天津卫视",
    "xinjiang tv 1": "新疆卫视",
    "xizang tv chinese": "西藏卫视",
    "yanbian satellite tv": "延边卫视",
    "yunnan satellite tv": "云南卫视",
    "zhejiang satellite tv": "浙江卫视",
    "fujian comprehensive channel": "东南卫视",
    "hunan economy channel": "湖南经视",
    "guangzhou tv": "广州综合",
    "harbin comprehensive news channel": "哈尔滨新闻综合",
    "xi an silk road channel": "西安丝路",
    "cctv+ 1": "CCTV+ 1",
    "cctv+ 2": "CCTV+ 2"
  };

  // iptv-org 之类的列表会带 (720p) / [Not 24/7] / HD 之类的后缀，清洗后才能和别的源按名合并
  function cleanLiveName(raw) {
    const cleaned = String(raw || "")
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\([^)]*(?:p|hd|sd|uhd|4k)[^)]*\)/gi, "")
      .replace(/\b(FHD|UHD|HD|SD)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const alias = LIVE_ALIAS[cleaned.toLowerCase()];
    return alias || cleaned;
  }

  function liveQualityOf(raw) {
    const text = String(raw || "");
    if (/2160p|4k/i.test(text)) return 2160;
    if (/1080p/i.test(text)) return 1080;
    if (/720p/i.test(text)) return 720;
    if (/576p|540p/i.test(text)) return 540;
    if (/480p/i.test(text)) return 480;
    return 0;
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
          const rawName = pick("tvg-name") || label;
          pending = {
            name: cleanLiveName(rawName) || rawName,
            group: pick("group-title"),
            logo: pick("tvg-logo") || undefined,
            tvgId: pick("tvg-id") || undefined,
            quality: liveQualityOf(rawName)
          };
          return;
        }
        if (line.startsWith("#")) return;
        if (pending) {
          output.push({
            name: pending.name || line,
            url: line,
            group: normalizeGroup(pending.group),
            logo: pending.logo,
            tvgId: pending.tvgId,
            quality: pending.quality || 0
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
    const liveConcurrency = Math.max(
      1,
      Number(currentSettings().concurrency) || FALLBACK_SETTINGS.concurrency
    );
    await pool(config.lives, liveConcurrency, async (live) => {
      try {
        const text = await fetchText(live.url, {
          raw: true,
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
    });
    if (!rawChannels.length) {
      const firstError =
        stats.find((item) => item.error)?.error || "直播源没有可用频道";
      throw new Error(firstError);
    }
    const merged = new Map();
    rawChannels.forEach((channel) => {
      // 按频道名跨组合并：同一个台在多个分组里出现时，把线路攒到一条记录上
      const key = channel.name.trim();
      const hit = merged.get(key);
      if (hit) {
        if (!hit.tvgId && channel.tvgId) hit.tvgId = channel.tvgId;
        if (!hit.urls.some((entry) => entry.url === channel.url)) {
          hit.urls.push({
            url: channel.url,
            sourceName: channel.sourceName,
            liveName: channel.sourceLiveName,
            quality: channel.quality || 0
          });
        }
        return;
      }
      merged.set(key, {
        key: `live_${shortHash(key)}`,
        name: channel.name,
        tvgId: channel.tvgId,
        group: channel.group,
        logo: channel.logo,
        image: channel.logo || fallbackImage(key),
        tone: toneFor(key),
        urls: [
          {
            url: channel.url,
            sourceName: channel.sourceName,
            liveName: channel.sourceLiveName,
            quality: channel.quality || 0
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

  // 跨源合并：片名归一化 + 年份相同视为同一部片，其它源作为备用线路
  function normalizeTitleForMerge(title) {
    return String(title || "")
      .replace(/[\s\u3000]+/g, "")
      .replace(/[：:·—\-_,，。.、!！?？'"“”‘’()（）\[\]【】]/g, "")

      .replace(/(国语|粤语|中英双字|中字|高清|抢先版|完整版|HD|BD)$/gi, "")
      .toLowerCase();
  }

  // 多站点聚合时按站点轮流取，避免先返回的源吃满整页配额
  function interleaveBySite(items) {
    const buckets = new Map();
    items.forEach((item) => {
      const key =
        safeString(item.siteName) ||
        safeString(item.sources?.[0]?.siteName) ||
        "其它";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    });
    const groups = [...buckets.values()];
    if (groups.length <= 1) return items;
    const ordered = [];
    const longest = Math.max(...groups.map((group) => group.length));
    for (let index = 0; index < longest; index += 1) {
      groups.forEach((group) => {
        if (group[index]) ordered.push(group[index]);
      });
    }
    return ordered;
  }

  function mergeByTitle(items) {
    const index = new Map();
    const out = [];
    items.forEach((item) => {
      const base = normalizeTitleForMerge(item.title);
      if (!base) {
        out.push(item);
        return;
      }
      const bucket = `${base}|${item.year || ""}`;
      const source = {
        key: item.key,
        siteKey: item.siteKey,
        vodId: item.vodId,
        sourceName: item.sourceName,
        siteName: item.siteName
      };
      const hit = index.get(bucket);
      if (hit) {
        if (!hit.sources.some((entry) => entry.key === item.key)) hit.sources.push(source);
        hit.siteCount = hit.sources.length;
        if (!hit.description && item.description) hit.description = item.description;
        if ((item.score || 0) > (hit.score || 0)) hit.score = item.score;
        if (item.image && !hit.imageReal) {
          hit.image = item.image;
          hit.imageReal = true;
        }
        return;
      }
      const entry = { ...item, sources: [source], siteCount: 1, imageReal: true };
      index.set(bucket, entry);
      out.push(entry);
    });
    return out;
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
      area,
      year,
      status: remarks,
      score: Number(score) || 0,
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
      timeout: timeoutMilliseconds(options.timeout || site?.timeout, settingsTimeoutMs())
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
      timeout: timeoutMilliseconds(options.timeout || site.timeout, settingsTimeoutMs())
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
            { ...query, ac: "detail" },
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
      timeout: timeoutMilliseconds(options.timeout || site.timeout, settingsTimeoutMs())
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
      timeout: timeoutMilliseconds(options.timeout || site.timeout, settingsTimeoutMs())
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
    const page = Math.max(1, Number(options.page) || 1);
    const typeId = Math.max(0, Number(options.type) || 0);
    const cacheKey = `${revision}|${query}|${limit}|${page}|${typeId}`;
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
    const settings = currentSettings();
    const maxSites = Math.max(1, Number(settings.maxSites) || FALLBACK_SETTINGS.maxSites);
    const concurrency = Math.max(1, Number(settings.concurrency) || FALLBACK_SETTINGS.concurrency);
    const stats = [];
    const allItems = [];
    // 按设置里的并发跑，不再固定 Promise.all 全打出去；站点数也由 maxSites 决定
    await pool(sites.slice(0, maxSites), concurrency, async (site) => {
      try {
        let items = [];
        if (site.runtimeKind === "adapter" && site.adapter === "4kcz") {
          items = await load4kczItems(site, query, limit);
        } else if (site.type === 3 || site.type === 4) {
          items = await loadCmsItems(
            site,
            query
              ? { ac: "detail", wd: query, pg: page, ...(typeId ? { t: typeId } : {}) }
              : { ac: "detail", pg: page, ...(typeId ? { t: typeId } : {}) },
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
    });
    if (!allItems.length) {
      const firstError =
        stats.find((stat) => stat.error)?.error || "内容源没有返回可展示的条目";
      const error = new Error(firstError);
      error.stats = clone(stats);
      error.siteCount = Math.min(sites.length, maxSites);
      throw error;
    }
    const seen = new Set();
    const deduped = allItems.filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
    const filteredItems = settingsApi ? settingsApi.filterItems(deduped, settings) : deduped;
    const hiddenCommentary = deduped.length - filteredItems.length;
    const items = interleaveBySite(mergeByTitle(filteredItems)).slice(0, limit);
    const result = {
      items,
      stats,
      sourceCount: new Set(items.map((item) => item.sourceName)).size,
      siteCount: Math.min(sites.length, maxSites),
      hiddenCommentary,
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
    const siteOrder = Math.max(
      0,
      (aggregate().sites || []).findIndex((entry) => entry.key === site.key)
    );
    const lines = parsePlayLines(
      raw.vod_play_from ?? raw.play_from,
      raw.vod_play_url ?? raw.play_url
    ).map((line, index) => ({
      ...line,
      // 站点越靠前权重越高；同站内第一条线路优先
      preference: 100 - siteOrder * 10 - index
    }));
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

  let categoryCache = null;

  async function loadCategories(options = {}) {
    if (categoryCache && !options.force) return clone(categoryCache);
    const config = aggregate();
    const sites = (config.supportedSites || []).filter(
      (site) =>
        site.enabled &&
        site.sourceId !== DEMO_SOURCE_ID &&
        (site.type === 3 || site.type === 4)
    );
    const site = sites[0];
    if (!site) return [];
    try {
      const payload = await fetchCmsPayload(site, { ac: "list" });
      const seen = new Set();
      const list = [];
      asArray(payload.class).forEach((item) => {
        const id = Number(item.type_id ?? item.id) || 0;
        if (!id || seen.has(id)) return;
        seen.add(id);
        list.push({
          id,
          name: safeString(item.type_name ?? item.name, "未命名分类"),
          pid: Number(item.type_pid ?? item.pid) || 0
        });
      });
      categoryCache = list;
      return clone(list);
    } catch (_) {
      return [];
    }
  }
  async function detailForSource(source, base) {
    const config = aggregate();
    const site = config.sites.find((entry) => entry.key === source.siteKey);
    if (!site) return null;
    const payload = await fetchCmsPayload(site, { ac: "detail", ids: source.vodId });
    const raw = asArray(payload.list)[0];
    if (!raw) return null;
    return hydratedFromRaw(raw, site, { ...base, ...source });
  }

  async function getLibraryDetail(item) {
    if (!item) throw new Error("缺少影片信息");
    // 合并过的条目：把各源的线路都拉回来，供播放器跨源切换
    if (Array.isArray(item.sources) && item.sources.length > 1) {
      const details = (
        await Promise.all(
          item.sources.map((source) => detailForSource(source, item).catch(() => null))
        )
      ).filter(Boolean);
      if (!details.length) throw new Error("所有来源都没有返回详情");
      const seenUrl = new Set();
      const lines = [];
      details.forEach((detail, index) => {
        (detail.lines || []).forEach((line) => {
          const episodes = (line.episodes || []).filter((episode) => {
            if (!episode?.url || seenUrl.has(episode.url)) return false;
            seenUrl.add(episode.url);
            return true;
          });
          if (!episodes.length) return;
          const suffix = detail.siteName || `源${index + 1}`;
          lines.push({
            ...line,
            name: `${line.name} · ${suffix}`,
            preference: 100 - index * 10,
            episodes
          });
        });
      });
      if (!lines.length) return details[0];
      const first = lines[0];
      return {
        ...details[0],
        lines,
        episodes: first.episodes,
        stream: first.episodes[0]?.url || details[0].stream,
        lineName: first.name,
        episodeName: first.episodes[0]?.name || "",
        mergedSources: details.length
      };
    }
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

  /* ---------- 站点级管理（设置 → 影视源） ---------- */

  const SITE_EVENT = "nova:sites-changed";

  /** 只在站点面板内部刷新，不触发片库/直播重载（检测不该把整页打回加载态） */
  function notifySites(reason = "sites") {
    const detail = { reason, revision, overrides: siteOverrides ? siteOverrides.counts() : null };
    window.dispatchEvent(new CustomEvent(SITE_EVENT, { detail }));
  }

  function listSites() {
    return aggregate().sites;
  }

  function findAggregatedSite(key) {
    const value = safeString(key);
    if (!value) return null;
    return aggregate().sites.find((site) => site.key === value) || null;
  }

  function setSiteEnabled(key, enabled) {
    const site = findAggregatedSite(key);
    if (!site) return false;
    siteOverrides?.patch(
      site.key,
      { enabled: Boolean(enabled) },
      { originKey: site.originKey, sourceId: site.sourceId }
    );
    notify(enabled ? "site-enable" : "site-disable");
    return true;
  }

  function setSitesEnabled(keys, enabled) {
    const wanted = new Set((Array.isArray(keys) ? keys : []).map((key) => safeString(key)));
    const targets = aggregate().sites.filter((site) => wanted.has(site.key));
    if (!targets.length) return 0;
    siteOverrides?.patchMany(
      targets.map((site) => ({
        key: site.key,
        originKey: site.originKey,
        sourceId: site.sourceId,
        patch: { enabled: Boolean(enabled) }
      }))
    );
    notify(enabled ? "site-enable-all" : "site-disable-all");
    return targets.length;
  }

  /**
   * 上移 / 下移一个站点。
   * 调整后把当前顺序整体写成显式 order：站点数量有限（几十个），
   * 这比维护「插入位置」的边界情况更不容易出错。
   */
  function moveSite(key, delta) {
    const list = aggregate().sites;
    const from = list.findIndex((site) => site.key === safeString(key));
    if (from < 0) return false;
    const to = Math.max(0, Math.min(list.length - 1, from + Number(delta || 0)));
    if (to === from) return false;
    const next = list.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    siteOverrides?.patchMany(
      next.map((site, index) => ({
        key: site.key,
        originKey: site.originKey,
        sourceId: site.sourceId,
        patch: { order: index }
      }))
    );
    notify("site-order");
    return true;
  }

  function setSiteOrder(key, order) {
    const site = findAggregatedSite(key);
    if (!site) return false;
    siteOverrides?.patch(
      site.key,
      { order: Number(order) },
      { originKey: site.originKey, sourceId: site.sourceId }
    );
    notify("site-order");
    return true;
  }

  function resetSiteOverrides() {
    siteOverrides?.clear();
    siteTestCache.clear();
    notify("site-reset");
    return true;
  }

  /** 外部（例如清除单个站点覆盖后）需要重新聚合一次时用，不改任何数据 */
  function touchSites(reason = "site-refresh") {
    notify(reason);
    return true;
  }

  function siteOverridesSnapshot() {
    return siteOverrides ? siteOverrides.readAll() : {};
  }

  function siteTestRecord(key) {
    return siteTestCache.get(safeString(key)) || null;
  }

  function siteRequestHeaders(site, target) {
    return headerForUrl(target, {
      defaultHeaders: site?.header || {},
      headerRules:
        sources.find((source) => source.id === site?.sourceId)?.parsed?.headers || []
    });
  }

  /**
   * 单站点检测：GET 一次最小请求，按站点类型判定，结果写回 overrides.health。
   * 判定规则在 site-health.js，这里只负责发请求与落库。
   */
  async function testSite(key, options = {}) {
    const site = findAggregatedSite(key);
    if (!site) return { ok: false, key: safeString(key), message: "站点不存在", ms: -1 };
    if (!siteHealth) {
      return { ok: false, key: site.key, message: "站点检测模块未加载", ms: -1 };
    }
    const plan = siteHealth.testPlan(site, { keyword: options.keyword });
    const timeout = timeoutMilliseconds(site.timeout, settingsTimeoutMs());
    const started = Date.now();
    let result;

    if (plan.kind === "unsupported") {
      result = { ok: false, message: plan.reason || "该类型暂不支持检测", ms: -1, count: 0, sample: "" };
    } else {
      try {
        if (plan.kind === "cms") {
          const text = await fetchText(plan.url, {
            headers: siteRequestHeaders(site, plan.url),
            timeout
          });
          result = { ...siteHealth.judgeCms(parseLooseJson(text)), ms: Date.now() - started };
        } else if (plan.kind === "html") {
          const html = await fetchText(plan.url, {
            headers: siteRequestHeaders(site, plan.url),
            timeout
          });
          const documentNode = new DOMParser().parseFromString(html, "text/html");
          const matches = plan.selector
            ? documentNode.querySelectorAll(plan.selector).length
            : 0;
          result = {
            ...siteHealth.judgeHtml({ length: html.length, matches }, plan),
            ms: Date.now() - started
          };
        } else {
          const items = site.adapter === "4kcz" ? await load4kczItems(site, {}, 6) : [];
          result = {
            ...siteHealth.judgeAdapter({ items: items.length, length: items.length ? 1 : 0 }),
            ms: Date.now() - started
          };
        }
      } catch (error) {
        result = {
          ok: false,
          message: error?.message || "检测失败",
          ms: Date.now() - started,
          count: 0,
          sample: ""
        };
      }
    }

    const record = siteHealth.healthRecord(result);
    siteTestCache.set(site.key, record);
    siteOverrides?.patch(
      site.key,
      { health: siteHealth.healthValue(result) },
      { originKey: site.originKey, sourceId: site.sourceId }
    );
    notifySites("site-test");
    return { ...result, key: site.key, name: site.name, record };
  }

  /** 批量检测：顺序执行，避免一次打出几十个请求把源站限流 */
  async function testSites(keys, options = {}) {
    const list = (Array.isArray(keys) && keys.length
      ? keys
      : aggregate().sites.filter((site) => !site.unsupported).map((site) => site.key)
    )
      .map((key) => safeString(key))
      .filter(Boolean);
    const results = [];
    for (const key of list) {
      // eslint-disable-next-line no-await-in-loop
      results.push({ key, result: await testSite(key, options) });
    }
    return results;
  }

  /* ---------- 解析接口（只登记与展示，不自动调用） ---------- */

  const PARSE_KEY = "nova.parses.v1";

  function readCustomParses() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PARSE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.url) : [];
    } catch (_) {
      return [];
    }
  }

  function writeCustomParses(list) {
    try {
      window.localStorage.setItem(PARSE_KEY, JSON.stringify(list));
    } catch (_) {
      /* 写不进去就只在内存里保留 */
    }
  }

  /** 订阅里的 parses + 手工登记的 parses */
  function listParses() {
    const config = aggregate();
    const fromSources = config.parses.map((parse) => ({
      id: `cfg:${shortHash(`${parse.type}|${parse.url}`)}`,
      name: parse.name || "未命名解析",
      type: Number(parse.type) || 1,
      url: parse.url,
      sourceName: parse.sourceName || "",
      custom: false
    }));
    const custom = readCustomParses().map((parse) => ({
      id: parse.id,
      name: safeString(parse.name, "自定义解析"),
      type: Number(parse.type) || 1,
      url: parse.url,
      sourceName: "手工登记",
      custom: true
    }));
    return [...custom, ...fromSources];
  }

  function addParse(input = {}) {
    const url = safeString(input.url);
    if (!url) throw new Error("解析地址不能为空");
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
      throw new Error("解析地址需要 http(s):// 开头，或使用站内路径");
    }
    const list = readCustomParses();
    if (list.some((item) => item.url === url)) throw new Error("这个解析接口已经登记过了");
    const parse = {
      id: `custom:${shortHash(`${url}|${Date.now()}`)}`,
      name: safeString(input.name, "自定义解析"),
      type: Number(input.type) || 1,
      url,
      createdAt: Date.now()
    };
    writeCustomParses([parse, ...list]);
    notify("parse-add");
    return parse;
  }

  function removeParse(id) {
    const list = readCustomParses();
    const next = list.filter((item) => item.id !== id);
    if (next.length === list.length) return false;
    writeCustomParses(next);
    notify("parse-remove");
    return true;
  }

  /* ---------- 首页内容位（吃订阅里的 home.sections） ---------- */

  function homeSections() {
    const config = aggregate();
    const sections = [];
    const seen = new Set();
    sources
      .filter((source) => source.enabled)
      .forEach((source) => {
        const declared = source.parsed?.home?.sections || [];
        declared.forEach((entry) => {
          const siteRef = safeString(entry.site);
          if (!siteRef) return;
          const site =
            config.sites.find((item) => item.key === siteRef) ||
            config.sites.find((item) => item.originKey === siteRef) ||
            config.sites.find((item) => item.name === siteRef) ||
            null;
          if (!site) return;
          const signature = `${entry.title}|${site.key}|${entry.typeId ?? ""}`;
          if (seen.has(signature)) return;
          seen.add(signature);
          sections.push({
            title: safeString(entry.title, site.name),
            siteKey: site.key,
            siteName: site.name,
            sourceName: site.sourceName,
            typeId: entry.typeId
          });
        });
      });
    return sections;
  }

  /**
   * 首页行：按 home.sections 逐行拉内容。
   * 任何一行失败都不影响其它行；全失败时返回空，调用方回落到默认首页。
   */
  async function loadHomeRows(options = {}) {
    const limit = Math.max(1, Number(options.limit) || 6);
    const maxRows = Math.max(1, Number(options.maxRows) || 4);
    const sections = homeSections();
    if (!sections.length) return { rows: [], sections: 0, failures: [] };

    const config = aggregate();
    const rows = [];
    const failures = [];
    for (const section of sections.slice(0, maxRows)) {
      const site = config.sites.find((item) => item.key === section.siteKey);
      if (!site) continue;
      try {
        let items = [];
        if (site.runtimeKind === "adapter" && site.adapter === "4kcz") {
          items = await load4kczItems(site, "", limit);
        } else if (site.type === 3 || site.type === 4) {
          const query = { ac: "videolist", pg: 1 };
          if (section.typeId !== undefined && section.typeId !== null && section.typeId !== "") {
            query.t = section.typeId;
          }
          items = await loadCmsItems(site, query, limit);
        } else if (site.type === 1) {
          items = await loadHtmlSiteItems(site, limit);
        }
        if (items.length) {
          rows.push({
            title: section.title,
            siteName: section.siteName,
            sourceName: section.sourceName,
            items: items.slice(0, limit)
          });
        } else {
          failures.push({ title: section.title, siteName: section.siteName, error: "没有返回条目" });
        }
      } catch (error) {
        failures.push({
          title: section.title,
          siteName: section.siteName,
          error: error?.message || "请求失败"
        });
      }
    }
    return { rows, sections: sections.length, failures };
  }

  /* ---------- 诊断导出 ---------- */

  function diagnostics() {
    const config = aggregate();
    return {
      generatedAt: new Date().toISOString(),
      app: { format: "nova-tv-preview", revision },
      settings: currentSettings(),
      stats: config.stats,
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        url: source.url,
        enabled: source.enabled,
        lastSync: source.lastSync,
        error: source.error || "",
        siteCount: source.parsed?.sites?.length || 0,
        liveCount: source.parsed?.lives?.length || 0,
        parseCount: source.parsed?.parses?.length || 0,
        compatibility: source.parsed?.compatibility?.status || "",
        runtime: source.runtime?.status || "pending"
      })),
      sites: config.sites.map((site) => ({
        key: site.key,
        originKey: site.originKey,
        name: site.name,
        type: site.type,
        runtimeKind: site.runtimeKind,
        sourceName: site.sourceName,
        enabled: site.enabled,
        searchable: site.searchable,
        unsupported: site.unsupported || "",
        health: typeof site.health === "number" ? site.health : null,
        overridden: Boolean(site.overridden),
        overrideVia: site.overrideVia || "",
        order: typeof site.order === "number" ? site.order : null
      })),
      parses: listParses(),
      overrides: siteOverridesSnapshot(),
      homeSections: homeSections()
    };
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  loadSources();

  // 远程订阅（kind=url）在启动时静默同步一次：后台「发布」之后，
  // 前台刷新页面就能拿到新内容，不用手动点同步。
  const AUTO_SYNC_MIN_MS = 30 * 60 * 1000;
  let autoSyncRunning = false;

  async function autoSyncRemoteSources() {
    if (autoSyncRunning) return;
    const targets = sources.filter(
      (source) =>
        source.enabled &&
        source.kind === "url" &&
        source.url &&
        Date.now() - (source.lastSync || 0) > AUTO_SYNC_MIN_MS
    );
    if (!targets.length) return;
    autoSyncRunning = true;
    let changed = 0;
    for (const source of targets) {
      try {
        await syncSource(source.id, { probe: false });
        changed += 1;
      } catch (_) {
        /* 单个失败不影响其它订阅 */
      }
    }
    autoSyncRunning = false;
    if (changed) notify("auto-sync");
  }

  // 仅在真实浏览器里跑；后台用 require 加载本文件时不触发网络请求
  if (!globalThis.__NOVA_HEADLESS__ && typeof window !== "undefined" && window.setTimeout) {
    window.setTimeout(autoSyncRemoteSources, 1500);
  }

  // 设置一变（并发/超时/UA/解说过滤），片库与直播的缓存就必须作废，
  // 否则改了设置但界面还拿旧结果，看起来像「设置没生效」。
  if (settingsApi?.subscribe) {
    settingsApi.subscribe(() => {
      notify("settings");
    });
  }

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
    addPreset,
    listPresets,
    exportConfig,
    listParses,
    addParse,
    removeParse,
    syncSource,
    syncAll,
    probeSource,
    toggleSource,
    removeSource,
    clearAllSources,
    restoreDemo,
    loadLiveChannels,
    listLiveSources,
    addLiveSource,
    removeLiveSource,
    setLiveSourceEnabled,
    markLiveSourceResult,
    testLiveSource,
    LIVE_SOURCE_ID,
    loadLibraryItems,
    loadHomeRows,
    homeSections,
    diagnostics,
    getLibraryDetail,
    loadCategories,
    mediaUrl,
    proxyUrl,
    headerForUrl,
    onChange,
    // 站点级管理（设置 → 影视源）
    siteEvent: SITE_EVENT,
    listSites,
    setSiteEnabled,
    setSitesEnabled,
    moveSite,
    setSiteOrder,
    resetSiteOverrides,
    touchSites,
    siteOverridesSnapshot,
    siteTestRecord,
    testSite,
    testSites,
    get revision() {
      return revision;
    }
  };
})();
