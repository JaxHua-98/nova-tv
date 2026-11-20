(() => {
  "use strict";

  const appRoot = document.getElementById("appRoot");
  const pages = {
    live: document.getElementById("livePage"),
    library: document.getElementById("libraryPage"),
    music: document.getElementById("musicPage"),
    saved: document.getElementById("savedPage"),
    settings: document.getElementById("settingsPage")
  };

  // 预览版不内置演示片库：内容源为空时展示空态，不伪造条目
  const fallbackLibraryItems = [];

  const fallbackLiveChannels = [];

  fallbackLibraryItems.forEach((item) => {
    const source = window.NovaDemoMedia?.library?.[item.key];
    if (source) Object.assign(item, source);
  });

  fallbackLiveChannels.forEach((channel) => {
    const source = window.NovaDemoMedia?.live?.[channel.key];
    if (source) Object.assign(channel, source);
  });

  let libraryItems = fallbackLibraryItems.slice();
  let liveChannels = fallbackLiveChannels.slice();
  let liveGroups = [...new Set(liveChannels.map((channel) => channel.group))];
  let liveDataState = "fallback";
  let liveDataError = "";
  let liveLoading = null;
  let libraryDataState = "fallback";
  let libraryDataError = "";
  let libraryLoading = null;
  let librarySourceCount = 0;
  let librarySiteCount = 0;
  // 被「过滤解说」挡掉的条目数，用于在片库头部如实说明，而不是悄悄少内容
  let libraryHiddenCommentary = 0;
  let librarySourceChecks = [];
  let liveLoadedRevision = -1;
  let libraryLoadedRevision = -1;
  let libraryDetailRequestId = 0;
  let sourceRefreshTimer = 0;

  const historyItems = [
    { key: "interstellar", progress: 58, label: "已观看 58%", note: "继续观看" },
    { key: "peaky", progress: 43, label: "已观看 第3集", note: "剧集 · S06" },
    { key: "totoro", progress: 72, label: "已观看 72%", note: "家庭 · 治愈" },
    { key: "dune", progress: 18, label: "已观看 18%", note: "上次观看 2 天前" },
    { key: "lostyou", progress: 64, label: "已观看 第12集", note: "剧集 · 全39集" },
    { key: "yourname", progress: 31, label: "已观看 31%", note: "上次观看 5 天前" }
  ];

  const favoriteItems = [
    { key: "dune", note: "最近收藏" },
    { key: "yourname", note: "已收藏" },
    { key: "avengers", note: "已收藏" },
    { key: "joker", note: "已收藏" },
    { key: "interstellar", note: "已收藏" },
    { key: "totoro", note: "已收藏" }
  ];

  // 曲库全部来自 music-source.js（聚合 API）；本地不再内置曲目
  let musicFeed = [];
  let musicFeedLoaded = false;
  const settingsState = {
    section: "sources",
    choices: {
      playback: "自动",
      music: "高品质",
      appearance: "跟随系统"
    },
    toggles: {
      browsing: [
        { key: "showRecent", label: "首页显示最近观看", value: true },
        { key: "showTrending", label: "首页显示热门内容", value: true },
        { key: "crossSourceSearch", label: "跨源聚合搜索结果", value: true },
        { key: "refreshOnStart", label: "启动时刷新订阅源", value: false }
      ],
      playback: [
        { key: "hardwareDecode", label: "优先硬件解码", value: true },
        { key: "autoSwitchLine", label: "播放失败自动切换线路", value: true },
        { key: "resumePlayback", label: "记录续播位置", value: true },
        { key: "skipIntro", label: "跳过片头片尾", value: false }
      ],
      music: [
        { key: "musicBackground", label: "允许后台播放", value: true },
        { key: "musicKeepOnHome", label: "音乐继续播放时进入首页", value: true },
        { key: "musicHeadphoneDuck", label: "连接耳机时自动降低音量", value: true },
        { key: "musicLossless", label: "优先无损音质", value: false }
      ],
      appearance: [
        { key: "focusOutline", label: "显示焦点白色描边", value: true },
        { key: "ambientMotion", label: "启用流体背景缓慢动画", value: true },
        { key: "safeArea", label: "保持 16:9 安全边距", value: true },
        { key: "highContrastSubtitles", label: "使用高对比度字幕", value: false }
      ]
    }
  };

  const sourceManagerState = {
    selectedId: window.NovaSources?.demoSourceId || ""
  };

  // 设置 → 影视源：站点级启停 / 测速 / 排序 的界面状态
  const siteManagerState = {
    selectedKey: "",
    query: "",
    typeFilter: "all",
    onlyEnabled: false,
    testing: new Set()
  };

  const liveState = {
    group: "全部",
    selectedKey: liveChannels[0]?.key || ""
  };

  const libraryState = {
    category: "全部",
    heroKey: libraryItems[0]?.key || ""
  };

  const musicState = {
    currentIndex: 0,
    mode: "track",     // track = 本地曲目，radio = 网络电台
    radioIndex: -1,
    playMode: "list",  // list / one / shuffle
    muted: false
  };

  // 公开电台流：走本地代理，免得被 Referer / CORS 挡掉
  const musicRadioData = [
    { id: "groove-salad", title: "Groove Salad", note: "慢拍电子 · SomaFM", url: "https://ice1.somafm.com/groovesalad-128-mp3", badge: "FM" },
    { id: "drone-zone", title: "Drone Zone", note: "氛围长音 · SomaFM", url: "https://ice1.somafm.com/dronezone-128-mp3", badge: "FM" },
    { id: "secret-agent", title: "Secret Agent", note: "复古谍战 · SomaFM", url: "https://ice1.somafm.com/secretagent-128-mp3", badge: "FM" },
    { id: "radio-paradise", title: "Radio Paradise", note: " eclectic 摇滚 · 全球", url: "https://stream.radioparadise.com/aac-128", badge: "FM" }
  ];

  const MUSIC_STORE_KEY = "nova.music.v1";

  // Radio Browser 拉回来的在线电台；为空时退回内置 4 条
  let musicRadioLive = [];
  let musicRadioLoaded = false;

  function radioList() {
    return musicRadioLive.length ? musicRadioLive : musicRadioData;
  }

  const savedState = {
    tab: "history",
    filter: "all",   // all / movie / series / music
    sort: "recent"   // recent / watch / score
  };

  let activePageKey = null;
  let rootReturnFocus = null;
  const pageStack = [];

  document.addEventListener("nova:sources-changed", () => {
    liveDataState = "idle";
    libraryDataState = "idle";
    liveLoadedRevision = -1;
    libraryLoadedRevision = -1;
    window.clearTimeout(sourceRefreshTimer);
    sourceRefreshTimer = window.setTimeout(() => {
      if (activePageKey === "live") refreshLiveData(true);
      if (activePageKey === "library") refreshLibraryData(true);
    }, 180);
  });

  const liveFilterRow = document.getElementById("liveFilterRow");
  const liveChannelGrid = document.getElementById("liveChannelGrid");
  const liveChannelCount = document.getElementById("liveChannelCount");
  const livePreviewVisual = document.getElementById("livePreviewVisual");
  const livePreviewTitle = document.getElementById("livePreviewTitle");
  const livePreviewMeta = document.getElementById("livePreviewMeta");
  const livePlayButton = document.getElementById("livePlayButton");
  const liveHeaderStatus = document.getElementById("liveHeaderStatus");

  const libraryCategoryList = document.getElementById("libraryCategoryList");
  const libraryHeroImage = document.getElementById("libraryHeroImage");
  const libraryHeroType = document.getElementById("libraryHeroType");
  const libraryHeroTitle = document.getElementById("libraryHeroTitle");
  const libraryHeroMeta = document.getElementById("libraryHeroMeta");
  const libraryHeroDescription = document.getElementById("libraryHeroDescription");
  const libraryHeroPlay = document.getElementById("libraryHeroPlay");
  const libraryHeroFavorite = document.getElementById("libraryHeroFavorite");
  const libraryGrid = document.getElementById("libraryGrid");
  const libraryGridCount = document.getElementById("libraryGridCount");
  const libraryHeaderCount = document.getElementById("libraryHeaderCount");
  const librarySummaryTitle = document.getElementById("librarySummaryTitle");
  const librarySummaryText = document.getElementById("librarySummaryText");
  const librarySourceAlert = document.getElementById("librarySourceAlert");
  const librarySourceAlertTitle = document.getElementById("librarySourceAlertTitle");
  const librarySourceAlertDetail = document.getElementById("librarySourceAlertDetail");
  const librarySourceAlertBadge = document.getElementById("librarySourceAlertBadge");

  const musicAudio = document.getElementById("musicAudio");
  const musicToggle = document.getElementById("musicToggle");
  const musicPrev = document.getElementById("musicPrev");
  const musicNext = document.getElementById("musicNext");
  const musicQueue = document.getElementById("musicQueue");
  const musicTrackTitle = document.getElementById("musicTrackTitle");
  const musicTrackArtist = document.getElementById("musicTrackArtist");
  const musicCurrentTime = document.getElementById("musicCurrentTime");
  const musicDuration = document.getElementById("musicDuration");
  const musicProgressFill = document.getElementById("musicProgressFill");
  const musicStateLabel = document.getElementById("musicStateLabel");

  const savedGrid = document.getElementById("savedGrid");
  const savedPanelTitle = document.getElementById("savedPanelTitle");
  const savedPanelSubtitle = document.getElementById("savedPanelSubtitle");
  const savedItemCount = document.getElementById("savedItemCount");

  const settingsNav = document.getElementById("settingsNav");
  const settingsPanel = document.getElementById("settingsPanel");
  let sourceDialog = null;
  let sourceFileInput = null;
  let sourceDialogReturnFocus = null;
  let sourceActionBusy = false;
  let focusSequence = 0;

  function icon(id, extraClass = "") {
    return `<svg class="icon ${extraClass}"><use href="#${id}" /></svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanInline(value, fallback = "") {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return text || fallback;
  }

  function revealInScrollable(element) {
    let container = element?.parentElement;
    while (container && container !== document.body) {
      const style = window.getComputedStyle(container);
      if (
        /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`) &&
        container.scrollHeight > container.clientHeight
      ) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const edge = 8;
        if (elementRect.top < containerRect.top + edge) {
          container.scrollTop -= containerRect.top + edge - elementRect.top;
        } else if (elementRect.bottom > containerRect.bottom - edge) {
          container.scrollTop += elementRect.bottom - (containerRect.bottom - edge);
        }
        return;
      }
      container = container.parentElement;
    }
  }

  function sourceCompatibilityLabel(status) {
    return {
      ready: "主链路可用",
      partial: "部分兼容",
      limited: "受限",
      error: "同步异常"
    }[status] || "待同步";
  }

  function sourceRuntimeLabel(status) {
    return {
      ok: "运行正常",
      partial: "部分可用",
      failed: "检测失败",
      unsupported: "需 Spider",
      pending: "未检测"
    }[status] || "未检测";
  }

  function sourceRuntimeSummary(runtime) {
    if (!runtime) return "尚未执行运行检测";
    if (runtime.fatalError) return runtime.fatalError;
    const siteText = `${runtime.siteSuccessCount || 0}/${runtime.checkedSiteCount || 0} 站点`;
    const liveText = `${runtime.liveSuccessCount || 0}/${runtime.checkedLiveCount || 0} 直播`;
    const contentText = `${runtime.itemCount || 0} 条目 · ${runtime.channelCount || 0} 频道`;
    const providerCount =
      Number(runtime.providerSiteCount || 0) + Number(runtime.spiderSiteCount || 0);
    const adaptedCount = Number(runtime.adaptedSiteCount || 0);
    if (runtime.executableSiteCount === 0 && providerCount > 0) {
      return `${providerCount} 个影视站点需 Spider · ${liveText} · ${runtime.channelCount || 0} 频道`;
    }
    if (!runtime.checkedSiteCount && !runtime.checkedLiveCount) {
      return runtime.providerSiteCount || runtime.spiderSiteCount
        ? `${runtime.providerSiteCount || 0} 个 csp_* / JS 站点 · ${runtime.spiderSiteCount || 0} 个 Spider 站点`
        : "配置中没有可直接执行的站点或直播源";
    }
    if (adaptedCount) {
      return `${adaptedCount} 个兼容直连 · ${runtime.itemCount || 0} 条目 · ${liveText}`;
    }
    return `${siteText} · ${liveText} · ${contentText}`;
  }

  function focusElement(element) {
    if (!element || element.closest("[hidden]")) return;
    // 统一走 NovaFocus：真 focus + 高亮 + 手动滚动（嵌套容器里 scrollIntoView 会误判）
    if (window.NovaFocus?.to) {
      window.NovaFocus.to(element);
      return;
    }
    const sequence = ++focusSequence;
    const applyFocus = () => {
      if (
        sequence !== focusSequence ||
        !document.contains(element) ||
        element.closest("[hidden]")
      ) {
        return;
      }
      document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
      revealInScrollable(element);
      element.focus({ preventScroll: true });
      element.classList.add("is-focused");
    };
    applyFocus();
    window.setTimeout(() => {
      if (document.activeElement !== element) applyFocus();
    }, 80);
    window.setTimeout(() => {
      if (document.activeElement === document.body) applyFocus();
    }, 180);
  }

  function getLibraryItem(key) {
    return (
      libraryItems.find((item) => item.key === key) ||
      fallbackLibraryItems.find((item) => item.key === key) ||
      null
    );
  }

  function showToast(message) {
    if (typeof window.NovaToast === "function") {
      window.NovaToast(message);
    }
  }

  function openDetail(item) {
    if (!item) {
      showToast("该分类暂无演示内容");
      return;
    }
    if (typeof window.NovaOpenDetail === "function") {
      window.NovaOpenDetail(item, { source: document.activeElement });
    }
  }

  /** 详情 → 多源线路：交给 lines.js 排序、合并镜像，第一条即默认播放源 */
  function withNovaLines(detail) {
    if (!detail || !window.NovaLines) return detail;
    try {
      const options = window.NovaLines.fromDetail(detail);
      if (!options.length) return detail;
      return {
        ...detail,
        novaLines: options,
        stream: options[0]?.url || detail.stream,
        playbackNote: detail.playbackNote
          ? `${detail.playbackNote} · ${options.length} 条线路`
          : `${options.length} 条线路`
      };
    } catch (_) {
      return detail;
    }
  }
  window.NovaWithLines = withNovaLines;

  async function openLibraryEntry(item) {
    if (!item) {
      showToast("当前条目不可用");
      return;
    }
    if (!item.siteKey || item.stream || libraryDataState !== "sources") {
      openDetail(item);
      return;
    }
    const requestId = ++libraryDetailRequestId;
    const detailPromise = window.NovaSources.getLibraryDetail(item);
    showToast(`正在从 ${item.siteName || item.sourceName || "内容源"} 读取详情`);
    openDetail({
      ...item,
      detailPromise,
      playbackNote: `正在从 ${item.siteName || item.sourceName || "内容源"} 读取详情与直连片源`
    });
    try {
      const detail = await detailPromise;
      if (requestId !== libraryDetailRequestId) return;
      if (typeof window.NovaRefreshDetail === "function") {
        window.NovaRefreshDetail(withNovaLines(detail));
      } else {
        openDetail(withNovaLines(detail));
      }
    } catch (error) {
      if (requestId !== libraryDetailRequestId) return;
      const failedItem = {
        ...item,
        detailPromise: null,
        playbackNote: `详情读取失败：${error.message}`
      };
      if (typeof window.NovaRefreshDetail === "function") {
        window.NovaRefreshDetail(failedItem);
      } else {
        openDetail(failedItem);
      }
    }
  }

  function libraryGroup(type) {
    const value = String(type || "");
    if (/动画|动漫|少儿/.test(value)) return "动画";
    if (/综艺|真人秀|脱口秀/.test(value)) return "综艺";
    if (/剧|连续|电视|短片/.test(value)) return "剧集";
    if (/电影|片|动作|喜剧|爱情|科幻|恐怖|剧情/.test(value)) return "电影";
    return value || "影视";
  }

  function filterForCategory(category) {
    if (category === "全部") return libraryItems;
    return libraryItems.filter((item) => libraryGroup(item.type) === category);
  }

  function renderLiveFilters() {
    // 直播页已由 live-ui.js 接管，旧实现找不到元素时静默退出
    if (!liveFilterRow || !document.body.contains(liveFilterRow)) return;
    const available = ["全部", ...liveGroups].slice(0, 7);
    if (!available.includes(liveState.group)) liveState.group = "全部";
    liveFilterRow.innerHTML = available
      .map(
        (group) => `
          <button
            class="page-chip focusable${group === liveState.group ? " is-selected" : ""}"
            type="button"
            data-live-group="${escapeHtml(group)}"
          >${escapeHtml(group)}</button>
        `
      )
      .join("");
  }

  async function refreshLiveData(force = false) {
    if (!liveChannelGrid || !document.body.contains(liveChannelGrid)) return null;
    if (liveLoading) return liveLoading;
    liveDataState = "loading";
    liveHeaderStatus.textContent = "正在同步直播源";
    renderLive();
    liveLoading = (async () => {
      try {
        const result = await window.NovaSources.loadLiveChannels({ force });
        if (result.channels.length) {
          liveChannels = result.channels;
          liveGroups = result.groups;
          liveDataState = "sources";
          liveDataError = "";
          liveHeaderStatus.textContent = `${result.sourceCount} 个直播源 · ${result.channels.length} 个频道`;
        }
      } catch (error) {
        liveChannels = fallbackLiveChannels.slice();
        liveGroups = [...new Set(liveChannels.map((channel) => channel.group))];
        liveDataState = "fallback";
        liveDataError = error.message || "直播源同步失败";
        liveHeaderStatus.textContent = "演示信号回退";
      } finally {
        liveLoading = null;
        liveLoadedRevision = window.NovaSources?.revision ?? 0;
        if (activePageKey === "live") renderLive();
      }
    })();
    return liveLoading;
  }

  function renderLive() {
    if (!liveChannelGrid || !document.body.contains(liveChannelGrid)) return;
    const channels =
      liveState.group === "全部"
        ? liveChannels
        : liveChannels.filter((channel) => channel.group === liveState.group);

    if (!channels.some((channel) => channel.key === liveState.selectedKey)) {
      liveState.selectedKey = channels[0]?.key || "";
    }

    renderLiveFilters();
    liveFilterRow.querySelectorAll("[data-live-group]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.liveGroup === liveState.group);
    });

    liveChannelCount.textContent =
      liveState.group === "全部"
        ? `${liveChannels.length} 个频道 · ${liveGroups.length} 个分组`
        : `${channels.length} 个频道 · ${liveState.group}分组`;

    if (liveDataState === "loading") {
      liveChannelGrid.innerHTML = `
        <div class="live-empty-panel">
          <span class="player-spinner" aria-hidden="true"></span>
          <strong>正在解析 M3U / TXT 直播源</strong>
          <span>同名频道的多条线路会自动合并</span>
        </div>
      `;
      return;
    }

    liveChannelGrid.innerHTML = channels
      .map(
        (channel) => `
          <button
            class="live-channel-card tone-${channel.tone} focusable${channel.key === liveState.selectedKey ? " is-selected" : ""}"
            type="button"
            data-live-key="${escapeHtml(channel.key)}"
            data-channel-group="${escapeHtml(channel.group)}"
          >
            <span class="live-card-top">
              <span class="live-card-badge"><i></i>LIVE</span>
              ${channel.urls?.length > 1 ? `<span class="live-line-count">${channel.urls.length} 线路</span>` : ""}
            </span>
            <span class="live-card-copy">
              <strong>${escapeHtml(channel.name)}</strong>
              <span>${escapeHtml(channel.group)} · ${escapeHtml(channel.sourceLabel || "标准直播源")}</span>
            </span>
          </button>
        `
      )
      .join("");

    if (!channels.length) {
      liveChannelGrid.innerHTML = `
        <div class="live-empty-panel">
          <strong>${escapeHtml(liveDataError || "当前分组没有频道")}</strong>
          <span>可在设置中同步或更换 TVBox 直播源</span>
        </div>
      `;
    }

    const selected = channels.find((channel) => channel.key === liveState.selectedKey) || channels[0];
    if (selected) updateLivePreview(selected);
  }

  function updateLivePreview(channel) {
    liveState.selectedKey = channel.key;
    liveChannelGrid.querySelectorAll(".live-channel-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.liveKey === channel.key);
    });
    livePreviewTitle.textContent = channel.name;
    livePreviewMeta.textContent = `${channel.group} · ${channel.sourceLabel || "标准直播源"} · ${channel.sourceName || "内置开放测试信号"}`;
    livePreviewVisual.style.backgroundImage = `url(${JSON.stringify(channel.image)})`;
    livePlayButton.disabled = !channel.stream;
    livePlayButton.querySelector("span").textContent = channel.stream
      ? channel.urls?.length > 1
        ? `播放当前频道 · 默认线路`
        : "播放当前频道"
      : "当前频道暂无地址";
  }

  function renderLibrarySourceAlert() {
    if (
      !librarySourceAlert ||
      !librarySourceAlertTitle ||
      !librarySourceAlertDetail ||
      !librarySourceAlertBadge
    ) {
      return;
    }
    const sourceApi = window.NovaSources;
    const sources = sourceApi?.list?.() || [];
    const enabledSources = sources.filter((source) => source.enabled);
    const nonDemoSources = enabledSources.filter(
      (source) => source.id !== sourceApi?.demoSourceId
    );
    const aggregate = sourceApi?.aggregate?.();
    const aggregateStats = aggregate?.stats || {};
    const scriptSites =
      Number(aggregateStats.providerSites || 0) +
      Number(aggregateStats.spiderSites || 0);
    const executableSites = Number(aggregateStats.supportedSites || 0);
    const failedChecks = librarySourceChecks.filter((check) => check.error);
    const firstError = cleanInline(
      failedChecks[0]?.error || libraryDataError || "内容源没有返回条目"
    ).slice(0, 110);

    let title = "";
    let detail = "";
    let badge = "";
    if (libraryDataState === "fallback") {
      title = "尚未导入内容源";
      if (nonDemoSources.length && executableSites === 0 && scriptSites > 0) {
        detail = `已启用订阅包含 ${scriptSites} 个 Spider/JS 站点，预览版不能执行；片库不会出现这些站点内容。`;
        badge = "订阅未生效";
      } else if (nonDemoSources.length && failedChecks.length) {
        detail = `${failedChecks.length} 个影视站点请求失败：${firstError}`;
        badge = "请求失败";
      } else if (nonDemoSources.length && executableSites === 0) {
        detail = "已启用订阅没有可直接请求的苹果 CMS 或 HTML 规则影视站点。";
        badge = "无可用片源";
      } else {
        detail = libraryDataError
          ? `影视源暂无内容：${firstError}`
          : "在「设置 → 内容源」导入 TVBox 订阅，或添加影视站点后即可浏览。";
        badge = "等待内容源";
      }
    } else if (libraryDataState === "sources" && failedChecks.length) {
      title = "部分影视源未返回内容";
      detail = `${failedChecks.length} 个站点检测失败：${firstError}`;
      badge = "部分可用";
    }

    if (!title) {
      librarySourceAlert.hidden = true;
      return;
    }
    librarySourceAlertTitle.textContent = title;
    librarySourceAlertDetail.textContent = detail;
    librarySourceAlertBadge.textContent = badge;
    librarySourceAlert.hidden = false;
  }

  async function refreshLibraryData(force = false) {
    if (libraryLoading) return libraryLoading;
    libraryDataState = "loading";
    if (librarySourceAlert) librarySourceAlert.hidden = true;
    libraryHeaderCount.textContent = "正在聚合启用站点";
    libraryLoading = (async () => {
      try {
        const result = await window.NovaSources.loadLibraryItems({ force });
        if (result.items.length) {
          libraryItems = result.items;
          librarySourceCount = result.sourceCount;
          librarySiteCount = result.siteCount;
          libraryHiddenCommentary = Number(result.hiddenCommentary) || 0;
          librarySourceChecks = Array.isArray(result.stats) ? result.stats : [];
          libraryDataState = "sources";
          libraryDataError = "";
        }
      } catch (error) {
        libraryItems = fallbackLibraryItems.slice();
        librarySourceCount = 0;
        librarySiteCount = 0;
        libraryHiddenCommentary = 0;
        librarySourceChecks = Array.isArray(error.stats) ? error.stats : [];
        libraryDataState = "fallback";
        libraryDataError = error.message || "影视源同步失败";
      } finally {
        libraryLoading = null;
        libraryLoadedRevision = window.NovaSources?.revision ?? 0;
        if (activePageKey === "library") renderLibrary();
      }
    })();
    return libraryLoading;
  }

  function renderLibrary(category = libraryState.category) {
    libraryState.category = category;
    renderLibrarySourceAlert();
    const categories = ["全部", "电影", "剧集", "动画", "综艺"];
    const counts = Object.fromEntries(
      categories.map((name) => [name, filterForCategory(name).length])
    );
    libraryCategoryList.innerHTML = categories
      .map(
        (name) => `
          <button
            class="rail-choice focusable${name === category ? " is-selected" : ""}"
            type="button"
            data-library-category="${escapeHtml(name)}"
          >
            <span>${escapeHtml(name)}</span><b>${counts[name]}</b>
          </button>
        `
      )
      .join("");

    const filtered = filterForCategory(category);
    const sourceStats = window.NovaSources?.aggregate?.().stats || {};
    const scriptSiteCount =
      Number(sourceStats.providerSites || 0) +
      Number(sourceStats.spiderSites || 0);
    const summary = {
      全部:
        libraryDataState === "sources"
          ? ["全部内容", "来自已启用 TVBox 站点"]
          : ["内置演示片库", "当前不是你的 TVBox 订阅内容"],
      电影: ["电影", "按内容源返回顺序聚合"],
      剧集: ["剧集", "剧集条目与更新信息聚合"],
      动画: ["动画", "动画电影与番剧条目"],
      综艺: ["综艺", "综艺与真人秀条目"]
    }[category];

    librarySummaryTitle.textContent = summary[0];
    librarySummaryText.textContent = summary[1];
    libraryGridCount.textContent = filtered.length > 8 ? `${filtered.length} 部内容 · 显示前 8 部` : `${filtered.length} 部内容`;
    libraryHeaderCount.textContent =
      libraryDataState === "loading"
        ? "正在聚合启用站点"
        : libraryDataState === "sources"
          ? `${libraryItems.length} 部 · ${librarySourceCount} 个来源${
              libraryHiddenCommentary ? ` · 已过滤 ${libraryHiddenCommentary} 条解说` : ""
            }`
          : scriptSiteCount
            ? `暂无可播源 · ${scriptSiteCount} 个需 Spider · 去设置换源`
            : "还没有影视源 · 去「设置 → 订阅与内容源」添加";

    if (filtered.length) {
      const hero = filtered[0];
      libraryState.heroKey = hero.key;
      libraryHeroImage.src = hero.image;
      libraryHeroImage.alt = `${hero.title}海报`;
      libraryHeroType.textContent = hero.type;
      libraryHeroTitle.textContent = hero.title;
      libraryHeroMeta.textContent = hero.meta;
      libraryHeroDescription.textContent = hero.description;
      libraryHeroPlay.disabled = false;
      libraryHeroPlay.querySelector("span").textContent =
        libraryDataState === "sources" ? "读取详情" : "查看详情";
    } else {
      libraryState.heroKey = "";
      libraryHeroImage.src = "./assets/images/dune.jpg";
      libraryHeroImage.alt = "";
      libraryHeroType.textContent = "提示";
      libraryHeroTitle.textContent = `${category}分类暂无内容`;
      libraryHeroMeta.textContent =
        libraryDataState === "sources"
          ? `已连接 ${librarySiteCount} 个站点，但当前分类没有条目`
          : libraryDataError || "等待内容源同步";
      libraryHeroDescription.textContent =
        "切换其他分类，或在设置中导入并启用包含该类内容的 TVBox 订阅。";
      libraryHeroPlay.disabled = true;
    }

    if (!filtered.length) {
      libraryGrid.innerHTML = `
        <div class="library-empty">
          <strong>${escapeHtml(category)} 分类暂无内容</strong>
          <span>${escapeHtml(libraryDataError || "按 Back 返回首页，或选择其他分类继续浏览")}</span>
        </div>
      `;
      return;
    }

    libraryGrid.innerHTML = filtered
      .slice(0, 8)
      .map(
        (item) => `
          <button class="library-card focusable" type="button" data-library-key="${escapeHtml(item.key)}">
            <img src="${escapeHtml(item.image)}" alt="" />
            <span class="library-card-shade"></span>
            <span class="content-type-pill">${escapeHtml(item.type)}</span>
            <span class="library-card-copy">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.meta)}</span>
            </span>
          </button>
        `
      )
      .join("");
  }

  function renderMusicQueue() {
    if (!musicFeed.length) {
      musicQueue.innerHTML = `<div class="music-rail-empty">曲库还没加载</div>`;
      return;
    }
    musicQueue.innerHTML = musicFeed
      .map(
        (track, index) => `
          <button
            class="music-rail-card focusable${index === musicState.currentIndex && musicState.mode === "track" ? " is-active" : ""}"
            type="button"
            tabindex="0"
            data-music-index="${index}"
          >
            <span class="rail-cover">
              <img src="${track.cover || "./assets/images/yourname.jpg"}" alt="" />
              <span class="rail-index">${String(index + 1).padStart(2, "0")}</span>
            </span>
            <span class="rail-meta">
              <strong>${escapeHtml(track.title)}</strong>
              <span>${escapeHtml(track.artist || "")} · ${formatTime(track.duration || 0)}</span>
            </span>
          </button>
        `
      )
      .join("");
  }

  function syncMusicQueueSelection() {
    musicQueue.querySelectorAll("[data-music-index]").forEach((item) => {
      item.classList.toggle(
        "is-active",
        musicState.mode === "track" && Number(item.dataset.musicIndex) === musicState.currentIndex
      );
    });
    const radio = document.getElementById("musicRadio");
    radio?.querySelectorAll("[data-radio-index]").forEach((item) => {
      item.classList.toggle(
        "is-active",
        musicState.mode === "radio" && Number(item.dataset.radioIndex) === musicState.radioIndex
      );
    });
  }

  /* ---------- 音乐 2.0：状态持久化 / 电台 / 跨页 mini 条 / MediaSession ---------- */

  function musicStoreRead() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(MUSIC_STORE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function musicStoreWrite() {
    try {
      window.localStorage.setItem(
        MUSIC_STORE_KEY,
        JSON.stringify({
          mode: musicState.mode,
          index: musicState.currentIndex,
          radioIndex: musicState.radioIndex,
          time: Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0,
          volume: musicAudio.volume,
          muted: musicAudio.muted,
          playMode: musicState.playMode
        })
      );
    } catch {
      /* 隐私模式下写不进去就算了 */
    }
  }

  function currentMusicEntry() {
    if (musicState.mode === "radio") return radioList()[musicState.radioIndex] || null;
    if (musicState.mode === "search") return musicState.searchTrack || null;
    return musicFeed[musicState.currentIndex] || null;
  }

  function renderMusicRadio() {
    const host = document.getElementById("musicRadio");
    if (!host) return;
    const list = radioList();
    host.innerHTML = list
      .map(
        (station, index) => `
          <button class="music-rail-card focusable${musicState.mode === "radio" && index === musicState.radioIndex ? " is-active" : ""}" type="button" tabindex="0" data-radio-index="${index}">
            <span class="rail-badge">${escapeHtml(station.badge || "FM")}</span>
            <span class="rail-meta">
              <strong>${escapeHtml(station.title)}</strong>
              <span>${escapeHtml(station.note || station.artist || "网络电台")} · <em class="music-radio-state" data-radio-state="${index}">待连接</em></span>
            </span>
          </button>
        `
      )
      .join("");
    const meta = document.getElementById("musicRadioMeta");
    if (meta) {
      meta.textContent = musicRadioLive.length
        ? `${musicRadioLive.length} 个 · Radio Browser`
        : "内置 4 条 · 在线目录未加载";
    }
  }

  function setRadioState(index, text, isError = false) {
    const node = document.querySelector(`[data-radio-state="${index}"]`);
    if (!node) return;
    node.textContent = text;
    node.closest(".music-rail-card")?.classList.toggle("is-error", isError);
  }

  function syncMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const entry = currentMusicEntry();
    if (!entry) return;
    try {
      const art = entry.cover || entry.image;
      const artwork = art
        ? [{ src: art, sizes: "512x512", type: "image/jpeg" }]
        : [];
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: entry.title,
        artist: entry.artist || entry.note || "NOVA TV",
        album: musicState.mode === "radio" ? "NOVA MUSIC · RADIO" : "NOVA MUSIC",
        artwork
      });
    } catch {
      /* 老浏览器不支持 MediaMetadata 就算了 */
    }
  }

  function bindMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const act = (name, handler) => {
      try {
        navigator.mediaSession.setActionHandler(name, handler);
      } catch {
        /* 该动作不被支持 */
      }
    };
    act("play", () => toggleMusicPlayback());
    act("pause", () => toggleMusicPlayback());
    act("previoustrack", () => musicStep(-1));
    act("nexttrack", () => musicStep(1));
    act("seekbackward", () => seekMusicBy(-10));
    act("seekforward", () => seekMusicBy(10));
    act("seekto", (event) => {
      if (typeof event.seekTime === "number") seekMusicTo(event.seekTime);
    });
  }

  function seekMusicTo(seconds) {
    if (!Number.isFinite(musicAudio.duration)) return;
    // 音源不可 seek（服务器不支持 Range）时直接给提示，别让进度条跳回 0
    const { seekable } = musicAudio;
    const canSeek = seekable.length > 0 && seekable.end(seekable.length - 1) > 0.5;
    if (!canSeek) {
      showToast("当前音源不支持拖动进度");
      return;
    }
    musicAudio.currentTime = Math.max(0, Math.min(musicAudio.duration, seconds));
    updateMusicUI();
  }

  function seekMusicBy(delta) {
    if (!Number.isFinite(musicAudio.duration)) return;
    seekMusicTo(musicAudio.currentTime + delta);
  }

  function removeMusicTrack(index) {
    if (!Number.isInteger(index) || index < 0 || index >= musicFeed.length) return;
    if (musicFeed.length <= 1) {
      showToast("队列里至少要留一首");
      return;
    }
    const removed = musicFeed.splice(index, 1)[0];
    const playing = !musicAudio.paused;
    if (musicState.mode === "track") {
      if (musicState.currentIndex >= musicFeed.length) {
        musicState.currentIndex = 0;
      } else if (index < musicState.currentIndex) {
        musicState.currentIndex -= 1;
      }
      const track = musicFeed[musicState.currentIndex];
      if (track && musicAudio.getAttribute("src") !== track.audio) {
        musicAudio.src = track.audio;
        musicAudio.load();
        if (playing) musicAudio.play().catch(() => {});
      }
    }
    renderMusicQueue();
    updateMusicUI();
    showToast(`已从队列移除 · ${removed.title}`);
  }

  // 上次听到哪儿：刷新后接着放，但不自动播放（浏览器也不允许）
  function restoreMusicState() {
    const saved = musicStoreRead();
    if (typeof saved.volume === "number" && saved.volume >= 0 && saved.volume <= 1) {
      musicAudio.volume = saved.volume;
    }
    if (saved.mode === "radio" && Number.isInteger(saved.radioIndex) && radioList()[saved.radioIndex]) {
      musicState.mode = "radio";
      musicState.radioIndex = saved.radioIndex;
      const station = radioList()[saved.radioIndex];
      musicAudio.src = `/api/proxy?url=${encodeURIComponent(station.url)}`;
      setRadioState(saved.radioIndex, "待连接");
      return;
    }
    if (typeof saved.playMode === "string" && ["list", "one", "shuffle"].includes(saved.playMode)) {
      musicState.playMode = saved.playMode;
    }
    musicAudio.muted = Boolean(saved.muted);
    if (Number.isInteger(saved.index) && saved.index >= 0) {
      musicState.currentIndex = saved.index;
    }
    // 曲目来自远端：等 feed 加载完再由 playMusicTrack 取流，这里只恢复位置
    musicState.resumeAt = Number.isFinite(Number(saved.time)) ? Number(saved.time) : 0;
  }

  /* ---- 曲库：聚合 API 榜单 ---- */

  async function loadMusicFeed(force = false) {
    if (musicFeedLoaded && !force) return;
    musicFeedLoaded = true;
    musicQueue.innerHTML = `<div class="music-rail-empty">正在拉取曲库…</div>`;
    const rows = await window.NovaMusicSources?.feed?.({ limit: 20 });
    musicFeed = Array.isArray(rows) ? rows : [];
    if (!musicFeed.length) {
      musicQueue.innerHTML = `<div class="music-rail-empty">曲库拉取失败，换个网络或稍后再试</div>`;
      return;
    }
    if (musicState.currentIndex >= musicFeed.length) musicState.currentIndex = 0;
    renderMusicQueue();
    const meta = document.getElementById("musicFeedMeta");
    if (meta) meta.textContent = `${musicFeed.length} 首 · 聚合 API`;
    // 恢复上次听到的位置：只有索引还是同一首时才续播
    if (musicState.resumeAt > 1 && !musicAudio.getAttribute("src")) {
      playMusicTrack(musicState.currentIndex, { autoplay: false }).then(() => {
        if (!Number.isFinite(musicAudio.duration)) return;
        musicAudio.currentTime = Math.min(musicState.resumeAt, musicAudio.duration - 1);
        updateMusicUI();
      });
      musicState.resumeAt = 0;
    }
  }

  /* ---------- 音乐全屏屏 ---------- */

  function isMusicScreenOpen() {
    const screen = document.getElementById("musicScreen");
    return Boolean(screen && !screen.hidden);
  }

  let musicScreenIdleTimer = 0;
  let musicScreenReturnFocus = null;
  let msProgressMode = false;


  /* ---- 歌词：LRC 解析 + 逐行滚动 ---- */

  function parseLrc(text) {
    if (!text) return [];
    const lines = [];
    text.split(/\r?\n/).forEach((raw) => {
      const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
      if (!stamps.length) return;
      const content = raw.replace(/\[[^\]]*\]/g, "").trim();
      if (!content) return;
      // 跳过“作词 : / 作曲 : ”这类制作信息行，避免歌词屏第一句是制作名单
      // 制作信息行：前 14 个字符里出现冒号，且含制作相关关键词
      if (/^.{0,24}[:：]/.test(content) &&
          /(作词|作曲|编曲|制作|监制|混音|母带|和声|录音|配唱|发行|出品|吉他|贝斯|鼓|弦乐|钢琴|人声|Vocals|Producer|Mix|Master|Studio|Recorded|Written|Composed|Arrang)/i.test(content)) return;
      stamps.forEach((m) => {
        const frac = m[3] ? Number(String(m[3]).padEnd(3, "0")) / 1000 : 0;
        lines.push({ time: Number(m[1]) * 60 + Number(m[2]) + frac, text: content });
      });
    });
    return lines.sort((a, b) => a.time - b.time);
  }

  let lyricLines = [];
  let lyricIndex = -1;
  let lyricKey = "";

  function renderLyrics(track) {
    const host = document.getElementById("msLyrics");
    if (!host) return;
    lyricLines = parseLrc(track?.lrc);
    lyricIndex = -1;
    if (!lyricLines.length) {
      const emptyText = musicState.mode === "radio" ? "电台直播 · 暂无歌词" : "纯音乐 · 暂无歌词";
      host.innerHTML = `<div class="ms-lyric-empty"><i></i><i></i><i></i><i></i><span>${emptyText}</span></div>`;
      // 无歌词时也要垂直居中，否则会贴在容器顶端
      const wrapHeight = host.parentElement?.clientHeight || 0;
      host.style.transform = `translateY(${Math.round(wrapHeight / 2 - 42)}px)`;
      return;
    }
    host.innerHTML = lyricLines
      .map((line, index) => `<div class="ms-lyric-line" data-lyric-index="${index}" data-lyric-time="${line.time}">${escapeHtml(line.text)}</div>`)
      .join("");
    measureLyrics();
    syncLyrics(true);
    scrollLyricsTo(0);
  }

  let lyricOffsets = [];
  let lyricResettleTimer = 0;

  // 长句会折行，高度不固定：渲染后逐行量一次，滚动位置按累加高度算
  function measureLyrics() {
    const host = document.getElementById("msLyrics");
    if (!host) return;
    const nodes = [...host.children].filter((node) => node.classList?.contains("ms-lyric-line"));
    lyricOffsets = [];
    let top = 0;
    nodes.forEach((node) => {
      lyricOffsets.push({ top, height: node.offsetHeight });
      top += node.offsetHeight;
    });
  }

  function scrollLyricsTo(index) {
    const host = document.getElementById("msLyrics");
    const wrap = host?.parentElement;
    if (!host || !wrap || !lyricOffsets.length) return;
    const clamped = Math.max(0, Math.min(lyricOffsets.length - 1, index));
    const record = lyricOffsets[clamped];
    const offset = wrap.clientHeight / 2 - (record.top + record.height / 2);
    host.style.transform = `translateY(${Math.round(offset)}px)`;
  }

  function syncLyrics(force = false) {
    const host = document.getElementById("msLyrics");
    if (!host || !lyricLines.length) return;
    const now = musicAudio.currentTime + 0.12;
    let next = -1;
    for (let i = 0; i < lyricLines.length; i += 1) {
      if (lyricLines[i].time <= now) next = i;
      else break;
    }
    if (next === lyricIndex && !force) return;
    lyricIndex = next;
    const nodes = [...host.children];
    nodes.forEach((node, i) => {
      if (!node.classList || !node.classList.contains("ms-lyric-line")) return;
      node.classList.toggle("is-current", i === lyricIndex);
      node.classList.toggle("is-near", Math.abs(i - lyricIndex) === 1);
      node.classList.toggle("is-focused", msLyricMode && i === lyricFocus);
    });
    if (!msLyricMode) {
      // 当前行字号 30 → 46 会改变行高，先按旧高度滚一次，动画结束再校正一次
      measureLyrics();
      scrollLyricsTo(lyricIndex < 0 ? 0 : lyricIndex);
      window.clearTimeout(lyricResettleTimer);
      lyricResettleTimer = window.setTimeout(() => {
        if (msLyricMode) return;
        measureLyrics();
        scrollLyricsTo(lyricIndex < 0 ? 0 : lyricIndex);
      }, 430);
    }
  }

  /* ---- 歌词模式：↑ 进入，↑/↓ 选句，OK 跳到该句 ---- */

  let msLyricMode = false;
  let lyricFocus = 0;

  function setLyricMode(on) {
    const host = document.getElementById("msLyrics");
    msLyricMode = on;
    if (!host) return;
    if (on) {
      lyricFocus = lyricIndex < 0 ? 0 : lyricIndex;
      const nodes = [...host.children].filter((node) => node.classList?.contains("ms-lyric-line"));
      nodes.forEach((node, i) => node.classList.toggle("is-focused", i === lyricFocus));
      scrollLyricsTo(lyricFocus);
      const target = host.children[lyricFocus];
      if (target) focusElement(target);
    } else {
      host.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
      host.querySelectorAll("[tabindex]").forEach((node) => node.removeAttribute("tabindex"));
      const toggle = document.querySelector("[data-ms-toggle]");
      if (toggle) focusElement(toggle);
      scrollLyricsTo(lyricIndex < 0 ? 0 : lyricIndex);
    }
  }

  function moveLyricFocus(delta) {
    if (!lyricOffsets.length) return;
    lyricFocus = Math.max(0, Math.min(lyricOffsets.length - 1, lyricFocus + delta));
    const host = document.getElementById("msLyrics");
    [...host.children].forEach((node, i) => {
      if (node.classList?.contains("ms-lyric-line")) node.classList.toggle("is-focused", i === lyricFocus);
    });
    scrollLyricsTo(lyricFocus);
  }

  function seekToLyric(index) {
    const line = lyricLines[index];
    if (!line) return;
    seekMusicTo(line.time);
  }
  function syncMusicScreen() {
    if (!isMusicScreenOpen()) return;
    const entry = currentMusicEntry();
    if (!entry) return;
    const coverUrl = entry.cover || entry.image || "";
    const cover = document.getElementById("msCover");
    if (cover && coverUrl) cover.src = coverUrl;
    if (coverUrl) applyMusicBackdrop(coverUrl);
    const title = document.getElementById("msTitle");
    if (title) title.textContent = entry.title;
    const artist = document.getElementById("msArtist");
    if (artist) artist.textContent = entry.artist || entry.note || "";
    const mode = document.getElementById("msMode");
    if (mode) {
      mode.textContent = musicState.mode === "radio"
        ? "网络电台"
        : `聚合 · ${entry.provider || "API"}`;
    }
    const playing = !musicAudio.paused;
    const toggle = document.querySelector("[data-ms-toggle]");
    if (toggle) {
      toggle.innerHTML = icon(playing ? "i-pause" : "i-play");
      toggle.setAttribute("aria-label", playing ? "暂停" : "播放");
    }
    const duration = musicState.mode === "radio" ? 0 : Number.isFinite(musicAudio.duration) ? musicAudio.duration : 24;
    const ratio = duration > 0 ? Math.min(1, musicAudio.currentTime / duration) : 0;
    const fill = document.getElementById("msProgressFill");
    if (fill) fill.style.width = `${ratio * 100}%`;
    const bar = document.getElementById("msProgress");
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    const cur = document.getElementById("msCurrent");
    if (cur) cur.textContent = formatTime(musicAudio.currentTime);
    const dur = document.getElementById("msDuration");
    if (dur) dur.textContent = musicState.mode === "radio" ? "LIVE" : formatTime(duration);

    syncPlayModeButton();
    syncMuteButton();
    syncMsFav();
    syncMsStatus();
    updateNextUp();
    const key = `${musicState.mode}:${entry.id || entry.title}`;
    if (key !== lyricKey) {
      lyricKey = key;
      renderLyrics(entry);
    } else {
      syncLyrics();
    }
  }

  /* ---- 频谱：Web Audio AnalyserNode ---- */

  let msAudioCtx = null;
  let msAnalyser = null;
  let msSpectrumRaf = 0;

  function initSpectrum() {
    if (msAnalyser) return true;
    const host = document.getElementById("msSpectrum");
    if (!host) return false;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      msAudioCtx = new Ctx();
      const source = msAudioCtx.createMediaElementSource(musicAudio);
      msAnalyser = msAudioCtx.createAnalyser();
      msAnalyser.fftSize = 128;
      msAnalyser.smoothingTimeConstant = 0.75;
      source.connect(msAnalyser);
      msAnalyser.connect(msAudioCtx.destination);
      host.innerHTML = Array.from({ length: 48 }, () => "<i></i>").join("");
      return true;
    } catch {
      msAnalyser = null;
      return false;
    }
  }

  function drawSpectrum() {
    msSpectrumRaf = 0;
    if (!msAnalyser) return;
    const screen = document.getElementById("musicScreen");
    if (!screen || screen.hidden) return;
    const bars = document.getElementById("msSpectrum")?.children || [];
    if (!bars.length) return;
    const data = new Uint8Array(msAnalyser.frequencyBinCount);
    msAnalyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / bars.length) || 1;
    for (let i = 0; i < bars.length; i += 1) {
      let sum = 0;
      for (let k = 0; k < step; k += 1) sum += data[i * step + k] || 0;
      const value = sum / step / 255;
      bars[i].style.height = `${Math.max(4, Math.round(value * 62))}px`;
    }
    msSpectrumRaf = window.requestAnimationFrame(drawSpectrum);
  }

  function startSpectrum() {
    if (!initSpectrum()) return;
    msAudioCtx?.resume?.().catch(() => {});
    if (!msSpectrumRaf) msSpectrumRaf = window.requestAnimationFrame(drawSpectrum);
  }

  function stopSpectrum() {
    if (msSpectrumRaf) {
      window.cancelAnimationFrame(msSpectrumRaf);
      msSpectrumRaf = 0;
    }
  }

  /* ---- 播放模式：列表 / 单曲 / 随机 ---- */

  const MUSIC_PLAY_MODES = [
    { key: "list", label: "列表" },
    { key: "one", label: "单曲" },
    { key: "shuffle", label: "随机" }
  ];

  function currentPlayMode() {
    return MUSIC_PLAY_MODES.find((mode) => mode.key === musicState.playMode) || MUSIC_PLAY_MODES[0];
  }

  function syncPlayModeButton() {
    const button = document.querySelector("[data-ms-mode]");
    if (button) button.textContent = currentPlayMode().label;
  }

  function cyclePlayMode() {
    const index = MUSIC_PLAY_MODES.findIndex((mode) => mode.key === musicState.playMode);
    const next = MUSIC_PLAY_MODES[(index + 1) % MUSIC_PLAY_MODES.length];
    musicState.playMode = next.key;
    syncPlayModeButton();
    musicStoreWrite();
    showToast(`播放模式 · ${next.label}`);
  }

  function syncMuteButton() {
    const button = document.querySelector("[data-ms-mute]");
    if (!button) return;
    button.innerHTML = icon(musicAudio.muted ? "i-mute" : "i-volume");
    button.setAttribute("aria-label", musicAudio.muted ? "取消静音" : "静音");
    button.classList.toggle("is-muted", musicAudio.muted);
  }

  function musicFavKey(entry) {
    if (!entry) return "";
    if (entry.provider) return `music:${entry.provider}:${entry.extra?.rawId || entry.id}`;
    return `music:${entry.id || entry.title}`;
  }

  function syncMsFav() {
    const button = document.querySelector("[data-ms-fav]");
    if (!button) return;
    const entry = currentMusicEntry();
    const key = entry && musicState.mode !== "radio" ? musicFavKey(entry) : "";
    const saved = key ? Boolean(window.NovaFav?.has?.(key)) : false;
    button.classList.toggle("is-saved", saved);
    button.style.color = saved ? "#b9a6ff" : "";
    button.setAttribute("aria-label", saved ? "取消收藏" : "加入收藏");
  }

  function toggleMusicFavorite() {
    const entry = currentMusicEntry();
    if (!entry) return;
    if (musicState.mode === "radio") {
      showToast("电台暂不支持收藏");
      return;
    }
    const key = musicFavKey(entry);
    const result = window.NovaFav?.toggle?.({
      key,
      title: entry.title,
      image: entry.cover || "",
      kind: "music",
      source: entry.provider || "",
      meta: entry.artist || ""
    });
    syncMsFav();
    showToast(result?.added ? `已收藏 · ${entry.title}` : "已取消收藏");
  }
  function toggleMusicMute() {
    musicAudio.muted = !musicAudio.muted;
    syncMuteButton();
    musicStoreWrite();
    showToast(musicAudio.muted ? "已静音" : "已恢复声音");
  }
  /* ---- 播放器背景：封面模糊 + 取色光斑 ---- */

  let msBackdropKey = "";
  let msBackdropTimer = 0;

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      else if (max === gn) h = ((bn - rn) / d + 2) / 6;
      else h = ((rn - gn) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s, l };
  }

  // 从封面左右两半各取一个平均色，作为两团光斑的色相
  function extractCoverHues(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const size = 32;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          const pick = (x0, x1, y0, y1) => {
            let r = 0, g = 0, b = 0, n = 0;
            for (let y = y0; y < y1; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                const i = (y * size + x) * 4;
                const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                if (lum < 18 || lum > 242) continue;
                r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
              }
            }
            if (!n) return null;
            return rgbToHsl(Math.round(r / n), Math.round(g / n), Math.round(b / n));
          };
          // 左上 / 右下两个区域取色，色相差异比左右对半更明显
          resolve({
            left: pick(0, size >> 1, 0, size >> 1),
            right: pick(size >> 1, size, size >> 1, size)
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function applyMusicBackdrop(coverUrl) {
    const screen = document.getElementById("musicScreen");
    const layers = [document.getElementById("msBg"), document.getElementById("msBgAlt")];
    if (!screen || !layers[0]) return;
    const url = coverUrl || "";
    const key = url.split("?")[0] + url.length;
    if (key === msBackdropKey) return;
    msBackdropKey = key;

    const active = layers[0].style.backgroundImage.includes(url) && url ? layers[1] : layers[0];
    const incoming = active === layers[0] ? layers[1] : layers[0];
    if (!url) return;

    incoming.style.backgroundImage = `url("${url}")`;
    // 强制回流，保证 opacity 过渡能触发
    void incoming.offsetWidth;
    incoming.style.opacity = "1";
    window.clearTimeout(msBackdropTimer);
    msBackdropTimer = window.setTimeout(() => {
      active.style.backgroundImage = `url("${url}")`;
      active.style.opacity = "1";
      incoming.style.opacity = "0";
    }, 640);

    const hues = await extractCoverHues(url);
    if (!hues) return;
    const clampHue = (hsl, fallback) => (hsl && Number.isFinite(hsl.h) ? hsl.h : fallback);
    screen.style.setProperty("--ms-h1", String(clampHue(hues.left, 250)));
    screen.style.setProperty("--ms-h2", String(clampHue(hues.right, 220)));
  }
  /* ---- 播放器状态机：播放中 / 缓冲 / 暂停 / 线路失效 ---- */

  let msSeekTipTimer = 0;
  let msVolumeTimer = 0;

  function setMsStatus(kind, text) {
    const pill = document.getElementById("msStatus");
    const label = document.getElementById("msStatusText");
    const screen = document.getElementById("musicScreen");
    if (pill) {
      pill.classList.toggle("is-buffering", kind === "buffering");
      pill.classList.toggle("is-paused", kind === "paused");
      pill.classList.toggle("is-error", kind === "error");
    }
    if (label) label.textContent = text;
    const buffer = document.getElementById("msBuffer");
    if (buffer) buffer.hidden = kind !== "buffering";
    const paused = document.getElementById("msPaused");
    if (paused) paused.hidden = kind !== "paused";
    const error = document.getElementById("msError");
    if (error) error.hidden = kind !== "error";
    screen?.classList.toggle("is-paused", kind === "paused");
  }

  function syncMsStatus() {
    if (!isMusicScreenOpen()) return;
    if (musicAudio.error) {
      setMsStatus("error", "线路失效");
      return;
    }
    if (musicAudio.paused) {
      setMsStatus("paused", "已暂停");
      return;
    }
    if (musicAudio.readyState < 3) {
      setMsStatus("buffering", "缓冲中…");
      return;
    }
    setMsStatus("playing", "播放中");
  }

  function showSeekTip(delta) {
    const tip = document.getElementById("msSeekTip");
    if (!tip) return;
    const time = document.getElementById("msSeekTime");
    const diff = document.getElementById("msSeekDelta");
    if (time) time.textContent = formatTime(musicAudio.currentTime);
    if (diff) diff.textContent = `${delta > 0 ? "+" : ""}${delta}s`;
    tip.hidden = false;
    window.clearTimeout(msSeekTipTimer);
    msSeekTipTimer = window.setTimeout(() => {
      tip.hidden = true;
    }, 1000);
  }

  function showVolumeTip() {
    const box = document.getElementById("msVolume");
    const bars = document.getElementById("msVolumeBars");
    if (!box || !bars) return;
    if (!bars.children.length) {
      bars.innerHTML = Array.from({ length: 5 }, () => "<i></i>").join("");
    }
    const level = Math.round(musicAudio.volume * 5);
    [...bars.children].forEach((bar, index) => bar.classList.toggle("on", index < level));
    box.hidden = false;
    window.clearTimeout(msVolumeTimer);
    msVolumeTimer = window.setTimeout(() => {
      box.hidden = true;
    }, 1300);
  }

  function changeVolume(delta) {
    const next = Math.min(1, Math.max(0, Math.round((musicAudio.volume + delta) * 10) / 10));
    musicAudio.volume = next;
    if (next > 0) musicAudio.muted = false;
    showVolumeTip();
    syncMuteButton();
    musicStoreWrite();
  }

  function updateNextUp() {
    const card = document.getElementById("msNext");
    if (!card) return;
    const duration = musicAudio.duration;
    const remain = Number.isFinite(duration) ? duration - musicAudio.currentTime : 0;
    const show = isMusicScreenOpen() && musicState.mode === "track" && musicFeed.length > 1 && remain > 0 && remain <= 12;
    card.hidden = !show;
    if (!show) return;
    const next = musicFeed[(musicState.currentIndex + 1) % musicFeed.length];
    const title = document.getElementById("msNextTitle");
    const artist = document.getElementById("msNextArtist");
    if (title) title.textContent = next?.title || "—";
    if (artist) artist.textContent = next?.artist || "";
  }
  function armMusicScreenIdle() {
    window.clearTimeout(musicScreenIdleTimer);
    musicScreenIdleTimer = window.setTimeout(() => {
      musicScreenIdleTimer = 0;
      const screen = document.getElementById("musicScreen");
      if (screen && !screen.hidden && !musicAudio.paused) screen.classList.add("is-idle");
    }, 5200);
  }

  function wakeMusicScreen() {
    const screen = document.getElementById("musicScreen");
    if (!screen || screen.hidden) return;
    screen.classList.remove("is-idle");
    armMusicScreenIdle();
  }

  function openMusicScreen() {
    const screen = document.getElementById("musicScreen");
    if (!screen) return;
    musicScreenReturnFocus = document.activeElement;
    screen.hidden = false;
    screen.classList.remove("is-idle");
    lyricKey = "";
    msProgressMode = false;
    syncMusicScreen();
    syncMsStatus();
    startSpectrum();
    armMusicScreenIdle();
    const toggle = screen.querySelector("[data-ms-toggle]");
    if (toggle) {
      toggle.focus({ preventScroll: true });
      toggle.classList.add("is-focused");
    } else {
      focusElement(screen.querySelector(".focusable"));
    }
  }

  function closeMusicScreen() {
    const screen = document.getElementById("musicScreen");
    if (!screen || screen.hidden) return;
    screen.hidden = true;
    screen.classList.remove("is-idle");
    msProgressMode = false;
    if (msLyricMode) setLyricMode(false);
    stopSpectrum();
    document.getElementById("msSeekTip")?.setAttribute("hidden", "");
    document.getElementById("msVolume")?.setAttribute("hidden", "");
    document.getElementById("msNext")?.setAttribute("hidden", "");
    document.getElementById("msError")?.setAttribute("hidden", "");
    window.clearTimeout(musicScreenIdleTimer);
    musicScreenIdleTimer = 0;
    const back = musicScreenReturnFocus && document.contains(musicScreenReturnFocus)
      ? musicScreenReturnFocus
      : document.querySelector("#musicPage [data-music-full]");
    if (back) focusElement(back);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const safe = Math.floor(seconds);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function updateMusicUI() {
    const track = currentMusicEntry() || musicFeed[musicState.currentIndex];
    const playing = !musicAudio.paused;
    const live = musicState.mode === "radio";
    const duration = Number.isFinite(musicAudio.duration) ? musicAudio.duration : live ? 0 : 24;
    const progress = duration > 0 ? Math.min(1, musicAudio.currentTime / duration) : 0;

    if (track) {
      musicTrackTitle.textContent = track.title;
      musicTrackArtist.textContent = track.artist || track.note || "";
    }
    musicCurrentTime.textContent = formatTime(musicAudio.currentTime);
    musicDuration.textContent = live ? "LIVE" : formatTime(duration);
    musicProgressFill.style.width = `${progress * 100}%`;
    const progressBar = document.getElementById("musicProgress");
    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      progressBar.classList.toggle("is-live", live);
    }
    musicStateLabel.textContent = live ? (playing ? "电台直播中" : "已暂停") : playing ? "正在播放" : "已暂停";
    const modeLabel = document.getElementById("musicModeLabel");
    if (modeLabel) {
      if (live) modeLabel.textContent = `电台 · ${track?.title || ""}`;
      else if (track?.provider) modeLabel.textContent = `聚合 · ${track.provider}`;
      else modeLabel.textContent = "聚合曲库";
    }
    musicToggle.innerHTML = icon(playing ? "i-pause" : "i-play");
    musicToggle.setAttribute("aria-label", playing ? "暂停" : "播放");
    pages.music.classList.toggle("is-playing", playing);
    syncMusicQueueSelection();
    syncMediaSession();
    syncMusicScreen();
  }

  async function playMusicTrack(index, options = {}) {
    if (!musicFeed.length) {
      showToast("曲库还在加载，稍等一下");
      return;
    }
    musicState.mode = "track";
    musicState.radioIndex = -1;
    musicState.currentIndex = ((index % musicFeed.length) + musicFeed.length) % musicFeed.length;
    const track = musicFeed[musicState.currentIndex];
    updateMusicUI();

    const source = track.url
      ? { url: track.url }
      : await window.NovaMusicSources?.getUrl?.(track);
    if (!source || !source.url) {
      showToast("这首取不到播放地址，换一首试试");
      return;
    }
    track.url = source.url;
    if (!track.lrc) {
      const lrc = await window.NovaMusicSources?.getLyric?.(track);
      if (lrc) track.lrc = lrc;
    }
    if (musicAudio.getAttribute("src") !== source.url) {
      musicAudio.src = source.url;
      musicAudio.load();
    } else if (options.restart !== false) {
      musicAudio.currentTime = 0;
    }
    updateMusicUI();

    if (options.autoplay === false) return;
    try {
      await musicAudio.play();
      updateMusicUI();
      musicStoreWrite();
      showToast(`正在播放 · ${track.title}`);
    } catch (error) {
      updateMusicUI();
      showToast("按 OK 继续播放");
    }
  }

  async function playRadio(index) {
    const list = radioList();
    const station = list[((index % list.length) + list.length) % list.length];
    if (!station) return;
    musicState.mode = "radio";
    musicState.radioIndex = list.indexOf(station);
    musicState.radioRetried = false;
    // 走本地代理：直连在浏览器里常被跳转/CORS 策略挡掉，代理实测稳定
    musicAudio.src = `/api/proxy?url=${encodeURIComponent(station.url)}`;
    musicAudio.load();
    setRadioState(musicState.radioIndex, "连接中…");
    updateMusicUI();
    try {
      await musicAudio.play();
      setRadioState(musicState.radioIndex, "播放中");
      updateMusicUI();
      musicStoreWrite();
      showToast(`正在收听 · ${station.title}`);
    } catch (error) {
      if (error && error.name === "NotAllowedError") {
        // 浏览器自动播放策略：不是线路问题，别误报
        setRadioState(musicState.radioIndex, "按 OK 开始");
      } else {
        setRadioState(musicState.radioIndex, "线路不可用", true);
      }
      updateMusicUI();
    }
  }

  // 统一的上一首 / 下一首：按当前模式在队列里走
  function musicStep(delta) {
    if (musicState.mode === "radio") {
      playRadio(musicState.radioIndex + delta);
      return;
    }
    if (musicState.playMode === "shuffle" && musicFeed.length > 1) {
      let next = musicState.currentIndex;
      while (next === musicState.currentIndex) {
        next = Math.floor(Math.random() * musicFeed.length);
      }
      playMusicTrack(next);
      return;
    }
    playMusicTrack(musicState.currentIndex + delta);
  }

  async function toggleMusicPlayback() {
    if (musicAudio.paused) {
      if (musicAudio.ended || musicAudio.currentTime >= (musicAudio.duration || 24) - 0.2) {
        musicAudio.currentTime = 0;
      }
      try {
        await musicAudio.play();
        if (musicState.mode === "radio" && musicState.radioIndex >= 0) {
          setRadioState(musicState.radioIndex, "播放中");
        }
      } catch (error) {
        showToast("当前浏览器无法播放这段音频");
        if (musicState.mode === "radio" && musicState.radioIndex >= 0) {
          setRadioState(musicState.radioIndex, "线路不可用", true);
        }
      }
    } else {
      musicAudio.pause();
    }
    updateMusicUI();
    musicStoreWrite();
  }

  /* 本机片单：lib-fav.js 写入 nova.fav.items.v1，跨页共享 */
  function readLocalFavorites() {
    try {
      const raw = JSON.parse(window.localStorage.getItem("nova.fav.items.v1") || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter((entry) => entry && entry.key);
    } catch {
      return [];
    }
  }

  // 远端海报要走本地代理，避免直连被 referer 拦掉
  // 已经是代理地址的（相对或绝对）不能再套一层：双重代理会让图片 404
  function unproxyImage(url) {
    const text = String(url || "");
    if (!/\/api\/proxy\?url=/i.test(text)) return text;
    try {
      const parsed = new URL(text, window.location.origin);
      return parsed.searchParams.get("url") || text;
    } catch {
      return text;
    }
  }

  function proxyImage(url) {
    if (!url) return "";
    if (url.startsWith("data:") || url.startsWith("./")) return url;
    if (/\/api\/proxy\?url=/i.test(url)) {
      try {
        const parsed = new URL(url, window.location.origin);
        // 归一成相对路径，换端口 / 换域名也能用
        return `${parsed.pathname}${parsed.search}`;
      } catch {
        return url;
      }
    }
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  // 片单里可能有不属于当前片库的条目，点击时用这里存的完整对象
  const savedPayloads = new Map();

  // 播放进度：player.js 写入，格式 { "key::第N集": { t, d, n, e, p, at } }
  function readPlaybackRecords() {
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
      // 条目 key 自己带 ::，只能按最后一个 :: 切
      const text = String(storeKey || "");
      const cut = text.lastIndexOf("::");
      const keyText = cut > 0 ? text.slice(0, cut) : text;
      const episodeText = cut > 0 ? text.slice(cut + 2) : "";
      const key = String(value.k || keyText || "").trim();
      const title = String(value.n || value.title || "").trim();
      if (!key || !title) return;
      const at = Number(value.at) || 0;
      // 同标题跨源视为同一部，保留最新一条
      const titleKey = title.replace(/[\s·:：\-—_（）()]+/g, "").toLowerCase();
      const prevByTitle = byShow.get(titleKey);
      if (prevByTitle && prevByTitle.at >= at) return;
      const total = Number(value.d) || 0;
      const current = Number(value.t) || 0;
      byShow.set(titleKey, {
        key,
        at,
        title,
        image: value.p || value.image || "",
        episode: String(value.e || episodeText || "").trim(),
        percent: total > 1 ? Math.max(1, Math.min(99, Math.round((current / total) * 100))) : 0,
        // 续播用：最后一次的播放地址与时间点
        url: String(value.u || "").trim(),
        t: current,
        category: normalizeHistoryCategory(value.g, value.y, value.e || episodeText)
      });
    });

    return [...byShow.values()].sort((a, b) => b.at - a.at);
  }

  const SAVED_KIND_LABEL = { movie: "电影", series: "剧集", variety: "综艺", anime: "动漫", other: "其他", live: "直播", music: "音乐" };

  function savedKindOf(entry) {
    return window.NovaFav?.normalize?.(entry)?.kind || entry.kind || "movie";
  }

  function readFavorites() {
    const raw = window.NovaFav?.list?.() || readLocalFavorites();
    return raw.map((entry) => window.NovaFav?.normalize?.(entry) || entry).filter(Boolean);
  }

  const HISTORY_CATEGORIES = [
    { id: "movie", label: "电影" },
    { id: "series", label: "电视剧" },
    { id: "variety", label: "综艺" },
    { id: "anime", label: "动漫" },
    { id: "other", label: "其他" }
  ];
  const HISTORY_CATEGORY_IDS = new Set(HISTORY_CATEGORIES.map((item) => item.id));

  // 写入端已经存了 g（归一化分类）就直接用；老记录按类型原文 / 集名推断
  function normalizeHistoryCategory(g, kindText, episodeText) {
    if (HISTORY_CATEGORY_IDS.has(g)) return g;
    const text = String(kindText || "");
    if (/动漫|动画|番剧|新番|国漫|日漫/.test(text)) return "anime";
    if (/综艺|真人秀|脱口秀|晚会|访谈|选秀/.test(text)) return "variety";
    if (/电视剧|连续剧|美剧|韩剧|日剧|港剧|台剧|短剧|剧集/.test(text)) return "series";
    if (/电影|影片|大片|剧场版/.test(text)) return "movie";
    const episode = String(episodeText || "");
    if (/第\s*\d+\s*[话話]/.test(episode)) return "anime";
    if (/第\s*\d+\s*期|第\s*\d+\s*季|EP?\s*\d+\s*期/i.test(episode)) return "variety";
    if (/第\s*\d+\s*集|EP?\s*\d+/i.test(episode)) return "series";
    return "other";
  }
  function dayBucket(at) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (at >= today) return "今天";
    if (at >= today - 86400000) return "昨天";
    if (at >= today - 6 * 86400000) return "本周";
    return "更早";
  }

  function buildHistoryEntries() {
    const records = readPlaybackRecords();
    const items = records
      .filter((record) => savedState.filter === "all" || record.category === savedState.filter)
      .map((record) => ({
        key: record.key,
        title: record.title,
        image: record.image,
        kind: record.category || "other",
        meta: record.episode || "上次看到这里",
        percent: record.percent || 0,
        at: record.at || 0,
        record
      }));
    const order = ["今天", "昨天", "本周", "更早"];
    const groups = new Map();
    items.forEach((item) => {
      const label = dayBucket(item.at);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    });
    const rows = [];
    order.forEach((label) => {
      const list = groups.get(label);
      if (!list || !list.length) return;
      rows.push({ group: label });
      rows.push(...list);
    });
    return rows;
  }

  function historyCategoryCounts() {
    const counts = { all: 0 };
    HISTORY_CATEGORIES.forEach((item) => { counts[item.id] = 0; });
    readPlaybackRecords().forEach((record) => {
      counts.all += 1;
      const id = record.category || "other";
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }
  function buildFavoriteEntries() {
    let list = readFavorites();
    if (savedState.filter !== "all") {
      list = list.filter((entry) => savedKindOf(entry) === savedState.filter);
    }
    const sort = savedState.sort;
    list = [...list].sort((a, b) => {
      if (sort === "score") return (Number(b.score) || 0) - (Number(a.score) || 0);
      if (sort === "watch") return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
      return (Number(b.at) || 0) - (Number(a.at) || 0);
    });
    return list.map((entry) => ({
      key: entry.key,
      title: entry.title,
      image: entry.image,
      kind: savedKindOf(entry),
      meta: entry.meta || entry.remarks || SAVED_KIND_LABEL[savedKindOf(entry)] || "",
      footer: entry,
      at: entry.at || 0,
      entry
    }));
  }

  function renderSavedChips(isHistory) {
    const chips = document.getElementById("savedChips");
    if (!chips) return;
    const counts = isHistory ? historyCategoryCounts() : null;
    const rows = isHistory
      ? [{ id: "all", label: "全部" }, ...HISTORY_CATEGORIES]
      : [
          { id: "all", label: "全部" },
          { id: "movie", label: "电影" },
          { id: "series", label: "剧集" },
          { id: "music", label: "音乐" }
        ];
    const favCounts = isHistory ? null : readFavorites().reduce((acc, entry) => {
      acc.all = (acc.all || 0) + 1;
      const id = savedKindOf(entry);
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, { all: 0 });

    const visible = rows.filter((row) => {
      if (row.id === "all") return true;
      const n = isHistory ? counts[row.id] || 0 : favCounts[row.id] || 0;
      return n > 0;
    });
    // 筛选值失效（比如切了 tab）就退回全部
    if (!visible.some((row) => row.id === savedState.filter)) savedState.filter = "all";

    chips.hidden = false;
    chips.innerHTML = visible
      .map((row) => {
        const n = isHistory ? counts[row.id] || 0 : favCounts[row.id] || 0;
        const active = row.id === savedState.filter ? " is-active" : "";
        return `<button class="saved-chip focusable${active}" type="button" data-saved-filter="${row.id}">${row.label}<em>${n}</em></button>`;
      })
      .join("");
  }
  function updateSavedStats() {
    const history = readPlaybackRecords();
    const favs = readFavorites();
    const historyNode = document.getElementById("savedStatHistory");
    const favNode = document.getElementById("savedStatFav");
    if (historyNode) historyNode.textContent = String(history.length);
    if (favNode) favNode.textContent = String(favs.length);
  }

  function renderSaved(tab = savedState.tab) {
    savedState.tab = tab;
    const isHistory = tab === "history";

    document.querySelectorAll("[data-saved-tab]").forEach((button) => {
      const selected = button.dataset.savedTab === tab;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });

    renderSavedChips(isHistory);

    const rows = isHistory ? buildHistoryEntries() : buildFavoriteEntries();
    const items = rows.filter((row) => !row.group);
    const empty = items.length === 0;

    savedPanelTitle.textContent = isHistory ? "观看历史" : "我的收藏";
    savedPanelSubtitle.textContent = isHistory
      ? "按最近观看排序 · 一剧一条，记录最后看的集"
      : savedState.filter === "all"
        ? "影视、音乐共用一份本地数据 · 长按 OK 删除"
        : `只看${SAVED_KIND_LABEL[savedState.filter] || "该类内容"} · 共 ${items.length} 项`;
    savedItemCount.textContent = `${items.length} 项`;

    const clearLabel = document.getElementById("savedClearLabel");
    if (clearLabel) clearLabel.textContent = isHistory ? "清理观看记录" : "清空我的收藏";

    updateSavedStats();
    savedPayloads.clear();
    hideSavedBars();

    if (empty) {
      const emptyText = isHistory
        ? { strong: "还没有观看记录", span: "播放任意影片后，这里会按进度自动排好" }
        : savedState.filter === "all"
          ? { strong: "片单还是空的", span: "在片库按下「加入片单」，或到音乐页点亮红心" }
          : { strong: "这一类还没有内容", span: "切回「全部」看看其它收藏" };
      savedGrid.innerHTML = `
        <div class="library-empty">
          <strong>${emptyText.strong}</strong>
          <span>${emptyText.span}</span>
        </div>`;
      return;
    }

    savedGrid.innerHTML = rows
      .map((row) => {
        if (row.group) return `<div class="saved-group-title">${escapeHtml(row.group)}</div>`;
        const key = row.key;
        const image = proxyImage(row.image || "");
        savedPayloads.set(key, row);
        const kindLabel = SAVED_KIND_LABEL[row.kind] || "";

        // 卡片结构和聚合片库完全一致：整版海报 + 底部渐变 + 叠字
        return `
          <button class="saved-card lib-card poster-card focusable" type="button" tabindex="0"
                  data-saved-key="${escapeHtml(key)}" data-saved-kind="${escapeHtml(row.kind)}">
            <span class="poster-cover">
              ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(row.title)}" />` : ""}
            </span>
            <span class="lib-card-shade"></span>
            ${kindLabel ? `<span class="poster-badges"><span class="poster-status">${kindLabel}</span></span>` : ""}
            <span class="poster-copy">
              <span class="poster-title">${escapeHtml(row.title)}</span>
              <span class="poster-meta">${escapeHtml(row.meta || "")}</span>
              ${row.record ? `<span class="saved-poster-progress"><i style="width:${row.percent}%"></i></span>` : ""}
            </span>
          </button>
        `;
      })
      .join("");
  }

  /* ---- 删除 / 撤销 / 清空 / 导出 ---- */

  let savedUndo = null;
  let savedUndoTimer = 0;
  let savedHoldTimer = 0;
  let savedHoldFired = false;

  function hideSavedBars() {
    const confirm = document.getElementById("savedConfirm");
    if (confirm) confirm.hidden = true;
  }

  function showSavedUndo(text, payload) {
    savedUndo = payload;
    const bar = document.getElementById("savedUndo");
    const label = document.getElementById("savedUndoText");
    if (label) label.textContent = text;
    if (bar) bar.hidden = false;
    window.clearTimeout(savedUndoTimer);
    savedUndoTimer = window.setTimeout(() => {
      savedUndo = null;
      if (bar) bar.hidden = true;
    }, 6000);
  }

  function deleteHistoryEntry(key) {
    let raw = {};
    try {
      raw = JSON.parse(window.localStorage.getItem("nova.play.progress.v1") || "{}");
    } catch {
      return;
    }
    const removed = {};
    Object.keys(raw).forEach((storeKey) => {
      const cut = storeKey.lastIndexOf("::");
      const showKey = cut > 0 ? storeKey.slice(0, cut) : storeKey;
      const parsed = String(raw[storeKey]?.k || showKey);
      if (parsed === key) {
        removed[storeKey] = raw[storeKey];
        delete raw[storeKey];
      }
    });
    try {
      window.localStorage.setItem("nova.play.progress.v1", JSON.stringify(raw));
    } catch {
      return;
    }
    document.dispatchEvent(new CustomEvent("nova:progress-changed"));
    renderSaved("history");
    if (Object.keys(removed).length) {
      showSavedUndo(`已删除 1 条观看记录`, { type: "history", removed });
    }
  }

  function deleteFavoriteEntry(key) {
    const entry = readFavorites().find((row) => row.key === key);
    window.NovaFav?.remove?.(key);
    renderSaved("favorites");
    if (entry) showSavedUndo(`已移出收藏 · ${entry.title}`, { type: "fav", entry });
  }

  function undoLastDelete() {
    if (!savedUndo) return;
    if (savedUndo.type === "history") {
      let raw = {};
      try {
        raw = JSON.parse(window.localStorage.getItem("nova.play.progress.v1") || "{}");
      } catch {
        raw = {};
      }
      Object.assign(raw, savedUndo.removed);
      try {
        window.localStorage.setItem("nova.play.progress.v1", JSON.stringify(raw));
      } catch {
        return;
      }
      document.dispatchEvent(new CustomEvent("nova:progress-changed"));
      renderSaved("history");
    } else {
      window.NovaFav?.toggle?.(savedUndo.entry);
      renderSaved("favorites");
    }
    savedUndo = null;
    const bar = document.getElementById("savedUndo");
    if (bar) bar.hidden = true;
    showToast("已撤销");
  }

  function clearHistory() {
    try {
      window.localStorage.removeItem("nova.play.progress.v1");
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new CustomEvent("nova:progress-changed"));
    renderSaved("history");
    showToast("观看记录已清空");
  }

  function clearFavorites() {
    window.NovaFav?.clear?.();
    renderSaved("favorites");
    showToast("收藏已清空");
  }

  function exportSaved() {
    const payload = {
      exportedAt: new Date().toISOString(),
      favorites: readFavorites(),
      history: readPlaybackRecords().map((row) => ({
        key: row.key,
        title: row.title,
        episode: row.episode,
        percent: row.percent,
        at: row.at
      }))
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nova-片单-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(`已导出 ${payload.favorites.length} 条收藏 / ${payload.history.length} 条历史`);
    } catch {
      showToast("导出失败，浏览器不允许下载");
    }
  }
  /* ---- 片单：长按 OK 删除 ---- */

  savedGrid.addEventListener("keydown", (event) => {
    const card = event.target.closest?.("[data-saved-key]");
    if (!card) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.repeat) return;
    savedHoldFired = false;
    window.clearTimeout(savedHoldTimer);
    savedHoldTimer = window.setTimeout(() => {
      savedHoldFired = true;
      const key = card.dataset.savedKey;
      if (savedState.tab === "history") deleteHistoryEntry(key);
      else deleteFavoriteEntry(key);
    }, 650);
  });

  savedGrid.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    window.clearTimeout(savedHoldTimer);
    if (savedHoldFired) {
      event.preventDefault();
      event.stopPropagation();
      savedHoldFired = false;
    }
  }, true);

  document.addEventListener("nova:fav-changed", () => {
    if (activePageKey === "saved") renderSaved(savedState.tab);
    else updateSavedStats();
  });

  document.addEventListener("nova:progress-changed", () => {
    if (activePageKey === "saved") renderSaved(savedState.tab);
  });
  function sourceRows(rows) {
    return rows
      .map(
        (row) => `
          <div class="source-row">
            <span class="source-icon">${icon(row.icon)}</span>
            <span class="source-copy">
              <strong>${row.title}</strong>
              <span>${row.subtitle}</span>
            </span>
            <button class="source-action focusable" type="button" data-settings-action="${row.action}">
              ${icon(row.actionIcon || "i-refresh")}
              <span>${row.actionLabel}</span>
            </button>
          </div>
        `
      )
      .join("");
  }

  function settingsHeader(title, subtitle, meta = "设置会持久化到 DataStore") {
    return `
      <div class="settings-panel-head">
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <span>${meta}</span>
      </div>
    `;
  }

  function renderSettingsSources() {
    const sourceApi = window.NovaSources;
    if (!sourceApi) {
      return `
        ${settingsHeader("内容源管理", "TVBox 兼容内容源模块未加载")}
        <div class="settings-warning">${icon("i-alert")}<span>sources.js 未加载，请从 start-preview.cmd 重新启动预览。</span></div>
      `;
    }
    const sources = sourceApi.list();
    const aggregate = sourceApi.aggregate();
    if (!sources.some((source) => source.id === sourceManagerState.selectedId)) {
      sourceManagerState.selectedId = sources[0]?.id || "";
    }
    const selected =
      sources.find((source) => source.id === sourceManagerState.selectedId) ||
      sources[0] ||
      null;
    const kpis = [
      {
        label: "启用订阅",
        value: `${aggregate.stats.enabledSources}/${aggregate.stats.totalSources}`,
        icon: "i-source",
        jump: "sources"
      },
      {
        label: "可执行站点",
        value: aggregate.stats.supportedSites,
        icon: "i-database",
        jump: "sites"
      },
      {
        label: "直播源",
        value: aggregate.stats.liveSources,
        icon: "i-tv",
        jump: "lives"
      },
      {
        label: "解析接口",
        value: aggregate.stats.parses,
        icon: "i-link",
        jump: "parses"
      }
    ];

    const sourceRows = sources
      .map((source) => {
        const report = source.parsed?.compatibility || {};
        const runtime = source.runtime || null;
        const videoNeedsSpider =
          runtime &&
          runtime.executableSiteCount === 0 &&
          Number(runtime.providerSiteCount || 0) + Number(runtime.spiderSiteCount || 0) > 0;
        const state = !source.enabled
          ? { className: "is-off", text: "已停用" }
          : source.error
            ? { className: "is-error", text: "同步异常" }
            : runtime?.status === "failed"
              ? { className: "is-error", text: "检测失败" }
              : runtime?.status === "unsupported"
                ? { className: "is-warning", text: "需 Spider" }
                : runtime?.status === "partial"
                  ? videoNeedsSpider
                    ? { className: "is-warning", text: "影视需 Spider" }
                    : { className: "is-warning", text: "部分可用" }
                  : runtime?.status === "ok"
                    ? { className: "", text: "运行正常" }
                    : { className: "", text: "已启用" };
        const iconId =
          source.kind === "url"
            ? "i-link"
            : source.kind === "demo"
              ? "i-database"
              : "i-file";
        return `
          <button
            class="source-select focusable${source.id === selected?.id ? " is-selected" : ""}"
            type="button"
            data-source-select="${escapeHtml(source.id)}"
            aria-label="查看内容源 ${escapeHtml(source.name)}"
          >
            <span class="source-select-icon">${icon(iconId)}</span>
            <span class="source-select-copy">
              <strong>${escapeHtml(source.name)}</strong>
              <span class="source-select-sub">${(report.cmsSites || 0) + (report.htmlSites || 0) + (report.adaptedSites || 0)} 可执行 · ${report.liveSources || 0} 直播 · ${escapeHtml(report.format || "TVBox")}</span>
            </span>
            <span class="source-state-pill ${state.className}"><i></i>${state.text}</span>
          </button>
        `;
      })
      .join("");

    let reportHtml = `
      <div class="source-report-empty">
        ${icon("i-source")}
        <strong>选择一个内容源查看兼容性</strong>
        <span>也可以从上方添加远程订阅、粘贴 TVBox JSON 或选择本地文件。</span>
      </div>
    `;
    if (selected) {
      const report = selected.parsed?.compatibility || {};
      const runtime = selected.runtime || null;
      const sites = selected.parsed?.sites || [];
      const warnings = report.warnings || [];
      const status = selected.error ? "error" : report.status;
      const sitePreview = [...sites]
        .sort(
          (left, right) =>
            Number(Boolean(left.unsupported)) - Number(Boolean(right.unsupported))
        )
        .slice(0, 2);
      const runtimeChecks = runtime
        ? [...(runtime.sites || []), ...(runtime.lives || [])].slice(0, 2)
        : [];
      const providerCount =
        Number(report.providerSites || 0) + Number(report.spiderSites || 0);
      const runtimeWarnings = [];
      if (runtime?.fatalError) runtimeWarnings.push(runtime.fatalError);
      runtimeChecks
        .filter((check) => check.error)
        .slice(0, 1)
        .forEach((check) => runtimeWarnings.push(`${check.name}：${check.error}`));
      reportHtml = `
        <div class="source-report-head">
          <div>
            <h3 title="${escapeHtml(selected.name)}">${escapeHtml(selected.name)}</h3>
            <p>${escapeHtml(
              selected.kind === "demo"
                ? "本地 TVBox 桩配置 · 可删除后重新导入自己的订阅"
                : selected.kind === "url"
                  ? "远程 TVBox 订阅"
                  : "本地 JSON 配置"
            )}</p>
          </div>
          <span class="source-state-pill ${selected.enabled ? (selected.error ? "is-error" : "") : "is-off"}">
            <i></i>${selected.enabled ? (selected.error ? "异常" : "启用") : "停用"}
          </span>
        </div>
        <div class="source-report-url" title="${escapeHtml(selected.url)}">${escapeHtml(selected.url || "本地内存配置")}</div>
        <div class="source-report-grid">
          <div class="source-report-stat"><strong>${report.cmsSites || 0}</strong><span>苹果 CMS</span></div>
          <div class="source-report-stat"><strong>${report.htmlSites || 0}</strong><span>HTML 规则</span></div>
          <div class="source-report-stat"><strong>${report.liveSources || 0}</strong><span>直播列表</span></div>
          <div class="source-report-stat"><strong>${report.parses || 0}</strong><span>解析接口</span></div>
          <div class="source-report-stat"><strong>${providerCount}</strong><span>需 Spider</span></div>
          <div class="source-report-stat"><strong>${report.adaptedSites || 0}</strong><span>兼容直连</span></div>
        </div>
        <div class="source-report-section">
          <label>
            <span>兼容性结论</span>
            <em>${escapeHtml(sourceCompatibilityLabel(status))}</em>
          </label>
          <div class="source-site-list">
            ${
              sitePreview.length
                ? sitePreview
                    .map(
                      (site) => `
                        <div class="source-site-row">
                          <strong title="${escapeHtml(site.name)}">${escapeHtml(site.name)}</strong>
                          <em>${escapeHtml(
                            site.runtimeKind === "adapter"
                              ? "网页直连"
                              : site.unsupported
                              ? "已跳过"
                              : site.typeLabel || `type=${site.type}`
                          )}</em>
                        </div>
                      `
                    )
                    .join("")
                : `<div class="source-site-row"><strong>没有影视站点</strong><em>仅直播</em></div>`
            }
            ${
              sites.length > 2
                ? `<div class="source-site-row"><strong>另有 ${sites.length - 2} 个站点</strong><em>${sites.slice(2).some((site) => site.unsupported) ? "含跳过项" : "已解析"}</em></div>`
                : ""
            }
          </div>
        </div>
        <div class="source-report-section">
          <label>
            <span>运行检测</span>
            <em>${escapeHtml(sourceRuntimeLabel(runtime?.status || "pending"))}</em>
          </label>
          <div class="source-runtime-summary" title="${escapeHtml(sourceRuntimeSummary(runtime))}">
            ${escapeHtml(sourceRuntimeSummary(runtime))}
          </div>
          ${
            runtimeChecks.length
              ? `<div class="source-site-list">
                  ${runtimeChecks
                    .map(
                      (check) => `
                        <div class="source-site-row source-runtime-row ${check.ok ? "is-ok" : "is-error"}">
                          <strong title="${escapeHtml(check.name)}">${escapeHtml(check.name)}</strong>
                          <em>${escapeHtml(
                            check.ok
                              ? `${check.count} ${check.type ? "条目" : "频道"}`
                              : "失败"
                          )}</em>
                        </div>
                      `
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
        <div class="source-report-section">
          <label><span>兼容性提示</span><em>${selected.lastSync ? "已同步" : "未同步"}</em></label>
          <div class="source-warning-list">
            ${
              selected.error
                ? `<div class="source-warning-row">${icon("i-alert")}<span>${escapeHtml(selected.error)}</span></div>`
                : runtimeWarnings.length
                  ? `<div class="source-warning-row">${icon("i-alert")}<span>${escapeHtml(runtimeWarnings[0])}</span></div>`
                : warnings.length
                  ? warnings
                      .slice(0, 1)
                      .map(
                        (warning) =>
                          `<div class="source-warning-row">${icon("i-alert")}<span>${escapeHtml(warning)}</span></div>`
                      )
                      .join("")
                  : `<div class="source-warning-row">${icon("i-check")}<span>主链路字段完整：sites / lives / parses / headers / flags / home。</span></div>`
            }
          </div>
        </div>
        <div class="source-report-actions">
          <button class="source-action-button focusable" type="button" data-source-action="sync" data-source-id="${escapeHtml(selected.id)}">
            ${icon("i-refresh")}<span>同步</span>
          </button>
          <button class="source-action-button focusable" type="button" data-source-action="probe" data-source-id="${escapeHtml(selected.id)}">
            ${icon("i-play")}<span>检测</span>
          </button>
          <button class="source-action-button focusable" type="button" data-source-action="toggle" data-source-id="${escapeHtml(selected.id)}">
            ${icon("i-power")}<span>${selected.enabled ? "停用" : "启用"}</span>
          </button>
          <button class="source-action-button danger focusable" type="button" data-source-action="delete" data-source-id="${escapeHtml(selected.id)}">
            ${icon("i-trash")}<span>删除</span>
          </button>
        </div>
      `;
    }

    const presetList = window.NovaSources.listPresets?.() || [];
    return `
      <div class="settings-source-manager">
        ${settingsHeader(
          "订阅与内容源",
          "TVBox 配置 · 苹果 CMS 片库 · M3U / TXT 直播",
          "本地持久化 · 敏感 Header 脱敏"
        )}
        <div class="source-metrics">
          ${kpis
            .map(
              (item) => `
                <button class="source-metric focusable" type="button" data-settings-jump="${item.jump}">
                  <span class="source-metric-icon">${icon(item.icon)}</span>
                  <strong>${item.value}</strong>
                  <span>${item.label}</span>
                </button>
              `
            )
            .join("")}
        </div>
        <div class="source-manager-toolbar">
          <div class="source-add-actions">
            <button class="source-toolbar-button primary focusable" type="button" data-source-menu>
              ${icon("i-add")}<span>添加订阅</span>
            </button>
            <button class="source-toolbar-button focusable" type="button" data-source-export>
              ${icon("i-file")}<span>导出</span>
            </button>
          </div>
        </div>
        <div class="source-add-menu" hidden>
          <div class="source-add-group">
            <span class="source-add-label">添加方式</span>
            <div class="source-add-row">
              <button class="source-add-item focusable" type="button" data-source-create="remote">
                ${icon("i-link")}<span>远程订阅地址</span>
              </button>
              <button class="source-add-item focusable" type="button" data-source-create="paste">
                ${icon("i-upload")}<span>粘贴 JSON</span>
              </button>
              <button class="source-add-item focusable" type="button" data-source-file>
                ${icon("i-file")}<span>本地文件</span>
              </button>
            </div>
          </div>
          <div class="source-add-group">
            <span class="source-add-label">内置预设 · ${presetList.length} 个公开 CMS 接口</span>
            <div class="source-add-row">
              ${presetList
                .map(
                  (preset) => `
                    <button class="source-add-item focusable" type="button" data-source-preset="${escapeHtml(preset.id)}" title="${escapeHtml(preset.desc)}">
                      ${icon("i-database")}<span>${escapeHtml(preset.name)}</span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
        <div class="source-workspace">
          <section class="source-list-pane">
            <div class="source-pane-heading">
              <strong>订阅列表</strong>
              <span>${sources.length} 个配置源 · 使用方向键选择</span>
            </div>
            <div class="source-list">
              ${
                sourceRows ||
                `<div class="source-empty">${icon("i-source")}<strong>还没有内容源</strong><span>添加远程 TVBox 订阅、粘贴配置，或选择本地 JSON 文件。</span></div>`
              }
            </div>
          </section>
          <aside class="source-report-pane">${reportHtml}</aside>
        </div>
        <div class="source-manager-footnote">
          ${icon("i-alert")}
          <span>预览版会识别 Spider（type=0）但不会运行 jar/dex；不实现虎牙/抖音房间号换地址，也不会绕过 DRM、付费或防盗链限制。</span>
          ${
            sources.some((source) => source.id === sourceApi.demoSourceId)
              ? ""
              : `<button class="source-restore-button focusable" type="button" data-source-restore-demo>恢复内置演示源</button>`
          }
        </div>
      </div>
    `;
  }

  /* ---------- 设置 → 影视源（站点级管理） ---------- */

  function cssEscape(value) {
    const text = String(value ?? "");
    if (window.CSS?.escape) return window.CSS.escape(text);
    return text.replace(/["\\]/g, "\\$&");
  }

  function siteTypeBadge(site) {
    const label = site.adapterLabel || site.typeLabel || `type=${site.type}`;
    return `<em class="source-mini-pill">${escapeHtml(label)}</em>`;
  }

  function siteStateTag(site) {
    if (!site.enabled) return `<em class="source-state-pill is-off"><i></i>已停用</em>`;
    if (site.unsupported) return `<em class="source-state-pill is-warning"><i></i>不可执行</em>`;
    if (site.runtimeKind === "adapter") return `<em class="source-state-pill"><i></i>兼容直连</em>`;
    return `<em class="source-state-pill"><i></i>可执行</em>`;
  }

  function siteHealthChip(site) {
    const healthApi = window.NovaSiteHealth;
    const record = window.NovaSources?.siteTestRecord?.(site.key) || null;
    const fallback = typeof site.health === "number" ? site.health : null;
    const view = healthApi
      ? healthApi.formatHealth(record || fallback)
      : { text: "未检测", state: "unknown" };
    const title = record?.message || (fallback !== null && fallback < 0 ? "上次检测失败" : "尚未检测");
    return `<span class="site-health is-${escapeHtml(view.state)}" title="${escapeHtml(title)}"><i></i>${escapeHtml(view.text)}</span>`;
  }

  function siteRowMarkup(site) {
    const testing = siteManagerState.testing.has(site.key);
    const key = escapeHtml(site.key);
    return `
      <div class="site-row${site.key === siteManagerState.selectedKey ? " is-selected" : ""}${site.enabled ? "" : " is-off"}" data-site-row="${key}">
        <button class="site-switch focusable${site.enabled ? " is-on" : ""}" type="button" data-site-toggle="${key}" aria-label="${site.enabled ? "停用" : "启用"}站点 ${escapeHtml(site.name)}"><span></span></button>
        <button class="site-row-main focusable" type="button" data-site-select="${key}">
          <span class="site-row-title">
            <strong>${escapeHtml(site.name)}</strong>
            ${siteTypeBadge(site)}
            ${site.overridden ? `<em class="source-mini-pill is-accent">已自定义</em>` : ""}
          </span>
          <span class="site-row-sub">${escapeHtml(site.sourceName || "未知订阅")} · ${escapeHtml(site.api || site.adapterBaseUrl || "无接口地址")}</span>
        </button>
        ${siteHealthChip(site)}
        <button class="source-action-button focusable" type="button" data-site-test="${key}"${site.unsupported ? " disabled" : ""}>
          ${icon("i-refresh")}<span>${testing ? "检测中" : "测试"}</span>
        </button>
      </div>
    `;
  }

  function siteListMarkup(sites) {
    if (!sites.length) {
      return `<div class="source-empty">${icon("i-search")}<strong>没有匹配的站点</strong><span>换个关键词，或切回「全部类型 / 显示已停用」。</span></div>`;
    }
    return sites.map((site) => siteRowMarkup(site)).join("");
  }

  function siteReportMarkup(site) {
    if (!site) {
      return `<div class="source-report-empty">${icon("i-source")}<strong>选择一个站点</strong><span>左侧列表里按方向键移动，Enter 查看接口、规则与检测记录。</span></div>`;
    }
    const runtime = site.unsupported
      ? site.unsupported
      : site.runtimeKind === "adapter"
        ? "公开网页直连：读取站点公开页面，不执行配置里的私有 Guard"
        : site.runtimeKind === "provider"
          ? "需要 csp_* / drpy 等 provider 运行时，浏览器预览版不执行"
          : "标准 HTTP(S) 接口，可直接请求";
    const record = window.NovaSources?.siteTestRecord?.(site.key) || null;
    const ruleCount = site.rules ? Object.keys(site.rules).length : 0;
    const key = escapeHtml(site.key);
    return `
      <div class="source-report-head">
        <div>
          <h3 title="${escapeHtml(site.name)}">${escapeHtml(site.name)}</h3>
          <p>${escapeHtml(site.sourceName || "未知订阅")} · ${escapeHtml(site.typeLabel || `type=${site.type}`)}</p>
        </div>
        ${siteStateTag(site)}
      </div>
      <div class="source-report-url" title="${escapeHtml(site.api || site.adapterBaseUrl || "")}">${escapeHtml(site.api || site.adapterBaseUrl || "无接口地址")}</div>
      <div class="source-report-grid">
        <div class="source-report-stat"><strong>${escapeHtml(String(site.type))}</strong><span>站点类型</span></div>
        <div class="source-report-stat"><strong>${ruleCount}</strong><span>HTML 规则</span></div>
        <div class="source-report-stat"><strong>${escapeHtml(String(site.timeout ?? 20))}</strong><span>超时(秒)</span></div>
        <div class="source-report-stat"><strong>${site.searchable ? "是" : "否"}</strong><span>可搜索</span></div>
        <div class="source-report-stat"><strong>${typeof site.order === "number" ? site.order + 1 : "—"}</strong><span>排序位</span></div>
        <div class="source-report-stat"><strong>${site.overrideVia === "originKey" ? "跨源" : site.overridden ? "本站" : "默认"}</strong><span>覆盖来源</span></div>
      </div>
      <div class="source-report-section">
        <label><span>运行能力</span><em>${escapeHtml(site.enabled ? "已启用" : "已停用")}</em></label>
        <div class="source-warning-list">
          <div class="source-warning-row">${icon(site.unsupported ? "i-alert" : "i-check")}<span>${escapeHtml(runtime)}</span></div>
          ${
            record
              ? `<div class="source-warning-row">${icon(record.ok ? "i-check" : "i-alert")}<span>最近检测：${escapeHtml(record.message)}${record.sample ? ` · 样例「${escapeHtml(record.sample)}」` : ""}</span></div>`
              : `<div class="source-warning-row">${icon("i-alert")}<span>还没有检测过这个站点</span></div>`
          }
        </div>
      </div>
      <div class="source-report-actions">
        <button class="source-action-button focusable" type="button" data-site-toggle="${key}">${icon("i-power")}<span>${site.enabled ? "停用" : "启用"}</span></button>
        <button class="source-action-button focusable" type="button" data-site-test="${key}"${site.unsupported ? " disabled" : ""}>${icon("i-play")}<span>测试</span></button>
        <button class="source-action-button focusable" type="button" data-site-move="up" data-site-key="${key}">${icon("i-arrow-left")}<span>上移</span></button>
        <button class="source-action-button focusable" type="button" data-site-move="down" data-site-key="${key}">${icon("i-arrow-right")}<span>下移</span></button>
        <button class="source-action-button danger focusable" type="button" data-site-clear="${key}">${icon("i-trash")}<span>清除本站覆盖</span></button>
      </div>
    `;
  }

  function paintSiteRows(options = {}) {
    const sourceApi = window.NovaSources;
    const healthApi = window.NovaSiteHealth;
    if (!sourceApi || !healthApi) return;
    const listPane = settingsPanel.querySelector("#siteListPane");
    const reportPane = settingsPanel.querySelector("#siteReportPane");
    const countLabel = settingsPanel.querySelector("#siteFilterCount");
    if (!listPane || !reportPane) return;

    const all = sourceApi.aggregate().sites;
    if (!all.some((site) => site.key === siteManagerState.selectedKey)) {
      siteManagerState.selectedKey = all[0]?.key || "";
    }
    const filtered = healthApi.filterSites(all, siteManagerState);
    if (filtered.length && !filtered.some((site) => site.key === siteManagerState.selectedKey)) {
      // 选中项被筛选条件挡住时，右栏跟着落到第一条可见站点，避免详情停在一个看不见的源上
      siteManagerState.selectedKey = filtered[0].key;
    }
    listPane.innerHTML = siteListMarkup(filtered);
    const selected = all.find((site) => site.key === siteManagerState.selectedKey) || null;
    reportPane.innerHTML = siteReportMarkup(selected);
    if (countLabel) countLabel.textContent = `${filtered.length} / ${all.length} 个站点`;
    if (options.focusSelector) {
      window.requestAnimationFrame(() => {
        focusElement(settingsPanel.querySelector(options.focusSelector));
      });
    }
  }

  function renderSettingsSites() {
    const sourceApi = window.NovaSources;
    const healthApi = window.NovaSiteHealth;
    if (!sourceApi || !healthApi) {
      return `
        ${settingsHeader("影视源", "站点级管理模块未加载")}
        <div class="settings-warning">${icon("i-alert")}<span>site-overrides.js / site-health.js 未加载，请从 start-preview.cmd 重新启动预览。</span></div>
      `;
    }
    const aggregate = sourceApi.aggregate();
    const all = aggregate.sites;
    const stats = aggregate.stats;
    const executable = all.filter((site) => !site.unsupported).length;
    const kpis = [
      { label: "站点总数", value: all.length, icon: "i-database" },
      { label: "已启用", value: stats.sitesEnabled, icon: "i-power" },
      { label: "可执行", value: executable, icon: "i-play" },
      { label: "已停用", value: stats.sitesDisabled, icon: "i-tune" }
    ];
    const chips = healthApi.TYPE_FILTERS.map((filter) => {
      const count =
        filter.id === "all"
          ? all.length
          : all.filter((site) => healthApi.typeBucket(site) === filter.id).length;
      return `
        <button class="site-chip focusable${siteManagerState.typeFilter === filter.id ? " is-selected" : ""}" type="button" data-site-type="${escapeHtml(filter.id)}">
          ${escapeHtml(filter.label)}<span>${count}</span>
        </button>
      `;
    }).join("");

    return `
      <div class="settings-sites-manager">
        ${settingsHeader(
          "影视源",
          "单个站点的启停、测速与顺序都在这里；订阅原文不动，重新同步也不会丢",
          `覆盖 ${stats.overrides?.total || 0} 条 · 本地持久化`
        )}
        <div class="source-manager-toolbar">
          <div class="source-kpis">
            ${kpis
              .map(
                (item) => `
                  <div class="source-kpi">
                    <span class="source-kpi-icon">${icon(item.icon)}</span>
                    <span class="source-kpi-copy"><strong>${item.value}</strong><span>${item.label}</span></span>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="source-add-actions">
            <button class="source-toolbar-button focusable" type="button" data-site-bulk="test">${icon("i-play")}<span>测试当前列表</span></button>
            <button class="source-toolbar-button focusable" type="button" data-site-bulk="enable">${icon("i-power")}<span>全部启用</span></button>
            <button class="source-toolbar-button focusable" type="button" data-site-bulk="disable">${icon("i-power")}<span>全部停用</span></button>
            <button class="source-toolbar-button focusable" type="button" data-site-bulk="reset">${icon("i-refresh")}<span>重置覆盖</span></button>
            <button class="source-toolbar-button focusable" type="button" data-sites-diagnostics>${icon("i-file")}<span>导出诊断</span></button>
          </div>
        </div>
        <div class="site-filter-bar">
          <label class="site-search">
            ${icon("i-search")}
            <input class="focusable" type="text" data-site-search value="${escapeHtml(siteManagerState.query)}" placeholder="搜索站点名称 / key / 接口" aria-label="搜索影视源" />
          </label>
          <div class="site-chips">${chips}</div>
          <button class="site-chip focusable${siteManagerState.onlyEnabled ? " is-selected" : ""}" type="button" data-site-only-enabled>只看已启用</button>
        </div>
        <div class="source-workspace">
          <section class="source-list-pane">
            <div class="source-pane-heading">
              <strong>站点列表</strong>
              <span id="siteFilterCount">—</span>
            </div>
            <div class="source-list" id="siteListPane"></div>
          </section>
          <aside class="source-report-pane" id="siteReportPane"></aside>
        </div>
        <div class="source-manager-footnote">
          ${icon("i-alert")}
          <span>站点设置存在独立覆盖表里；Spider / 私有协议站点只识别不执行，这里也不会把它标成「可播」。</span>
        </div>
      </div>
    `;
  }

  /* ---------- 内置订阅 / 导出 / 解析接口 ---------- */

  /** 后台任务结束时刷新内容源页；用户正在输入时不要抢着重绘，否则输入框会被清空 */
  function rerenderSourcesIfIdle() {
    if (settingsState.section !== "sources") return false;
    const active = document.activeElement;
    if (active && settingsPanel.contains(active) && active.matches("input, textarea")) return false;
    renderSettings("sources");
    return true;
  }

  function addPresetSource(id) {
    let source;
    try {
      source = window.NovaSources.addPreset(id);
    } catch (error) {
      showToast(error.message || "添加内置订阅失败");
      return;
    }
    sourceManagerState.selectedId = source.id;
    renderSettings("sources");
    // 预设内容已经落本地，不再自动联网探测：想验站点点「同步」或去「影视源」逐个测试
    showToast(`已添加内置订阅：${source.name} · 可点同步开始检测`);
  }

  function exportMergedConfig() {
    try {
      const config = window.NovaSources.exportConfig();
      const text = JSON.stringify(config, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nova-tv-merged-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast(
        `已导出合并订阅 · ${config.sites.length} 站点 / ${config.lives.length} 直播 / ${config.parses.length} 解析`
      );
    } catch (error) {
      showToast(`导出失败：${error.message || "未知错误"}`);
    }
  }

  /** 诊断导出：订阅 → 站点 → 覆盖 → 健康 → 设置，一次说清「为什么这个源没内容」 */
  function exportDiagnostics() {
    try {
      const data = window.NovaSources.diagnostics();
      const text = JSON.stringify(data, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nova-tv-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast(`已导出诊断 · ${data.sources.length} 订阅 / ${data.sites.length} 站点`);
    } catch (error) {
      showToast(`诊断导出失败：${error.message || "未知错误"}`);
    }
  }

  function addParseFromForm() {
    const nameInput = settingsPanel.querySelector("[data-parse-name]");
    const urlInput = settingsPanel.querySelector("[data-parse-url]");
    try {
      const parse = window.NovaSources.addParse({
        name: nameInput?.value,
        url: urlInput?.value
      });
      renderSettings("parses");
      showToast(`已登记解析接口：${parse.name}`);
    } catch (error) {
      showToast(error.message || "登记失败");
    }
  }

  function renderSettingsLives() {
    return `
      ${settingsHeader("电视直播源", "独立管理 M3U / TXT 直播列表，启用后自动并入电视直播页")}
      <div class="settings-flat-page">${renderLiveSourcesSection()}</div>
    `;
  }

  function renderSettingsParses() {
    return `
      ${settingsHeader("解析接口", "登记第三方解析服务；预览版只保存与展示，不自动调用")}
      <div class="settings-flat-page">${renderParsesSection()}</div>
    `;
  }

  // 推荐直播源：IPTV-API 官方 Pages 结果（对方定期重新采集/测速后更新）
  const LIVE_SOURCE_PRESETS = [
    {
      id: "iptv-api-m3u",
      name: "IPTV 自动更新 · M3U",
      url: "https://guovin.github.io/iptv-api/result.m3u",
      note: "官方 Pages 结果，含分组与台标"
    },
    {
      id: "iptv-api-txt",
      name: "IPTV 自动更新 · TXT",
      url: "https://guovin.github.io/iptv-api/result.txt",
      note: "同样的频道，TXT 格式更轻"
    },
    {
      id: "iptv-org-zho",
      name: "iptv-org 中文频道",
      url: "https://iptv-org.github.io/iptv/languages/zho.m3u",
      note: "人工维护，带分辨率标注；作为补充与备用线路"
    }
  ];

  function renderLiveSourcesSection() {
    const sourceApi = window.NovaSources;
    const items = sourceApi?.listLiveSources?.() || [];
    const activeCount = items.filter((item) => item.enabled).length;
    const rows = items
      .map(
        (item) => `
          <div class="source-live-row">
            <div class="source-live-head">
              <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
              <em class="source-live-state ${item.enabled ? "is-on" : "is-off"}">${
                item.enabled
                  ? item.lastChannels
                    ? `${item.lastChannels} 个频道`
                    : "已启用"
                  : "已停用"
              }</em>
            </div>
            <div class="source-parse-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
            ${
              item.lastError
                ? `<div class="source-live-error">${escapeHtml(item.lastError)}</div>`
                : ""
            }
            <div class="source-live-actions">
              <button class="source-action-button focusable" type="button" data-live-test="${escapeHtml(item.id)}">${icon("i-refresh")}<span>测试</span></button>
              <button class="source-action-button focusable" type="button" data-live-toggle="${escapeHtml(item.id)}">${icon("i-power")}<span>${item.enabled ? "停用" : "启用"}</span></button>
              <button class="source-parse-remove focusable" type="button" data-live-remove="${escapeHtml(item.id)}" aria-label="删除直播源">${icon("i-trash")}</button>
            </div>
          </div>
        `
      )
      .join("");
    return `
      <div class="source-report-section source-live-section">
        <label><span>电视直播源</span><em>${items.length} 个 · ${activeCount} 个启用</em></label>
        <div class="source-live-list">
          ${
            items.length
              ? rows
              : `<div class="source-live-row"><div class="source-live-head"><strong>没有独立直播源</strong><em>可在下方添加</em></div><div class="source-parse-url">订阅自带的直播源仍会照常合并进来。</div></div>`
          }
        </div>
        <div class="source-live-presets">
          <span class="source-add-label">推荐直播源 · 对方定期重新采集与测速</span>
          <div class="source-add-row">
            ${LIVE_SOURCE_PRESETS.map(
              (preset) => `
                <button class="source-add-item focusable" type="button" data-live-preset="${preset.id}" title="${escapeHtml(preset.note)}">
                  ${icon("i-refresh")}<span>${escapeHtml(preset.name)}</span>
                </button>
              `
            ).join("")}
          </div>
        </div>
        <div class="source-parse-form">
          <input class="focusable" type="text" data-live-field data-live-name placeholder="名称（可空）" aria-label="直播源名称" />
          <input class="focusable" type="text" data-live-field data-live-url placeholder="https://…/live.m3u" aria-label="直播源地址" />
          <button class="source-action-button focusable" type="button" data-live-add>${icon("i-add")}<span>添加</span></button>
        </div>
        <div class="source-runtime-summary">只接受标准 M3U / TXT 直播列表；启用后会自动并入电视直播页，可随时单独停用。</div>
      </div>
    `;
  }

  function addLiveSourceFromForm() {
    const nameInput = settingsPanel.querySelector("[data-live-name]");
    const urlInput = settingsPanel.querySelector("[data-live-url]");
    try {
      const item = window.NovaSources.addLiveSource({
        name: nameInput?.value,
        url: urlInput?.value
      });
      renderSettings("lives");
      showToast(`已添加直播源：${item.name}`);
    } catch (error) {
      showToast(error.message || "添加直播源失败");
    }
  }

  function toggleLiveSource(id) {
    const item = (window.NovaSources.listLiveSources() || []).find((row) => row.id === id);
    if (!item) return;
    window.NovaSources.setLiveSourceEnabled(id, !item.enabled);
    renderSettings("lives");
    showToast(`${item.name}：${item.enabled ? "已停用" : "已启用"}`);
  }

  function removeLiveSourceRow(id) {
    const item = (window.NovaSources.listLiveSources() || []).find((row) => row.id === id);
    if (!item) return;
    window.NovaSources.removeLiveSource(id);
    renderSettings("lives");
    showToast(`已删除直播源：${item.name}`);
  }

  async function testLiveSourceRow(id) {
    try {
      const result = await window.NovaSources.testLiveSource(id);
      showToast(`${result.name}：解析到 ${result.channels} 个频道`);
    } catch (error) {
      showToast(`${error.message || "测试失败"}`);
    } finally {
      renderSettings("lives");
    }
  }

  async function runSiteTest(key) {
    if (!key || siteManagerState.testing.has(key)) return;
    siteManagerState.testing.add(key);
    paintSiteRows();
    try {
      const result = await window.NovaSources.testSite(key);
      showToast(`${result.name || "站点"}：${result.message}`);
    } catch (error) {
      showToast(`检测失败：${error.message || "未知错误"}`);
    } finally {
      siteManagerState.testing.delete(key);
      paintSiteRows({ focusSelector: `[data-site-test="${cssEscape(key)}"]` });
    }
  }

  async function runSiteBulk(action) {
    const sourceApi = window.NovaSources;
    const healthApi = window.NovaSiteHealth;
    if (!sourceApi || !healthApi) return;
    const all = sourceApi.aggregate().sites;
    const visible = healthApi.filterSites(all, siteManagerState);

    if (action === "enable" || action === "disable") {
      const count = sourceApi.setSitesEnabled(
        visible.map((site) => site.key),
        action === "enable"
      );
      paintSiteRows();
      showToast(`${count} 个站点已${action === "enable" ? "启用" : "停用"}`);
      return;
    }

    if (action === "reset") {
      sourceApi.resetSiteOverrides();
      siteManagerState.testing.clear();
      paintSiteRows();
      showToast("站点覆盖已重置为配置默认值");
      return;
    }

    if (action === "test") {
      const targets = visible.filter((site) => !site.unsupported && !siteManagerState.testing.has(site.key));
      if (!targets.length) {
        showToast("当前列表没有可测试的站点");
        return;
      }
      // 一次最多测 12 个：顺序检测，避免几十个请求一起把源站惹毛
      const batch = targets.slice(0, 12);
      batch.forEach((site) => siteManagerState.testing.add(site.key));
      paintSiteRows();
      showToast(`开始检测 ${batch.length} 个站点${targets.length > batch.length ? `（列表共 ${targets.length} 个，先测前 12 个）` : ""}`);
      try {
        const results = await sourceApi.testSites(batch.map((site) => site.key));
        const summary = healthApi.summarize(results.map((entry) => ({ key: entry.key, result: entry.result })));
        showToast(summary.message);
      } catch (error) {
        showToast(`批量检测失败：${error.message || "未知错误"}`);
      } finally {
        batch.forEach((site) => siteManagerState.testing.delete(site.key));
        paintSiteRows();
      }
    }
  }

  /** 解析接口：只登记与展示，不自动调用第三方解析服务 */
  function renderParsesSection() {
    const sourceApi = window.NovaSources;
    const parses = sourceApi?.listParses?.() || [];
    return `
      <div class="source-report-section source-parse-section">
        <label><span>解析接口</span><em>${parses.length} 个 · 不自动调用</em></label>
        <div class="source-parse-list">
          ${
            parses.length
              ? parses
                  .slice(0, 6)
                  .map(
                    (parse) => `
                      <div class="source-parse-row">
                        <div class="source-parse-head">
                          <strong title="${escapeHtml(parse.name)}">${escapeHtml(parse.name)}</strong>
                          <em>${escapeHtml(parse.custom ? "手工登记" : parse.sourceName || "订阅")}</em>
                          ${
                            parse.custom
                              ? `<button class="source-parse-remove focusable" type="button" data-parse-remove="${escapeHtml(parse.id)}" aria-label="删除解析接口">${icon("i-trash")}</button>`
                              : ""
                          }
                        </div>
                        <div class="source-parse-url" title="${escapeHtml(parse.url)}">${escapeHtml(parse.url)}</div>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="source-parse-row"><div class="source-parse-head"><strong>没有解析接口</strong><em>可在下方登记</em></div></div>`
          }
          ${parses.length > 6 ? `<div class="source-parse-row"><div class="source-parse-head"><strong>另有 ${parses.length - 6} 个</strong><em>已折叠</em></div></div>` : ""}
        </div>
        <div class="source-parse-form">
          <input class="focusable" type="text" data-parse-field data-parse-name placeholder="名称（可空）" aria-label="解析名称" />
          <input class="focusable" type="text" data-parse-field data-parse-url placeholder="https://…/?url=" aria-label="解析地址" />
          <button class="source-action-button focusable" type="button" data-parse-add>${icon("i-add")}<span>登记</span></button>
        </div>
        <div class="source-runtime-summary">解析接口只登记与展示；预览版不会自动调用第三方解析服务，也不会绕过 DRM 与防盗链。</div>
      </div>
    `;
  }

  function ensureSourceFileInput() {
    if (sourceFileInput) return sourceFileInput;
    sourceFileInput = document.createElement("input");
    sourceFileInput.type = "file";
    sourceFileInput.accept = ".json,.txt,application/json,text/plain";
    sourceFileInput.className = "source-file-input";
    sourceFileInput.setAttribute("aria-label", "选择 TVBox JSON 配置文件");
    document.getElementById("stage").appendChild(sourceFileInput);
    sourceFileInput.addEventListener("change", async () => {
      const file = sourceFileInput.files?.[0];
      sourceFileInput.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const source = window.NovaSources.importJson(text, {
          name: file.name.replace(/\.[^.]+$/, ""),
          kind: "file",
          url: file.name
        });
        sourceManagerState.selectedId = source.id;
        renderSettings("sources");
        window.requestAnimationFrame(() => {
          focusElement(
            settingsPanel.querySelector(
              `[data-source-select="${CSS.escape(sourceManagerState.selectedId)}"]`
            )
          );
        });
        showToast(`已导入 ${source.name} · ${source.parsed.compatibility.cmsSites} 个 CMS 站点`);
      } catch (error) {
        showToast(`导入失败：${error.message}`);
      }
    });
    return sourceFileInput;
  }

  function ensureSourceDialog() {
    if (sourceDialog) return sourceDialog;
    sourceDialog = document.createElement("section");
    sourceDialog.className = "source-dialog-screen";
    sourceDialog.hidden = true;
    sourceDialog.setAttribute("aria-label", "添加 TVBox 内容源");
    document.getElementById("stage").appendChild(sourceDialog);
    sourceDialog.addEventListener("click", (event) => {
      if (event.target === sourceDialog || event.target.closest("[data-source-dialog-cancel]")) {
        closeSourceDialog();
      }
    });
    sourceDialog.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sourceActionBusy) return;
      const form = event.target.closest("[data-source-dialog-form]");
      if (!form) return;
      const mode = form.dataset.sourceDialogForm;
      const submit = form.querySelector("[data-source-dialog-submit]");
      const errorBox = form.querySelector("[data-source-dialog-error]");
      const name = form.querySelector('[name="sourceName"]')?.value.trim() || "";
      const submitLabel = submit?.innerHTML || "";
      if (errorBox) {
        errorBox.textContent = "";
        errorBox.hidden = true;
      }
      sourceActionBusy = true;
      if (submit) {
        submit.disabled = true;
        submit.innerHTML = `${icon("i-refresh")}<span>正在解析…</span>`;
      }
      try {
        let source;
        if (mode === "remote") {
          const url = form.querySelector('[name="sourceUrl"]')?.value.trim() || "";
          // 先不探测：探测 6 个站点可能要十几秒，先把站点列表秒出来，检测放后台
          source = await window.NovaSources.addRemote(url, { name, probe: false });
          if (source?.error) throw new Error(source.error);
          if (source?.id) {
            window.setTimeout(() => {
              window.NovaSources.syncSource(source.id).catch(() => {});
            }, 800);
          }
        } else {
          const json = form.querySelector('[name="sourceJson"]')?.value || "";
          source = window.NovaSources.importJson(json, {
            name: name || "粘贴的 TVBox 配置",
            kind: "paste"
          });
        }
        sourceManagerState.selectedId = source.id;
        closeSourceDialog({ restoreFocus: false });
        renderSettings("sources");
        window.requestAnimationFrame(() => {
          focusElement(
            settingsPanel.querySelector(
              `[data-source-select="${CSS.escape(sourceManagerState.selectedId)}"]`
            )
          );
        });
        showToast(
          `已添加 ${source.name} · ${
            source.parsed.compatibility.cmsSites +
            source.parsed.compatibility.htmlSites +
            source.parsed.compatibility.adaptedSites
          } 影视站 · ${source.parsed.compatibility.liveSources} 直播`
        );
      } catch (error) {
        if (errorBox) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
        }
        else showToast(`添加失败：${error.message}`);
      } finally {
        sourceActionBusy = false;
        if (submit && document.contains(submit)) {
          submit.disabled = false;
          submit.innerHTML = submitLabel;
        }
      }
    });
    return sourceDialog;
  }

  function openSourceDialog(mode = "remote") {
    const dialog = ensureSourceDialog();
    const isRemote = mode === "remote";
    sourceDialogReturnFocus = document.activeElement;
    dialog.innerHTML = `
      <div class="source-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="sourceDialogTitle">
        <div class="source-dialog-head">
          <div>
            <span class="panel-kicker">TVBOX SOURCE IMPORT</span>
            <h2 id="sourceDialogTitle">${isRemote ? "添加远程订阅" : "粘贴 TVBox JSON"}</h2>
            <p>${
              isRemote
                ? "支持标准 TVBox 配置和 tvbox-desktop/1 扩展。远程请求会经过本地受控代理，并禁止访问内网地址。"
                : "直接粘贴完整 JSON。解析器会读取 sites、lives、parses、headers、flags 与 home，并为每个站点生成兼容性报告。"
            }</p>
          </div>
          <button class="source-dialog-close focusable" type="button" data-source-dialog-cancel aria-label="关闭">
            ${icon("i-close")}
          </button>
        </div>
        <form class="source-dialog-form" data-source-dialog-form="${isRemote ? "remote" : "paste"}">
          <div class="source-form-grid${isRemote ? "" : " is-single"}">
            <label class="source-field">
              <span>显示名称</span>
              <input class="focusable" name="sourceName" type="text" autocomplete="off" spellcheck="false" placeholder="例如：我的 TVBox 订阅" />
            </label>
            ${
              isRemote
                ? `
                  <label class="source-field">
                    <span>订阅 URL</span>
                    <input class="focusable" name="sourceUrl" type="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/tvbox.json" />
                  </label>
                `
                : `
                  <label class="source-field">
                    <span>TVBox JSON</span>
                    <textarea class="focusable" name="sourceJson" spellcheck="false" placeholder='{"sites":[],"lives":[],"parses":[]}'></textarea>
                  </label>
                `
            }
          </div>
          <div class="source-dialog-note">
            ${icon("i-alert")}
            <span>兼容范围：苹果 CMS type=3/4、HTML 规则 type=1、已验证公开网页直连、M3U/TXT 直播、Headers 与扩展 home。私有 Spider / csp_* Guard 会显示但不会执行。Cookie 等敏感 Header 会在界面脱敏，代理默认不透传。</span>
          </div>
          <div class="source-warning-row" data-source-dialog-error aria-live="polite" hidden></div>
          <div class="source-dialog-footer">
            <button class="source-dialog-button focusable" type="button" data-source-dialog-cancel>取消</button>
            <button class="source-dialog-button primary focusable" type="submit" data-source-dialog-submit>
              ${icon(isRemote ? "i-refresh" : "i-check")}<span>${isRemote ? "同步并添加" : "解析并添加"}</span>
            </button>
          </div>
        </form>
      </div>
    `;
    dialog.hidden = false;
    const waitingForSources = document.getElementById("settingsPanel");
    if (waitingForSources) waitingForSources.inert = true;
    window.requestAnimationFrame(() => {
      const first = dialog.querySelector("input, textarea");
      first?.focus({ preventScroll: true });
      first?.classList.add("is-focused");
    });
  }

  function closeSourceDialog(options = {}) {
    if (!sourceDialog || sourceDialog.hidden) return;
    const target = sourceDialogReturnFocus;
    sourceDialog.hidden = true;
    sourceDialog.innerHTML = "";
    const panel = document.getElementById("settingsPanel");
    if (panel) panel.inert = false;
    sourceDialogReturnFocus = null;
    if (options.restoreFocus !== false && target && document.contains(target)) {
      window.requestAnimationFrame(() => focusElement(target));
    }
  }

  let deleteConfirmId = "";

  async function runSourceAction(action, id) {
    if (sourceActionBusy) return;
    const source = window.NovaSources.get(id);
    if (!source) {
      showToast("内容源不存在");
      return;
    }
    if (action === "toggle") {
      window.NovaSources.toggleSource(id);
      renderSettings("sources");
      window.requestAnimationFrame(() => {
        focusElement(
          settingsPanel.querySelector(
            `[data-source-select="${CSS.escape(id)}"]`
          )
        );
      });
      showToast(`${source.name} · ${source.enabled ? "已停用" : "已启用"}`);
      return;
    }
    if (action === "delete") {
      if (deleteConfirmId !== id) {
        deleteConfirmId = id;
        showToast("再次确认删除该内容源");
        return;
      }
      deleteConfirmId = "";
      window.NovaSources.removeSource(id);
      sourceManagerState.selectedId = window.NovaSources.list()[0]?.id || "";
      renderSettings("sources");
      window.requestAnimationFrame(() => {
        focusElement(
          settingsPanel.querySelector(
            `[data-source-select="${CSS.escape(sourceManagerState.selectedId)}"]`
          ) || settingsPanel.querySelector(".focusable")
        );
      });
      showToast(`${source.name} · 已删除`);
      return;
    }
    if (action === "sync") {
      sourceActionBusy = true;
      showToast(`正在同步 ${source.name}`);
      try {
        const next = await window.NovaSources.syncSource(id);
        sourceManagerState.selectedId = next.id;
        renderSettings("sources");
        window.requestAnimationFrame(() => {
          focusElement(
            settingsPanel.querySelector(
              `[data-source-action="sync"][data-source-id="${CSS.escape(id)}"]`
            )
          );
        });
        const providerCount =
          Number(next.parsed.compatibility.providerSites || 0) +
          Number(next.parsed.compatibility.spiderSites || 0);
        if (
          next.runtime?.status === "unsupported" &&
          providerCount > 0
        ) {
          showToast(`配置已同步 · ${providerCount} 个站点需 Spider，当前不可直接播放`);
        } else if (next.runtime?.status === "failed") {
          showToast(
            `配置已同步 · 运行检测失败：${cleanInline(
              next.runtime.fatalError ||
                next.runtime.sites?.find((item) => item.error)?.error ||
                "站点未返回内容"
            ).slice(0, 70)}`
          );
        } else {
          showToast(`同步完成 · ${sourceRuntimeSummary(next.runtime)}`);
        }
      } catch (error) {
        renderSettings("sources");
        window.requestAnimationFrame(() => {
          focusElement(
            settingsPanel.querySelector(
              `[data-source-action="sync"][data-source-id="${CSS.escape(id)}"]`
            )
          );
        });
        showToast(`同步失败：${error.message}`);
      } finally {
        sourceActionBusy = false;
      }
      return;
    }
    if (action === "probe") {
      sourceActionBusy = true;
      showToast(`正在检测 ${source.name}`);
      try {
        const next = await window.NovaSources.probeSource(id, {
          timeout: 12000,
          maxSites: 6,
          maxLives: 8,
          limit: 3
        });
        sourceManagerState.selectedId = next.id;
        renderSettings("sources");
        window.requestAnimationFrame(() => {
          focusElement(
            settingsPanel.querySelector(
              `[data-source-action="probe"][data-source-id="${CSS.escape(id)}"]`
            )
          );
        });
        showToast(
          `检测完成 · ${sourceRuntimeLabel(next.runtime?.status)} · ${sourceRuntimeSummary(
            next.runtime
          )}`
        );
      } catch (error) {
        showToast(`检测失败：${error.message}`);
      } finally {
        sourceActionBusy = false;
      }
    }
  }

  function renderToggleSettings(section, title, subtitle, choices = null) {
    const rows = settingsState.toggles[section];
    const live = window.NovaSettings ? window.NovaSettings.get() : {};
    return `
      ${settingsHeader(title, subtitle)}
      ${
        choices
          ? `
            <div class="settings-section-card">
              <div class="settings-section-title">
                <h3>${choices.title}</h3>
                <span>${settingsState.choices[section]}</span>
              </div>
              <p>${choices.description}</p>
              <div class="settings-choice-row">
                ${choices.options
                  .map(
                    (option) => `
                      <button
                        class="settings-choice focusable${settingsState.choices[section] === option ? " is-selected" : ""}"
                        type="button"
                        data-setting-choice="${section}:${option}"
                      >${option}</button>
                    `
                  )
                  .join("")}
              </div>
            </div>
          `
          : ""
      }
      ${rows
        .map((row, index) => {
          const isOn = typeof live[row.key] === "boolean" ? live[row.key] : row.value;
          return `
            <button
              class="setting-toggle-row focusable${isOn ? " is-on" : ""}"
              type="button"
              data-setting-toggle="${section}:${index}"
            >
              <span class="toggle-label">${row.label}</span>
              <span class="setting-toggle" aria-hidden="true"></span>
            </button>
          `;
        })
        .join("")}
      <div class="settings-footer-note">这些开关会写入本地设置（nova.settings.v1），刷新与重启后都会恢复。</div>
    `;
  }

  /** 设置 → 通用：并发 / 超时 / UA 三档预设 + 解说过滤 + 恢复默认 */
  function renderSettingsGeneral() {
    const settingsApi = window.NovaSettings;
    if (!settingsApi) {
      return `
        ${settingsHeader("通用", "设置模块未加载")}
        <div class="settings-warning">${icon("i-alert")}<span>nova-settings.js 未加载，请从 start-preview.cmd 重新启动预览。</span></div>
      `;
    }
    const current = settingsApi.get();
    const summary = settingsApi.describe(current);
    const group = (kind, title, description) => {
      const presets = settingsApi.PRESETS[kind] || [];
      const activeId = settingsApi.presetOf(kind);
      const active = presets.find((preset) => preset.id === activeId);
      return `
        <div class="settings-section-card">
          <div class="settings-section-title">
            <h3>${title}</h3>
            <span>${escapeHtml(active ? active.label : "自定义")}</span>
          </div>
          <p>${description}</p>
          <div class="settings-choice-row">
            ${presets
              .map(
                (preset) => `
                  <button
                    class="settings-choice focusable${activeId === preset.id ? " is-selected" : ""}"
                    type="button"
                    data-setting-choice="${kind}:${preset.id}"
                    title="${escapeHtml(preset.detail)}"
                  >${escapeHtml(preset.label)}</button>
                `
              )
              .join("")}
          </div>
          <div class="settings-preset-detail">${escapeHtml(active ? active.detail : "当前值不在预设里")}</div>
        </div>
      `;
    };

    return `
      ${settingsHeader("通用", "并发、超时与 User-Agent 会直接影响片库和搜索", "写入 nova.settings.v1 · 重启后恢复")}
      ${group("concurrency", "请求并发", "同时在跑几个站点请求。并发越高首屏越快，但更容易被源站限流。")}
      ${group("timeout", "请求超时", "单个站点列表 / 详情 / 检测请求的最长等待时间。")}
      ${group("userAgent", "User-Agent", "部分站点会校验 UA；经本地代理转发的请求才会真正生效。")}
      <button
        class="setting-toggle-row focusable${current.filterCommentary ? " is-on" : ""}"
        type="button"
        data-setting-toggle="general:commentary"
      >
        <span class="toggle-label">结果过滤解说 / 速看 / 混剪</span>
        <span class="setting-toggle" aria-hidden="true"></span>
      </button>
      <div class="settings-footer-note">
        当前：${escapeHtml(summary.concurrency)} · ${escapeHtml(summary.timeout)} · UA ${escapeHtml(summary.userAgent)} · ${escapeHtml(summary.commentary)}
      </div>
      <div class="settings-choice-row">
        <button class="settings-choice focusable" type="button" data-settings-reset>恢复默认设置</button>
      </div>
    `;
  }

  function renderSettingsAbout() {
    return `
      ${settingsHeader("关于 NOVA TV", "系统信息与组件声明", "本地试玩版 0.1.0")}
      <div class="settings-about-hero">
        <div class="settings-about-mark">N</div>
        <h3>NOVA TV</h3>
        <p>智能电视影视聚合平台 · Android TV 原生试玩版</p>
      </div>
      <div class="settings-about-list">
        <div>${icon("i-grid")}<span>Jetpack Compose · 1920×1080 逻辑画布</span></div>
        <div>${icon("i-play")}<span>AndroidX Media3 / ExoPlayer</span></div>
        <div>${icon("i-database")}<span>Room · DataStore · OkHttp · Jsoup</span></div>
        <div>${icon("i-tv")}<span>最低系统 Android 6.0 (API 23)</span></div>
      </div>
      <div class="settings-footer-note">演示图片仅用于 UI 评审，正式发布前必须替换为有明确授权的素材。本轮源码可试用，不交付 APK。</div>
    `;
  }

  function renderSettings(section = settingsState.section) {
    settingsState.section = section;
    settingsNav.querySelectorAll("[data-settings-section]").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.settingsSection === section);
    });

    switch (section) {
      case "sites":
        settingsPanel.innerHTML = renderSettingsSites();
        paintSiteRows();
        break;
      case "general":
        settingsPanel.innerHTML = renderSettingsGeneral();
        break;
      case "browsing":
        settingsPanel.innerHTML = renderToggleSettings(
          "browsing",
          "浏览与首页",
          "控制首页模块、聚合搜索与订阅源刷新"
        );
        break;
      case "playback":
        settingsPanel.innerHTML = renderToggleSettings(
          "playback",
          "播放设置",
          "解码、线路切换与续播行为",
          {
            title: "默认解码策略",
            description: "原生版会根据设备能力选择 MediaCodec 或软件回退。",
            options: ["自动", "硬件优先", "软件兼容"]
          }
        );
        break;
      case "music":
        settingsPanel.innerHTML = renderToggleSettings(
          "music",
          "音乐设置",
          "后台播放、音频质量与音乐域行为",
          {
            title: "默认试听音质",
            description: "真实音乐源接入后，此选项会映射到对应线路或音质参数。",
            options: ["标准", "高品质", "无损"]
          }
        );
        break;
      case "appearance":
        settingsPanel.innerHTML = renderToggleSettings(
          "appearance",
          "外观与动效",
          "焦点描边、背景动态和电视安全区",
          {
            title: "动效强度",
            description: "焦点移动和页面入场动画会遵循系统减少动态效果设置。",
            options: ["跟随系统", "流畅", "克制"]
          }
        );
        break;
      case "lives":
        settingsPanel.innerHTML = renderSettingsLives();
        break;
      case "parses":
        settingsPanel.innerHTML = renderSettingsParses();
        break;
      case "about":
        settingsPanel.innerHTML = renderSettingsAbout();
        break;
      case "sources":
      default:
        settingsState.section = "sources";
        settingsPanel.innerHTML = renderSettingsSources();
        break;
    }
  }

  function initialFocusFor(key) {
    const selectors = {
      live: "#liveChannelGrid .live-channel-card",
      library: "#libraryPage .lib-card",
      music: "#musicToggle",
      saved: "#savedGrid .saved-card",
      settings: "#settingsNav .settings-nav-row.is-selected"
    };
    const preferred = document.querySelector(selectors[key]);
    if (preferred) return preferred;
    // 兜底时跳过左上角 logo：它是「回首页」按钮，不能一进页面焦点就落在那儿
    const candidates = pages[key] ? [...pages[key].querySelectorAll(".focusable")] : [];
    return candidates.find((el) => !el.hasAttribute("data-go-home")) || candidates[0] || null;
  }

  /* ---- 音乐搜索（聚合 API） ---- */

  async function runMusicSearch() {
    const input = document.getElementById("musicSearchInput");
    const list = document.getElementById("musicSearchList");
    const keyword = (input?.value || "").trim();
    if (!keyword || !list) return;
    list.innerHTML = `<div class="music-search-note">正在搜索「${escapeHtml(keyword)}」…</div>`;
    const rows = await window.NovaMusicSources?.search?.(keyword, { limit: 20 });
    if (!rows || !rows.length) {
      list.innerHTML = `<div class="music-search-note">没有结果：${escapeHtml(keyword)}。聚合 API 可能限流，换关键词或稍后再试。</div>`;
      return;
    }
    list.innerHTML = rows
      .map(
        (track, index) => `
          <button class="music-search-item focusable" type="button" tabindex="0" data-search-track="${index}">
            <span class="music-search-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="music-search-copy">
              <strong>${escapeHtml(track.title)}</strong>
              <span>${escapeHtml(track.artist)}${track.album ? " · " + escapeHtml(track.album) : ""}</span>
            </span>
            <span class="music-search-src">${escapeHtml(track.provider)}</span>
          </button>
        `
      )
      .join("");
    musicSearchResults = rows;
  }

  let musicSearchResults = [];

  async function playSearchTrack(track) {
    if (!track) return;
    const source = await window.NovaMusicSources?.getUrl?.(track);
    if (!source || !source.url) {
      showToast("这条曲目取不到播放地址，换一首试试");
      return;
    }
    const lrc = await window.NovaMusicSources?.getLyric?.(track);
    musicState.mode = "search";
    musicState.radioIndex = -1;
    musicState.searchTrack = { ...track, lrc: lrc || "", url: source.url };
    closeMusicSearch(true);
    musicAudio.src = source.url;
    musicAudio.load();
    updateMusicUI();
    try {
      await musicAudio.play();
      showToast(`正在播放 · ${track.title}`);
    } catch {
      showToast("按 OK 继续播放");
    }
  }

  function openMusicSearch() {
    const panel = document.getElementById("musicSearchPanel");
    if (!panel) return;
    panel.hidden = false;
    musicSearchResults = [];
    const list = document.getElementById("musicSearchList");
    if (list) list.innerHTML = `<div class="music-search-note">输入关键词后回车，结果来自聚合 API（网易 / QQ / 酷狗 / 咪咕）。</div>`;
    const input = document.getElementById("musicSearchInput");
    if (input) {
      input.value = "";
      input.focus({ preventScroll: true });
    }
  }

  function closeMusicSearch(keepPlaying = false) {
    const panel = document.getElementById("musicSearchPanel");
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    const button = document.querySelector("[data-music-search]");
    if (button && !keepPlaying) focusElement(button);
  }

  function isMusicSearchOpen() {
    const panel = document.getElementById("musicSearchPanel");
    return Boolean(panel && !panel.hidden);
  }
  async function loadRadioStations(force = false) {
    if (musicRadioLoaded && !force) return;
    musicRadioLoaded = true;
    const meta = document.getElementById("musicRadioMeta");
    if (meta) meta.textContent = "正在读取在线电台…";
    try {
      const rows = await window.NovaMusicSources?.radio?.list?.({ country: "CN", limit: 24 });
      musicRadioLive = Array.isArray(rows) && rows.length
        ? rows.map((row) => ({
            ...row,
            badge: row.extra?.codec ? String(row.extra.codec).slice(0, 3).toUpperCase() : "FM",
            note: row.artist || "网络电台"
          }))
        : [];
    } catch {
      musicRadioLive = [];
    }
    renderMusicRadio();
  }

  function preparePage(key, options = {}) {
    if (key === "live") {
      if (options.group) liveState.group = options.group;
      renderLive();
      const revision = window.NovaSources?.revision ?? 0;
      if (liveDataState !== "sources" && liveLoadedRevision !== revision) {
        refreshLiveData();
      }
      return;
    }
    if (key === "music") {
      loadMusicFeed();
      loadRadioStations();
      return;
    }
    if (key === "library") {
      renderLibrary(options.category || libraryState.category);
      const revision = window.NovaSources?.revision ?? 0;
      if (libraryDataState !== "sources" && libraryLoadedRevision !== revision) {
        refreshLibraryData();
      }
      return;
    }
    if (key === "music") {
      if (!musicQueue.children.length) renderMusicQueue();
      updateMusicUI();
      return;
    }
    if (key === "saved") {
      renderSaved(options.tab || savedState.tab);
      return;
    }
    if (key === "settings") {
      renderSettings(options.section || settingsState.section);
    }
  }

  function activatePage(key, focusTarget = null) {
    activePageKey = key;
    Object.entries(pages).forEach(([pageKey, page]) => {
      page.classList.toggle("is-active", pageKey === key);
      page.hidden = pageKey !== key;
    });
    appRoot.classList.add("is-dimmed");
    appRoot.inert = true;

    window.requestAnimationFrame(() => {
      const target = focusTarget || initialFocusFor(key);
      focusElement(target);
    });
  }

  function open(key, source, options = {}) {
    const page = pages[key];
    if (!page) return;

    const sourceElement =
      source && source.nodeType === 1
        ? source
        : document.activeElement && document.activeElement !== document.body
          ? document.activeElement
          : null;

    if (activePageKey === key) {
      if (key === "settings" && options.section) {
        renderSettings(options.section);
        focusElement(settingsPanel.querySelector(".focusable") || initialFocusFor(key));
      }
      return;
    }

    if (activePageKey) {
      pageStack.push({
        key: activePageKey,
        focus: sourceElement
      });
    } else {
      rootReturnFocus = sourceElement;
    }

    preparePage(key, options);
    activatePage(key);
  }

  function close() {
    if (sourceDialog && !sourceDialog.hidden) {
      closeSourceDialog();
      return;
    }
    if (!activePageKey) return;

    const currentPage = pages[activePageKey];
    currentPage.classList.remove("is-active");
    currentPage.hidden = true;

    if (pageStack.length) {
      const previous = pageStack.pop();
      preparePage(previous.key);
      activatePage(previous.key, previous.focus);
      return;
    }

    activePageKey = null;
    appRoot.classList.remove("is-dimmed");
    appRoot.inert = false;

    const target =
      rootReturnFocus && document.contains(rootReturnFocus)
        ? rootReturnFocus
        : document.querySelector(".topbar-search");
    rootReturnFocus = null;
    focusElement(target);
  }

  function isOpen() {
    return Boolean(activePageKey);
  }

  // 回最首页：一次清空整条页面栈（片库 → 设置 这种多层也直接回到时钟页）
  function goHome() {
    if (!activePageKey) return;
    window.NovaLiveUI?.stop?.();
    let guard = 0;
    while (activePageKey && guard < 12) {
      close();
      guard += 1;
    }
    // 焦点交给 close() 自己还原（回到当初打开页面的那个元素，没有就落到首页搜索）
  }

  function focusNow(element) {
    if (!element || element.closest("[hidden]")) return true;
    focusSequence += 1;
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    revealInScrollable(element);
    element.focus({ preventScroll: true });
    element.classList.add("is-focused");
    // 横向 rail：把目标卡滚进可视区（原生 focus 不会滚横向容器）
    const rail = element.closest(".music-rail, .home-rail");
    if (rail) {
      const left = element.offsetLeft - rail.offsetLeft;
      const right = left + element.offsetWidth;
      if (left < rail.scrollLeft || right > rail.scrollLeft + rail.clientWidth) {
        rail.scrollTo({ left: Math.max(0, left - 32), behavior: "smooth" });
      }
    }
    return true;
  }

  function stepInList(items, current, direction, wrap = false) {
    const index = items.indexOf(current);
    if (index < 0) return null;
    const delta = direction === "left" || direction === "up" ? -1 : 1;
    let nextIndex = index + delta;
    if (wrap) nextIndex = (nextIndex + items.length) % items.length;
    return items[nextIndex] || null;
  }

  function moveWithin(current, items, direction) {
    if (!current || !items.length) return null;
    const currentRect = current.getBoundingClientRect();
    const cx = currentRect.left + currentRect.width / 2;
    const cy = currentRect.top + currentRect.height / 2;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of items) {
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
      } else {
        primary = direction === "up" ? -dy : dy;
        perpendicular = Math.abs(dx);
      }
      if (primary < 8) continue;

      const overlapX = Math.max(
        0,
        Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left)
      );
      const overlapY = Math.max(
        0,
        Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top)
      );
      const overlap =
        direction === "left" || direction === "right" ? overlapY : overlapX;
      const axisSize =
        direction === "left" || direction === "right"
          ? currentRect.height
          : currentRect.width;
      const overlapRatio = axisSize > 0 ? Math.min(1, overlap / axisSize) : 0;
      const crossAxisPenalty = overlap > 0 ? 0 : 320;
      const score =
        primary +
        perpendicular * 1.18 -
        overlapRatio * 100 +
        crossAxisPenalty;

      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  function visibleItems(items) {
    return items.filter((item) => {
      if (!item || item.closest("[hidden]")) return false;
      const rect = item.getBoundingClientRect();
      return rect.width > 2 && rect.height > 2;
    });
  }

  /* 直播页遥控器导航：顶栏 / 视频按钮 / 分组 / 频道列表 四个分区 */
  const liveNav = { dir: "", at: 0, count: 0 };

  function liveNavStep(direction) {
    const now = Date.now();
    if (liveNav.dir === direction && now - liveNav.at < 420) {
      liveNav.count += 1;
    } else {
      liveNav.count = 0;
    }
    liveNav.dir = direction;
    liveNav.at = now;
    const count = liveNav.count;
    if (count < 5) return 1;
    if (count < 10) return 3;
    if (count < 18) return 8;
    return 15;
  }

  function focusLiveRow(element) {
    if (!element) return true;
    element.scrollIntoView({ block: "nearest" });
    return focusNow(element);
  }

  function navigateLive(direction, active) {
    if (window.NovaLiveUI?.navigateHome?.(direction, active)) return true;
    const page = pages.live;
    if (!page || !active) return false;
    const search = page.querySelector(".lv-search");
    const buttons = visibleItems([...page.querySelectorAll(".lv-player .lv-btn")]);
    const chips = visibleItems([...page.querySelectorAll(".lv-groups .lv-chip")]);
    const rows = visibleItems([...page.querySelectorAll(".lv-channels .lv-row")]);

    if (active === search) {
      if (direction === "down") return focusNow(chips[0] || buttons[0]);
      return true;
    }

    if (buttons.includes(active)) {
      const index = buttons.indexOf(active);
      if (direction === "left") {
        return index > 0 ? focusNow(buttons[index - 1]) : true;
      }
      if (direction === "right") {
        if (index < buttons.length - 1) return focusNow(buttons[index + 1]);
        return focusLiveRow(rows[0]);
      }
      if (direction === "up") return focusNow(search);
      if (direction === "down") return focusNow(chips[0] || rows[0]);
      return true;
    }

    if (chips.includes(active)) {
      if (direction === "left" || direction === "right") {
        const step = direction === "left" ? -1 : 1;
        const target = chips[(chips.indexOf(active) + step + chips.length) % chips.length];
        if (target && target !== active) {
          target.click();
          focusNow(target);
        }
        return true;
      }
      if (direction === "down") return focusLiveRow(rows[0]);
      if (direction === "up") return focusNow(buttons[0] || search);
      return true;
    }

    if (rows.includes(active)) {
      const index = rows.indexOf(active);
      if (direction === "up") {
        if (index === 0) return focusNow(chips[0] || buttons[0]);
        const step = liveNavStep("up");
        return focusLiveRow(rows[Math.max(0, index - step)]);
      }
      if (direction === "down") {
        const step = liveNavStep("down");
        const next = Math.min(rows.length - 1, index + step);
        return focusLiveRow(rows[next]);
      }
      if (direction === "left") return focusNow(buttons[0]);
      if (direction === "right") return true;
      return true;
    }

    return false;
  }
  function navigateLibrary(direction, active) {
    const page = pages.library;
    const back = page.querySelector(".page-back");
    const headerAction = page.querySelector(".page-header [data-open-settings]");
    const categories = visibleItems([...page.querySelectorAll("#libraryCategoryList .rail-choice")]);
    const railSettings = page.querySelector(".rail-settings-button");
    const heroPlay = page.querySelector("#libraryHeroPlay");
    const heroFavorite = page.querySelector("#libraryHeroFavorite");
    const heroButtons = visibleItems([heroPlay, heroFavorite]);
    const cards = visibleItems([...page.querySelectorAll("#libraryGrid .library-card")]);
    const selectedCategory =
      categories.find((category) => category.classList.contains("is-selected")) ||
      categories[0];

    if (active === back) {
      if (direction === "right") return focusNow(headerAction);
      if (direction === "down") return focusNow(categories[0]);
      return true;
    }
    if (active === headerAction) {
      if (direction === "left") return focusNow(back);
      if (direction === "down") return focusNow(categories[0]);
      return true;
    }
    if (categories.includes(active)) {
      if (direction === "up" || direction === "down") {
        const target = stepInList(categories, active, direction);
        if (target) return focusNow(target);
        if (direction === "up" && active === categories[0]) return focusNow(back);
        if (direction === "down" && active === categories[categories.length - 1]) {
          return focusNow(railSettings);
        }
        return true;
      }
      if (direction === "right") return focusNow(heroPlay);
      return true;
    }
    if (active === railSettings) {
      if (direction === "up") return focusNow(categories[categories.length - 1]);
      if (direction === "right") return focusNow(heroFavorite);
      return true;
    }
    if (heroButtons.includes(active)) {
      if (direction === "left" || direction === "right") {
        return focusNow(stepInList(heroButtons, active, direction));
      }
      if (direction === "up") return focusNow(selectedCategory);
      if (direction === "down") {
        const index = active === heroPlay ? 0 : 1;
        return focusNow(cards[index] || cards[0]);
      }
      return true;
    }
    if (cards.includes(active)) {
      const index = cards.indexOf(active);
      const column = index % 4;
      const row = Math.floor(index / 4);
      const rowCount = Math.ceil(cards.length / 4);
      let target = null;

      if (direction === "left") {
        target = column > 0 ? cards[index - 1] : selectedCategory;
      } else if (direction === "right") {
        target =
          column < 3 && index + 1 < cards.length ? cards[index + 1] : null;
      } else if (direction === "up") {
        target =
          row > 0
            ? cards[index - 4]
            : heroButtons[column < 2 ? column : 1] || heroPlay;
      } else if (direction === "down") {
        target =
          row < rowCount - 1 && index + 4 < cards.length
            ? cards[index + 4]
            : null;
      }
      return focusNow(target);
    }
    return false;
  }

  function navigateMusic(direction, active) {
    const page = pages.music;
    const logo = page.querySelector("[data-go-home]");
    const headerAction = page.querySelector(".music-topbar [data-open-settings]");
    const controls = visibleItems([
      page.querySelector("#musicPrev"),
      page.querySelector("#musicToggle"),
      page.querySelector("#musicNext")
    ]);
    const progress = page.querySelector("#musicProgress");
    const queueItems = visibleItems([...page.querySelectorAll("#musicQueue .music-rail-card")]);
    const radioItems = visibleItems([...page.querySelectorAll("#musicRadio .music-rail-card")]);
    const play = page.querySelector("#musicToggle");
    const currentQueue =
      queueItems[musicState.currentIndex] || queueItems[0] || radioItems[0] || null;

    // 顶栏：logo ← → 设置图标，↓ 进控制区
    if (logo && active === logo) {
      if (direction === "right") return focusNow(headerAction) || true;
      if (direction === "down") return focusNow(play) || true;
      return true;
    }
    if (active === headerAction) {
      if (direction === "left") return focusNow(logo) || true;
      if (direction === "down") return focusNow(play) || true;
      return true;
    }
    // 进度条：←/→ 快退快进，↑ 回控制键，↓ 进队列
    if (progress && active === progress) {
      if (direction === "left") { seekMusicBy(-5); return true; }
      if (direction === "right") { seekMusicBy(5); return true; }
      if (direction === "up") return focusNow(play) || true;
      if (direction === "down") return focusNow(currentQueue) || true;
      return true;
    }
    if (controls.includes(active)) {
      if (direction === "left" || direction === "right") {
        return focusNow(stepInList(controls, active, direction));
      }
      if (direction === "up") return focusNow(progress) || true;
      if (direction === "down") return focusNow(currentQueue) || true;
      return true;
    }
    if (radioItems.includes(active)) {
      if (direction === "up" || direction === "down") {
        const target = stepInList(radioItems, active, direction);
        return focusNow(target || queueItems[queueItems.length - 1] || play);
      }
      if (direction === "left") return focusNow(page.querySelector("#musicPrev"));
      if (direction === "right") return focusNow(page.querySelector("#musicNext"));
      return true;
    }
    if (queueItems.includes(active)) {
      if (direction === "up" || direction === "down") {
        const target = stepInList(queueItems, active, direction);
        if (target) return focusNow(target) || true;
        // 队列走到底：向下接电台列表，向上回控制键
        if (direction === "down" && radioItems[0]) return focusNow(radioItems[0]) || true;
        return focusNow(play) || true;
      }
      if (direction === "left") return focusNow(page.querySelector("#musicPrev"));
      if (direction === "right") return focusNow(page.querySelector("#musicNext"));
      return true;
    }
    return false;
  }

  function navigateSaved(direction, active) {
    const page = pages.saved;
    const back = page.querySelector(".page-back");
    const tabs = visibleItems([...page.querySelectorAll("[data-saved-tab]")]);
    const cards = visibleItems([...page.querySelectorAll("#savedGrid .saved-card")]);
    const actions = visibleItems([...page.querySelectorAll("[data-saved-action]")]);

    if (active === back) {
      if (direction === "right") return focusNow(tabs[0]);
      if (direction === "down") return focusNow(cards[0]);
      return true;
    }
    if (tabs.includes(active)) {
      if (direction === "left" || direction === "right") {
        return focusNow(stepInList(tabs, active, direction));
      }
      if (direction === "down") return focusNow(cards[0]);
      if (direction === "up") return focusNow(back);
      return true;
    }
    if (cards.includes(active)) {
      const index = cards.indexOf(active);
      const column = index % 3;
      const row = Math.floor(index / 3);
      const rowCount = Math.ceil(cards.length / 3);
      let target = null;

      if (direction === "left") {
        target = column > 0 ? cards[index - 1] : tabs[0];
      } else if (direction === "right") {
        target =
          column < 2 && index + 1 < cards.length
            ? cards[index + 1]
            : actions[row] || actions[0];
      } else if (direction === "up") {
        target = row > 0 ? cards[index - 3] : tabs[0];
      } else if (direction === "down") {
        target =
          row < rowCount - 1 && index + 3 < cards.length
            ? cards[index + 3]
            : null;
      }
      return focusNow(target);
    }
    if (actions.includes(active)) {
      if (direction === "up" || direction === "down") {
        return focusNow(stepInList(actions, active, direction));
      }
      if (direction === "left") {
        const index = actions.indexOf(active);
        const rowCard = cards[index * 3 + 2] || cards[Math.min(index * 3, cards.length - 1)];
        return focusNow(rowCard);
      }
      return true;
    }
    return false;
  }

  /**
   * 影视源页的显式焦点分区：
   *   工具栏（测试 / 启用 / 停用 / 重置）
   *   筛选（搜索框 + 类型 chips + 只看已启用）
   *   站点列表（每行：开关 → 站名 → 测试，行内左右走，行间上下走）
   *   右栏操作（启用/停用、测试、上移/下移、清除覆盖）
   * 返回 false 表示当前焦点不在这四个区里，交回通用逻辑处理。
   */
  function navigateSitesPage(direction, active) {
    const panel = settingsPanel;
    if (!panel) return false;
    const toolbar = visibleItems([...panel.querySelectorAll(".source-toolbar-button")]);
    const filters = visibleItems([
      ...panel.querySelectorAll(".site-search input, .site-chip")
    ]);
    const rows = [...panel.querySelectorAll("[data-site-row]")]
      .map((row) => visibleItems([...row.querySelectorAll(".focusable")]))
      .filter((slots) => slots.length);
    const report = visibleItems([
      ...panel.querySelectorAll(".source-report-actions .source-action-button")
    ]);

    const step = (list, element, dir) => {
      const target = stepInList(list, element, dir);
      return target ? focusNow(target) : true;
    };

    if (toolbar.includes(active)) {
      if (direction === "left" || direction === "right") return step(toolbar, active, direction);
      if (direction === "down") return focusNow(filters[0]);
      return true;
    }

    if (filters.includes(active)) {
      if (direction === "left" || direction === "right") return step(filters, active, direction);
      if (direction === "up") return focusNow(toolbar[0]);
      if (direction === "down") return focusNow(rows[0]?.[0]);
      return true;
    }

    const rowIndex = rows.findIndex((slots) => slots.includes(active));
    if (rowIndex >= 0) {
      const slots = rows[rowIndex];
      const slotIndex = slots.indexOf(active);
      if (direction === "left") {
        if (slotIndex > 0) return focusNow(slots[slotIndex - 1]);
        const previous = rows[rowIndex - 1];
        return previous ? focusNow(previous[previous.length - 1]) : true;
      }
      if (direction === "right") {
        if (slotIndex < slots.length - 1) return focusNow(slots[slotIndex + 1]);
        return report.length ? focusNow(report[0]) : true;
      }
      if (direction === "down") {
        const next = rows[rowIndex + 1];
        if (next) return focusNow(next[Math.min(slotIndex, next.length - 1)]);
        return report.length ? focusNow(report[0]) : true;
      }
      if (direction === "up") {
        const previous = rows[rowIndex - 1];
        if (previous) return focusNow(previous[Math.min(slotIndex, previous.length - 1)]);
        return focusNow(filters[0]);
      }
      return true;
    }

    if (report.includes(active)) {
      if (direction === "left") {
        // 回到站点列表最后一行：落在这个行的第一个焦点位（开关），
        // 不落到「最后一个可见位」——Spider 站点的检测按钮是禁用态，容易落空。
        const last = rows[rows.length - 1];
        return last ? focusNow(last[0]) : focusNow(filters[0]);
      }
      if (direction === "right") return step(report, active, direction);
      if (direction === "up") {
        const last = rows[rows.length - 1];
        return last ? focusNow(last[0]) : focusNow(filters[0]);
      }
      if (direction === "down") return step(report, active, direction);
      return true;
    }

    return false;
  }

  function navigateSettings(direction, active) {
    const page = pages.settings;
    const back = page.querySelector(".page-back");
    const navRows = visibleItems([...page.querySelectorAll("#settingsNav .settings-nav-row")]);
    const contentItems = visibleItems([...page.querySelectorAll("#settingsPanel .focusable")]);
    const selectedNav =
      navRows.find((row) => row.classList.contains("is-selected")) ||
      navRows[0];

    if (active === back) {
      if (direction === "down") return focusNow(selectedNav);
      return true;
    }
    if (navRows.includes(active)) {
      if (direction === "up" || direction === "down") {
        const target = stepInList(navRows, active, direction);
        if (target) return focusNow(target);
        if (direction === "up" && active === navRows[0]) return focusNow(back);
        return true;
      }
      if (direction === "right") return focusNow(contentItems[0]);
      return true;
    }
    // 影视源页有自己的四段式布局（工具栏 → 筛选 → 站点列表 → 右栏操作），
    // 用几何最近邻会在「筛选」按下去直接跳到右栏，绕开真正要操作的站点行，
    // 所以这里走显式分区导航。
    if (settingsState.section === "sites" && navigateSitesPage(direction, active)) return true;
    if (contentItems.includes(active)) {
      const target = moveWithin(active, contentItems, direction);
      if (target) return focusNow(target);
      if (direction === "left" || direction === "up") return focusNow(selectedNav);
      return true;
    }
    return false;
  }

  function navigateSourceDialog(direction, active) {
    if (!sourceDialog || sourceDialog.hidden) return false;
    const items = visibleItems([
      ...sourceDialog.querySelectorAll(".focusable, input, textarea")
    ]).filter(
      (item, index, list) =>
        !item.disabled &&
        !item.closest("[hidden]") &&
        list.indexOf(item) === index
    );
    if (!items.length) return true;
    if (direction === "up" || direction === "down") {
      const index = items.indexOf(active);
      if (index >= 0) {
        const next = items[index + (direction === "down" ? 1 : -1)];
        if (next) return focusNow(next);
      }
    }
    return true;
  }

  function moveFocus(direction) {
    if (!activePageKey) return false;
    const detailScreen = document.getElementById("detailScreen");
    const searchScreen = document.getElementById("searchScreen");
    if (!detailScreen.hidden || !searchScreen.hidden) return false;

    const active = document.activeElement;
    if (sourceDialog && !sourceDialog.hidden) {
      return navigateSourceDialog(direction, active);
    }
    if (!active || !pages[activePageKey].contains(active)) return false;

    switch (activePageKey) {
      case "live": {
        const logo = pages.live.querySelector("[data-go-home]");
        const search = pages.live.querySelector(".lv-topbar [data-lv-search]");
        // 焦点在 logo 上：右/下回到顶栏搜索，其余方向按住不动，别跑到页面外
        if (logo && active === logo) {
          if (direction === "right" || direction === "down") {
            const next = search || pages.live.querySelector("[data-lv-entry]") || pages.live.querySelector(".focusable:not([data-go-home])");
            if (next) {
              focusElement(next);
              return true;
            }
          }
          return true;
        }
        // 顶栏搜索是最左一个，再往左就交给 logo
        if (logo && search && active === search && direction === "left") {
          focusElement(logo);
          return true;
        }

        const liveResult = navigateLive(direction, active);
        // 直播页的导航是"轨道制"，走到最上面就没有出口了。
        // 这里补一条：向上已经没地方可去时，把焦点交给左上角 logo（回首页）
        if (
          direction === "up" &&
          logo &&
          !active.closest(".lv-topbar") &&
          document.activeElement === active
        ) {
          focusElement(logo);
          return true;
        }
        return liveResult;
      }
      case "library":
        if (window.NovaApp?.navigate?.(direction, active)) return true;
        return navigateLibrary(direction, active);
      case "music":
        if (window.NovaPagesExtra?.navigateMusic?.(direction, active)) return true;
        return navigateMusic(direction, active);
      case "saved":
        if (window.NovaPagesExtra?.navigateSaved?.(direction, active)) return true;
        return navigateSaved(direction, active);
      case "settings":
        if (window.NovaSettingsUI?.navigate?.(direction, active)) return true;
        return navigateSettings(direction, active);
      default:
        return false;
    }
  }

  window.NovaPages = {
    open,
    close,
    goHome,
    isOpen,
    moveFocus,
    renderLive,
    renderLibrary,
    renderMusicQueue,
    renderSaved,
    renderSettings,
    // 新版片库卡片与详情页要用这两个入口
    openDetail,
    openLibraryEntry
  };

  document.addEventListener("click", (event) => {
    const home = event.target.closest("[data-go-home]");
    if (home) {
      goHome();
      return;
    }

    const back = event.target.closest("[data-page-back]");
    if (back) {
      close();
      return;
    }

    const settingsButton = event.target.closest("[data-open-settings]");
    if (settingsButton) {
      open("settings", settingsButton, {
        section: settingsButton.dataset.settingsTarget || "sources"
      });
      return;
    }

    const sourceMenuButton = event.target.closest("[data-source-menu]");
    if (sourceMenuButton) {
      const menu = settingsPanel.querySelector(".source-add-menu");
      if (menu) {
        menu.hidden = !menu.hidden;
        if (!menu.hidden) {
          menu.querySelector(".focusable")?.focus({ preventScroll: true });
        }
      }
      return;
    }

    const settingsJump = event.target.closest("[data-settings-jump]");
    if (settingsJump) {
      renderSettings(settingsJump.dataset.settingsJump);
      return;
    }

    // 点菜单外部收起
    if (!event.target.closest(".source-add-menu")) {
      const openMenu = settingsPanel.querySelector(".source-add-menu:not([hidden])");
      if (openMenu) openMenu.hidden = true;
    }

    const sourceCreate = event.target.closest("[data-source-create]");
    if (sourceCreate) {
      openSourceDialog(sourceCreate.dataset.sourceCreate);
      return;
    }

    const presetButton = event.target.closest("[data-source-preset]");
    if (presetButton) {
      addPresetSource(presetButton.dataset.sourcePreset);
      return;
    }

    const exportButton = event.target.closest("[data-source-export]");
    if (exportButton) {
      exportMergedConfig();
      return;
    }

    if (event.target.closest("[data-live-add]")) {
      addLiveSourceFromForm();
      return;
    }

    const livePreset = event.target.closest("[data-live-preset]");
    if (livePreset) {
      const preset = LIVE_SOURCE_PRESETS.find((item) => item.id === livePreset.dataset.livePreset);
      if (preset) {
        try {
          window.NovaSources.addLiveSource({ name: preset.name, url: preset.url });
          renderSettings("lives");
          showToast(`已添加：${preset.name}`);
        } catch (error) {
          showToast(error.message || "添加失败");
        }
      }
      return;
    }

    const liveToggle = event.target.closest("[data-live-toggle]");
    if (liveToggle) {
      toggleLiveSource(liveToggle.dataset.liveToggle);
      return;
    }

    const liveRemove = event.target.closest("[data-live-remove]");
    if (liveRemove) {
      removeLiveSourceRow(liveRemove.dataset.liveRemove);
      return;
    }

    const liveTest = event.target.closest("[data-live-test]");
    if (liveTest) {
      testLiveSourceRow(liveTest.dataset.liveTest);
      return;
    }

    const parseAdd = event.target.closest("[data-parse-add]");
    if (parseAdd) {
      addParseFromForm();
      return;
    }

    const parseRemove = event.target.closest("[data-parse-remove]");
    if (parseRemove) {
      const removed = window.NovaSources.removeParse(parseRemove.dataset.parseRemove);
      renderSettings("sources");
      showToast(removed ? "解析接口已删除" : "只能删除手工登记的解析接口");
      return;
    }

    const sourceFile = event.target.closest("[data-source-file]");
    if (sourceFile) {
      ensureSourceFileInput().click();
      return;
    }

    const sourceRestore = event.target.closest("[data-source-restore-demo]");
    if (sourceRestore) {
      const source = window.NovaSources.restoreDemo();
      sourceManagerState.selectedId = source.id;
      renderSettings("sources");
      window.requestAnimationFrame(() => {
        focusElement(
          settingsPanel.querySelector(
            `[data-source-select="${CSS.escape(source.id)}"]`
          )
        );
      });
      showToast("内置演示源已恢复");
      return;
    }

    const sourceSelect = event.target.closest("[data-source-select]");
    if (sourceSelect) {
      sourceManagerState.selectedId = sourceSelect.dataset.sourceSelect;
      renderSettings("sources");
      window.requestAnimationFrame(() => {
        focusElement(
          settingsPanel.querySelector(
            `[data-source-select="${CSS.escape(sourceManagerState.selectedId)}"]`
          )
        );
      });
      return;
    }

    const sourceAction = event.target.closest("[data-source-action]");
    if (sourceAction) {
      runSourceAction(
        sourceAction.dataset.sourceAction,
        sourceAction.dataset.sourceId
      );
      return;
    }

    const liveGroup = event.target.closest("[data-live-group]");
    if (liveGroup) {
      liveState.group = liveGroup.dataset.liveGroup;
      renderLive();
      window.requestAnimationFrame(() => {
        focusElement(
          liveFilterRow.querySelector(
            `[data-live-group="${CSS.escape(liveState.group)}"]`
          )
        );
      });
      return;
    }

    const liveCard = event.target.closest("[data-live-key]");
    if (liveCard) {
      const channel = liveChannels.find((entry) => entry.key === liveCard.dataset.liveKey);
      if (channel) updateLivePreview(channel);
      return;
    }

    const category = event.target.closest("[data-library-category]");
    if (category) {
      renderLibrary(category.dataset.libraryCategory);
      window.requestAnimationFrame(() => {
        focusElement(
          libraryCategoryList.querySelector(
            `[data-library-category="${CSS.escape(libraryState.category)}"]`
          )
        );
      });
      return;
    }

    const libraryCard = event.target.closest("[data-library-key]");
    if (libraryCard) {
      openLibraryEntry(getLibraryItem(libraryCard.dataset.libraryKey));
      return;
    }

    const musicItem = event.target.closest("[data-music-index]");
    if (musicItem) {
      playMusicTrack(Number(musicItem.dataset.musicIndex));
      return;
    }

    const radioItem = event.target.closest("[data-radio-index]");
    if (radioItem) {
      playRadio(Number(radioItem.dataset.radioIndex));
      return;
    }

    if (event.target.closest("[data-music-search]")) {
      openMusicSearch();
      return;
    }

    const searchTrack = event.target.closest("[data-search-track]");
    if (searchTrack) {
      playSearchTrack(musicSearchResults[Number(searchTrack.dataset.searchTrack)]);
      return;
    }

    if (event.target.closest("[data-music-full]")) {
      if (isMusicSearchOpen()) {
        closeMusicSearch();
        return;
      }
      openMusicScreen();
      return;
    }

    if (event.target.closest("[data-ms-prev]")) {
      musicStep(-1);
      return;
    }

    if (event.target.closest("[data-ms-next]")) {
      musicStep(1);
      return;
    }

    if (event.target.closest("[data-ms-toggle]")) {
      toggleMusicPlayback();
      return;
    }

    if (event.target.closest("[data-ms-mode]")) {
      cyclePlayMode();
      return;
    }

    if (event.target.closest("[data-ms-mute]")) {
      toggleMusicMute();
      return;
    }

    if (event.target.closest("[data-ms-fav]")) {
      toggleMusicFavorite();
      return;
    }

    const lyricLine = event.target.closest(".ms-lyric-line");
    if (lyricLine && lyricLine.dataset.lyricTime) {
      seekToLyric(Number(lyricLine.dataset.lyricIndex));
      return;
    }

    const msItem = event.target.closest("[data-ms-index]");
    if (msItem) {
      const index = Number(msItem.dataset.msIndex);
      if (musicState.mode === "radio") playRadio(index);
      else playMusicTrack(index);
      return;
    }

    const savedTab = event.target.closest("[data-saved-tab]");
    if (savedTab) {
      renderSaved(savedTab.dataset.savedTab);
      focusElement(savedGrid.querySelector(".saved-card"));
      return;
    }

    const savedCard = event.target.closest("[data-saved-key]");
    if (savedCard) {
      const key = savedCard.dataset.savedKey;
      const payload = savedPayloads.get(key) || getLibraryItem(key);
      if (!payload) return;
      // 观看历史：有可播地址就直接续播，否则进详情
      const record = payload.record;
      const stream = record ? window.NovaPlayer?.rawUrl?.(record.url) || record.url : "";
      if (record && stream && typeof window.NovaPlayer?.open === "function") {
        window.NovaPlayer.open({
          title: record.title,
          kind: "剧集",
          meta: record.episode || "继续观看",
          url: stream,
          key: record.key,
          image: record.image,
          episode: record.episode,
          startAt: record.t
        });
        return;
      }
      openDetail(payload);
      return;
    }

    const savedFilter = event.target.closest("[data-saved-filter]");
    if (savedFilter) {
      savedState.filter = savedFilter.dataset.savedFilter;
      const tabNow = savedState.tab;
      renderSaved(tabNow);
      // chip 是重渲染出来的，得重新取节点
      focusElement(document.querySelector(`#savedChips [data-saved-filter="${savedState.filter}"]`));
      return;
    }

    const siteToggle = event.target.closest("[data-site-toggle]");
    if (siteToggle) {
      const key = siteToggle.dataset.siteToggle;
      const site = window.NovaSources?.listSites?.().find((entry) => entry.key === key);
      if (site) {
        window.NovaSources.setSiteEnabled(key, !site.enabled);
        siteManagerState.selectedKey = key;
        paintSiteRows({ focusSelector: `[data-site-toggle="${cssEscape(key)}"]` });
        showToast(`${site.name}：已${site.enabled ? "停用" : "启用"}`);
      }
      return;
    }

    const siteTest = event.target.closest("[data-site-test]");
    if (siteTest) {
      runSiteTest(siteTest.dataset.siteTest);
      return;
    }

    const siteSelect = event.target.closest("[data-site-select]");
    if (siteSelect) {
      siteManagerState.selectedKey = siteSelect.dataset.siteSelect;
      paintSiteRows({ focusSelector: `[data-site-select="${cssEscape(siteManagerState.selectedKey)}"]` });
      return;
    }

    const siteMove = event.target.closest("[data-site-move]");
    if (siteMove) {
      const key = siteMove.dataset.siteKey;
      const moved = window.NovaSources.moveSite(key, siteMove.dataset.siteMove === "up" ? -1 : 1);
      paintSiteRows({ focusSelector: `[data-site-move="${siteMove.dataset.siteMove}"][data-site-key="${cssEscape(key)}"]` });
      showToast(moved ? "顺序已调整" : "已经到头了");
      return;
    }

    const siteClear = event.target.closest("[data-site-clear]");
    if (siteClear) {
      const key = siteClear.dataset.siteClear;
      window.NovaSiteOverrides?.remove(key);
      window.NovaSources.touchSites("site-clear");
      paintSiteRows();
      showToast("该站点的自定义设置已清除");
      return;
    }

    const siteType = event.target.closest("[data-site-type]");
    if (siteType) {
      siteManagerState.typeFilter = siteType.dataset.siteType;
      renderSettings("sites");
      window.requestAnimationFrame(() => {
        focusElement(
          settingsPanel.querySelector(`[data-site-type="${cssEscape(siteManagerState.typeFilter)}"]`)
        );
      });
      return;
    }

    const siteOnly = event.target.closest("[data-site-only-enabled]");
    if (siteOnly) {
      siteManagerState.onlyEnabled = !siteManagerState.onlyEnabled;
      renderSettings("sites");
      window.requestAnimationFrame(() => {
        focusElement(settingsPanel.querySelector("[data-site-only-enabled]"));
      });
      return;
    }

    const siteBulk = event.target.closest("[data-site-bulk]");
    if (siteBulk) {
      runSiteBulk(siteBulk.dataset.siteBulk);
      return;
    }

    const diagnosticsButton = event.target.closest("[data-sites-diagnostics]");
    if (diagnosticsButton) {
      exportDiagnostics();
      return;
    }

    const settingsSection = event.target.closest("[data-settings-section]");
    if (settingsSection) {
      renderSettings(settingsSection.dataset.settingsSection);
      return;
    }

    const settingsToggle = event.target.closest("[data-setting-toggle]");
    if (settingsToggle) {
      const [section, indexText] = settingsToggle.dataset.settingToggle.split(":");
      const settingsApi = window.NovaSettings;
      if (section === "general" && indexText === "commentary") {
        const next = !(settingsApi?.get().filterCommentary ?? true);
        settingsApi?.patch({ filterCommentary: next });
        showToast(`解说过滤：${next ? "已开启" : "已关闭"}`);
        renderSettings("general");
        window.requestAnimationFrame(() => {
          focusElement(settingsPanel.querySelector('[data-setting-toggle="general:commentary"]'));
        });
        return;
      }
      const row = settingsState.toggles[section]?.[Number(indexText)];
      if (!row) return;
      const live = settingsApi ? settingsApi.get() : {};
      const next = !(typeof live[row.key] === "boolean" ? live[row.key] : row.value);
      settingsApi?.patch({ [row.key]: next });
      row.value = next;
      settingsToggle.classList.toggle("is-on", next);
      showToast(`${row.label}：${next ? "已开启" : "已关闭"}`);
      return;
    }

    const settingsReset = event.target.closest("[data-settings-reset]");
    if (settingsReset) {
      window.NovaSettings?.reset();
      renderSettings("general");
      window.requestAnimationFrame(() => {
        focusElement(settingsPanel.querySelector("[data-settings-reset]"));
      });
      showToast("设置已恢复默认");
      return;
    }

    const settingsChoice = event.target.closest("[data-setting-choice]");
    if (settingsChoice) {
      const [section, option] = settingsChoice.dataset.settingChoice.split(":");
      const settingsApi = window.NovaSettings;
      const presets = settingsApi?.PRESETS?.[section];
      if (presets) {
        const preset = presets.find((entry) => entry.id === option);
        if (preset) {
          settingsApi.patch(preset.patch);
          renderSettings("general");
          window.requestAnimationFrame(() => {
            focusElement(
              settingsPanel.querySelector(`[data-setting-choice="${section}:${option}"]`)
            );
          });
          showToast(`已切换：${preset.label} · ${preset.detail}`);
          return;
        }
      }
      settingsState.choices[section] = option;
      settingsChoice.closest(".settings-choice-row")?.querySelectorAll(".settings-choice").forEach((button) => {
        button.classList.toggle(
          "is-selected",
          button.dataset.settingChoice === `${section}:${option}`
        );
      });
      const headingBadge = settingsChoice
        .closest(".settings-section-card")
        ?.querySelector(".settings-section-title span");
      if (headingBadge) headingBadge.textContent = option;
      showToast(`已选择：${option}`);
      return;
    }

    const savedAction = event.target.closest("[data-saved-action]");
    if (savedAction) {
      const action = savedAction.dataset.savedAction;
      if (action === "clear") {
        const box = document.getElementById("savedConfirm");
        const text = document.getElementById("savedConfirmText");
        if (text) {
          text.textContent = savedState.tab === "history" ? "确定清空全部观看记录？" : "确定清空我的收藏？";
        }
        if (box) {
          box.hidden = false;
          focusElement(box.querySelector("[data-saved-action='confirm-clear']"));
        }
        return;
      }
      if (action === "confirm-clear") {
        const box = document.getElementById("savedConfirm");
        if (box) box.hidden = true;
        if (savedState.tab === "history") clearHistory();
        else clearFavorites();
        return;
      }
      if (action === "cancel-clear") {
        const box = document.getElementById("savedConfirm");
        if (box) box.hidden = true;
        focusElement(document.querySelector('[data-saved-action="clear"]'));
        return;
      }
      if (action === "undo") {
        undoLastDelete();
        return;
      }
      if (action === "export-list") {
        exportSaved();
        return;
      }
    }
  });

  settingsPanel.addEventListener("input", (event) => {
    const input = event.target.closest?.("[data-site-search]");
    if (!input) return;
    siteManagerState.query = input.value;
    paintSiteRows();
  });

  // 搜索框 / 解析登记框里的按键不能被全局电视焦点逻辑吃掉：
  // 否则打不出空格，Enter 还会误点当前焦点按钮
  settingsPanel.addEventListener(
    "keydown",
    (event) => {
      const field = event.target.closest?.("[data-site-search], [data-parse-field]");
      if (!field) return;
      if (event.key === "Escape") {
        if (field.matches("[data-site-search]")) {
          field.value = "";
          siteManagerState.query = "";
          paintSiteRows({ focusSelector: ".site-row-main" });
        } else {
          field.blur();
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === "Enter" && field.matches("[data-parse-field]")) {
        event.preventDefault();
        event.stopPropagation();
        addParseFromForm();
        return;
      }
      if (["Enter", " ", "Spacebar", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.stopPropagation();
      }
    },
    true
  );

  livePlayButton.addEventListener("click", () => {
    const channel = liveChannels.find((entry) => entry.key === liveState.selectedKey);
    if (!channel?.stream) {
      showToast("当前频道暂无可用播放地址");
      return;
    }
    window.NovaPlayer?.open({
      title: channel.name,
      kind: "LIVE",
      meta: `${channel.group} · ${channel.sourceName || "标准直播源"}`,
      source: channel.sourceName || channel.source || "TVBox 直播源",
      url: channel.stream,
      isLive: true
    });
  });

  libraryHeroPlay.addEventListener("click", () => {
    openLibraryEntry(getLibraryItem(libraryState.heroKey));
  });

  libraryHeroFavorite.addEventListener("click", () => {
    const item = getLibraryItem(libraryState.heroKey);
    showToast(item ? `${item.title} · 已加入收藏` : "当前分类暂无收藏内容");
  });

  musicToggle.addEventListener("click", toggleMusicPlayback);
  musicPrev.addEventListener("click", () => {
    if (musicState.mode === "track" && musicAudio.currentTime > 3) {
      musicAudio.currentTime = 0;
      updateMusicUI();
      return;
    }
    musicStep(-1);
  });
  musicNext.addEventListener("click", () => musicStep(1));

  // 进度条：点哪儿跳哪儿（遥控器聚焦后用 ←/→ 微调）
  const musicProgressBar = document.getElementById("musicProgress");
  musicProgressBar?.addEventListener("click", (event) => {
    if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) return;
    const rect = musicProgressBar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seekMusicTo(ratio * musicAudio.duration);
  });

  // 队列长按 OK 移除（本地曲目，至少留一首）
  let musicQueueHoldTimer = 0;
  let musicQueueHoldFired = false;
  musicQueue.addEventListener("keydown", (event) => {
    const item = event.target.closest?.("[data-music-index]");
    if (!item) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.repeat) return;
    musicQueueHoldFired = false;
    clearTimeout(musicQueueHoldTimer);
    musicQueueHoldTimer = window.setTimeout(() => {
      musicQueueHoldFired = true;
      removeMusicTrack(Number(item.dataset.musicIndex));
    }, 650);
  });
  musicQueue.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    clearTimeout(musicQueueHoldTimer);
    if (musicQueueHoldFired) {
      event.preventDefault();
      event.stopPropagation();
      musicQueueHoldFired = false;
    }
  }, true);

  let musicStoreTick = 0;
  musicAudio.addEventListener("timeupdate", () => {
    updateMusicUI();
    musicStoreTick += 1;
    if (musicStoreTick % 8 === 0) musicStoreWrite();
  });
  musicAudio.addEventListener("loadedmetadata", updateMusicUI);
  musicAudio.addEventListener("waiting", () => {
    if (isMusicScreenOpen()) setMsStatus("buffering", "缓冲中…");
  });
  musicAudio.addEventListener("canplay", () => {
    if (isMusicScreenOpen() && !musicAudio.paused) setMsStatus("playing", "播放中");
  });
  musicAudio.addEventListener("stalled", () => {
    if (isMusicScreenOpen()) setMsStatus("buffering", "缓冲中…");
  });
  musicAudio.addEventListener("play", () => {
    if (musicState.mode === "radio" && musicState.radioIndex >= 0) {
      setRadioState(musicState.radioIndex, "播放中");
    }
    if (isMusicScreenOpen()) {
      setMsStatus("playing", "播放中");
      startSpectrum();
    }
    updateMusicUI();
    musicStoreWrite();
  });
  musicAudio.addEventListener("pause", () => {
    if (isMusicScreenOpen()) {
      setMsStatus("paused", "已暂停");
      stopSpectrum();
    }
    updateMusicUI();
    musicStoreWrite();
  });
  musicAudio.addEventListener("error", () => {
    if (musicState.mode !== "radio" || musicState.radioIndex < 0) {
      updateMusicUI();
      return;
    }
    // 只走本地代理：频谱用 WebAudio 接了 analyser，跨域直连会被静音
    setRadioState(musicState.radioIndex, "线路不可用", true);
    if (isMusicScreenOpen()) setMsStatus("error", "线路失效");
    updateMusicUI();
  });
  musicAudio.addEventListener("ended", () => {
    if (musicState.mode === "radio") return;
    if (musicState.playMode === "one") {
      musicAudio.currentTime = 0;
      musicAudio.play().catch(() => {});
      return;
    }
    musicStep(1);
  });

  /* ---- 音乐搜索面板：输入框回车搜索，返回键关闭 ---- */

  const musicSearchInput = document.getElementById("musicSearchInput");
  musicSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      runMusicSearch();
    }
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isMusicSearchOpen()) return;
      const key = event.key;
      if (key === "Backspace" || key === "GoBack" || key === "Escape" || key === "Esc" || key === "BrowserBack") {
        event.preventDefault();
        event.stopPropagation();
        closeMusicSearch();
        return;
      }
      if (key === "ArrowDown" || key === "ArrowUp") {
        const items = [...document.querySelectorAll("#musicSearchList .music-search-item")];
        if (!items.length) return;
        event.preventDefault();
        event.stopPropagation();
        const current = document.activeElement;
        const index = items.indexOf(current);
        const next = items[Math.min(items.length - 1, Math.max(0, (index < 0 ? -1 : index) + (key === "ArrowDown" ? 1 : -1)))] || items[0];
        focusElement(next);
      }
    },
    true
  );
  bindMediaSession();

  /* ---- 全屏音乐屏：键盘接管（capture 阶段，先于 app.js 的空间导航） ---- */

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isMusicScreenOpen()) return;
      const screen = document.getElementById("musicScreen");
      const key = event.key;

      if (key === "Backspace" || key === "GoBack" || key === "Escape" || key === "Esc" || key === "BrowserBack") {
        event.preventDefault();
        event.stopPropagation();
        closeMusicScreen();
        return;
      }
      if (!/^Arrow|^Enter$|^ $/.test(key)) return;
      event.preventDefault();
      event.stopPropagation();
      wakeMusicScreen();

      const active = document.activeElement;
      const progress = screen.querySelector("#msProgress");
      const toggle = screen.querySelector("[data-ms-toggle]");

      // 歌词模式：↑/↓ 选句，OK 跳到该句，←/→ 退出
      if (msLyricMode) {
        if (key === "ArrowUp" || key === "ArrowDown") {
          moveLyricFocus(key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (key === "ArrowLeft" || key === "ArrowRight") {
          setLyricMode(false);
          return;
        }
        if (key === "Enter" || key === " ") {
          seekToLyric(lyricFocus);
          return;
        }
        return;
      }

      // 播放模式：←/→ 切歌；进度模式：←/→ ±5 秒（带目标时间气泡）
      if (key === "ArrowLeft" || key === "ArrowRight") {
        if (msProgressMode) {
          const delta = key === "ArrowLeft" ? -5 : 5;
          seekMusicBy(delta);
          showSeekTip(delta);
          return;
        }
        musicStep(key === "ArrowLeft" ? -1 : 1);
        return;
      }
      // 进度模式下 ↑/↓ 调音量；否则 ↓ 进进度、↑ 进歌词
      if (key === "ArrowDown" || key === "ArrowUp") {
        const wantProgress = key === "ArrowDown";
        if (msProgressMode) {
          changeVolume(key === "ArrowUp" ? 0.1 : -0.1);
          return;
        }
        if (wantProgress) {
          msProgressMode = true;
          if (progress) focusElement(progress);
          return;
        }
        if (msLyricMode) {
          setLyricMode(false);
          return;
        }
        if (lyricLines.length) setLyricMode(true);
        return;
      }
      if (key === "Enter" || key === " ") {
        if (!document.getElementById("msError")?.hidden) {
          musicStep(1);
          return;
        }
        if (msProgressMode) {
          msProgressMode = false;
          if (toggle) focusElement(toggle);
          return;
        }
        if (active && active.matches("button")) active.click();
        else toggleMusicPlayback();
      }
    },
    true
  );

  document.getElementById("msProgress")?.addEventListener("click", (event) => {
    if (!Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) return;
    const bar = event.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seekMusicTo(ratio * musicAudio.duration);
  });

  renderLive();
  renderLibrary();
  renderMusicQueue();
  renderMusicRadio();
  restoreMusicState();
  updateMusicUI();
  renderSaved();
  renderSettings();

})();

