/*
  NOVA TV · 四大分类页（电影 / 电视剧 / 综艺 / 动漫）
  - 统一顶栏：品牌 + 分隔线 + 返回片库 + 页面名 ｜ 搜索 / 筛选 / 排序 / 状态
  - 每页五个模块，横向卡片 + 纵向滚动，全部占位内容
  - 与聚合片库共用 .lib-* 组件与几何焦点导航
*/
(function () {
  "use strict";

  const host = document.querySelector(".stage") || document.body;
  const libraryPage = document.getElementById("libraryPage");
  if (!libraryPage) return;

  const PAGES = {
    movie: {
      label: "电影",
      eyebrow: "MOVIE",
      tone: "violet",
      modules: [
        { title: "高分电影", sub: "口碑之作", icon: "i-star", tone: "violet" },
        { title: "电影热播", sub: "近期最热", icon: "i-flame", tone: "rose" },
        { title: "院线热映", sub: "正在上映", icon: "i-film", tone: "sky" },
        { title: "即将上映", sub: "敬请期待", icon: "i-clock", tone: "amber" },
        { title: "冷门好片", sub: "值得发现", icon: "i-eye", tone: "plum" }
      ],
      filters: [
        { key: "region", label: "地区", options: ["全部", "中国大陆", "中国香港", "美国", "欧洲", "日韩"] },
        { key: "year", label: "年份", options: ["全部", "2026", "2025", "2024", "2023", "更早"] },
        { key: "genre", label: "类型", options: ["全部", "剧情", "科幻", "动作", "喜剧", "悬疑", "爱情"] },
        { key: "quality", label: "清晰度", options: ["全部", "4K", "1080P", "720P"] }
      ]
    },
    series: {
      label: "电视剧",
      eyebrow: "SERIES",
      tone: "rose",
      modules: [
        { title: "国产新剧", sub: "新剧首发", icon: "i-tv", tone: "rose" },
        { title: "韩剧在追", sub: "每周更新", icon: "i-flame", tone: "violet" },
        { title: "日剧上新", sub: "本季新番", icon: "i-star", tone: "sky" },
        { title: "美剧续看", sub: "接着上次", icon: "i-play", tone: "amber" },
        { title: "口碑高分剧", sub: "评分前列", icon: "i-check", tone: "plum" }
      ],
      filters: [
        { key: "region", label: "地区", options: ["全部", "中国大陆", "韩国", "日本", "美国", "英国"] },
        { key: "year", label: "年份", options: ["全部", "2026", "2025", "2024", "2023", "更早"] },
        { key: "genre", label: "类型", options: ["全部", "都市", "悬疑", "古装", "医疗", "律政"] },
        { key: "status", label: "更新状态", options: ["全部", "连载中", "已完结", "待播出"] }
      ]
    },
    variety: {
      label: "综艺",
      eyebrow: "VARIETY",
      tone: "amber",
      modules: [
        { title: "热门综艺", sub: "全网热议", icon: "i-flame", tone: "amber" },
        { title: "正在更新", sub: "最新一期", icon: "i-clock", tone: "rose" },
        { title: "下饭必看", sub: "轻松解压", icon: "i-music", tone: "mint" },
        { title: "高分口碑综艺", sub: "评分优选", icon: "i-star", tone: "violet" },
        { title: "真人秀精选", sub: "旅行 · 生活 · 竞技", icon: "i-tv", tone: "sky" }
      ],
      filters: [
        { key: "region", label: "地区", options: ["全部", "中国大陆", "中国台湾", "韩国", "日本"] },
        { key: "genre", label: "类型", options: ["全部", "真人秀", "访谈", "音乐", "生活", "竞技"] },
        { key: "year", label: "年份", options: ["全部", "2026", "2025", "2024", "更早"] },
        { key: "status", label: "更新状态", options: ["全部", "连载中", "已完结"] }
      ]
    },
    anime: {
      label: "动漫",
      eyebrow: "ANIME",
      tone: "sky",
      modules: [
        { title: "热门番剧", sub: "本季霸权", icon: "i-flame", tone: "sky" },
        { title: "新番更新", sub: "每周追更", icon: "i-clock", tone: "violet" },
        { title: "经典动画", sub: "跨年代佳作", icon: "i-star", tone: "amber" },
        { title: "国创动漫", sub: "国产原创", icon: "i-film", tone: "rose" },
        { title: "治愈精选", sub: "温柔日常", icon: "i-eye", tone: "mint" }
      ],
      filters: [
        { key: "region", label: "地区", options: ["全部", "日本", "中国大陆", "美国", "欧洲"] },
        { key: "genre", label: "类型", options: ["全部", "热血", "奇幻", "日常", "恋爱", "科幻"] },
        { key: "year", label: "年份", options: ["全部", "2026", "2025", "2024", "更早"] },
        { key: "status", label: "连载状态", options: ["全部", "连载中", "已完结", "剧场版"] }
      ]
    }
  };

  const SORTS = [
    { key: "default", label: "综合排序" },
    { key: "latest", label: "最新更新" },
    { key: "hot", label: "热度优先" },
    { key: "score", label: "评分优先" }
  ];

  const state = { key: "", panel: "", sort: "default", filter: {} };
  const pages = {};
  // 「查看全部」用的独立列表页，由 buildListPage() 建出来
  let listPage = null;

  /* ---------- 构建页面 ---------- */

  function placeholderCard(index, label) {
    const tone = ["violet", "rose", "sky", "amber", "plum", "mint"][index % 6];
    return `
      <button class="lib-card poster-card focusable" type="button" aria-label="${label}">
        <span class="poster-cover tone-${tone}">
          <span class="lib-card-grain"></span>
          <span class="lib-card-shade"></span>
        </span>
      </button>`;
  }

  function shelfMarkup(module, index) {
    const cards = Array.from({ length: 6 }, (_, i) => placeholderCard(i + index, `${module.title} 占位 ${i + 1}`)).join("");

    return `
      <section class="lib-shelf cat-shelf" data-module="${index}">
        <div class="lib-shelf-head">
          <span class="lib-shelf-icon"><svg class="icon"><use href="#${module.icon}" /></svg></span>
          <h2>${module.title}</h2>
          <span class="cat-shelf-sub">${module.sub}</span>
          <button class="lib-shelf-link focusable" type="button" data-cat-all="${index}">
            <span>查看全部</span>
            <svg class="icon"><use href="#i-arrow-right" /></svg>
          </button>
        </div>
        <div class="lib-rail">${cards}</div>
      </section>`;
  }

  /* ---------- 顶栏：与片库首页共用同一份 DOM ---------- */

  // 直接克隆片库首页的 .lib-topbar：index.html 里改一次，所有分类页跟着变，
  // 省得 7 个 Tab + 3 个图标按钮在六个地方各写一遍。
  function topbarMarkup(activeKey) {
    const source = document.querySelector("#libraryPage .lib-topbar");
    if (!source) return "";
    const clone = source.cloneNode(true);
    clone.querySelectorAll("[data-lib-tab]").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.libTab === activeKey);
      tab.classList.remove("is-focused");
    });
    clone.querySelectorAll("[data-lib-action]").forEach((btn) => btn.classList.remove("is-focused"));
    // 顶栏 logo 现在也是可聚焦按钮，克隆体要一起清掉焦点态，免得出现两个高亮
    clone.querySelectorAll("[data-go-home]").forEach((btn) => btn.classList.remove("is-focused"));
    return clone.outerHTML;
  }

  // 分类页自己的东西（标题、状态、筛选、排序）落到顶栏下面一行
  function toolbarMarkup(config) {
    return `
      <div class="cat-toolbar">
        <span class="cat-toolbar-eyebrow">${config.eyebrow}</span>
        <h1 class="cat-toolbar-title">${config.label}</h1>
        <span class="cat-status"><i class="status-dot mint"></i>在线</span>
        <div class="cat-toolbar-actions">
          <button class="lib-pill focusable" type="button" data-cat-panel="filter">
            <svg class="icon"><use href="#i-tune" /></svg><span>筛选</span>
          </button>
          <button class="lib-pill focusable" type="button" data-cat-panel="sort">
            <svg class="icon"><use href="#i-list" /></svg><span>排序</span>
          </button>
        </div>
      </div>`;
  }

  function buildPage(key) {
    const config = PAGES[key];
    const section = document.createElement("section");
    section.className = "page-screen cat-page";
    section.id = `catPage-${key}`;
    section.hidden = true;
    section.setAttribute("aria-label", `${config.label}分类`);
    section.innerHTML = `
      <div class="page-scrim" aria-hidden="true"></div>
      <div class="lib-shell cat-shell">
        ${topbarMarkup(key)}
        ${toolbarMarkup(config)}

        <main class="cat-scroll" data-cat-scroll>
          ${config.modules.map(shelfMarkup).join("")}
        </main>

        <div class="lib-panel" data-cat-panelbox hidden></div>
        <div class="cat-toast" data-cat-toast hidden></div>
      </div>
    `;
    host.appendChild(section);
    pages[key] = section;
    return section;
  }

  Object.keys(PAGES).forEach(buildPage);

  /* ---------- 真实数据：按 CMS 分类抓取，对应到 5 个模块 ---------- */
  /* typeId 来自采集站分类表：1 电影片 / 13 国产剧 / 15 韩国剧 / 16 欧美剧 / 22 日本剧
     25 大陆综艺 / 26 港台综艺 / 27 日韩综艺 / 29 国产动漫 / 30 日韩动漫 / 31 欧美动漫
     45 预告片 / 20 记录片 */

  const SECTION_RULES = {
    movie: [
      { typeId: 11, sort: "score" },
      { typeId: 6, sort: "new" },
      { typeId: 9, sort: "year" },
      { typeId: 8, sort: "year" },
      { typeId: 20, sort: "score" }
    ],
    series: [
      { typeId: 13, sort: "new" },
      { typeId: 15, sort: "new" },
      { typeId: 22, sort: "new" },
      { typeId: 16, sort: "new" },
      { typeId: 13, sort: "score", offset: 5 }
    ],
    variety: [
      { typeId: 25, sort: "new" },
      { typeId: 26, sort: "new" },
      { typeId: 27, sort: "new" },
      { typeId: 25, sort: "score", offset: 6 },
      { typeId: 28, sort: "new" }
    ],
    anime: [
      { typeId: 30, sort: "new" },
      { typeId: 29, sort: "new" },
      { typeId: 31, sort: "new" },
      { typeId: 29, sort: "score", offset: 6 },
      { typeId: 32, sort: "new" }
    ]
  };

  function splitMeta(meta) {
    const parts = String(meta || "").split("·").map((part) => part.trim()).filter(Boolean);
    const year = parts.find((part) => /^\d{4}$/.test(part)) || "";
    const scoreRaw = parts.find((part) => /分$/.test(part)) || "";
    const status = parts.find((part) => /更新|全\s*\d|完结|连载|第\d+[集期]/.test(part) && !/分$/.test(part)) || "";
    return { year, status, score: scoreRaw.replace(/\s*分$/, "") };
  }

  function badgeOf(item, info) {
    const status = item.status || info.status;
    if (status) {
      const numbers = String(status).match(/\d+\s*[集期]/);
      if (numbers) return String(status).startsWith("全") ? `全 ${numbers[0]}` : numbers[0];
      return String(status).slice(0, 8);
    }
    if (item.score > 0) return `★ ${item.score.toFixed(1)}`;
    return "";
  }

  /* 卡片 → 条目 的登记表：分类页 / 列表页 / 更多分类 共用一份，点卡进详情时用 */
  const catalogItems = new Map();

  function rememberCatalog(item) {
    if (item?.key) catalogItems.set(String(item.key), item);
  }

  function posterCard(item) {
    rememberCatalog(item);
    const pic = item.image || "";
    const title = item.title || "";
    const info = splitMeta(item.meta);
    const badge = badgeOf(item, info);
    const metaLine = [item.year || info.year, item.type].filter(Boolean).join(" · ");
    return `
      <button class="lib-card poster-card has-art focusable" type="button" data-vod="${item.key || ""}" aria-label="${title}">
        <span class="poster-cover">
          ${pic ? `<img src="${pic}" alt="" loading="eager" decoding="async" />` : ""}
          <span class="lib-card-shade"></span>
          <span class="poster-badges">
            ${badge ? `<span class="poster-status">${badge}</span>` : ""}
            ${item.score > 0 ? `<span class="poster-score">★ ${item.score.toFixed(1)}</span>` : ""}
          </span>
          <span class="poster-copy">
            <span class="poster-title" title="${title}">${title}</span>
            <span class="poster-meta">${metaLine}</span>
          </span>
        </span>
      </button>`;
  }

  async function fetchSection(rule) {
    const api = window.NovaSources;
    if (!api?.loadLibraryItems) return [];
    const result = await api.loadLibraryItems({ type: rule.typeId, limit: 24 });
    let items = (result?.items || result || []).filter((item) => item?.image);
    if (rule.sort === "score") items = items.sort((a, b) => (b.score || 0) - (a.score || 0));
    if (rule.sort === "year") items = items.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    const offset = rule.offset || 0;
    return items.slice(offset, offset + 6);
  }

  async function fallbackPool() {
    const api = window.NovaSources;
    if (!api?.loadLibraryItems) return [];
    const out = [];
    for (const page of [1, 2]) {
      try {
        const result = await api.loadLibraryItems({ page });
        out.push(...(result?.items || result || []));
      } catch (_) {
        break;
      }
    }
    const seen = new Set();
    return out.filter((item) => {
      if (!item?.key || seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }

  async function hydrateCategory(key) {
    const page = pages[key];
    if (!page || !window.NovaSources) return;
    const rails = [...page.querySelectorAll(".cat-shelf .lib-rail")];
    const rules = SECTION_RULES[key] || [];

    const results = await Promise.all(
      rails.map(async (rail, index) => {
        const rule = rules[index];
        if (!rule) return [];
        try {
          return await fetchSection(rule);
        } catch (_) {
          return [];
        }
      })
    );

    const needFallback = results.some((list) => list.length < 6);
    const pool = needFallback ? await fallbackPool() : [];

    rails.forEach((rail, index) => {
      let slice = results[index] || [];
      if (slice.length < 6 && pool.length) {
        const used = new Set(slice.map((item) => item.key));
        const extra = pool.filter((item) => !used.has(item.key));
        slice = slice.concat(extra).slice(0, 6);
      }
      if (slice.length) rail.innerHTML = slice.map(posterCard).join("");
    });
  }
  /* ---------- 焦点 ---------- */

  function current() {
    if (state.key === "more") return morePage || null;
    if (state.key === "list") return listPage || null;
    return pages[state.key] || null;
  }

  function focusables(scope) {
    return [...scope.querySelectorAll(".focusable")].filter((node) => {
      if (node.disabled) return false;
      if (node.closest("[hidden]")) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    });
  }

  function focusEl(node, scroll) {
    if (!node) return false;
    const page = current();
    page?.querySelectorAll(".is-focused").forEach((el) => el.classList.remove("is-focused"));
    node.classList.add("is-focused");
    node.focus({ preventScroll: true });
    if (scroll !== false) {
      node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
    return true;
  }

  function activeEl() {
    const page = current();
    if (!page) return null;
    return page.querySelector(".focusable.is-focused") || (page.contains(document.activeElement) ? document.activeElement : null);
  }

  function move(active, direction, scope) {
    // 从 Tab 那一行往下走：先落到「筛选 / 排序」工具条，再往下才是卡片
    if (direction === "down" && active.closest(".lib-topbar") && !active.closest(".lib-actions")) {
      const toolbar = scope.querySelector(".cat-toolbar .lib-pill");
      if (toolbar) return toolbar;
    }
    const pool = focusables(scope);
    const a = active.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;

    for (const node of pool) {
      if (node === active) continue;
      const r = node.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      let primary = 0;
      let secondary = 0;
      if (direction === "left" && dx < -12) { primary = -dx; secondary = Math.abs(dy); }
      else if (direction === "right" && dx > 12) { primary = dx; secondary = Math.abs(dy); }
      else if (direction === "up" && dy < -12) { primary = -dy; secondary = Math.abs(dx); }
      else if (direction === "down" && dy > 12) { primary = dy; secondary = Math.abs(dx); }
      else continue;
      const score = primary + secondary * 1.8;
      if (score < bestScore) { bestScore = score; best = node; }
    }
    return best;
  }

  /* ---------- 面板 ---------- */

  function panelBox() {
    return current()?.querySelector("[data-cat-panelbox]") || null;
  }

  function panelMarkup() {
    return `
      <div class="lib-panel-card" role="dialog" aria-modal="true">
        <div class="lib-panel-head">
          <div>
            <span class="lib-panel-kicker">${state.panel === "sort" ? "SORT" : "FILTER"}</span>
            <h2>${state.panel === "sort" ? "排序" : "筛选"}</h2>
          </div>
          <button class="lib-panel-close focusable" type="button" data-cat-close aria-label="关闭">
            <svg class="icon"><use href="#i-close" /></svg>
          </button>
        </div>
        <div class="lib-panel-body" data-cat-body></div>
        <div class="lib-panel-foot">
          <button class="lib-btn ghost focusable" type="button" data-cat-close><span>取消</span></button>
          <button class="lib-btn primary focusable" type="button" data-cat-apply><span>应用</span></button>
        </div>
      </div>`;
  }

  function paintPanelBody() {
    const box = panelBox();
    if (!box) return;
    const body = box.querySelector("[data-cat-body]");
    if (!body) return;

    if (state.panel === "sort") {
      body.innerHTML = `<div class="lib-option-list">${SORTS.map((item) => `
        <button class="lib-option focusable ${state.sort === item.key ? "is-active" : ""}" type="button" data-cat-sort="${item.key}">
          <span>${item.label}</span><svg class="icon"><use href="#i-check" /></svg>
        </button>`).join("")}</div>`;
      return;
    }

    const filters = PAGES[state.key].filters;
    body.innerHTML = filters.map((group) => `
      <div class="lib-filter-group">
        <span class="lib-filter-label">${group.label}</span>
        <div class="lib-chip-row">
          ${group.options.map((option) => `
            <button class="lib-chip focusable ${(state.filter[group.key] || "全部") === option ? "is-active" : ""}"
              type="button" data-cat-filter="${group.key}" data-cat-value="${option}">${option}</button>`).join("")}
        </div>
      </div>`).join("");
  }

  function bindPanelBody() {
    const box = panelBox();
    if (!box) return;
    box.querySelectorAll("[data-cat-sort]").forEach((node) => {
      node.addEventListener("click", () => {
        state.sort = node.dataset.catSort;
        paintPanelBody();
        bindPanelBody();
      });
    });
    box.querySelectorAll("[data-cat-filter]").forEach((node) => {
      node.addEventListener("click", () => {
        state.filter[node.dataset.catFilter] = node.dataset.catValue;
        paintPanelBody();
        bindPanelBody();
      });
    });
  }

  function openPanel(kind) {
    const box = panelBox();
    if (!box) return;
    state.panel = kind;
    box.innerHTML = panelMarkup();
    box.hidden = false;
    paintPanelBody();
    bindPanelBody();
    box.querySelectorAll("[data-cat-close]").forEach((node) => node.addEventListener("click", () => closePanel(true)));
    box.querySelector("[data-cat-apply]")?.addEventListener("click", () => closePanel(true));
    focusEl(box.querySelector(".focusable"), false);
  }

  function closePanel(restore) {
    const box = panelBox();
    if (!box || box.hidden) return;
    const kind = state.panel;
    box.hidden = true;
    box.innerHTML = "";
    state.panel = "";
    if (restore) {
      const page = current();
      focusEl(page?.querySelector(`[data-cat-panel="${kind}"]`), false);
    }
  }

  /* ---------- 打开 / 返回 ---------- */

  function open(key) {
    if (!PAGES[key]) return;
    state.key = key;
    state.filter = {};

    Object.values(pages).forEach((section) => {
      section.hidden = true;
      section.classList.remove("is-active");
    });
    libraryPage.hidden = true;
    libraryPage.classList.remove("is-active");
    // 从「更多分类」直接切到四大分类时要把它也收起来，否则两页叠着
    if (typeof morePage !== "undefined" && morePage) {
      morePage.hidden = true;
      morePage.classList.remove("is-active");
    }
    if (listPage) {
      listPage.hidden = true;
      listPage.classList.remove("is-active");
      listState.requestId += 1;
      listState.loading = false;
    }

    const section = pages[key];
    section.hidden = false;
    requestAnimationFrame(() => section.classList.add("is-active"));
    const scroll = section.querySelector("[data-cat-scroll]");
    if (scroll) scroll.scrollTop = 0;

    // 顶栏选中态跟着分类走
    window.NovaLibraryNav?.paintActive?.(key);

    window.setTimeout(() => {
      const first = section.querySelector("[data-cat-panel=\"filter\"]") || focusables(section)[0];
      focusEl(first, false);
    }, 220);

    hydrateCategory(key).catch(() => {});
  }

  // quiet = true 时不再把焦点还回分类卡（顶栏图标直接跳去别的页面时用）
  function back(quiet) {
    if (state.key === "more") {
      const result = morePage.querySelector("[data-more-result]");
      if (result && !result.hidden) {
        showMoreGrid();
        return;
      }
    }
    const key = state.key;
    Object.values(pages).forEach((section) => {
      section.hidden = true;
      section.classList.remove("is-active");
    });
    if (typeof morePage !== "undefined" && morePage) {
      morePage.hidden = true;
      morePage.classList.remove("is-active");
    }
    if (listPage) {
      listPage.hidden = true;
      listPage.classList.remove("is-active");
      listState.requestId += 1;
      listState.loading = false;
    }
    state.key = "";
    window.NovaPages?.open("library", document.body, { category: "全部" });
    // 顶栏回到「首页」
    window.NovaLibraryNav?.paintActive?.("home");
    // open() 在页面已激活时不会重加 is-active，这里补一次，避免回来是空白
    libraryPage.hidden = false;
    requestAnimationFrame(() => {
      libraryPage.classList.add("is-active");
      Object.values(pages).forEach((section) => {
        section.classList.remove("is-active");
        section.hidden = true;
      });
    });
    if (quiet !== true) {
      window.setTimeout(() => window.NovaLibraryUI?.focusCategory?.(key), 240);
    }
  }

  /* ---------- 键盘 ---------- */

  function onKeyDown(event) {
    const page = current();
    if (!page || page.hidden) return;
    const box = panelBox();
    const panelOpen = box && !box.hidden;

    if (event.key === "Escape") {
      if (panelOpen) {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      } else if (state.key === "list") {
        event.preventDefault();
        event.stopPropagation();
        closeList();
      } else {
        event.preventDefault();
        event.stopPropagation();
        back();
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      const active = activeEl();
      if (active) {
        event.preventDefault();
        event.stopPropagation();
        active.click();
      }
      return;
    }

    const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    const direction = map[event.key];
    if (!direction) return;

    const active = activeEl();
    const scope = panelOpen ? box : page;
    if (!active) {
      focusEl(focusables(scope)[0], false);
      event.preventDefault();
      return;
    }
    const target = move(active, direction, scope);
    if (target) {
      event.preventDefault();
      event.stopPropagation();
      focusEl(target, !panelOpen);
    }
  }

  document.addEventListener("keydown", onKeyDown, true);

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-cat-back]");
    if (!target) return;
    event.preventDefault();
    back();
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-cat-panel]");
    if (!trigger) return;
    const page = current();
    if (!page || !page.contains(trigger)) return;
    event.preventDefault();
    openPanel(trigger.dataset.catPanel);
  });

  /* 调试/预览：?page=movie|series|variety|anime 直接打开，&panel=filter|sort 打开面板 */
  const qp = new URLSearchParams(window.location.search);
  const wanted = qp.get("page");
  if (wanted === "more") {
    window.setTimeout(() => openMore(), 320);
  } else if (wanted && PAGES[wanted]) {
    window.setTimeout(() => {
      open(wanted);
      if (qp.get("panel")) {
        window.setTimeout(() => openPanel(qp.get("panel")), 380);
      }
    }, 320);
  }

  // 片库分类卡 -> 分类页（事件委托，避免依赖片库脚本的绑定顺序）
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lib-category]");
    if (!trigger) return;
    if (trigger.closest(".lib-legacy")) return;
    const key = trigger.dataset.libCategory;
    if (!key) return;
    event.preventDefault();
    if (key === "more") openMore();
    else open(key);
  });

  function showToast(message) {
    const page = current();
    const toast = page?.querySelector("[data-cat-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 1800);
  }

  document.addEventListener("click", (event) => {
    const page = current();
    if (!page || !page.contains(event.target)) return;
    if (event.target.closest("[data-cat-panel], [data-cat-back], .lib-panel")) return;
    // 货架的「查看全部」、更多分类入口、卡片各有自己的委托，这里只剩老的占位卡
    if (event.target.closest(".cat-card")) {
      showToast("占位卡片 · 详情页接入后展示剧集与线路");
    }
  });

  /* ---------- 更多分类：与四个分类页同结构的货架页 ---------- */

  const FALLBACK_CATEGORIES = [
    { id: 1, name: "电影片", pid: 0 }, { id: 2, name: "连续剧", pid: 0 },
    { id: 3, name: "综艺片", pid: 0 }, { id: 4, name: "动漫片", pid: 0 },
    { id: 6, name: "动作片", pid: 1 }, { id: 7, name: "喜剧片", pid: 1 },
    { id: 8, name: "爱情片", pid: 1 }, { id: 9, name: "科幻片", pid: 1 },
    { id: 10, name: "恐怖片", pid: 1 }, { id: 11, name: "剧情片", pid: 1 },
    { id: 12, name: "战争片", pid: 1 }, { id: 13, name: "国产剧", pid: 2 },
    { id: 14, name: "香港剧", pid: 2 }, { id: 15, name: "韩国剧", pid: 2 },
    { id: 16, name: "欧美剧", pid: 2 }, { id: 20, name: "记录片", pid: 1 },
    { id: 21, name: "台湾剧", pid: 2 }, { id: 22, name: "日本剧", pid: 2 },
    { id: 23, name: "海外剧", pid: 2 }, { id: 24, name: "泰国剧", pid: 2 },
    { id: 25, name: "大陆综艺", pid: 3 }, { id: 26, name: "港台综艺", pid: 3 },
    { id: 27, name: "日韩综艺", pid: 3 }, { id: 28, name: "欧美综艺", pid: 3 },
    { id: 29, name: "国产动漫", pid: 4 }, { id: 30, name: "日韩动漫", pid: 4 },
    { id: 31, name: "欧美动漫", pid: 4 }, { id: 32, name: "港台动漫", pid: 4 },
    { id: 33, name: "海外动漫", pid: 4 }, { id: 34, name: "伦理片", pid: 1 },
    { id: 35, name: "电影解说", pid: 0 }, { id: 36, name: "体育", pid: 0 },
    { id: 37, name: "足球", pid: 36 }, { id: 38, name: "篮球", pid: 36 },
    { id: 39, name: "网球", pid: 36 }, { id: 40, name: "斯诺克", pid: 36 },
    { id: 45, name: "预告片", pid: 1 }, { id: 46, name: "短剧", pid: 0 },
    { id: 49, name: "动画片", pid: 1 }, { id: 52, name: "AI漫剧", pid: 0 }
  ];

  const MORE_ICONS = ["i-film", "i-tv", "i-music", "i-star", "i-eye", "i-flame", "i-clock", "i-grid"];

  const moreState = { type: 0, name: "", page: 1, loading: false, childrenMap: new Map() };

  function buildMorePage() {
    const section = document.createElement("section");
    section.className = "page-screen cat-page cat-more-page";
    section.id = "catPage-more";
    section.hidden = true;
    section.setAttribute("aria-label", "更多分类");
    section.innerHTML = `
      <div class="page-scrim" aria-hidden="true"></div>
      <div class="lib-shell cat-shell">
        ${topbarMarkup("more")}
        <div class="cat-toolbar">
          <span class="cat-toolbar-eyebrow">ALL</span>
          <h1 class="cat-toolbar-title" data-more-heading>更多分类</h1>
          <span class="cat-status"><i class="status-dot mint"></i><span data-more-count>加载中</span></span>
        </div>

        <main class="cat-scroll" data-more-scroll>
          <div class="more-shelves" data-more-shelves></div>

          <div class="more-result" data-more-result hidden>
            <div class="lib-shelf-head">
              <span class="lib-shelf-icon"><svg class="icon"><use href="#i-grid" /></svg></span>
              <h2 data-more-title>分类</h2>
              <button class="lib-shelf-link focusable" type="button" data-more-reset>
                <svg class="icon"><use href="#i-arrow-left" /></svg><span>全部分类</span>
              </button>
            </div>
            <div class="more-chip-row" data-more-chips></div>
            <div class="more-results" data-more-results></div>
            <button class="lib-btn ghost more-load focusable" type="button" data-more-load>
              <span>加载更多</span>
            </button>
          </div>
        </main>
      </div>
    `;
    host.appendChild(section);
    return section;
  }

  const morePage = buildMorePage();

  async function loadCategoryList() {
    let list = [];
    try {
      list = (await window.NovaSources?.loadCategories?.()) || [];
    } catch (_) {
      list = [];
    }
    return list.length ? list : FALLBACK_CATEGORIES.slice();
  }

  /* 更多分类固定五个模块：纪录片 / 体育 / 少儿 / 短剧 / AI 漫剧 */
  const MORE_SHELVES = [
    { key: "doc", name: "纪录片", icon: "i-film", types: [20] },
    { key: "sport", name: "体育", icon: "i-flame", types: [37, 38, 39, 40] },
    { key: "kids", name: "少儿", icon: "i-star", types: [49, 32] },
    { key: "short", name: "短剧", icon: "i-clock", types: [46] },
    { key: "aiman", name: "AI 漫剧", icon: "i-grid", types: [52] }
  ];

  function shelfMarkupFor(shelf, index) {
    return `
      <section class="lib-shelf" data-more-shelf="${shelf.key}">
        <div class="lib-shelf-head">
          <span class="lib-shelf-icon"><svg class="icon"><use href="#${shelf.icon || MORE_ICONS[index % MORE_ICONS.length]}" /></svg></span>
          <h2>${shelf.name}</h2>
          <button class="lib-shelf-link focusable" type="button" data-more-open="${shelf.key}" data-more-name="${shelf.name}">
            <span>查看全部</span>
            <svg class="icon"><use href="#i-arrow-right" /></svg>
          </button>
        </div>
        <div class="lib-rail">
          ${Array.from({ length: 6 }, (_, i) => placeholderCard(i, `${shelf.name} ${i + 1}`)).join("")}
        </div>
      </section>`;
  }

  async function fillShelves(shelf, index) {
    const api = window.NovaSources;
    const lists = await Promise.all(
      shelf.types.map((type) =>
        api.loadLibraryItems({ type, limit: 10 })
          .then((response) => response?.items || response || [])
          .catch(() => [])
      )
    );
    const seen = new Set();
    const items = [];
    lists.flat().forEach((item) => {
      if (!item?.key || seen.has(item.key) || !item.image) return;
      seen.add(item.key);
      items.push(item);
    });
    const node = morePage.querySelector(`[data-more-shelf="${shelf.key}"]`);
    const rail = node?.querySelector(".lib-rail");
    if (rail && items.length) {
      rail.innerHTML = items.slice(0, 6).map(posterCard).join("");
      return items.length;
    }
    if (node) node.remove();
    return 0;
  }

  async function fillMoreShelves() {
    const hostEl = morePage.querySelector("[data-more-shelves]");
    if (!hostEl || hostEl.dataset.ready === "1") return;

    const categories = await loadCategoryList();
    moreState.categories = categories;
    moreState.childrenMap = new Map(MORE_SHELVES.map((shelf) => [shelf.key, shelf.types]));

    hostEl.innerHTML = MORE_SHELVES.map(shelfMarkupFor).join("");
    hostEl.dataset.ready = "1";

    const count = morePage.querySelector("[data-more-count]");
    if (count) count.textContent = `${MORE_SHELVES.length} 个专区`;

    await Promise.all(MORE_SHELVES.map((shelf, index) => fillShelves(shelf, index)));
  }
  function renderChips(parentId) {
    const row = morePage.querySelector("[data-more-chips]");
    if (!row) return;
    const children = moreState.childrenMap.get(parentId) || [];
    if (!children.length) {
      row.innerHTML = "";
      row.hidden = true;
      return;
    }
    const categories = moreState.categories || [];
    row.hidden = false;
    row.innerHTML = children
      .map((id) => {
        const item = categories.find((entry) => entry.id === id);
        const label = item ? item.name : String(id);
        return `<button class="more-chip focusable" type="button" data-more-type="${id}" data-more-name="${label}">${label}</button>`;
      })
      .join("");
  }

  async function loadMoreResults(reset) {
    if (moreState.loading) return;
    const results = morePage.querySelector("[data-more-results]");
    if (!results) return;
    moreState.loading = true;
    if (reset) {
      moreState.page = 1;
      results.innerHTML = "";
    }
    try {
      const response = await window.NovaSources.loadLibraryItems({
        type: moreState.type,
        page: moreState.page,
        limit: 24
      });
      const items = (response?.items || response || []).filter((item) => item?.image);
      if (items.length) {
        results.insertAdjacentHTML("beforeend", items.map(posterCard).join(""));
        moreState.page += 1;
      }
      const load = morePage.querySelector("[data-more-load]");
      if (load) load.hidden = items.length === 0;
    } catch (_) {
      const load = morePage.querySelector("[data-more-load]");
      if (load) load.hidden = true;
    } finally {
      moreState.loading = false;
    }
  }

  function showMoreShelves() {
    const shelves = morePage.querySelector("[data-more-shelves]");
    const result = morePage.querySelector("[data-more-result]");
    if (shelves) shelves.hidden = false;
    if (result) result.hidden = true;
    const heading = morePage.querySelector("[data-more-heading]");
    if (heading) heading.textContent = "更多分类";
    const scroll = morePage.querySelector("[data-more-scroll]");
    if (scroll) scroll.scrollTop = 0;
    const first = morePage.querySelector("[data-more-shelf] .poster-card, [data-more-open]");
    if (first) focusEl(first, false);
  }

  async function showMoreResult(key, name, children) {
    const list = Array.isArray(children) ? children.filter(Boolean) : [];
    moreState.key = key;
    moreState.name = name;
    moreState.children = list;
    moreState.type = list[0] || Number(key) || 0;

    morePage.querySelector("[data-more-shelves]").hidden = true;
    const result = morePage.querySelector("[data-more-result]");
    result.hidden = false;
    morePage.querySelector("[data-more-heading]").textContent = name;
    morePage.querySelector("[data-more-title]").textContent = name;
    renderChips(key);
    const scroll = morePage.querySelector("[data-more-scroll]");
    if (scroll) scroll.scrollTop = 0;

    const results = morePage.querySelector("[data-more-results]");
    const load = morePage.querySelector("[data-more-load]");
    results.innerHTML = "";

    if (moreState.children.length > 1) {
      const lists = await Promise.all(
        moreState.children.map((id) =>
          window.NovaSources.loadLibraryItems({ type: id, limit: 12 })
            .then((response) => response?.items || response || [])
            .catch(() => [])
        )
      );
      const seen = new Set();
      const merged = [];
      lists.flat().forEach((item) => {
        if (!item?.key || seen.has(item.key) || !item.image) return;
        seen.add(item.key);
        merged.push(item);
      });
      if (merged.length) results.innerHTML = merged.slice(0, 36).map(posterCard).join("");
      if (load) load.hidden = true;
    } else {
      if (load) load.hidden = false;
      await loadMoreResults(true);
    }

    const first = result.querySelector(".poster-card") || result.querySelector("[data-more-load]");
    if (first) focusEl(first, false);
  }

  // 「更多分类」页：纪录片、体育、少儿、短剧、AI 漫剧 都在这里，顶栏选中态固定「更多分类」
  function openMore() {
    state.key = "more";
    Object.values(pages).forEach((section) => {
      section.hidden = true;
      section.classList.remove("is-active");
    });
    libraryPage.hidden = true;
    libraryPage.classList.remove("is-active");
    morePage.hidden = false;
    requestAnimationFrame(() => morePage.classList.add("is-active"));
    if (listPage) {
      listPage.hidden = true;
      listPage.classList.remove("is-active");
      listState.requestId += 1;
      listState.loading = false;
    }
    showMoreShelves();
    window.NovaLibraryNav?.paintActive?.("more");
    fillMoreShelves().then(() => {
      if (!morePage.querySelector(".is-focused")) {
        const first = morePage.querySelector("[data-more-open]") || morePage.querySelector(".poster-card");
        focusEl(first, false);
      }
    });
  }

  morePage.querySelector("[data-more-home]")?.addEventListener("click", () => back());
  morePage.querySelector("[data-more-reset]")?.addEventListener("click", () => showMoreShelves());
  morePage.querySelector("[data-more-load]")?.addEventListener("click", () => loadMoreResults(false));

  /* ---------- 「查看全部」列表页 ---------- */
  /* 单 type：首屏拉 3 页（72 条）→ 按模块规则排序 → 出 36 张，之后逐页追加
     多 type：各拉第 1 页合并 → 最多 36 张，不分页（与更多分类的货架口径一致） */

  const LIST_PAGE_SIZE = 24;
  const LIST_TYPE_LIMIT = 8; // 多 type 时每个分类取 8 条：与首页 loadHotPool 的口径一致，且命中同一份缓存
  const LIST_FIRST_PAGES = 3;
  const LIST_FIRST_SHOW = 36;
  const LIST_AUTOLOAD_GAP = 480;

  const listState = {
    originKey: "",
    originFocus: null,
    originScroll: 0,
    type: 0,
    types: [],
    sort: "new",
    title: "",
    eyebrow: "",
    page: 1,
    loading: false,
    done: false,
    items: [],
    seen: new Set(),
    requestId: 0
  };

  function buildListPage() {
    const section = document.createElement("section");
    section.className = "page-screen cat-page cat-list-page";
    section.id = "catPage-list";
    section.hidden = true;
    section.setAttribute("aria-label", "全部内容");
    section.innerHTML = `
      <div class="page-scrim" aria-hidden="true"></div>
      <div class="lib-shell cat-shell">
        ${topbarMarkup("home")}
        <div class="cat-toolbar list-toolbar">
          <span class="cat-toolbar-eyebrow" data-list-eyebrow>LIBRARY</span>
          <h1 class="cat-toolbar-title" data-list-title>全部</h1>
          <span class="cat-status"><i class="status-dot mint"></i><span data-list-count>加载中</span></span>
          <div class="cat-toolbar-actions">
            <div class="list-sorts" data-list-sorts>
              ${LIST_SORTS.map(
                (item) =>
                  `<button class="list-sort focusable" type="button" data-list-sort="${item.key}">${item.label}</button>`
              ).join("")}
            </div>
            <button class="lib-pill focusable" type="button" data-list-back>
              <svg class="icon"><use href="#i-arrow-left" /></svg><span>返回</span>
            </button>
          </div>
        </div>

        <div class="list-chips" data-list-chips hidden></div>

        <main class="cat-scroll list-scroll" data-list-scroll>
          <div class="list-grid" data-list-grid></div>
          <div class="library-empty list-empty" data-list-empty hidden>
            <strong data-list-empty-title>这里还没有内容</strong>
            <span data-list-empty-text>换一个分类试试</span>
            <button class="lib-btn ghost focusable" type="button" data-list-retry hidden><span>重新加载</span></button>
          </div>
          <button class="lib-btn ghost list-more focusable" type="button" data-list-more hidden>
            <span>加载更多</span>
          </button>
        </main>
      </div>`;
    host.appendChild(section);
    return section;
  }

  // pageKey + index → 标题 / typeId / 排序规则
  function resolveListSource(options) {
    const pageKey = options.pageKey || "";
    const index = Number(options.index) || 0;

    if (pageKey === "more") {
      const shelf = MORE_SHELVES[index];
      if (!shelf) return null;
      return { title: shelf.name, eyebrow: "MORE", types: (shelf.types || []).slice(), sort: "new" };
    }
    if (!pageKey || pageKey === "library") {
      // 首页「正在热播」：和那条带用同一批 typeId + 同一条 hotScore，
      // 首屏还能直接吃 loadHotPool 已经拉过的缓存（limit/page 都一样）
      const hotTypes = window.NovaLibraryUI?.hotTypes;
      return {
        title: "正在热播",
        eyebrow: "LIBRARY",
        types: Array.isArray(hotTypes) && hotTypes.length ? hotTypes.slice() : [0],
        sort: "hot"
      };
    }
    const config = PAGES[pageKey];
    const module = config?.modules?.[index];
    if (!config || !module) return null;
    const rule = (SECTION_RULES[pageKey] || [])[index] || {};
    return {
      title: module.title,
      eyebrow: config.eyebrow,
      types: [Number(rule.typeId) || 0],
      sort: rule.sort || "new"
    };
  }

  function uniqueListItems(items) {
    const out = [];
    items.forEach((item) => {
      if (!item?.key || !item.image) return;
      const key = String(item.key);
      if (listState.seen.has(key)) return;
      listState.seen.add(key);
      out.push(item);
    });
    return out;
  }

  // 列表页的排序档位（客户端排，不额外请求）
  const LIST_SORTS = [
    { key: "hot", label: "热播优先" },
    { key: "new", label: "最新更新" },
    { key: "score", label: "评分优先" },
    { key: "year", label: "年份优先" }
  ];

  // 与 library-ui.js 的 hotScore 保持同一条规则：在更 +3 / 今年 +2 / 有评分 +1 / 有简介 +1
  function listHotScore(item) {
    let score = 0;
    if (/更新至|第\s*\d+\s*[期集]/.test(item.status || "")) score += 3;
    if (String(item.year || "") === String(new Date().getFullYear())) score += 2;
    if (Number(item.score) > 0) score += 1;
    if (item.description && item.description.length > 24) score += 1;
    return score;
  }

  function sortListItems(items, sort) {
    const out = items.slice();
    if (sort === "hot") {
      // 优先用首页那条带的比较器，保证「带」和「全部」顺序完全一致
      const compare = window.NovaLibraryUI?.compareHot;
      if (typeof compare === "function") out.sort(compare);
      else out.sort((a, b) => listHotScore(b) - listHotScore(a));
    } else if (sort === "score") {
      out.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    } else if (sort === "year") {
      out.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    }
    // "new"：保持服务端返回顺序（站内是 CMS 更新序，跨站按抓取完成顺序）
    return out;
  }

  /* 重排后重画整个网格；先把当前视口顶部那张卡记下来，重排后拉回同一条。
     listState.items 永远保持「抓取顺序」，排序只作用于渲染视图，
     这样切回「最新」还能还原服务端顺序。 */
  function renderListGrid(options = {}) {
    const grid = listBox("grid");
    const scroll = listBox("scroll");
    if (!grid) return;

    let anchorKey = "";
    let anchorTop = 0;
    if (options.anchor && scroll) {
      const viewTop = scroll.getBoundingClientRect().top;
      const first = [...grid.children].find(
        (el) => el.getBoundingClientRect().bottom > viewTop + 1
      );
      if (first) {
        anchorKey = first.dataset.vod || "";
        anchorTop = first.getBoundingClientRect().top;
      }
    }

    const view = sortListItems(listState.items, listState.sort);
    grid.innerHTML = view.map(posterCard).join("");

    if (anchorKey && scroll) {
      const next = [...grid.children].find((el) => el.dataset.vod === anchorKey);
      if (next) scroll.scrollTop += next.getBoundingClientRect().top - anchorTop;
    }
  }

  function paintListSorts() {
    const multi = listState.types.length > 1;
    listPage?.querySelectorAll("[data-list-sort]").forEach((node) => {
      const key = node.dataset.listSort;
      // 多分类混合时「服务端顺序」不是一个有意义的选项，直接收起来
      const available = !(multi && key === "new");
      node.hidden = !available;
      const active = available && key === listState.sort;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", String(active));
    });
  }

  function listBox(name) {
    return listPage?.querySelector(`[data-list-${name}]`) || null;
  }

  function paintListMeta(countText) {
    const count = listBox("count");
    if (count) count.textContent = countText;
  }

  function showListEmpty(title, text, withRetry) {
    const empty = listBox("empty");
    if (!empty) return;
    empty.hidden = false;
    empty.querySelector("[data-list-empty-title]").textContent = title;
    empty.querySelector("[data-list-empty-text]").textContent = text;
    const retry = empty.querySelector("[data-list-retry]");
    if (retry) retry.hidden = !withRetry;
  }

  async function renderListChips(type) {
    const row = listBox("chips");
    if (!row) return;
    // 多分类混合的列表（首页热播池）没有「同级分类」可言，整行不显示
    if (!type || listState.types.length > 1) {
      row.hidden = true;
      row.innerHTML = "";
      return;
    }
    const categories = await loadCategoryList();
    const self = categories.find((entry) => Number(entry.id) === Number(type));
    const pid = self ? Number(self.pid) || 0 : 0;
    const siblings = pid
      ? categories.filter((entry) => Number(entry.pid) === pid)
      : categories.filter((entry) => Number(entry.id) === Number(type));
    if (siblings.length < 2) {
      row.hidden = true;
      row.innerHTML = "";
      return;
    }
    row.innerHTML = siblings
      .map(
        (entry) =>
          `<button class="more-chip focusable${Number(entry.id) === Number(type) ? " is-active" : ""}" type="button"
            data-list-type="${entry.id}" data-list-name="${entry.name}">${entry.name}</button>`
      )
      .join("");
    row.hidden = false;
  }

  // 单页取数：把异常包成 { ok, items | error }，好在整批都失败时区分「没内容」和「取不到」
  async function fetchListPage(api, type, page, limit) {
    try {
      const res = await api.loadLibraryItems({ type, page, limit });
      return { ok: true, items: res?.items || res || [] };
    } catch (error) {
      return { ok: false, error };
    }
  }

  async function loadList(reset) {
    if (!listPage || listState.loading) return;
    const api = window.NovaSources;
    const grid = listBox("grid");
    const moreBtn = listBox("more");
    if (!grid) return;

    listState.loading = true;
    const requestId = ++listState.requestId;

    if (reset) {
      listState.page = 1;
      listState.items = [];
      listState.seen = new Set();
      listState.done = false;
      grid.innerHTML = Array.from({ length: 6 }, (_, i) => placeholderCard(i, "加载中")).join("");
      if (listBox("empty")) listBox("empty").hidden = true;
      if (moreBtn) moreBtn.hidden = true;
      paintListMeta("加载中");
    }
    if (moreBtn) moreBtn.disabled = true;

    try {
      if (!api?.loadLibraryItems) throw new Error("内容源还没准备好");

      const multi = listState.types.length > 1;
      let fetched = [];

      if (multi) {
        // 多 type（首页热播）：每个 type 取同一页，合并后交给 hotScore 排
        const results = await Promise.all(
          listState.types.map((type) => fetchListPage(api, type, listState.page, LIST_TYPE_LIMIT))
        );
        const ok = results.filter((entry) => entry.ok);
        if (!ok.length) throw results[0]?.error || new Error("内容源没有返回数据");
        fetched = ok.flatMap((entry) => entry.items);
        listState.page += 1;
      } else if (reset) {
        const wanted = Array.from({ length: LIST_FIRST_PAGES }, (_, i) => i + 1);
        const results = await Promise.all(
          wanted.map((page) => fetchListPage(api, listState.type, page, LIST_PAGE_SIZE))
        );
        const ok = results.filter((entry) => entry.ok);
        if (!ok.length) throw results[0]?.error || new Error("内容源没有返回数据");
        fetched = ok.flatMap((entry) => entry.items);
        listState.page = LIST_FIRST_PAGES + 1;
      } else {
        const result = await fetchListPage(api, listState.type, listState.page, LIST_PAGE_SIZE);
        if (!result.ok) throw result.error;
        fetched = result.items;
        listState.page += 1;
      }

      if (requestId !== listState.requestId) return;

      const fresh = uniqueListItems(fetched);

      if (reset) {
        listState.items = fresh;
        renderListGrid();
        // 多 type 时没有「首批够不够」的概念，抓到空才算到底
        listState.done = multi ? fresh.length === 0 : fresh.length < LIST_FIRST_SHOW;
      } else if (!fresh.length) {
        listState.done = true;
      } else {
        listState.items = listState.items.concat(fresh);
        renderListGrid({ anchor: true });
      }

      if (!listState.items.length) {
        grid.innerHTML = "";
        showListEmpty("这个分类暂时没有内容", "换一个分类，或稍后再试", false);
        paintListMeta("0 部");
        if (moreBtn) moreBtn.hidden = true;
      } else {
        if (listBox("empty")) listBox("empty").hidden = true;
        paintListMeta(listState.done ? `共 ${listState.items.length} 部` : `已加载 ${listState.items.length} 部`);
        if (moreBtn) moreBtn.hidden = listState.done;
      }

      if (reset) {
        const first = grid.querySelector(".poster-card") || listBox("back");
        focusEl(first, false);
        const scroll = listBox("scroll");
        if (scroll) scroll.scrollTop = 0;
      }
    } catch (error) {
      if (requestId !== listState.requestId) return;
      grid.innerHTML = "";
      if (moreBtn) moreBtn.hidden = true;
      showListEmpty("内容源没有返回数据", error?.message || "请检查网络后重试", true);
      paintListMeta("读取失败");
      focusEl(listBox("retry") || listBox("back"), false);
    } finally {
      if (requestId === listState.requestId) {
        listState.loading = false;
        if (moreBtn) moreBtn.disabled = false;
      }
    }
  }

  async function openList(options = {}) {
    if (!listPage) return false;
    const source = resolveListSource(options);
    if (!source) return false;

    const origin = current();
    listState.originKey = state.key;
    listState.originFocus = document.activeElement;
    listState.originScroll = origin
      ? origin.querySelector("[data-cat-scroll], [data-more-scroll]")?.scrollTop || 0
      : document.querySelector(".lib-main")?.scrollTop || 0;

    listState.types = source.types.length ? source.types : [0];
    listState.type = listState.types[0];
    listState.sort = source.sort;
    listState.title = source.title;
    listState.eyebrow = source.eyebrow;

    document.querySelectorAll(".is-focused").forEach((el) => el.classList.remove("is-focused"));

    Object.values(pages).forEach((section) => {
      section.hidden = true;
      section.classList.remove("is-active");
    });
    if (morePage) {
      morePage.hidden = true;
      morePage.classList.remove("is-active");
    }
    libraryPage.hidden = true;
    libraryPage.classList.remove("is-active");

    listPage.hidden = false;
    requestAnimationFrame(() => listPage.classList.add("is-active"));
    state.key = "list";
    window.NovaLibraryNav?.paintActive?.(listState.originKey || "home");

    const titleNode = listBox("title");
    if (titleNode) titleNode.textContent = source.title;
    const eyebrowNode = listBox("eyebrow");
    if (eyebrowNode) eyebrowNode.textContent = source.eyebrow;
    paintListSorts();

    // chips 与首屏并行拉，分类接口慢的时候不至于拖住列表
    renderListChips(listState.type).catch(() => {});
    await loadList(true);
    return true;
  }

  function closeList() {
    if (!listPage || listPage.hidden) return false;
    listPage.hidden = true;
    listPage.classList.remove("is-active");
    listState.requestId += 1; // 作废在途请求
    listState.loading = false;

    state.key = listState.originKey || "";
    const target =
      state.key === "" ? libraryPage : state.key === "more" ? morePage : pages[state.key];
    if (target) {
      target.hidden = false;
      requestAnimationFrame(() => target.classList.add("is-active"));
    }
    window.NovaLibraryNav?.paintActive?.(state.key || "home");

    const scrollEl =
      state.key === ""
        ? document.querySelector(".lib-main")
        : target?.querySelector("[data-cat-scroll], [data-more-scroll]") || null;
    const originFocus = listState.originFocus;
    const originScroll = listState.originScroll;
    window.setTimeout(() => {
      if (scrollEl) scrollEl.scrollTop = originScroll;
      if (originFocus && document.contains(originFocus)) focusEl(originFocus, false);
    }, 60);
    return true;
  }

  listPage = buildListPage();
  listPage.querySelector("[data-list-scroll]")?.addEventListener("scroll", (event) => {
    if (listState.loading || listState.done) return;
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < LIST_AUTOLOAD_GAP) loadList(false);
  });

  // 「查看全部」：四大分类页的货架
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-cat-all]");
    if (!trigger) return;
    if (!state.key || state.key === "list" || state.key === "more") return;
    const page = pages[state.key];
    if (!page || !page.contains(trigger)) return;
    event.preventDefault();
    openList({ pageKey: state.key, index: Number(trigger.dataset.catAll) || 0 });
  });

  // 列表页自己的按钮
  document.addEventListener("click", (event) => {
    if (!listPage || listPage.hidden || !listPage.contains(event.target)) return;

    if (event.target.closest("[data-list-back]")) {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.target.closest("[data-list-more]")) {
      event.preventDefault();
      loadList(false);
      return;
    }
    if (event.target.closest("[data-list-retry]")) {
      event.preventDefault();
      loadList(true);
      return;
    }
    const sortBtn = event.target.closest("[data-list-sort]");
    if (sortBtn) {
      event.preventDefault();
      const sort = sortBtn.dataset.listSort;
      if (!sort || sort === listState.sort) return;
      listState.sort = sort;
      paintListSorts();
      // 数据已在内存里，重排重画即可，不再请求
      renderListGrid({ anchor: true });
      return;
    }
    const chip = event.target.closest("[data-list-type]");
    if (chip) {
      event.preventDefault();
      const type = Number(chip.dataset.listType) || 0;
      if (!type || type === listState.type) return;
      listState.type = type;
      listState.types = [type];
      // 排序保持在用户当前选的那一档，换分类不该把排序重置
      renderListChips(type).catch(() => {});
      loadList(true);
    }
  });

  // 分类页 / 列表页 / 更多分类的卡片 → 详情页
  document.addEventListener("click", (event) => {
    const card = event.target.closest(".lib-card[data-vod]");
    if (!card || !card.closest(".cat-page")) return;
    const key = card.dataset.vod;
    const item = key ? catalogItems.get(key) : null;
    if (!item) return;
    event.preventDefault();
    if (typeof window.NovaPages?.openLibraryEntry === "function") {
      window.NovaPages.openLibraryEntry(item);
    } else {
      window.NovaOpenDetail?.(item);
    }
  });

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-more-open]");
    if (open) {
      event.preventDefault();
      const key = open.dataset.moreOpen;
      showMoreResult(key, open.dataset.moreName || "分类", moreState.childrenMap.get(key) || []);
      return;
    }
    const chip = event.target.closest("[data-more-type]");
    if (!chip) return;
    event.preventDefault();
    showMoreResult(chip.dataset.moreType, chip.dataset.moreName || "分类", [Number(chip.dataset.moreType)]);
  });
  window.NovaCategories = { open, back, openMore, openList, closeList, state };
})();
