(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const appRoot = document.getElementById("appRoot");
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");

  const searchTrigger = document.getElementById("searchTrigger");
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

  function moveFocus(direction) {
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

    for (const candidate of elements) {
      if (candidate === current) continue;
      const rect = candidate.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;

      let primary;
      let perpendicular;

      if (direction === "left" || direction === "right") {
        primary = direction === "left" ? -dx : dx;
        perpendicular = Math.abs(dy);
        if (primary < 8) continue;
      } else {
        primary = direction === "up" ? -dy : dy;
        perpendicular = Math.abs(dx);
        if (primary < 8) continue;
      }

      const overlapX = Math.max(
        0,
        Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left)
      );
      const overlapY = Math.max(
        0,
        Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top)
      );
      const overlap = direction === "left" || direction === "right" ? overlapY : overlapX;
      const axisSize = direction === "left" || direction === "right" ? currentRect.height : currentRect.width;
      const overlapRatio = axisSize > 0 ? Math.min(1, overlap / axisSize) : 0;

      const score = primary + perpendicular * 1.48 - overlapRatio * 44;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
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

  function paintSearchResults(query) {
    currentSearchQuery = query.trim();
    const matches = searchCatalogue(currentSearchQuery);
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

  function updateDetailView(item) {
    detailBackdrop.style.backgroundImage = `url("${item.image}")`;
    detailKind.textContent = item.type || item.kind || "内容";
    detailTitle.textContent = item.title;
    detailMeta.textContent = item.meta || "";
    detailDescription.textContent = item.description || "";
    const dynamicSource = Boolean(item.siteKey || item.sourceName?.includes("TVBox"));
    detailPlayLabel.textContent = item.detailPromise
      ? "正在读取片源…"
      : item.stream
        ? dynamicSource
          ? item.episodeName
            ? `播放 ${item.episodeName}`
            : "播放首个片源"
          : "播放测试片源"
        : "暂无直连片源";
    detailFootnoteText.textContent =
      item.playbackNote ||
      item.source ||
      (dynamicSource
        ? "片源由已启用内容源提供；仅播放配置返回的 HTTP(S) 地址"
        : "影片信息仅用于界面演示 · 播放内容为公开授权测试片源，不代表条目对应正片");
    const favoriteButton = detailScreen.querySelector('[data-action="detail-favorite"] span');
    if (favoriteButton) favoriteButton.textContent = "加入收藏";
  }

  function openDetail(item, options = {}) {
    const fromSearch = !searchScreen.hidden;
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
    });
  }

  function refreshDetail(item) {
    if (detailScreen.hidden || !item) return false;
    currentDetail = { ...item };
    updateDetailView(item);
    return true;
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
        if (currentDetail?.key === requestKey) refreshDetail(detail);
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
        showToast("Wi-Fi 已连接 · 网络状态良好");
        break;
      case "sources":
        window.NovaPages?.open("settings", source, { section: "sources" });
        break;
      case "notifications":
        showToast("2 条提醒 · 内容源状态已更新，请查看运行检测");
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
      case "detail-favorite":
        showToast("已加入收藏");
        break;
      default:
        break;
    }
  }

  function goBack() {
    if (window.NovaPlayer?.isOpen?.()) {
      window.NovaPlayer.close();
      return;
    }
    if (window.NovaPages?.isOpen?.()) {
      window.NovaPages.close();
      return;
    }
    if (!detailScreen.hidden) {
      closeDetail();
      return;
    }
    if (!searchScreen.hidden) {
      closeSearch();
      return;
    }

    const active = document.activeElement;
    if (active?.closest(".poster-grid")) {
      setFocus(document.querySelector(".recent-card") || searchTrigger);
      return;
    }
    if (active?.closest(".recent-grid")) {
      setFocus(document.querySelector(".feature-card") || searchTrigger);
      return;
    }
    if (active?.closest(".feature-grid")) {
      setFocus(searchTrigger);
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

    if (!item?.stream) {
      showToast("当前条目仅用于界面演示，暂无可用测试片源");
      return;
    }

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
      url: item.stream,
      isLive: Boolean(item.isLive)
    });
  });

  window.addEventListener("keydown", (event) => {
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

  fitStage();
  renderSearchResults("");
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