/* ---- 音乐源状态卡片：注入到「音乐设置」面板（2026-11-19） ---- */
(function () {
  "use strict";
  if (typeof document === "undefined") return;

  function buildCard() {
    const status = window.NovaMusicSources?.status?.() || { providers: [], aggregator: "" };
    const rows = (status.providers || [])
      .map((p) => {
        const ok = p.ok ? "在线" : "异常";
        return `<div class="music-source-row"><span class="music-source-dot${p.ok ? " is-ok" : ""}"></span><strong>${p.provider}</strong><em>${ok}</em><span class="music-source-note">${p.note || ""}</span></div>`;
      })
      .join("");
    return `
      <div class="settings-section-card music-source-card">
        <div class="settings-section-title">
          <h3>音乐源</h3>
          <span>${status.providers?.length || 0} 个源</span>
        </div>
        <p>曲库与搜索走聚合 API，电台走 Radio Browser。换自建聚合地址后立即生效。</p>
        <div class="music-source-list">${rows || '<div class="music-source-row"><em>暂无源状态</em></div>'}</div>
        <div class="music-source-url">
          <span>聚合地址</span>
          <input type="text" id="musicAggregatorInput" value="${status.aggregator || ""}" spellcheck="false" />
          <button class="settings-choice focusable" type="button" id="musicAggregatorSave">保存</button>
        </div>
      </div>`;
  }

  function inject() {
    const panel = document.getElementById("settingsPanel");
    if (!panel) return;
    const head = panel.querySelector(".settings-panel-head h2")?.textContent?.trim();
    if (head !== "音乐设置") return;
    if (panel.querySelector(".music-source-card")) return;
    panel.insertAdjacentHTML("beforeend", buildCard());
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#musicAggregatorSave")) return;
    const input = document.getElementById("musicAggregatorInput");
    const value = (input?.value || "").trim();
    if (!value) return;
    window.NovaMusicSources?.setAggregatorBase?.(value);
    window.NovaToast?.("聚合地址已保存");
  });

  const observer = new MutationObserver(() => inject());
  const start = () => {
    const panel = document.getElementById("settingsPanel");
    if (!panel) return;
    observer.observe(panel, { childList: true, subtree: false });
    inject();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else window.setTimeout(start, 1200);
})();
