(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const appRoot = document.getElementById("appRoot");
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");

  // 搜索入口搬进顶栏后旧 id 不再存在：优先新按钮，兼容旧 id
  const searchTrigger = document.getElementById("searchTrigger") || document.querySelector(".topbar-search");
  const searchScreen = document.getElementById("searchScreen");
  const searchClose = document.getElementById("searchClose");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const searchResultTitle = document.getElementById("searchResultTitle");
  const searchResultCount = document.getElementById("searchResultCount");
  const searchSuggestions = document.getElementById("searchSuggestions");

  const detailScreen = document.getElementById("detailScreen");
  const detailClose = document.getElementById("detailClose");
  const detailBackdrop = document.getElementById("detailBackdrop");
  const detailKind = document.getElementById("detailKind");
  const detailTitle = document.getElementById("detailTitle");
  const detailMeta = document.getElementById("detailMeta");
  const detailDescription = document.getElementById("detailDescription");
  const detailPlay = document.getElementById("detailPlay");
  const detailPlayLabel = detailPlay.querySelector("span");
  const detailFootnoteText = document.getElementById("detailFootnoteText");
  // 详情页 3.0：海报 / 信息小卡 / 选集·选源
  const detailPoster = document.getElementById("detailPoster");
  const detailPosterImg = document.getElementById("detailPosterImg");
  const detailFacts = document.getElementById("detailFacts");
  const detailPickerTitle = document.getElementById("detailPickerTitle");
  const detailPickerSub = document.getElementById("detailPickerSub");
  const detailLineRow = document.getElementById("detailLineRow");
  const detailEpGroups = document.getElementById("detailEpGroups");
  const detailPickerScroll = document.getElementById("detailPickerScroll");
  const detailEpGrid = document.getElementById("detailEpGrid");
  const detailSourceList = document.getElementById("detailSourceList");
  const detailPickerEmpty = document.getElementById("detailPickerEmpty");
  const detailFavoriteBtn = detailScreen.querySelector('[data-action="detail-favorite"]');

  // 首页内容位：由订阅里的 home.sections 驱动，拿不到就回落到固定卡片
  const homeRows = document.getElementById("homeRows");
  const homeRowItems = new Map();
  let homeRowsTimer = 0;

  const catalogue = [
    {
      key: "interstellar",
      title: "星际穿越",
      type: "电影",
      meta: "2014 · 科幻 / 冒险 · 2小时49分",
      image: "./assets/images/interstellar.jpg",
      keywords: "诺兰 克里斯托弗诺兰 马修麦康纳 太空 虫洞 科幻",
      description: "宇航员库珀穿过虫洞寻找人类新家园。时间、引力与亲情在星际之间彼此牵引。"
    },
    {
      key: "peaky",
      title: "浴血黑帮 第6季",
      type: "剧集",
      meta: "2022 · 犯罪 / 剧情 · 第6季",
      image: "./assets/images/peaky.jpg",
      keywords: "浴血黑帮 汤米谢尔比 伯明翰 犯罪 英剧",
      description: "汤米·谢尔比在时代剧变中继续守住家族与生意，旧日敌友也逐一回到伯明翰。"
    },
    {
      key: "totoro",
      title: "龙猫",
      type: "动画电影",
      meta: "1988 · 动画 / 奇幻 · 1小时26分",
      image: "./assets/images/totoro.jpg",
      keywords: "宫崎骏 吉卜力 龙猫 森林 治愈 动画",
      description: "小月和小梅在乡间遇见森林守护者龙猫，一段温柔而奇妙的夏日冒险由此展开。"
    },
    {
      key: "dune",
      title: "沙丘 II",
      type: "电影",
      meta: "2024 · 科幻 / 冒险 · 2小时46分",
      image: "./assets/images/dune.jpg",
      keywords: "沙丘 保罗厄崔迪 科幻 沙漠 史诗",
      description: "保罗·厄崔迪与契妮和弗雷曼人并肩作战，在复仇与预言之间寻找自己的道路。"
    },
    {
      key: "joker",
      title: "小丑",
      type: "电影",
      meta: "2019 · 剧情 / 犯罪 · 2小时02分",
      image: "./assets/images/joker.jpg",
      keywords: "小丑 亚瑟弗莱克 犯罪 剧情 哥谭",
      description: "在冷漠而失衡的城市里，一个被忽视的喜剧演员逐渐走向崩溃，也走向聚光灯中央。"
    },
    {
      key: "avengers",
      title: "复仇者联盟4：终局之战",
      type: "电影",
      meta: "2019 · 动作 / 科幻 · 3小时01分",
      image: "./assets/images/avengers.jpg",
      keywords: "复仇者联盟 漫威 终局之战 超级英雄",
      description: "幸存的英雄们再次集结，穿越时间与失去，为宇宙争取最后一次逆转机会。"
    },
    {
      key: "lostyou",
      title: "长相思",
      type: "剧集",
      meta: "2023 · 古装 / 爱情 · 全39集",
      image: "./assets/images/lostyou.jpg",
      keywords: "长相思 小夭 古装 爱情 东方",
      description: "小夭在漫长岁月中辗转流离，与故人重逢，也被卷入家国、身份与选择的漩涡。"
    },
    {
      key: "yourname",
      title: "你的名字。",
      type: "动画电影",
      meta: "2016 · 动画 / 爱情 · 1小时46分",
      image: "./assets/images/yourname.jpg",
      keywords: "新海诚 你的名字 动画 爱情 彗星 青春",
      description: "两个陌生少年在梦中交换身体，并在时间与距离之间寻找彼此。"
    },
    {
      key: "cctv1",
      title: "央视一套",
      type: "直播",
      meta: "综合频道 · 高清 · 正在播出",
      image: "./assets/images/avengers.jpg",
      keywords: "央视 CCTV 综合 频道 直播 新闻",
      description: "NOVA TV 将把标准 m3u / txt 直播源整理成清晰、遥控器友好的频道目录。"
    },
    {
      key: "music-night",
      title: "夜空中最亮的星",
      type: "音乐",
      meta: "逃跑计划 · 单曲 · 04:12",
      image: "./assets/images/yourname.jpg",
      keywords: "逃跑计划 夜空 音乐 歌曲 摇滚",
      description: "音乐模块会独立承载本地音乐、网络电台、歌单与后台播放。"
    }
  ];

  catalogue.forEach((item) => {
    const source =
      window.NovaDemoMedia?.library?.[item.key] ||
      window.NovaDemoMedia?.live?.[item.key];
    if (source) Object.assign(item, source);
  });

  let toastTimer = 0;
  let currentFocus = null;
  let detailReturn = null;
  let currentDetail = null;
  let currentSearchQuery = "";
  let remoteSearchItems = [];
  let remoteSearchTimer = 0;
  let remoteSearchRequest = 0;

  function fitStage() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty("--stage-scale", String(scale));
  }

  // 焦点可见性兜底：无论走哪条导航分支，按下方向键后都保证焦点在屏内
  function ensureFocusVisible() {
    const element = document.activeElement;
    if (!element || element === document.body) return false;
    const rect = element.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.width < 2 || rect.height < 2) return false;
    if (rect.top >= 48 && rect.bottom <= vh - 8) return false;
    const hosts = document.querySelectorAll(".nv-scroll, .nv-set-scroll, .nv-search-scroll, .page-main, .lv-list");
    for (const host of hosts) {
      if (!host.contains(element)) continue;
      if (host.scrollHeight <= host.clientHeight + 4) continue;
      if (getComputedStyle(host).display === "none") continue;
      const box = host.getBoundingClientRect();
      const topPad = 64;
      const bottomPad = 28;
      if (rect.top < box.top + topPad) {
        host.scrollTop += rect.top - box.top - topPad;
      } else if (rect.bottom > box.bottom - bottomPad) {
        host.scrollTop += rect.bottom - box.bottom + bottomPad;
      }
      return true;
    }
    return false;
  }

  function setFocus(element, options = {}) {
    if (!element || element.disabled || element.closest("[hidden]") || element.closest("[inert]")) {
      return;
    }
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    element.classList.add("is-focused");
    currentFocus = element;
    if (options.focus !== false) {
      element.focus({ preventScroll: true });
    }
    // 电视上焦点必须始终可见：滚到最近的容器的可视区内
    if (options.scroll !== false) scrollIntoContainer(element);
  }

  function clearFocus() {
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    currentFocus = null;
  }

  function visibleFocusables() {
    return [...document.querySelectorAll(".focusable")].filter((element) => {
      if (element.disabled || element.closest("[hidden]") || element.closest("[inert]")) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    });
  }

  // 统一焦点落点：真正 focus + 高亮 + 手动滚动到可视区
  // 原生 scrollIntoView 在嵌套 overflow 容器里会误判，必须自己算
  // 已知的滚动容器清单：不依赖 computed style，命中即滚动，最可靠
  const SCROLL_HOSTS = [".nv-scroll", ".nv-set-scroll", ".nv-search-scroll", ".page-main", ".lv-list", ".lv-epg-list", ".content"];

  // 横向 rail（首页两条在更带 / 音乐页）跟随：竖向滚动不会带它
  function scrollRailIntoView(element) {
    const rail = element && element.closest ? element.closest(".home-rail, .music-rail") : null;
    if (!rail) return;
    const left = element.offsetLeft - rail.offsetLeft;
    const right = left + element.offsetWidth;
    const viewLeft = rail.scrollLeft;
    const viewRight = viewLeft + rail.clientWidth;
    // 只滚最小距离，避免每挪一张就跳一整屏
    if (right > viewRight) rail.scrollLeft = right - rail.clientWidth + 40;
    else if (left < viewLeft) rail.scrollLeft = left - 40;
  }

  function scrollIntoContainer(element) {
    if (!element) return false;
    scrollRailIntoView(element);
    const hosts = [...document.querySelectorAll(SCROLL_HOSTS.join(","))];
    for (const host of hosts) {
      if (!host.contains(element)) continue;
      if (host.scrollHeight <= host.clientHeight + 4) continue;
      if (getComputedStyle(host).display === "none") continue;
      const box = host.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const topPad = 72;
      const bottomPad = 40;
      if (rect.top < box.top + topPad) {
        host.scrollTop += rect.top - box.top - topPad;
        return true;
      }
      if (rect.bottom > box.bottom - bottomPad) {
        host.scrollTop += rect.bottom - box.bottom + bottomPad;
        return true;
      }
      return true;
    }
    return false;
  }

  function focusToElement(element, options = {}) {
    if (!element) return false;
    document.querySelectorAll(".is-focused").forEach((node) => {
      if (node !== element) node.classList.remove("is-focused");
    });
    element.focus({ preventScroll: true });
    element.classList.add("is-focused");
    scrollRailIntoView(element);
    if (!scrollIntoContainer(element) && options.fallback !== false) {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    return true;
  }

  window.NovaFocus = { to: focusToElement, scroll: scrollIntoContainer };
  window.__focusFix = ensureFocusVisible;

  function moveFocus(direction) {
    moveFocusInner(direction);
    // 同步兜底：headless / 低帧率环境下 rAF 可能被节流，这里必须立刻生效
    ensureFocusVisible();
  }

  window.addEventListener(
    "keydown",
    (event) => {
      if (!/^Arrow/.test(event.key)) return;
      const fix = () => window.__focusFix?.();
      fix();
      Promise.resolve().then(fix);
      window.setTimeout(fix, 0);
      window.setTimeout(fix, 24);
      window.setTimeout(fix, 80);
    },
    true
  );

  // 行式导航状态：竖直移动时保留起点列，避免左右游走
  let navAnchorX = null;
  let navLastDirection = "";

  function moveFocusInner(direction) {
    // Banner 聚焦时左右键切轮播，不移动焦点
    const activeEl = document.activeElement;
    if (activeEl && activeEl.closest(".lib-banner") && window.NovaLibraryUI?.hero) {
      if (direction === "left") { window.NovaLibraryUI.hero.prev(); return; }
      if (direction === "right") { window.NovaLibraryUI.hero.next(); return; }
    }
    if (window.NovaSearch?.isOpen?.()) {
      window.NovaSearch.navigate?.(direction);
      return;
    }

    if (window.NovaDetail?.isOpen?.()) {
      window.NovaDetail.navigate?.(direction);
      return;
    }

    if (window.NovaPlayer?.isOpen?.() && window.NovaPlayer.moveFocus(direction)) {
      return;
    }

    if (window.NovaPages?.isOpen?.() && window.NovaPages.moveFocus?.(direction)) {
      return;
    }

    const elements = visibleFocusables();
    if (!elements.length) return;

    const active = document.activeElement;
    const activeFocusable =
      active && active.matches(".focusable")
        ? active
        : active && active.closest
          ? active.closest(".focusable")
          : null;

    if (document.activeElement === searchInput) {
      if (direction === "down" || direction === "right") {
        const first = elements.find(
          (element) =>
            element.classList.contains("suggestion-chip") || element.classList.contains("search-result")
        );
        if (first) setFocus(first);
      } else if (direction === "up" || direction === "left") {
        setFocus(searchClose);
      } else {
        return;
      }
      return;
    }

    const current = activeFocusable || currentFocus || elements[0];
    const currentRect = current.getBoundingClientRect();
    const cx = currentRect.left + currentRect.width / 2;
    const cy = currentRect.top + currentRect.height / 2;

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    // 行式导航：竖直移动保留起点列作为锚点，先选最近的一行，再在该行里挑最接近锚点的
    const vertical = direction === "up" || direction === "down";
    if (vertical) {
      if (navLastDirection !== direction || navAnchorX == null) navAnchorX = cx;
    } else {
      navAnchorX = null;
    }
    navLastDirection = direction;

    const anchorX = vertical && navAnchorX != null ? navAnchorX : cx;
    const rows = new Map();

    for (const candidate of elements) {
      if (candidate === current) continue;
      const rect = candidate.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;

      let primary;
      if (direction === "left" || direction === "right") {
        primary = direction === "left" ? -dx : dx;
        if (primary < 8) continue;
      } else {
        primary = direction === "up" ? -dy : dy;
        if (primary < 8) continue;
      }

      const overlapX = Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left));
      const overlapY = Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top));
      const overlap = direction === "left" || direction === "right" ? overlapY : overlapX;
      const axisSize = direction === "left" || direction === "right" ? currentRect.height : currentRect.width;
      const overlapRatio = axisSize > 0 ? Math.min(1, overlap / axisSize) : 0;

      if (vertical) {
        // 按行聚合（顶部相差 24px 以内算同一行）
        const rowKey = Math.round(rect.top / 24);
        if (!rows.has(rowKey)) rows.set(rowKey, { distance: Math.abs(primary), items: [] });
        rows.get(rowKey).items.push({ candidate, score: Math.abs(x - anchorX) - overlapRatio * 44 });
      } else {
        const score = primary + Math.abs(y - cy) * 1.48 - overlapRatio * 44;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }

    if (vertical && rows.size) {
      const nearest = [...rows.values()].sort((a, b) => a.distance - b.distance)[0];
      nearest.items.sort((a, b) => a.score - b.score);
      if (nearest.items[0]) best = nearest.items[0].candidate;
    }

    if (best) setFocus(best);
  }

  function showToast(message) {
    toastText.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }


  let statusPanel = null;

  function statusPanelRows() {
    const sources = window.NovaSources;
    const all = typeof sources?.list === "function" ? sources.list() : [];
    const enabled = typeof sources?.listEnabled === "function" ? sources.listEnabled() : [];
    const online = navigator.onLine;
    const effective = navigator.connection?.effectiveType;
    const networkLabel = online
      ? `在线${effective ? ` · ${effective.toUpperCase()}` : ""}`
      : "离线";
    const sourceLabel = enabled.length
      ? enabled.map((item) => item.name).slice(0, 2).join(" / ") + (enabled.length > 2 ? ` 等 ${enabled.length} 个` : "")
      : "内置演示订阅";
    const stats = `${enabled.length} 启用 / ${all.length} 总计`;
    return [
      ["网络", networkLabel],
      ["内容源", sourceLabel],
      ["站点统计", stats],
      ["播放器", "HTML5 video · 就绪"],
    ];
  }

  function closeStatusPanel() {
    statusPanel?.remove();
    statusPanel = null;
  }

  function toggleStatusPanel() {
    if (statusPanel) {
      closeStatusPanel();
      return;
    }
    const stage = document.querySelector(".stage") || document.body;
    const panel = document.createElement("div");
    panel.className = "status-panel";

    const head = document.createElement("div");
    head.className = "status-panel-head";
    const title = document.createElement("strong");
    title.textContent = "消息";
    const sub = document.createElement("span");
    sub.textContent = "系统与内容源状态";
    head.append(title, sub);

    const list = document.createElement("dl");
    list.style.margin = "0";
    for (const [label, value] of statusPanelRows()) {
      const row = document.createElement("div");
      row.className = "status-panel-row";
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      row.append(dt, dd);
      list.append(row);
    }

    const close = document.createElement("button");
    close.type = "button";
    close.className = "status-panel-close focusable";
    close.textContent = "关闭";
    close.addEventListener("click", closeStatusPanel);

    panel.append(head, list, close);
    stage.append(panel);
    statusPanel = panel;
    close.focus();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && statusPanel) {
      closeStatusPanel();
    }
  });
  function syncDimState() {
    const pageOpen = Boolean(window.NovaPages?.isOpen?.());
    const dimmed = !searchScreen.hidden || !detailScreen.hidden || pageOpen;
    appRoot.classList.toggle("is-dimmed", dimmed);
    appRoot.inert = dimmed;
  }

  function openSearch() {
    detailReturn = null;
    searchScreen.hidden = false;
    detailScreen.hidden = true;
    appRoot.classList.add("is-dimmed");
    appRoot.inert = true;
    renderSearchResults(currentSearchQuery);
    window.requestAnimationFrame(() => {
      searchInput.focus({ preventScroll: true });
      searchInput.select();
    });
  }

  function closeSearch(options = {}) {
    if (searchScreen.hidden) return;
    searchScreen.hidden = true;
    syncDimState();
    if (options.restoreFocus !== false) {
      setFocus(searchTrigger);
    }
  }

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function searchCatalogue(query) {
    const needle = normalize(query);
    if (!needle) return catalogue.slice(0, 6);
    const localMatches = catalogue.filter((item) => {
      const haystack = normalize(`${item.title}${item.type}${item.meta}${item.keywords}${item.description}`);
      return haystack.includes(needle);
    });
    const remoteMatches = remoteSearchItems.filter((item) => {
      const haystack = normalize(
        `${item.title}${item.type}${item.meta}${item.description}`
      );
      return haystack.includes(needle);
    });
    const seen = new Set();
    return [...remoteMatches, ...localMatches].filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });
  }

  function escapeSearchHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---- 搜索历史 ---- */
  const SEARCH_HISTORY_KEY = "nova.search.history.v1";

  function readSearchHistory() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }

  function pushSearchHistory(keyword) {
    const text = String(keyword || "").trim();
    if (!text) return;
    const list = readSearchHistory().filter((item) => item !== text);
    list.unshift(text);
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 8)));
    } catch {
      /* 忽略存储异常 */
    }
  }

  function renderSearchHistory() {
    const list = readSearchHistory();
    if (!list.length) return false;
    searchSuggestions.innerHTML = list
      .map((word) => `<button class="suggestion-chip focusable" type="button" data-query="${escapeSearchHtml(word)}">${escapeSearchHtml(word)}</button>`)
      .join("");
    return true;
  }

  function paintSearchResults(query) {
    currentSearchQuery = query.trim();
    const matches = searchCatalogue(currentSearchQuery);
    if (!currentSearchQuery) renderSearchHistory();
    const visible = matches.slice(0, 6);

    searchResultTitle.textContent = currentSearchQuery ? `“${currentSearchQuery}” 的结果` : "推荐内容";
    searchResultCount.textContent = remoteSearchItems.length
      ? `${matches.length} 个结果 · 已搜索在线片库`
      : `${matches.length} 个结果`;

    if (!visible.length) {
      searchResults.innerHTML = `
        <div class="empty-result">
          <strong>没有找到相关内容</strong>
          <span>试试片名、演员、频道名或更短的关键词</span>
        </div>
      `;
      return;
    }

    searchResults.innerHTML = visible
      .map(
        (item) => `
          <button class="search-result focusable" type="button" data-key="${escapeSearchHtml(item.key)}">
            <span class="search-result-thumb"><img src="${escapeSearchHtml(item.image)}" alt="" /></span>
            <span class="search-result-copy">
              <span class="search-result-title">${escapeSearchHtml(item.title)}</span>
              <span class="search-result-meta">${escapeSearchHtml(item.meta)}</span>
            </span>
            <span class="search-result-type">${escapeSearchHtml(item.type)}</span>
          </button>
        `
      )
      .join("");
  }

  function scheduleRemoteSearch(query) {
    window.clearTimeout(remoteSearchTimer);
    const cleanQuery = query.trim();
    const requestId = ++remoteSearchRequest;
    if (!cleanQuery || !window.NovaSources?.loadLibraryItems) {
      remoteSearchItems = [];
      return;
    }
    remoteSearchTimer = window.setTimeout(async () => {
      try {
        const result = await window.NovaSources.loadLibraryItems({
          query: cleanQuery,
          limit: 18,
          force: true
        });
        if (
          requestId !== remoteSearchRequest ||
          currentSearchQuery !== cleanQuery
        ) {
          return;
        }
        remoteSearchItems = result.items || [];
      } catch (_) {
        if (requestId !== remoteSearchRequest) return;
        remoteSearchItems = [];
      }
      if (
        requestId === remoteSearchRequest &&
        currentSearchQuery === cleanQuery
      ) {
        paintSearchResults(cleanQuery);
      }
    }, 360);
  }

  function renderSearchResults(query) {
    currentSearchQuery = query.trim();
    scheduleRemoteSearch(query);
    paintSearchResults(query);
  }

  /* ---------- 详情页 2.0：介绍 + 选集 / 选源 ---------- */

  const DETAIL_GROUP_SIZE = 50;
  const detailPickerState = {
    mode: "none",
    lineIndex: 0,
    group: 0,
    lines: [],
    key: "",
    currentIndex: -1,
    initialized: false
  };
  // 调试口：控制台里能直接看选集状态
  window.NovaDetailPicker = detailPickerState;

  // 左栏信息小卡：类型 / 地区 / 年份 / 状态 / 集数 / 线路
  function paintDetailFacts(item) {
    if (!detailFacts) return;
    const segments = String(item?.meta || "")
      .split("·")
      .map((part) => part.trim())
      .filter(Boolean);
    const lines = detailPickerLines(item);
    const episodeCount = lines.length
      ? Math.max(...lines.map((line) => (line.episodes || []).length))
      : 0;
    const facts = [];
    if (item?.type) facts.push({ label: "类型", value: item.type });
    if (segments[1]) facts.push({ label: "地区", value: segments[1] });
    if (segments[0] && /^\d{4}$/.test(segments[0])) facts.push({ label: "年份", value: segments[0] });
    if (segments[2]) facts.push({ label: "状态", value: segments[2] });
    if (episodeCount > 1) facts.push({ label: "集数", value: `${episodeCount} 集` });
    if (lines.length) facts.push({ label: "线路", value: `${lines.length} 条` });
    const score = segments.find((part) => /分$/.test(part));
    if (score) facts.push({ label: "评分", value: score.replace(/\s*分$/, "") });
    detailFacts.innerHTML = facts
      .slice(0, 6)
      .map(
        (fact) => `
        <div class="fact-item">
          <span class="fact-label">${escapeSearchHtml(fact.label)}</span>
          <span class="fact-value" title="${escapeSearchHtml(fact.value)}">${escapeSearchHtml(fact.value)}</span>
        </div>`
      )
      .join("");
  }

  // 进度键是「条目key::集名」，而条目 key 自己就带 ::（src_x::lziapi:::166620），  // 所以只能从右边找最后一个 :: 切，不能 split。
  function splitProgressKey(storeKey) {
    const text = String(storeKey || "");
    const cut = text.lastIndexOf("::");
    if (cut <= 0) return { key: text, episode: "" };
    return { key: text.slice(0, cut), episode: text.slice(cut + 2) };
  }

  // 未合并的进度记录：「key::第N集」逐条留着，选集打点要用
  function readProgressRaw() {
    let raw = null;
    try {
      raw = JSON.parse(window.localStorage.getItem("nova.play.progress.v1") || "{}");
    } catch {
      return [];
    }
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw)
      .map(([storeKey, value]) => {
        if (!value || typeof value !== "object") return null;
        const parts = splitProgressKey(storeKey);
        const key = String(value.k || parts.key || "").trim();
        if (!key) return null;
        const total = Number(value.d) || 0;
        const current = Number(value.t) || 0;
        return {
          key,
          episode: String(value.e || parts.episode || "").trim(),
          at: Number(value.at) || 0,
          t: current,
          d: total,
          percent: total > 1 ? Math.max(1, Math.min(99, Math.round((current / total) * 100))) : 0
        };
      })
      .filter(Boolean);
  }

  // 某一部片：集名 → 最近一条进度
  function progressForShow(key) {
    const map = new Map();
    if (!key) return map;
    readProgressRaw()
      .filter((entry) => entry.key === key)
      .forEach((entry) => {
        const prev = map.get(entry.episode);
        if (!prev || prev.at < entry.at) map.set(entry.episode, entry);
      });
    return map;
  }

  function detailPickerLines(item) {
    const lines = Array.isArray(item?.lines) ? item.lines : [];
    return lines.filter((line) => (line.episodes || []).length);
  }

  // 「播放 / 继续」按钮指向哪一集
  function detailPlayTarget(item) {
    const lines = detailPickerLines(item);
    if (!lines.length) return null;
    const lineIndex = Math.min(Math.max(detailPickerState.lineIndex, 0), lines.length - 1);
    const line = lines[lineIndex];
    const episodes = line.episodes || [];
    if (!episodes.length) return null;
    const isSeries = episodes.length > 1;
    const progress = progressForShow(item?.key);
    let resume = null;
    if (isSeries) {
      episodes.forEach((episode) => {
        const saved = progress.get(episode.name);
        if (saved && (!resume || saved.at > resume.saved.at)) resume = { episode, saved };
      });
    }
    const target = resume ? resume.episode : episodes[0];
    const index = Math.max(0, episodes.indexOf(target));
    return {
      line,
      episodes,
      episode: target,
      index,
      isSeries,
      saved: progress.get(target?.name) || null
    };
  }

  function paintDetailFavorite(item) {
    if (!detailFavoriteBtn) return;
    const saved = Boolean(item?.key && window.NovaFav?.has?.(item.key));
    detailFavoriteBtn.classList.toggle("is-saved", saved);
    const label = detailFavoriteBtn.querySelector("span");
    if (label) label.textContent = saved ? "已加入片单" : "加入收藏";
    const use = detailFavoriteBtn.querySelector("use");
    if (use) use.setAttribute("href", saved ? "#i-check" : "#i-bookmark");
  }

  function paintDetailPlayLabel(item) {
    if (!detailPlayLabel) return;
    const target = detailPlayTarget(item);
    if (!target) {
      detailPlayLabel.textContent = item?.detailPromise
        ? "正在读取片源…"
        : item?.stream
          ? "播放测试片源"
          : "暂无直连片源";
      return;
    }
    if (target.saved) {
      detailPlayLabel.textContent = target.isSeries
        ? `继续 ${target.episode.name} · ${target.saved.percent}%`
        : `继续观看 · ${target.saved.percent}%`;
      return;
    }
    detailPlayLabel.textContent = target.isSeries ? `播放 ${target.episode.name}` : "播放正片";
  }

  function paintEpisodeMarks(item) {
    const progress = progressForShow(item?.key);
    detailEpGrid?.querySelectorAll("[data-detail-episode]").forEach((node) => {
      const index = Number(node.dataset.detailEpisode);
      const line = detailPickerState.lines[detailPickerState.lineIndex];
      const episode = line?.episodes?.[index];
      node.classList.toggle("is-watched", Boolean(episode && progress.get(episode.name)));
      node.classList.toggle("is-current", index === detailPickerState.currentIndex);
    });
  }

  function renderLineChips(lines) {
    if (!detailLineRow) return;
    if (lines.length < 2) {
      detailLineRow.innerHTML = "";
      return;
    }
    detailLineRow.innerHTML = lines
      .map(
        (line, index) => `
        <button class="line-chip focusable${index === detailPickerState.lineIndex ? " is-active" : ""}" type="button" data-detail-line="${index}">
          线路 ${index + 1}<em>${escapeSearchHtml(String(line.name || "").slice(0, 10))}</em>
        </button>`
      )
      .join("");
  }

  function renderEpisodeGrid(item) {
    const line = detailPickerState.lines[detailPickerState.lineIndex];
    const episodes = line?.episodes || [];
    const total = episodes.length;
    if (detailPickerSub) {
      detailPickerSub.textContent = `${line?.name ? `${line.name} · ` : ""}共 ${total} 集`;
    }

    const groups = Math.ceil(total / DETAIL_GROUP_SIZE);
    if (detailPickerState.group >= groups) detailPickerState.group = 0;
    if (detailEpGroups) {
      if (groups > 1) {
        detailEpGroups.hidden = false;
        detailEpGroups.innerHTML = Array.from({ length: groups }, (_, group) => {
          const from = group * DETAIL_GROUP_SIZE + 1;
          const to = Math.min(total, (group + 1) * DETAIL_GROUP_SIZE);
          return `<button class="group-chip focusable${group === detailPickerState.group ? " is-active" : ""}" type="button" data-detail-group="${group}">${from}-${to}</button>`;
        }).join("");
      } else {
        detailEpGroups.hidden = true;
        detailEpGroups.innerHTML = "";
      }
    }

    if (detailSourceList) detailSourceList.hidden = true;
    if (!detailEpGrid) return;
    detailEpGrid.hidden = false;

    const start = detailPickerState.group * DETAIL_GROUP_SIZE;
    const progress = progressForShow(item?.key);
    detailEpGrid.innerHTML = episodes
      .slice(start, start + DETAIL_GROUP_SIZE)
      .map((episode, offset) => {
        const index = start + offset;
        const watched = Boolean(progress.get(episode.name));
        const current = index === detailPickerState.currentIndex;
        return `<button class="ep-btn focusable${watched ? " is-watched" : ""}${current ? " is-current" : ""}" type="button"
          data-detail-episode="${index}" title="${escapeSearchHtml(episode.name || "")}">${escapeSearchHtml(episode.name || `第${index + 1}集`)}</button>`;
      })
      .join("");

    if (detailPickerScroll) detailPickerScroll.scrollTop = 0;
  }

  function renderSourceRows(item) {
    if (!detailSourceList) return;
    if (detailEpGrid) detailEpGrid.hidden = true;
    detailSourceList.hidden = false;
    detailSourceList.innerHTML = detailPickerState.lines
      .map((line, index) => {
        const episode = (line.episodes || [])[0] || {};
        const direct = /\.(m3u8|mp4|webm)(\?|$)/i.test(String(episode.url || ""));
        return `
          <button class="detail-source-card focusable${index === detailPickerState.lineIndex ? " is-active" : ""}" type="button" data-detail-source="${index}">
            <span class="source-dot"></span>
            <span class="source-name">线路 ${index + 1}</span>
            <span class="source-raw">${escapeSearchHtml(String(line.name || "内容源"))}</span>
            <span class="source-tag">${direct ? "直连" : "需解析"}</span>
          </button>`;
      })
      .join("");
  }

  function renderDetailPicker(item) {
    detailPickerState.lines = detailPickerLines(item);
    detailPickerState.key = item?.key || "";
    detailPickerState.lineIndex = Math.min(
      Math.max(detailPickerState.lineIndex, 0),
      Math.max(0, detailPickerState.lines.length - 1)
    );

    if (detailEpGrid) {
      detailEpGrid.innerHTML = "";
      detailEpGrid.hidden = false;
    }
    if (detailSourceList) {
      detailSourceList.innerHTML = "";
      detailSourceList.hidden = true;
    }
    if (detailLineRow) detailLineRow.innerHTML = "";
    if (detailEpGroups) {
      detailEpGroups.hidden = true;
      detailEpGroups.innerHTML = "";
    }
    if (detailPickerEmpty) detailPickerEmpty.hidden = true;

    const lines = detailPickerState.lines;
    if (!lines.length) {
      detailPickerState.mode = "none";
      if (detailPickerTitle) detailPickerTitle.textContent = "选集";
      if (detailPickerSub) detailPickerSub.textContent = "";
      if (detailPickerEmpty) {
        detailPickerEmpty.hidden = false;
        detailPickerEmpty.textContent = item?.detailPromise
          ? "正在从内容源读取分集…"
          : "这条内容没有分集信息，可直接按上方按钮播放";
      }
      return;
    }

    const episodeCount = Math.max(...lines.map((line) => (line.episodes || []).length));
    detailPickerState.mode = episodeCount > 1 ? "episodes" : "sources";
    if (detailPickerTitle) {
      detailPickerTitle.textContent = detailPickerState.mode === "episodes" ? "选集" : "播放源";
    }

    // 刚进详情页时，把「最近看过的那一集」标成当前集（只做一次，别覆盖用户翻的组）
    if (!detailPickerState.initialized) {
      const firstLine = lines[detailPickerState.lineIndex] || lines[0];
      const progress = progressForShow(item?.key);
      let latest = -1;
      let latestAt = 0;
      (firstLine?.episodes || []).forEach((episode, index) => {
        const saved = progress.get(episode.name);
        if (saved && saved.at > latestAt) {
          latestAt = saved.at;
          latest = index;
        }
      });
      detailPickerState.currentIndex = latest;
      detailPickerState.group = latest >= 0 ? Math.floor(latest / DETAIL_GROUP_SIZE) : 0;
      detailPickerState.initialized = true;
    }

    if (detailPickerState.mode === "episodes") {
      renderLineChips(lines);
      renderEpisodeGrid(item);
    } else {
      if (detailPickerSub) detailPickerSub.textContent = `${lines.length} 个播放源`;
      renderSourceRows(item);
    }
  }

  function openDetailPlayer(payload) {
    const item = currentDetail;
    if (!item || !payload?.url) {
      showToast("这个条目暂时没有可用片源");
      return;
    }
    const settings = window.NovaSettings?.get?.() || {};
    // 播放器里的「选集 / 下一集」需要整条分集表，顺手一起送进去
    const line = detailPickerState.lines[detailPickerState.lineIndex];
    const episodes = (line?.episodes || []).map((entry) => entry.name);
    const index = Number.isFinite(payload.index)
      ? payload.index
      : Math.max(0, episodes.indexOf(payload.episodeName || ""));
    const hasNext = episodes.length > 1 && index + 1 < episodes.length;
    window.NovaPlayer?.open({
      title: item.title,
      kind: item.type || item.kind || "NOVA TV",
      meta: [payload.episodeName, item.meta].filter(Boolean).join(" · "),
      source: item.sourceName || item.siteName || item.source || "内容源",
      url: payload.url,
      lines: payload.lines || [],
      autoSwitchLine: settings.autoSwitchLine !== false,
      key: item.key,
      image: item.image || "",
      episode: payload.episodeName || "",
      startAt: payload.startAt || 0,
      // 播放器内部用：选集抽屉 + 片尾自动连播
      episodes,
      episodeIndex: Math.max(0, index),
      nextEpisode: hasNext ? episodes[index + 1] : "",
      onEpisode: (next) => playDetailEpisode(next),
      onNext: hasNext ? () => playDetailEpisode(index + 1) : null
    });
  }

  function playDetailEpisode(index) {
    const item = currentDetail;
    const line = detailPickerState.lines[detailPickerState.lineIndex];
    const episode = line?.episodes?.[index];
    if (!episode?.url) {
      showToast("这一集还没有片源");
      return;
    }
    const options =
      window.NovaLines?.fromDetail({ ...item, lines: detailPickerState.lines }, { episodeIndex: index }) || [];
    const saved = progressForShow(item.key).get(episode.name);
    detailPickerState.currentIndex = index;
    paintEpisodeMarks(item);
    openDetailPlayer({
      url: episode.url,
      lines: options,
      episodeName: episode.name,
      index,
      startAt: saved?.t || 0
    });
  }

  // 详情页自己能补一次分集：不依赖 pages.js 的 dataState 是不是 "sources"
  let detailFetchKey = "";
  function ensureDetailLines(item) {
    if (!item?.key || !item.siteKey || item.detailPromise) return;
    if (Array.isArray(item.lines) && item.lines.length) return;
    if (detailFetchKey === item.key) return;
    if (!window.NovaSources?.getLibraryDetail) return;
    detailFetchKey = item.key;
    window.NovaSources.getLibraryDetail(item)
      .then((detail) => {
        if (detailScreen.hidden || currentDetail?.key !== item.key) return;
        const merged = window.NovaWithLines ? window.NovaWithLines(detail) : detail;
        refreshDetail({ ...merged, detailPromise: null });
      })
      .catch(() => {
        if (detailFetchKey === item.key) detailFetchKey = "";
      });
  }

  function updateDetailView(item) {
    detailBackdrop.style.backgroundImage = `url("${item.image || ""}")`;
    detailKind.textContent = item.type || item.kind || "内容";
    detailTitle.textContent = item.title || "";
    detailMeta.textContent = item.meta || "";
    detailDescription.textContent = item.description || "";

    const poster = proxiedPoster(item.image || "");
    if (detailPoster && detailPosterImg) {
      if (poster) {
        detailPoster.hidden = false;
        if (detailPosterImg.getAttribute("src") !== poster) detailPosterImg.src = poster;
      } else {
        detailPoster.hidden = true;
      }
    }

    const dynamicSource = Boolean(item.siteKey || item.sourceName?.includes("TVBox"));
    detailFootnoteText.textContent =
      item.playbackNote ||
      item.source ||
      (dynamicSource
        ? "片源由已启用内容源提供；仅播放配置返回的 HTTP(S) 地址"
        : "影片信息仅用于界面演示 · 播放内容为公开授权测试片源，不代表条目对应正片");

    paintDetailFavorite(item);
    paintDetailPlayLabel(item);
    renderDetailPicker(item);
    paintDetailFacts(item);
    ensureDetailLines(item);
  }

  function openDetail(item, options = {}) {
    const fromSearch = !searchScreen.hidden;
    // 换了一部片：选集相关的临时状态全部重置
    if (item?.key !== currentDetail?.key) {
      detailPickerState.lineIndex = 0;
      detailPickerState.group = 0;
      detailPickerState.currentIndex = -1;
      detailPickerState.initialized = false;
      detailFetchKey = "";
    }
    currentDetail = { ...item };
    detailReturn = {
      fromSearch,
      source: options.source || document.activeElement,
      searchKey: options.searchKey || null
    };

    searchScreen.hidden = true;
    detailScreen.hidden = false;
    appRoot.classList.add("is-dimmed");
    appRoot.inert = true;
    updateDetailView(item);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setFocus(detailPlay));
    // 长按 OK 进入：等片源就绪再起播（最多重试 12 次）
    if (window.__novaQuickPlayKey && currentDetail?.key === window.__novaQuickPlayKey) {
      window.__novaQuickPlayKey = null;
      let quickTries = 0;
      const fireQuickPlay = () => {
        if (detailScreen.hidden) return;
        if (detailPlay.disabled) {
          if (quickTries++ < 20) {
            window.setTimeout(fireQuickPlay, 500);
          } else {
            showToast("片源还在读取，按 OK 播放");
          }
          return;
        }
        detailPlay.click();
      };
      window.setTimeout(fireQuickPlay, 300);
    }
    });
  }

  function refreshDetail(item) {
    if (detailScreen.hidden || !item) return false;
    currentDetail = { ...item };
    updateDetailView(item);
    return true;
  }

  /** 首页行的显示规则：有配置行就顶掉固定卡片；设置里关掉的那块永远不显示 */
  function applyHomeVisibility() {
    const settings = window.NovaSettings?.get?.() || {};
    const recent = document.querySelector(".recent-section");
    const trending = document.querySelector(".trending-section");
    const rowsReady = Boolean(homeRows && !homeRows.hidden && homeRows.children.length);
    if (recent) recent.hidden = rowsReady || settings.showRecent === false;
    if (trending) trending.hidden = rowsReady || settings.showTrending === false;
  }

  /* ---------- 首页「最近观看」：数据来自播放进度 ---------- */

  // .recent-grid 是 3 列单行，最多放 3 张
  const RECENT_HOME_LIMIT = 3;
  const recentGrid = document.getElementById("heroRecentList");
  let homeRecentRecords = [];

  // 与 list/观看历史 同一份存储：{ "key::第N集": { t, d, n, e, p, u, at } }
  function readWatchProgress() {
    let raw = null;
    try {
      raw = JSON.parse(window.localStorage.getItem("nova.play.progress.v1") || "{}");
    } catch {
      return [];
    }
    if (!raw || typeof raw !== "object") return [];

    const byShow = new Map();
    Object.entries(raw).forEach(([storeKey, value]) => {
      if (!value || typeof value !== "object") return;
      const parts = splitProgressKey(storeKey);
      const key = String(value.k || parts.key || "").trim();
      const title = String(value.n || value.title || "").trim();
      if (!key || !title) return;
      const at = Number(value.at) || 0;
      // 同标题跨源视为同一部：按标题归一，保留最新一条
      const titleKey = title.replace(/[\s·:：\-—_（）()]+/g, "").toLowerCase();
      const prevByTitle = byShow.get(titleKey);
      if (prevByTitle && prevByTitle.at >= at) return;
      // 同标题跨源视为同一部：按标题归一，保留最新一条
      const total = Number(value.d) || 0;
      const current = Number(value.t) || 0;
      byShow.set(titleKey, {
        storeKey,
        key,
        at,
        title,
        image: value.p || value.image || "",
        episode: String(value.e || parts.episode || "").trim(),
        url: value.u || "",
        t: current,
        d: total,
        percent: total > 1 ? Math.max(1, Math.min(99, Math.round((current / total) * 100))) : 0
      });
    });

    return [...byShow.values()].sort((a, b) => b.at - a.at);
  }

  function proxiedPoster(url) {
    if (!url) return "";
    // 数据层有时已经把图包过代理（http://127.0.0.1:4178/api/proxy?…），别再套一层
    if (url.includes("/api/proxy?") || url.startsWith("data:") || url.startsWith("./")) return url;
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // 首页最近观看：纯文字行，不带海报
  function recentRowMarkup(record) {
    const percent = Math.max(0, Math.min(100, Number(record.percent) || 0));
    const remain = record.d > 0 ? Math.max(0, record.d - record.t) : 0;
    const episode = record.episode ? escapeSearchHtml(record.episode) : "—";
    return `
      <button class="hero-recent-row focusable" type="button" data-recent-key="${escapeSearchHtml(record.key)}">
        <span class="hero-recent-main">
          <span class="hero-recent-title">${escapeSearchHtml(record.title)}</span>
          <span class="hero-recent-ep">${episode}</span>
        </span>
        <span class="hero-recent-bar"><i style="width:${percent}%"></i></span>
        <span class="hero-recent-pct">${percent}%</span>
        <span class="hero-recent-time">${formatClock(record.t)} / ${formatClock(record.d)}</span>
        <span class="hero-recent-left">${remain > 0 ? `还剩 ${Math.max(1, Math.round(remain / 60))} 分` : "看完了"}</span>
      </button>`;
  }

  function renderRecentWatch() {
    if (!recentGrid) return;
    homeRecentRecords = readWatchProgress().slice(0, RECENT_HOME_LIMIT);
    if (!homeRecentRecords.length) {
      recentGrid.innerHTML =
        `<div class="hero-recent-empty">还没有观看记录 · 播一集后这里会自动排上进度</div>`;
      return;
    }
    recentGrid.innerHTML = homeRecentRecords.map(recentRowMarkup).join("");
    const countNode = document.getElementById("heroRecentCount");
    if (countNode) countNode.textContent = `全部 ${readWatchProgress().length} 条`;
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-recent-key]");
    if (!card) return;
    const record = homeRecentRecords.find((entry) => entry.key === card.dataset.recentKey);
    if (!record) return;
    event.preventDefault();
    // 有可播地址就直接续播；地址过期或缺失时退回详情页
    const stream = window.NovaPlayer?.rawUrl?.(record.url) || record.url;
    if (stream && typeof window.NovaPlayer?.open === "function") {
      window.NovaPlayer.open({
        title: record.title,
        kind: record.episode ? "剧集" : "NOVA TV",
        meta: record.episode || "继续观看",
        url: stream,
        key: record.key,
        image: record.image,
        episode: record.episode,
        startAt: record.t
      });
      return;
    }
    window.NovaPages?.openDetail?.({
      key: record.key,
      title: record.title,
      image: record.image,
      meta: record.episode
    });
  });

  renderRecentWatch();
  document.addEventListener("nova:progress-changed", renderRecentWatch);
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === "nova.play.progress.v1") renderRecentWatch();
  });

  function renderHomeRow(row) {
    const cards = (row.items || [])
      .map((item) => {
        homeRowItems.set(item.key, item);
        return `
          <button class="poster-card focusable" type="button" data-home-key="${escapeSearchHtml(item.key)}">
            <img src="${escapeSearchHtml(item.image)}" alt="" />
            <span class="poster-tone"></span>
            <span class="poster-bottom"></span>
            <span class="poster-title">${escapeSearchHtml(item.title)}</span>
            <span class="poster-meta">${escapeSearchHtml(item.meta || item.type || "")}</span>
          </button>
        `;
      })
      .join("");
    return `
      <section class="glass-section home-row" aria-label="${escapeSearchHtml(row.title)}">
        <div class="section-head">
          <div class="section-title-wrap">
            <span class="section-icon"><svg class="icon"><use href="#i-film" /></svg></span>
            <h2>${escapeSearchHtml(row.title)}</h2>
          </div>
          <span class="home-row-source">${escapeSearchHtml(row.siteName || "")}</span>
        </div>
        <div class="poster-grid home-row-grid">${cards}</div>
      </section>
    `;
  }

  async function refreshHomeRows() {
    if (!homeRows || !window.NovaSources?.loadHomeRows) return;
    homeRowItems.clear();
    homeRows.innerHTML = "";
    homeRows.hidden = true;
    applyHomeVisibility();
    try {
      const result = await window.NovaSources.loadHomeRows({ limit: 5, maxRows: 4 });
      if (!result?.rows?.length) return;
      homeRows.innerHTML = result.rows.map((row) => renderHomeRow(row)).join("");
      homeRows.hidden = false;
    } catch (_) {
      homeRows.hidden = true;
    }
    applyHomeVisibility();
  }

  function scheduleHomeRows() {
    window.clearTimeout(homeRowsTimer);
    homeRowsTimer = window.setTimeout(() => {
      refreshHomeRows();
    }, 220);
  }

  function openCatalogueItem(item, options = {}) {
    if (!item) return;
    if (!item.siteKey || item.stream || !window.NovaSources?.getLibraryDetail) {
      openDetail(item, options);
      return;
    }
    const requestKey = item.key;
    const detailPromise = window.NovaSources.getLibraryDetail(item);
    showToast(
      `正在从 ${item.siteName || item.sourceName || "在线片库"} 读取详情`
    );
    openDetail(
      {
        ...item,
        detailPromise,
        playbackNote: `正在从 ${
          item.siteName || item.sourceName || "在线片库"
        } 读取详情与公开直连片源`
      },
      options
    );
    detailPromise
      .then((detail) => {
        if (currentDetail?.key !== requestKey) return;
        refreshDetail(window.NovaWithLines ? window.NovaWithLines(detail) : detail);
      })
      .catch((error) => {
        if (currentDetail?.key !== requestKey) return;
        refreshDetail({
          ...item,
          detailPromise: null,
          playbackNote: `详情读取失败：${error.message}`
        });
      });
  }

  function closeDetail() {
    if (detailScreen.hidden) return;
    detailScreen.hidden = true;
    currentDetail = null;

    if (detailReturn?.fromSearch) {
      searchScreen.hidden = false;
      appRoot.classList.add("is-dimmed");
      appRoot.inert = true;
      paintSearchResults(currentSearchQuery);
      const key = detailReturn.searchKey;
      window.requestAnimationFrame(() => {
        const target = key ? searchResults.querySelector(`[data-key="${key}"]`) : null;
        setFocus(target || searchResults.querySelector(".search-result") || searchClose);
      });
      detailReturn = null;
      return;
    }

    const source = detailReturn?.source;
    detailReturn = null;
    syncDimState();
    window.requestAnimationFrame(() => {
      if (source && document.contains(source)) setFocus(source);
      else setFocus(searchTrigger);
    });
  }

  function handleAction(action, source) {
    if (action === "live" || action === "library" || action === "music" || action === "saved") {
      window.NovaPages?.open(action, source);
      return;
    }

    switch (action) {
      case "search":
        openSearch();
        break;
      case "network":
        toggleStatusPanel();
        break;
      case "sources":
        window.NovaPages?.open("settings", source, { section: "sources" });
        break;
      case "notifications":
        toggleStatusPanel();
        break;
      case "settings":
        window.NovaPages?.open("settings", source, { section: "sources" });
        break;
      case "recent-all":
        window.NovaPages?.open("saved", source, { tab: "history" });
        break;
      case "trending-all":
        window.NovaPages?.open("library", source, { category: "全部" });
        break;
      case "detail-favorite": {
        const item = currentDetail;
        if (!item?.key) {
          showToast("这个条目暂时无法收藏");
          break;
        }
        const result = window.NovaFav?.toggle?.(item);
        if (result) {
          paintDetailFavorite(item);
          showToast(result.added ? `已加入片单 · ${item.title}` : "已从片单移除");
        } else {
          showToast("收藏功能还没准备好");
        }
        break;
      }
      default:
        break;
    }
  }

  function goBack() {
    if (window.NovaPlayer?.isOpen?.()) {
      window.NovaPlayer.close();
      return;
    }
    if (!searchScreen.hidden) {
      closeSearch();
      return;
    }
    if (!detailScreen.hidden) {
      closeDetail();
      return;
    }
    if (window.NovaPages?.isOpen?.()) {
      window.NovaPages.close();
      return;
    }

    const active = document.activeElement;
    // 首页（新结构）：热门带 → 最近观看 → 功能卡 → 顶栏，逐级回退
    if (active?.closest("#homeShelves")) {
      setFocus(document.querySelector("[data-shelf-tab]") || searchTrigger);
      return;
    }
    if (active?.closest(".hero-recent")) {
      setFocus(searchTrigger);
      return;
    }
    if (active?.closest(".feature-grid")) {
      setFocus(document.querySelector(".hero-recent-row") || document.querySelector(".hero-recent-all") || searchTrigger);
      return;
    }
    showToast("已在 NOVA TV 首页");
  }

  function activateCurrent() {
    const active = document.activeElement;
    if (!active || active === document.body) return;
    if (active.matches?.("input") && active.closest("form")) {
      active.closest("form").requestSubmit();
      return;
    }
    if (active === searchInput) {
      const first = searchResults.querySelector(".search-result");
      if (first) first.click();
      return;
    }
    if (active.matches("button")) {
      active.click();
    }
  }

  window.addEventListener("resize", fitStage);

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target?.matches?.(".focusable")) {
      document.querySelectorAll(".is-focused").forEach((node) => {
        if (node !== target) node.classList.remove("is-focused");
      });
      target.classList.add("is-focused");
      currentFocus = target;
    }
  });

  document.addEventListener("click", (event) => {
    const focusable = event.target.closest?.(".focusable");
    if (focusable) {
      setFocus(focusable, { focus: false });
    }
  });

  searchTrigger.addEventListener("click", () => openSearch());

  searchClose.addEventListener("click", () => closeSearch());

  searchInput.addEventListener("input", () => {
    renderSearchResults(searchInput.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const first = searchResults.querySelector(".search-result");
      if (first) first.click();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      const first = searchResults.querySelector(".search-result");
      setFocus(first || searchClose);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      setFocus(searchClose);
    }
  });

  searchSuggestions.addEventListener("click", (event) => {
    const chip = event.target.closest(".suggestion-chip");
    if (!chip) return;
    searchInput.value = chip.dataset.query || chip.textContent.trim();
    renderSearchResults(searchInput.value);
    searchInput.focus({ preventScroll: true });
  });

  searchResults.addEventListener("click", (event) => {
    const result = event.target.closest(".search-result");
    if (!result) return;
    const item = [...remoteSearchItems, ...catalogue].find(
      (entry) => entry.key === result.dataset.key
    );
    if (!item) return;
    openCatalogueItem(item, { source: result, searchKey: item.key });
    pushSearchHistory(currentSearchQuery);
  });

  document.querySelectorAll("[data-action]").forEach((element) => {
    if (element === searchTrigger) return;
    element.addEventListener("click", () => {
      handleAction(element.dataset.action, element);
    });
  });

  document.querySelectorAll(".recent-card, .poster-card").forEach((card) => {
    card.addEventListener("click", () => {
      openDetail(
        {
          key: card.dataset.key,
          title: card.dataset.title,
          kind: card.dataset.kind,
          type: card.dataset.kind,
          meta: card.dataset.meta,
          image: card.dataset.image,
          description: card.dataset.detail
        },
        { source: card }
      );
    });
  });

  detailClose.addEventListener("click", closeDetail);
  detailPlay.addEventListener("click", async () => {
    let item = currentDetail;
    if (!item) return;

    if (!item.stream && item.detailPromise) {
      showToast("正在读取片源，请稍候");
      try {
        const detail = await item.detailPromise;
        if (detailScreen.hidden) return;
        refreshDetail(detail);
        item = currentDetail;
      } catch (error) {
        if (detailScreen.hidden) return;
        refreshDetail({
          ...item,
          detailPromise: null,
          playbackNote: `详情读取失败：${error.message}`
        });
        item = currentDetail;
      }
    }

    // 有分集信息：走「继续 / 第一集」那一集
    const target = detailPlayTarget(currentDetail || item);
    if (target?.episode?.url) {
      playDetailEpisode(target.index);
      return;
    }

    if (!item?.stream) {
      showToast("当前条目仅用于界面演示，暂无可用测试片源");
      return;
    }

    const lines = Array.isArray(item.novaLines) ? item.novaLines : [];
    const settings = window.NovaSettings?.get?.() || {};
    window.NovaPlayer?.open({
      title: item.title,
      kind: item.type || item.kind || "NOVA TV",
      meta:
        item.playbackNote ||
        `${item.meta || "内容信息用于界面演示"} · ${
          item.source || "开放测试片源"
        }`,
      source:
        item.source ||
        item.sourceName ||
        item.siteName ||
        "开放测试片源",
      url: item.stream || lines[0]?.url || "",
      lines,
      autoSwitchLine: settings.autoSwitchLine !== false,
      isLive: Boolean(item.isLive),
      // 「继续观看」要用的身份与封面
      key: item.key,
      image: item.image || item.pic || "",
      episode: item.episodeName || ""
    });
  });

  /* ---------- 详情页：选集 / 选源 / 相关推荐 ---------- */

  // 播放器关掉后（同一部片）：刷新已看标记与「继续」文案，不重建网格以免丢焦点
  document.addEventListener("nova:player-closed", () => {
    if (detailScreen.hidden || !currentDetail) return;
    paintDetailPlayLabel(currentDetail);
    paintEpisodeMarks(currentDetail);
    paintDetailFavorite(currentDetail);
  });

  detailScreen.addEventListener("click", (event) => {
    const episodeBtn = event.target.closest("[data-detail-episode]");
    if (episodeBtn) {
      event.preventDefault();
      playDetailEpisode(Number(episodeBtn.dataset.detailEpisode) || 0);
      return;
    }

    const sourceBtn = event.target.closest("[data-detail-source]");
    if (sourceBtn) {
      event.preventDefault();
      const index = Number(sourceBtn.dataset.detailSource) || 0;
      detailPickerState.lineIndex = index;
      renderDetailPicker(currentDetail);
      paintDetailPlayLabel(currentDetail);
      playDetailEpisode(0);
      return;
    }

    const lineChip = event.target.closest("[data-detail-line]");
    if (lineChip) {
      event.preventDefault();
      const index = Number(lineChip.dataset.detailLine) || 0;
      if (index === detailPickerState.lineIndex) return;
      detailPickerState.lineIndex = index;
      detailPickerState.group = 0;
      renderDetailPicker(currentDetail);
      paintDetailPlayLabel(currentDetail);
      const first = detailEpGrid?.querySelector(".ep-btn");
      if (first) setFocus(first);
      return;
    }

    const groupChip = event.target.closest("[data-detail-group]");
    if (groupChip) {
      event.preventDefault();
      const group = Number(groupChip.dataset.detailGroup) || 0;
      if (group === detailPickerState.group) return;
      detailPickerState.group = group;
      renderDetailPicker(currentDetail);
      const first = detailEpGrid?.querySelector(".ep-btn");
      if (first) setFocus(first);
      return;
    }

  });

  window.addEventListener("keydown", (event) => {
  /* ---- 长按 OK：跳过详情直接播 ---- */
  let quickHoldTimer = 0;
  let quickHoldFired = false;

  function quickPlayCardKey() {
    const el = document.activeElement;
    if (!el || !el.closest) return "";
    const card = el.closest("[data-library-key], [data-vod], [data-recent-key]");
    return card ? String(card.dataset.libraryKey || card.dataset.vod || card.dataset.recentKey || "") : "";
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.repeat) return;
      const key = quickPlayCardKey();
      if (!key) return;
      quickHoldFired = false;
      window.clearTimeout(quickHoldTimer);
      quickHoldTimer = window.setTimeout(() => {
        quickHoldFired = true;
        window.__novaQuickPlayKey = key;
        showToast("直接播放");
      }, 700);
    },
    true
  );

  document.addEventListener(
    "keyup",
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      window.clearTimeout(quickHoldTimer);
    },
    true
  );

    const key = event.key;
    const activeField = document.activeElement?.matches?.("input, textarea")
      ? document.activeElement
      : null;
    const direction = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down"
    }[key];

    if (direction) {
      const isTextarea = activeField?.tagName === "TEXTAREA";
      if (
        activeField &&
        ((direction === "left" || direction === "right") ||
          (isTextarea && (direction === "up" || direction === "down")))
      ) {
        return;
      }
      if (document.activeElement === searchInput && (direction === "left" || direction === "right")) {
        return;
      }
      event.preventDefault();
      moveFocus(direction);
      return;
    }

    if (key === "Enter") {
      const isTextarea = activeField?.tagName === "TEXTAREA";
      if (
        activeField &&
        activeField.closest("[data-source-dialog-form]") &&
        !isTextarea
      ) {
        event.preventDefault();
        activeField.closest("form")?.requestSubmit();
        return;
      }
      if (
        activeField &&
        isTextarea &&
        activeField.closest("[data-source-dialog-form]") &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        activeField.closest("form")?.requestSubmit();
        return;
      }
      if (isTextarea) return;
      event.preventDefault();
      activateCurrent();
      return;
    }

    if (key === " " || key === "Spacebar") {
      if (document.activeElement?.matches?.("button")) {
        event.preventDefault();
        activateCurrent();
      }
      return;
    }

    if (key === "Escape" || key === "BrowserBack" || key === "GoBack") {
      event.preventDefault();
      goBack();
      return;
    }

    if (key === "Backspace" && document.activeElement !== searchInput) {
      event.preventDefault();
      goBack();
    }
  });

  // Prevent the browser from restoring an old focus ring after connected displays wake.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !currentFocus) {
      const first = document.querySelector(".feature-card");
      if (first) setFocus(first);
    }
  });

  homeRows?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-home-key]");
    if (!card) return;
    const item = homeRowItems.get(card.dataset.homeKey);
    if (item) openCatalogueItem(item, { source: card });
  });

  // 订阅或设置一变，首页行跟着重算（设置里的「首页显示最近观看 / 热门内容」也在这条链上生效）
  document.addEventListener("nova:sources-changed", scheduleHomeRows);
  window.NovaSettings?.subscribe?.(() => applyHomeVisibility());

  fitStage();
  renderSearchResults("");
  refreshHomeRows();
  window.NovaOpenDetail = openDetail;
  window.NovaRefreshDetail = refreshDetail;
  window.NovaToast = showToast;

  window.setTimeout(() => {
    appRoot.classList.add("is-ready");
    window.setTimeout(() => {
      setFocus(document.querySelector(".feature-card"));
    }, 520);
  }, 40);
})();

