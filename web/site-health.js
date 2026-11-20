/**
 * NOVA TV · 站点健康检测与筛选（纯逻辑，无 DOM / 无网络）
 *
 * 对齐 tvbox-desktop 的 sites.ts#testSite：
 *   · 苹果 CMS（type 3/4）：打一次 ac=detail，能解析出 list 且非空才算通；
 *   · HTML 规则（type 1）：打 search 模板，再用 rules.list 选择器数节点，
 *     选择器匹配不到要单独报「规则可能已失效」，不能笼统说连不上；
 *   · 公开网页直连适配器：打适配器入口，能抓到条目就算通；
 *   · Spider / 私有协议：不做假测试，直接如实标记「检测不可用」。
 *
 * 这里只负责「怎么测、怎么判」，真正的 fetch / DOM 解析由 sources.js 注入，
 * 所以这一层可以在 Node 里直接单测。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NovaSiteHealth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TYPE_FILTERS = Object.freeze([
    { id: "all", label: "全部类型" },
    { id: "cms", label: "苹果 CMS" },
    { id: "html", label: "HTML 规则" },
    { id: "adapter", label: "兼容直连" },
    { id: "spider", label: "需 Spider" },
    { id: "other", label: "其它" }
  ]);

  function text(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value).trim() || fallback;
  }

  /** 追加查询参数：保留原参数，同名参数以传入值为准 */
  function appendQuery(url, params = {}) {
    const base = text(url);
    if (!base) return "";
    const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null);
    if (!entries.length) return base;
    const [head, ...rest] = base.split("#");
    const joiner = head.includes("?") ? (/[?&]$/.test(head) ? "" : "&") : "?";
    const query = entries
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
      .join("&");
    return `${head}${joiner}${query}${rest.length ? `#${rest.join("#")}` : ""}`;
  }

  /** 把配置里的 {wd} / {kw} / {key} / {keyword} 占位符换掉 */
  function fillKeyword(template, keyword) {
    const value = encodeURIComponent(keyword || "测试");
    return text(template).replace(/\{(wd|kw|key|keyword|search)\}/gi, value);
  }

  function classify(site) {
    if (!site) return "unsupported";
    if (site.unsupported) return "unsupported";
    if (site.runtimeKind === "adapter") return "adapter";
    if (site.type === 3 || site.type === 4) return "cms";
    if (site.type === 1) return "html";
    return "unsupported";
  }

  /**
   * 生成检测计划。返回 { kind, url, selector, keyword, reason }
   * kind=unsupported 时 reason 直接给用户看，不发请求。
   */
  function testPlan(site, options = {}) {
    const kind = classify(site);
    const keyword = text(options.keyword, "测试");
    if (kind === "unsupported") {
      return {
        kind,
        reason: site?.unsupported || "该类型暂不支持运行检测",
        url: "",
        selector: ""
      };
    }
    if (kind === "adapter") {
      return {
        kind,
        url: text(site.adapterBaseUrl || site.api),
        selector: "",
        keyword,
        reason: ""
      };
    }
    if (kind === "cms") {
      if (!site.api) return { kind, reason: "站点未配置接口地址", url: "", selector: "" };
      return {
        kind,
        url: appendQuery(site.api, { ac: "detail", pg: 1 }),
        selector: "",
        keyword,
        reason: ""
      };
    }
    const template = text(site.rules?.search || site.api);
    if (!template) return { kind, reason: "HTML 规则站缺少搜索地址或接口地址", url: "", selector: "" };
    const target = fillKeyword(template, keyword);
    if (!/^https?:\/\//i.test(target)) {
      return {
        kind,
        reason: "网页规则站需要一个 http(s) 地址，当前地址不可直接请求",
        url: "",
        selector: ""
      };
    }
    return { kind, url: target, selector: text(site.rules?.list), keyword, reason: "" };
  }

  function fail(message, extra = {}) {
    return { ok: false, message: text(message, "检测失败"), count: 0, sample: "", ...extra };
  }

  /** 苹果 CMS：code 非成功或 list 为空都算不通，但消息要能区分这两种情况 */
  function judgeCms(payload) {
    if (!payload || typeof payload !== "object") return fail("接口返回的不是 JSON 对象");
    if (payload.code !== undefined && Number(payload.code) !== 1) {
      return fail(`接口返回异常：${text(payload.msg, `code=${payload.code}`)}`);
    }
    const list = Array.isArray(payload.list) ? payload.list : [];
    if (!list.length) return fail("接口连通但未返回数据");
    const sample = text(list[0]?.vod_name ?? list[0]?.name);
    return { ok: true, message: `正常，返回 ${list.length} 条`, count: list.length, sample };
  }

  /**
   * HTML 规则站：page 由调用方注入
   * { length, matches } —— matches 是用 rules.list 选择器数出来的节点数。
   */
  function judgeHtml(page, plan = {}) {
    const length = Number(page?.length ?? 0);
    const matches = Number(page?.matches ?? 0);
    if (!length) return fail("页面没有内容");
    if (length < 50) return fail("页面内容过短，可能被拦截");
    const selector = text(plan.selector);
    if (selector && !matches) {
      return fail(`页面可访问，但列表选择器「${selector}」没有匹配到节点，规则可能已失效`);
    }
    return {
      ok: true,
      message: selector ? `正常，匹配到 ${matches} 个列表节点` : `正常，页面 ${length} 字节`,
      count: matches,
      sample: ""
    };
  }

  /** 公开网页直连适配器：按抓到的条目数判定 */
  function judgeAdapter(page) {
    const items = Number(page?.items ?? 0);
    const length = Number(page?.length ?? 0);
    if (items > 0) return { ok: true, message: `正常，读取到 ${items} 个条目`, count: items, sample: "" };
    if (!length) return fail("适配器页面没有返回内容");
    return fail("页面可访问，但没有解析出条目，站点结构可能已变化");
  }

  /** 结构化健康记录，直接写进 overrides.health 之外的展示层 */
  function healthRecord(result, now = Date.now()) {
    return {
      ok: Boolean(result?.ok),
      ms: Number(result?.ms ?? -1),
      message: text(result?.message, result?.ok ? "正常" : "检测失败"),
      sample: text(result?.sample),
      at: now
    };
  }

  /** 0 / 正数 = 可用（数字是耗时毫秒），-1 = 失败 */
  function healthValue(result) {
    return result?.ok ? Math.max(0, Number(result.ms ?? 0)) : -1;
  }

  function formatHealth(health) {
    if (!health) return { text: "未检测", state: "unknown" };
    if (typeof health === "number") {
      return health >= 0 ? { text: `${health}ms`, state: "ok" } : { text: "失败", state: "bad" };
    }
    if (health.ok) {
      return { text: health.ms >= 0 ? `${health.ms}ms` : "正常", state: "ok" };
    }
    return { text: "失败", state: "bad" };
  }

  /**
   * 默认排序：用户显式设置的 order 优先，其余保持配置里的原始顺序
   * （`index` 由调用方按 aggregate 顺序写入），最后按名称兜底。
   */
  function sortSites(sites) {
    return sites.slice().sort((left, right) => {
      const leftOrder = Number.isFinite(left.order) ? left.order : 10_000 + Number(left.index ?? 0);
      const rightOrder = Number.isFinite(right.order) ? right.order : 10_000 + Number(right.index ?? 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return String(left.name || "").localeCompare(String(right.name || ""), "zh-Hans-CN");
    });
  }

  function typeBucket(site) {
    if (site?.runtimeKind === "adapter") return "adapter";
    if (site?.type === 0) return "spider";
    if (site?.type === 3 || site?.type === 4) return "cms";
    if (site?.type === 1) return "html";
    return "other";
  }

  function matchesQuery(site, query) {
    const needle = text(query).toLowerCase();
    if (!needle) return true;
    return [site?.name, site?.key, site?.originKey, site?.api, site?.sourceName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }

  /** 列表筛选：类型 + 只看启用 + 关键词，全部命中才保留 */
  function filterSites(sites, state = {}) {
    const typeFilter = text(state.typeFilter, "all");
    return sites.filter((site) => {
      if (typeFilter !== "all" && typeBucket(site) !== typeFilter) return false;
      if (state.onlyEnabled && !site.enabled) return false;
      if (state.sourceId && site.sourceId !== state.sourceId) return false;
      return matchesQuery(site, state.query);
    });
  }

  /** 批量测试结果汇总，用于底部一行提示 */
  function summarize(results) {
    const list = Array.isArray(results) ? results : [];
    const ok = list.filter((entry) => entry?.result?.ok);
    const failed = list.length - ok.length;
    const times = ok.map((entry) => Number(entry.result.ms)).filter((value) => Number.isFinite(value) && value >= 0);
    const average = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : -1;
    return {
      total: list.length,
      ok: ok.length,
      failed,
      averageMs: average,
      message: list.length
        ? `${ok.length}/${list.length} 可用${failed ? ` · ${failed} 个失败` : ""}${
            average >= 0 ? ` · 平均 ${average}ms` : ""
          }`
        : "没有可测试的站点"
    };
  }

  return {
    TYPE_FILTERS,
    appendQuery,
    fillKeyword,
    classify,
    testPlan,
    judgeCms,
    judgeHtml,
    judgeAdapter,
    healthRecord,
    healthValue,
    formatHealth,
    sortSites,
    typeBucket,
    matchesQuery,
    filterSites,
    summarize
  };
});
