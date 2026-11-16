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

  const fallbackLibraryItems = [
    {
      key: "dune",
      title: "沙丘 II",
      type: "电影",
      meta: "2024 · 科幻 / 冒险 · 2小时46分",
      image: "./assets/images/dune.jpg",
      description: "保罗·厄崔迪与契妮和弗雷曼人并肩作战，在复仇与预言之间寻找自己的道路。"
    },
    {
      key: "interstellar",
      title: "星际穿越",
      type: "电影",
      meta: "2014 · 科幻 / 冒险 · 2小时49分",
      image: "./assets/images/interstellar.jpg",
      description: "宇航员库珀穿过虫洞寻找人类新家园。时间、引力与亲情在星际之间彼此牵引。"
    },
    {
      key: "joker",
      title: "小丑",
      type: "电影",
      meta: "2019 · 剧情 / 犯罪 · 2小时02分",
      image: "./assets/images/joker.jpg",
      description: "在冷漠而失衡的城市里，一个被忽视的喜剧演员逐渐走向崩溃，也走向聚光灯中央。"
    },
    {
      key: "peaky",
      title: "浴血黑帮 第6季",
      type: "剧集",
      meta: "2022 · 犯罪 / 剧情 · 第6季",
      image: "./assets/images/peaky.jpg",
      description: "汤米·谢尔比在时代剧变中继续守住家族与生意，旧日敌友也逐一回到伯明翰。"
    },
    {
      key: "totoro",
      title: "龙猫",
      type: "动画电影",
      meta: "1988 · 动画 / 奇幻 · 1小时26分",
      image: "./assets/images/totoro.jpg",
      description: "小月和小梅在乡间遇见森林守护者龙猫，一段温柔而奇妙的夏日冒险由此展开。"
    },
    {
      key: "lostyou",
      title: "长相思",
      type: "剧集",
      meta: "2023 · 古装 / 爱情 · 全39集",
      image: "./assets/images/lostyou.jpg",
      description: "小夭在漫长岁月中辗转流离，与故人重逢，也被卷入家国、身份与选择的漩涡。"
    },
    {
      key: "avengers",
      title: "复仇者联盟4：终局之战",
      type: "电影",
      meta: "2019 · 动作 / 科幻 · 3小时01分",
      image: "./assets/images/avengers.jpg",
      description: "幸存的英雄们再次集结，穿越时间与失去，为宇宙争取最后一次逆转机会。"
    },
    {
      key: "yourname",
      title: "你的名字。",
      type: "动画电影",
      meta: "2016 · 动画 / 爱情 · 1小时46分",
      image: "./assets/images/yourname.jpg",
      description: "两个陌生少年在梦中交换身体，并在时间与距离之间寻找彼此。"
    }
  ];

  const fallbackLiveChannels = [
    { key: "cctv1", name: "CCTV-1 综合", group: "央视", tone: "coral", image: "./assets/images/avengers.jpg" },
    { key: "cctv5", name: "CCTV-5 体育", group: "央视", tone: "violet", image: "./assets/images/dune.jpg" },
    { key: "cctv6", name: "CCTV-6 电影", group: "央视", tone: "mint", image: "./assets/images/interstellar.jpg" },
    { key: "cctv13", name: "CCTV-13 新闻", group: "央视", tone: "gold", image: "./assets/images/joker.jpg" },
    { key: "hunan", name: "湖南卫视", group: "卫视", tone: "violet", image: "./assets/images/lostyou.jpg" },
    { key: "dragon", name: "东方卫视", group: "卫视", tone: "coral", image: "./assets/images/yourname.jpg" },
    { key: "zhejiang", name: "浙江卫视", group: "卫视", tone: "mint", image: "./assets/images/totoro.jpg" },
    { key: "jiangsu", name: "江苏卫视", group: "卫视", tone: "gold", image: "./assets/images/peaky.jpg" },
    { key: "anqing", name: "安庆新闻综合", group: "地方", tone: "coral", image: "./assets/images/interstellar.jpg" },
    { key: "ahpublic", name: "安徽公共", group: "地方", tone: "violet", image: "./assets/images/dune.jpg" },
    { key: "music-live", name: "音乐现场", group: "音乐", tone: "mint", image: "./assets/images/yourname.jpg" },
    { key: "concert", name: "经典演唱会", group: "音乐", tone: "gold", image: "./assets/images/joker.jpg" }
  ];

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

  const musicQueueData = [
    {
      title: "夜航星 · NOVA Session",
      artist: "NOVA TV · 本地原创合成试听音轨",
      duration: "00:24",
      image: "./assets/images/yourname.jpg",
      audio: "./assets/audio/nova_demo_ambient.wav"
    },
    {
      title: "晨雾电台",
      artist: "NOVA TV · 晨间环境音乐",
      duration: "00:24",
      image: "./assets/images/interstellar.jpg",
      audio: "./assets/audio/nova_morning_mist.wav"
    },
    {
      title: "蓝色时刻",
      artist: "NOVA TV · 深夜蓝调",
      duration: "00:24",
      image: "./assets/images/dune.jpg",
      audio: "./assets/audio/nova_blue_hour.wav"
    },
    {
      title: "雨夜歌单",
      artist: "NOVA TV · 雨声氛围选段",
      duration: "00:24",
      image: "./assets/images/peaky.jpg",
      audio: "./assets/audio/nova_rainy_night.wav"
    }
  ];

  const settingsState = {
    section: "sources",
    choices: {
      playback: "自动",
      music: "高品质",
      appearance: "跟随系统"
    },
    toggles: {
      browsing: [
        { label: "首页显示最近观看", value: true },
        { label: "首页显示热门内容", value: true },
        { label: "跨源聚合搜索结果", value: true },
        { label: "启动时刷新订阅源", value: false }
      ],
      playback: [
        { label: "优先硬件解码", value: true },
        { label: "播放失败自动切换线路", value: true },
        { label: "记录续播位置", value: true },
        { label: "跳过片头片尾", value: false }
      ],
      music: [
        { label: "允许后台播放", value: true },
        { label: "音乐继续播放时进入首页", value: true },
        { label: "连接耳机时自动降低音量", value: true },
        { label: "优先无损音质", value: false }
      ],
      appearance: [
        { label: "显示焦点白色描边", value: true },
        { label: "启用流体背景缓慢动画", value: true },
        { label: "保持 16:9 安全边距", value: true },
        { label: "使用高对比度字幕", value: false }
      ]
    }
  };

  const sourceManagerState = {
    selectedId: window.NovaSources?.demoSourceId || ""
  };

  const liveState = {
    group: "全部",
    selectedKey: liveChannels[0].key
  };

  const libraryState = {
    category: "全部",
    heroKey: libraryItems[0].key
  };

  const musicState = {
    currentIndex: 0
  };

  const savedState = {
    tab: "history"
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
        window.NovaRefreshDetail(detail);
      } else {
        openDetail(detail);
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
      title = "当前显示内置演示片库";
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
          : "启用影视源暂未返回内容，当前继续展示内置演示数据。";
        badge = "演示回退";
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
          librarySourceChecks = Array.isArray(result.stats) ? result.stats : [];
          libraryDataState = "sources";
          libraryDataError = "";
        }
      } catch (error) {
        libraryItems = fallbackLibraryItems.slice();
        librarySourceCount = 0;
        librarySiteCount = 0;
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
    libraryGridCount.textContent = `${filtered.length} 部内容`;
    libraryHeaderCount.textContent =
      libraryDataState === "loading"
        ? "正在聚合启用站点"
        : libraryDataState === "sources"
          ? `${libraryItems.length} 部 · ${librarySourceCount} 个来源`
          : scriptSiteCount
            ? `演示回退 · ${scriptSiteCount} 个需 Spider`
            : "演示回退 · 影视源不可用";

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
    musicQueue.innerHTML = musicQueueData
      .map(
        (track, index) => `
          <button
            class="music-queue-item focusable${index === musicState.currentIndex ? " is-active" : ""}"
            type="button"
            data-music-index="${index}"
          >
            <span class="music-queue-cover"><img src="${track.image}" alt="" /></span>
            <span class="music-queue-copy">
              <strong>${track.title}</strong>
              <span>${track.artist}</span>
            </span>
            <span class="music-queue-duration">${track.duration}</span>
          </button>
        `
      )
      .join("");
  }

  function syncMusicQueueSelection() {
    musicQueue.querySelectorAll("[data-music-index]").forEach((item) => {
      item.classList.toggle(
        "is-active",
        Number(item.dataset.musicIndex) === musicState.currentIndex
      );
    });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const safe = Math.floor(seconds);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function updateMusicUI() {
    const track = musicQueueData[musicState.currentIndex];
    const playing = !musicAudio.paused;
    const duration = Number.isFinite(musicAudio.duration) ? musicAudio.duration : 24;
    const progress = duration > 0 ? Math.min(1, musicAudio.currentTime / duration) : 0;

    musicTrackTitle.textContent = track.title;
    musicTrackArtist.textContent = track.artist;
    musicCurrentTime.textContent = formatTime(musicAudio.currentTime);
    musicDuration.textContent = formatTime(duration);
    musicProgressFill.style.width = `${progress * 100}%`;
    musicStateLabel.textContent = playing ? "正在播放" : "已暂停";
    musicToggle.innerHTML = icon(playing ? "i-pause" : "i-play");
    musicToggle.setAttribute("aria-label", playing ? "暂停" : "播放");
    pages.music.classList.toggle("is-playing", playing);
    syncMusicQueueSelection();
  }

  async function playMusicTrack(index, options = {}) {
    musicState.currentIndex = (index + musicQueueData.length) % musicQueueData.length;
    const track = musicQueueData[musicState.currentIndex];
    const sourceChanged = musicAudio.getAttribute("src") !== track.audio;
    if (sourceChanged) {
      musicAudio.src = track.audio;
      musicAudio.load();
    } else if (options.restart !== false) {
      musicAudio.currentTime = 0;
    }
    updateMusicUI();

    if (options.autoplay === false) return;
    try {
      await musicAudio.play();
      updateMusicUI();
      showToast(`正在试听 · ${track.title}`);
    } catch (error) {
      updateMusicUI();
      showToast("浏览器阻止了自动播放，请按 Enter 开始试听");
    }
  }

  async function toggleMusicPlayback() {
    if (musicAudio.paused) {
      if (musicAudio.ended || musicAudio.currentTime >= (musicAudio.duration || 24) - 0.2) {
        musicAudio.currentTime = 0;
      }
      try {
        await musicAudio.play();
      } catch (error) {
        showToast("当前浏览器无法播放这段试听音轨");
      }
    } else {
      musicAudio.pause();
    }
  }

  function renderSaved(tab = savedState.tab) {
    savedState.tab = tab;
    const items = tab === "history" ? historyItems : favoriteItems;
    const isHistory = tab === "history";

    document.querySelectorAll("[data-saved-tab]").forEach((button) => {
      const selected = button.dataset.savedTab === tab;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", String(selected));
    });

    savedPanelTitle.textContent = isHistory ? "观看历史" : "我的收藏";
    savedPanelSubtitle.textContent = isHistory
      ? "按最近播放时间排序 · 本机演示数据"
      : "跨片源统一收藏 · 本机演示数据";
    savedItemCount.textContent = `${items.length} 项`;

    savedGrid.innerHTML = items
      .map((entry) => {
        const item = getLibraryItem(entry.key);
        if (!item) return "";
        return `
          <button class="saved-card focusable" type="button" data-saved-key="${item.key}">
            <img src="${item.image}" alt="" />
            <span class="saved-card-shade"></span>
            <span class="content-type-pill">${item.type}</span>
            <span class="saved-card-copy">
              <strong>${item.title}</strong>
              <span>${item.meta}</span>
              ${
                isHistory
                  ? `<span class="saved-progress-row"><i style="--saved-progress:${entry.progress}%"></i><em>${entry.label}</em></span>`
                  : `<span class="saved-progress-row"><em>${entry.note}</em></span>`
              }
            </span>
          </button>
        `;
      })
      .join("");
  }

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
        icon: "i-source"
      },
      {
        label: "可执行站点",
        value: aggregate.stats.supportedSites,
        icon: "i-database"
      },
      {
        label: "直播源",
        value: aggregate.stats.liveSources,
        icon: "i-tv"
      },
      {
        label: "解析接口",
        value: aggregate.stats.parses,
        icon: "i-list"
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
              <span class="source-select-title-row">
                <strong>${escapeHtml(source.name)}</strong>
                <span class="source-mini-pill">${escapeHtml(report.format || "TVBox")}</span>
              </span>
              <span class="source-select-url">${escapeHtml(source.url || (source.kind === "demo" ? "内置演示配置" : "本地文件"))}</span>
            </span>
            <span class="source-select-badges">
              <span class="source-state-pill ${state.className}"><i></i>${state.text}</span>
              <span class="source-type-pill">${(report.cmsSites || 0) + (report.htmlSites || 0) + (report.adaptedSites || 0)} 可执行 · ${report.liveSources || 0} 直播</span>
            </span>
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

    return `
      <div class="settings-source-manager">
        ${settingsHeader(
          "内容源管理",
          "TVBox A/B 方言 · 苹果 CMS 片库 · M3U / TXT 直播",
          "本地持久化 · 敏感 Header 脱敏"
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
            <button class="source-toolbar-button focusable" type="button" data-source-create="remote">
              ${icon("i-link")}<span>远程订阅</span>
            </button>
            <button class="source-toolbar-button focusable" type="button" data-source-create="paste">
              ${icon("i-upload")}<span>粘贴 JSON</span>
            </button>
            <button class="source-toolbar-button focusable" type="button" data-source-file>
              ${icon("i-file")}<span>本地文件</span>
            </button>
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
          source = await window.NovaSources.addRemote(url, { name });
          if (source?.error) throw new Error(source.error);
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
        .map(
          (row, index) => `
            <button
              class="setting-toggle-row focusable${row.value ? " is-on" : ""}"
              type="button"
              data-setting-toggle="${section}:${index}"
            >
              <span class="toggle-label">${row.label}</span>
              <span class="setting-toggle" aria-hidden="true"></span>
            </button>
          `
        )
        .join("")}
      <div class="settings-footer-note">这些开关在浏览器试用版中会即时改变状态；原生版将写入 DataStore 并在重启后恢复。</div>
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
      library: "#libraryGrid .library-card",
      music: "#musicToggle",
      saved: "#savedGrid .saved-card",
      settings: "#settingsNav .settings-nav-row.is-selected"
    };
    return document.querySelector(selectors[key]) || pages[key].querySelector(".focusable");
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
        : document.getElementById("searchTrigger");
    rootReturnFocus = null;
    focusElement(target);
  }

  function isOpen() {
    return Boolean(activePageKey);
  }

  function focusNow(element) {
    if (!element || element.closest("[hidden]")) return true;
    focusSequence += 1;
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    revealInScrollable(element);
    element.focus({ preventScroll: true });
    element.classList.add("is-focused");
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

  function navigateLive(direction, active) {
    const page = pages.live;
    const back = page.querySelector(".page-back");
    const headerAction = page.querySelector(".page-header [data-open-settings]");
    const filters = visibleItems([...page.querySelectorAll("#liveFilterRow .page-chip")]);
    const channels = visibleItems([...page.querySelectorAll("#liveChannelGrid .live-channel-card")]);
    const play = page.querySelector("#livePlayButton");

    if (active === back) {
      if (direction === "right") return focusNow(headerAction);
      if (direction === "down") return focusNow(filters[0]);
      return true;
    }
    if (active === headerAction) {
      if (direction === "left") return focusNow(back);
      if (direction === "down") return focusNow(filters[0]);
      return true;
    }
    if (filters.includes(active)) {
      if (direction === "left" || direction === "right") {
        return focusNow(stepInList(filters, active, direction, true));
      }
      if (direction === "up") return focusNow(headerAction);
      if (direction === "down") {
        const selected =
          channels.find((channel) => channel.classList.contains("is-selected")) ||
          channels[0];
        return focusNow(selected);
      }
      return true;
    }
    if (channels.includes(active)) {
      const index = channels.indexOf(active);
      const column = index % 4;
      const row = Math.floor(index / 4);
      const rowCount = Math.ceil(channels.length / 4);
      let target = null;

      if (direction === "left") {
        target =
          column > 0
            ? channels[index - 1]
            : filters.find(
                (filter) =>
                  filter.dataset.liveGroup === active.dataset.channelGroup
              ) || filters[0];
      } else if (direction === "right") {
        target =
          column < 3 && index + 1 < channels.length
            ? channels[index + 1]
            : play;
      } else if (direction === "up") {
        target =
          row > 0
            ? channels[index - 4]
            : filters.find(
                (filter) =>
                  filter.dataset.liveGroup === active.dataset.channelGroup
              ) || filters[0];
      } else if (direction === "down") {
        target =
          row < rowCount - 1 && index + 4 < channels.length
            ? channels[index + 4]
            : null;
      }
      return focusNow(target);
    }
    if (active === play) {
      const selected =
        channels.find((channel) => channel.classList.contains("is-selected")) ||
        channels[channels.length - 1];
      if (direction === "left" || direction === "up") return focusNow(selected);
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
    const back = page.querySelector(".page-back");
    const headerAction = page.querySelector(".page-header [data-open-settings]");
    const controls = visibleItems([
      page.querySelector("#musicPrev"),
      page.querySelector("#musicToggle"),
      page.querySelector("#musicNext")
    ]);
    const queueItems = visibleItems([...page.querySelectorAll("#musicQueue .music-queue-item")]);
    const play = page.querySelector("#musicToggle");
    const currentQueue =
      queueItems[musicState.currentIndex] || queueItems[0];

    if (active === back) {
      if (direction === "right") return focusNow(headerAction);
      if (direction === "down") return focusNow(play);
      return true;
    }
    if (active === headerAction) {
      if (direction === "left") return focusNow(back);
      if (direction === "down") return focusNow(play);
      return true;
    }
    if (controls.includes(active)) {
      if (direction === "left" || direction === "right") {
        return focusNow(stepInList(controls, active, direction));
      }
      if (direction === "down") return focusNow(currentQueue);
      if (direction === "up") return focusNow(back);
      return true;
    }
    if (queueItems.includes(active)) {
      if (direction === "up" || direction === "down") {
        const target = stepInList(queueItems, active, direction);
        return focusNow(target || play);
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
      case "live":
        return navigateLive(direction, active);
      case "library":
        return navigateLibrary(direction, active);
      case "music":
        return navigateMusic(direction, active);
      case "saved":
        return navigateSaved(direction, active);
      case "settings":
        return navigateSettings(direction, active);
      default:
        return false;
    }
  }

  window.NovaPages = {
    open,
    close,
    isOpen,
    moveFocus,
    renderLive,
    renderLibrary,
    renderMusicQueue,
    renderSaved,
    renderSettings
  };

  document.addEventListener("click", (event) => {
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

    const sourceCreate = event.target.closest("[data-source-create]");
    if (sourceCreate) {
      openSourceDialog(sourceCreate.dataset.sourceCreate);
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

    const savedTab = event.target.closest("[data-saved-tab]");
    if (savedTab) {
      renderSaved(savedTab.dataset.savedTab);
      focusElement(savedGrid.querySelector(".saved-card"));
      return;
    }

    const savedCard = event.target.closest("[data-saved-key]");
    if (savedCard) {
      openDetail(getLibraryItem(savedCard.dataset.savedKey));
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
      const row = settingsState.toggles[section]?.[Number(indexText)];
      if (!row) return;
      row.value = !row.value;
      settingsToggle.classList.toggle("is-on", row.value);
      showToast(`${row.label}：${row.value ? "已开启" : "已关闭"}`);
      return;
    }

    const settingsChoice = event.target.closest("[data-setting-choice]");
    if (settingsChoice) {
      const [section, option] = settingsChoice.dataset.settingChoice.split(":");
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
      showToast(
        savedAction.dataset.savedAction === "clear-history"
          ? "演示数据已保留；清理功能将在 Room 持久化接入后启用"
          : "片单导出将在个人数据层接入后启用"
      );
    }
  });

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
    if (musicAudio.currentTime > 3) {
      musicAudio.currentTime = 0;
      updateMusicUI();
      return;
    }
    playMusicTrack(musicState.currentIndex - 1);
  });
  musicNext.addEventListener("click", () => {
    playMusicTrack(musicState.currentIndex + 1);
  });

  musicAudio.addEventListener("timeupdate", () => updateMusicUI());
  musicAudio.addEventListener("loadedmetadata", updateMusicUI);
  musicAudio.addEventListener("play", updateMusicUI);
  musicAudio.addEventListener("pause", updateMusicUI);
  musicAudio.addEventListener("ended", () => {
    playMusicTrack(musicState.currentIndex + 1);
  });

  renderLive();
  renderLibrary();
  renderMusicQueue();
  updateMusicUI();
  renderSaved();
  renderSettings();
})();
