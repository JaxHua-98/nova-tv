(() => {
  "use strict";

  const playerScreen = document.getElementById("playerScreen");
  const video = document.getElementById("playerVideo");
  const closeButton = document.getElementById("playerClose");
  const toggleButton = document.getElementById("playerToggle");
  const rewindButton = document.getElementById("playerRewind");
  const forwardButton = document.getElementById("playerForward");
  const muteButton = document.getElementById("playerMute");
  const episodesButton = document.getElementById("playerEpisodes");
  const linesButton = document.getElementById("playerLines");
  const moreButton = document.getElementById("playerMore");
  const retryButton = document.getElementById("playerRetry");
  const statePanel = document.getElementById("playerState");
  const stateTitle = document.getElementById("playerStateTitle");
  const stateDetail = document.getElementById("playerStateDetail");
  const stateActions = document.getElementById("playerStateActions");
  const stateSwitchButton = document.getElementById("playerStateSwitch");
  const stateRetryButton = document.getElementById("playerStateRetry");
  const title = document.getElementById("playerTitle");
  const meta = document.getElementById("playerMeta");
  const kind = document.getElementById("playerKind");
  const sourceLabel = document.getElementById("playerSourceLabel");
  const resolution = document.getElementById("playerResolution");
  const rateTag = document.getElementById("playerRateTag");
  const aspectTag = document.getElementById("playerAspectTag");
  const liveIndicator = document.getElementById("playerLiveIndicator");
  const timeline = document.getElementById("playerTimeline");
  const seek = document.getElementById("playerSeek");
  const seekBuffer = document.getElementById("playerSeekBuffer");
  const seekFill = document.getElementById("playerSeekFill");
  const seekKnob = document.getElementById("playerSeekKnob");
  const seekTip = document.getElementById("playerSeekTip");
  const seekTipTime = document.getElementById("playerSeekTipTime");
  const seekTipDelta = document.getElementById("playerSeekTipDelta");
  const seekThumb = document.getElementById("playerSeekThumb");
  const currentTimeLabel = document.getElementById("playerCurrentTime");
  const durationLabel = document.getElementById("playerDuration");
  const mini = document.getElementById("playerMini");
  const miniFill = document.getElementById("playerMiniFill");
  const drawer = document.getElementById("playerDrawer");
  const drawerTitle = document.getElementById("playerDrawerTitle");
  const drawerBody = document.getElementById("playerDrawerBody");
  const drawerClose = document.getElementById("playerDrawerClose");
  const nextCard = document.getElementById("playerNext");
  const nextTitle = document.getElementById("playerNextTitle");
  const nextCount = document.getElementById("playerNextCount");
  const nextPlay = document.getElementById("playerNextPlay");
  const nextCancel = document.getElementById("playerNextCancel");
  const toastBox = document.getElementById("playerToast");
  const statsBox = document.getElementById("playerStats");

  let currentMedia = null;
  let hls = null;
  let returnFocus = null;
  let inertState = [];
  // 多源线路：由 lines.js 提供排序、镜像合并与失败切换
  let lineSelector = null;
  let autoSwitchLine = true;

  /* ---------- 交互状态 ---------- */

  const IDLE_MS = 4500;
  const EXIT_ARM_MS = 3000;
  const NEXT_SECONDS = 8;
  const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const ASPECTS = [
    { id: "fit", label: "适应" },
    { id: "fill", label: "铺满" },
    { id: "stretch", label: "拉伸" }
  ];
  const SLEEPS = [0, 30, 60, 90];
  const SEEK_STEPS = [10, 20, 30, 60, 120, 300];
  const SCRUB_STEPS = [60, 120, 300, 600, 900, 1800];

  const state = {
    zone: "idle", // idle | controls | drawer
    focusIndex: 0,
    idleTimer: 0,
    exitAt: 0,
    toastTimer: 0,
    seekPreview: 0,
    seekTimer: 0,
    tipTimer: 0,
    hintTimer: 0,
    thumbReady: false,
    drawerMode: "",
    drawerIndex: 0,
    aspect: "fit",
    rate: 1,
    sleepMinutes: 0,
    sleepTimer: 0,
    ambientTimer: 0,
    statsTimer: 0,
    enterDownAt: 0,
    statsArmTimer: 0,
    lastDir: "",
    lastDirAt: 0,
    dirBurst: 0,
    nextTimer: 0,
    nextLeft: 0,
    nextInfo: null
  };

  /* ---------- 播放进度 ---------- */

  const PROGRESS_KEY = "nova.play.progress.v1";
  let progressSavedAt = 0;

  // 进度里要存原始地址：/api/proxy?url=… 是本站的包装，存进去再喂回播放器会被二次代理
  function rawStreamUrl(url) {
    const value = String(url || "");
    const marker = "/api/proxy?url=";
    if (!value.startsWith(marker)) return value;
    const rest = value.slice(marker.length);
    const cut = rest.indexOf("&headers=");
    const target = cut >= 0 ? rest.slice(0, cut) : rest;
    try {
      return decodeURIComponent(target);
    } catch {
      return value;
    }
  }

  // 海报可能已是 /api/proxy 地址，存库前还原成原始 URL，避免双重代理
  function rawImage(url) {
    const text = String(url || "");
    if (!/\/api\/proxy\?url=/i.test(text)) return text;
    try {
      return new URL(text, window.location.origin).searchParams.get("url") || "";
    } catch {
      return "";
    }
  }

  // 归一化分类：源站 type_name 五花八门，统一成 movie / series / variety / anime / other
  function normalizeCategory(kindText, episodeText) {
    const text = String(kindText || "");
    if (/动漫|动画|番剧|番組|新番|国漫|日漫/.test(text)) return "anime";
    if (/综艺|真人秀|脱口秀|晚会|访谈|选秀/.test(text)) return "variety";
    if (/电视剧|连续剧|美剧|韩剧|日剧|港剧|台剧|短剧|剧集/.test(text)) return "series";
    if (/电影|影片|大片|剧场版/.test(text)) return "movie";
    const episode = String(episodeText || "");
    if (/第\s*\d+\s*[期季]|EP?\s*\d+\s*期/i.test(episode)) return "variety";
    if (/第\s*\d+\s*[集话話]|EP?\s*\d+/i.test(episode)) return "series";
    if (/第\s*\d+\s*[话話]/.test(episode)) return "anime";
    return "other";
  }

  function saveProgress(force) {
    const media = currentMedia;
    if (!media || media.isLive || !media.key) return;
    const total = Number.isFinite(video.duration) ? video.duration : 0;
    const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    // 时长还没读到、或只看了片头几秒，先不记
    if (total < 30 || position < 5) return;
    const now = Date.now();
    if (!force && now - progressSavedAt < 5000) return;
    progressSavedAt = now;

    let store = {};
    try {
      store = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}") || {};
    } catch {
      store = {};
    }

    const recordKey = `${media.key}::${media.episode || ""}`;
    // 快看完的从列表里撤掉，别让「继续观看」堆满已看完的
    if (total - position < Math.max(20, total * 0.04)) {
      delete store[recordKey];
    } else {
      store[recordKey] = {
        t: Math.round(position),
        d: Math.round(total),
        k: media.key || "",
        n: media.title || "",
        e: media.episode || "",
        p: rawImage(media.image),
        // 首页「最近观看」靠这条直接续播，没地址时退回详情页
        u: rawStreamUrl(media.url),
        // 分类：写入时存一份，避免以后回查片库查不到
        y: media.kind || "",
        g: normalizeCategory(media.kind, media.episode),
        at: now
      };
    }

    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
    } catch {
      return;
    }
    document.dispatchEvent(new CustomEvent("nova:progress-changed"));
  }

  /* ---------- 线路 ---------- */

  function lineLabelOf(option) {
    if (!option) return "";
    const mirrors = Number(option.mirrorCount) || 0;
    return mirrors > 0 ? `${option.label} · ${mirrors + 1} 镜像` : option.label;
  }

  /** 切到某条线路并重建播放器；返回是否真的切了 */
  function applyLine(option, message) {
    if (!option?.url) return false;
    const url = String(option.url || "");
    currentMedia = {
      ...currentMedia,
      url,
      lineLabel: lineLabelOf(option),
      mirrorCount: Number(option.mirrorCount) || 0
    };
    sourceLabel.textContent = currentMedia.lineLabel;
    if (message) toast(message);
    setPanelState("loading", `正在连接「${option.label}」`, "线路切换后重新拉流");

    // 采集站的线路常给成「分享页」，得先解析出 m3u8，否则会直接失败又切回去
    const needsResolve = /^https?:/i.test(url) && !HLS_RE.test(url) && !MP4_RE.test(url);
    if (needsResolve) {
      resolvePlayable(url)
        .then((finalUrl) => {
          if (!currentMedia || currentMedia.lineLabel !== lineLabelOf(option)) return;
          currentMedia = { ...currentMedia, url: finalUrl };
          attachSource();
        })
        .catch(() => {
          toast("这条线路解析失败，换一条试试");
          if (!tryFailover(option.label)) showErrorPanel("线路解析失败", "这条线路的地址打不开，换一条试试");
        });
      return true;
    }

    attachSource();
    return true;
  }

  /** 播放失败自动换下一条线路；全部失败才报错 */
  function tryFailover(reason) {
    if (!autoSwitchLine || !lineSelector) return false;
    const next = lineSelector.fail();
    if (!next) return false;
    return applyLine(next, `${reason || "当前线路"}不可用，已切到「${next.label}」`);
  }

  /** 手动切下一条 */
  function switchLine() {
    if (!lineSelector) {
      toast("当前条目只有一条线路");
      return null;
    }
    const next = lineSelector.next();
    if (!next) {
      toast("没有更多可用线路了");
      return null;
    }
    applyLine(next, `已切到「${next.label}」`);
    return next;
  }

  /* ---------- 小工具 ---------- */

  function icon(id) {
    return `<svg class="icon"><use href="#${id}" /></svg>`;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const safe = Math.floor(seconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainder = safe % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function duration() {
    return Number.isFinite(video.duration) ? video.duration : 0;
  }

  function toast(text, ms = 2000) {
    if (!toastBox) return;
    toastBox.textContent = text;
    toastBox.hidden = false;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      toastBox.hidden = true;
    }, ms);
  }

  function settings() {
    return window.NovaSettings?.get?.() || {};
  }

  /* ---------- 状态面板 ---------- */

  function setPanelState(mode, heading, detail = "") {
    statePanel.hidden = false;
    statePanel.classList.toggle("is-error", mode === "error");
    stateTitle.textContent = heading;
    stateDetail.textContent = detail;
    stateActions.hidden = true;
  }

  function hidePanelState() {
    statePanel.hidden = true;
    stateActions.hidden = true;
  }

  function showErrorPanel(heading, detail, options = {}) {
    setPanelState("error", heading, detail);
    const canSwitch = Boolean(lineSelector && lineSelector.list.length > 1);
    stateSwitchButton.hidden = !canSwitch;
    stateRetryButton.hidden = false;
    stateActions.hidden = false;
    // 出错时把焦点交给可点的操作，别让用户在黑屏上乱按
    window.requestAnimationFrame(() => {
      focusItem(canSwitch ? stateSwitchButton : stateRetryButton);
    });
    if (options.focus !== false) {
      state.zone = "controls";
      playerScreen.classList.remove("is-idle");
    }
  }

  // 把播放器的原始错误翻成人话
  function humanizeError(error) {
    const code = error?.code || video.error?.code || 0;
    if (code === 1) return { heading: "播放被中断", detail: "按「重新加载」再试一次" };
    if (code === 2) return { heading: "网络中断", detail: "检查网络连接，或换一条线路" };
    if (code === 3) return { heading: "解码失败", detail: "这段编码电视解不了，换线路试试" };
    if (code === 4) return { heading: "片源无法播放", detail: "地址可能已失效（404 / 403），换线路试试" };
    return { heading: "片源暂时无法播放", detail: "按「重新加载」重试，或换一条线路" };
  }

  /* ---------- 进度显示 ---------- */

  function updateResolution() {
    const width = video.videoWidth;
    const height = video.videoHeight;
    resolution.textContent = width > 0 && height > 0 ? `${width}×${height}` : "AUTO";
  }

  function bufferedRatio() {
    const total = duration();
    if (!total || !video.buffered || !video.buffered.length) return 0;
    let end = 0;
    for (let i = 0; i < video.buffered.length; i += 1) {
      const value = video.buffered.end(i);
      if (value > end) end = value;
    }
    return Math.min(1, end / total);
  }

  function updateSeekUI(position) {
    const total = duration();
    const current = Number.isFinite(position) ? position : video.currentTime || 0;
    const ratio = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
    seekFill.style.width = `${ratio * 100}%`;
    seekBuffer.style.width = `${bufferedRatio() * 100}%`;
    seekKnob.style.left = `${ratio * 100}%`;
    miniFill.style.width = `${ratio * 100}%`;
    currentTimeLabel.textContent = formatTime(current);
    durationLabel.textContent = total > 0 ? formatTime(total) : "直播";
    seek.setAttribute("aria-valuemax", String(Math.round(total)));
    seek.setAttribute("aria-valuenow", String(Math.round(current)));
  }

  function updatePlaybackUI() {
    const playing = !video.paused && !video.ended;
    toggleButton.innerHTML = icon(playing ? "i-pause" : "i-play");
    toggleButton.setAttribute("aria-label", playing ? "暂停" : "播放");
    muteButton.innerHTML = icon(video.muted ? "i-mute" : "i-volume");
    muteButton.setAttribute("aria-label", video.muted ? "取消静音" : "静音");

    if (currentMedia?.isLive) {
      currentTimeLabel.textContent = playing ? "正在直播" : "直播已暂停";
      durationLabel.textContent = "直播";
      seekFill.style.width = "100%";
      miniFill.style.width = "100%";
      return;
    }

    updateSeekUI();
  }

  /* ---------- 控件显隐 ---------- */

  function controlsIdle() {
    return playerScreen.classList.contains("is-idle");
  }

  function resetIdle() {
    window.clearTimeout(state.idleTimer);
    if (!state.zone) return;
    // 暂停、抽屉打开、出错、自动连播倒计时时，控件不自动收
    if (video.paused || state.zone === "drawer" || !nextCard.hidden || !statePanel.hidden) return;
    state.idleTimer = window.setTimeout(() => {
      if (video.paused || state.zone === "drawer") return;
      hideControls();
    }, IDLE_MS);
  }

  function hideControls() {
    if (state.zone === "drawer") return;
    state.zone = "idle";
    playerScreen.classList.add("is-idle");
    playerScreen.classList.remove("is-seek-hint");
    clearFocus();
    seekTip.hidden = true;
  }

  // 快进时只把进度条亮出来，别把整排按钮弹出来（否则连按会变成移动焦点）
  function showSeekHint() {
    playerScreen.classList.add("is-idle", "is-seek-hint");
    window.clearTimeout(state.hintTimer);
    state.hintTimer = window.setTimeout(() => {
      playerScreen.classList.remove("is-seek-hint");
    }, 1800);
  }

  function showControls(target) {
    playerScreen.classList.remove("is-idle", "is-seek-hint");
    state.zone = "controls";
    if (target) {
      focusItem(target);
    } else if (!document.activeElement?.closest?.(".player-controls, .player-topbar, .player-timeline")) {
      focusItem(toggleButton);
    }
    resetIdle();
  }

  /* ---------- 焦点 ---------- */

  function focusItem(element) {
    if (!element || element.hidden) return false;
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    element.focus({ preventScroll: true });
    element.classList.add("is-focused");
    state.focusIndex = controlList().indexOf(element);
    return true;
  }

  function clearFocus() {
    document.querySelectorAll(".is-focused").forEach((node) => node.classList.remove("is-focused"));
    if (document.activeElement?.blur) document.activeElement.blur();
  }

  // 左右走位只在按钮之间循环；进度条单独一格，用 ↓ 进去、↑ 出来
  function controlList() {
    return [
      closeButton,
      rewindButton,
      toggleButton,
      forwardButton,
      muteButton,
      episodesButton,
      linesButton,
      moreButton,
      retryButton
    ].filter((button) => button && !button.hidden);
  }

  /* ---------- seek ---------- */

  function seekStep(direction) {
    const now = Date.now();
    const same = direction === state.lastDir && now - state.lastDirAt < 800;
    state.dirBurst = same ? Math.min(state.dirBurst + 1, SEEK_STEPS.length - 1) : 0;
    state.lastDir = direction;
    state.lastDirAt = now;
    return SEEK_STEPS[state.dirBurst];
  }

  function scrubStep(direction) {
    const now = Date.now();
    const same = direction === state.lastDir && now - state.lastDirAt < 800;
    state.dirBurst = same ? Math.min(state.dirBurst + 1, SCRUB_STEPS.length - 1) : 0;
    state.lastDir = direction;
    state.lastDirAt = now;
    return SCRUB_STEPS[state.dirBurst];
  }

  function seekBy(delta) {
    const total = duration();
    if (!total) return;
    const base = state.seekPreview || video.currentTime || 0;
    const target = Math.max(0, Math.min(total - 1, base + delta));
    state.seekPreview = target;
    updateSeekUI(target);
    showSeekTip(target, delta);
    // 连按期间不真的跳，停手 350ms 再落，避免 HLS 反复重拉
    window.clearTimeout(state.seekTimer);
    state.seekTimer = window.setTimeout(applySeek, 350);
    resetIdle();
  }

  function applySeek() {
    if (!state.seekPreview) return;
    const target = state.seekPreview;
    state.seekPreview = 0;
    try {
      video.currentTime = target;
    } catch (_) {
      /* 忽略越界 */
    }
    updateSeekUI(target);
  }

  function showSeekTip(target, delta) {
    seekTip.hidden = false;
    seekTipTime.textContent = formatTime(target);
    if (seekTipDelta) {
      const sign = delta >= 0 ? "+" : "−";
      const abs = Math.abs(delta);
      seekTipDelta.textContent = abs >= 60 ? `${sign}${Math.round(abs / 60)} 分钟` : `${sign}${abs} 秒`;
    }
    const total = duration();
    const ratio = total > 0 ? Math.max(0, Math.min(1, target / total)) : 0;
    seekTip.style.left = `${ratio * 100}%`;
    window.clearTimeout(state.tipTimer);
    state.tipTimer = window.setTimeout(() => {
      seekTip.hidden = true;
    }, 1600);
  }

  // 跳转落定后抓一帧当预览，下次快进能对上画面
  // （HLS 走 MSE，跨源分片会把 canvas 污染，抓不出来就只留时间气泡）
  function captureThumb() {
    if (!seekThumb || !video.videoWidth) return;
    try {
      const context = seekThumb.getContext("2d");
      context.drawImage(video, 0, 0, seekThumb.width, seekThumb.height);
      seekThumb.style.display = "block";
      state.thumbReady = true;
    } catch (_) {
      state.thumbReady = false;
      seekThumb.style.display = "none";
    }
  }

  /* ---------- 抽屉 ---------- */

  function drawerItems() {
    return [...drawerBody.querySelectorAll("[data-player-option]")];
  }

  function openDrawer(mode) {
    state.drawerMode = mode;
    state.zone = "drawer";
    playerScreen.classList.remove("is-idle");
    drawer.hidden = false;
    drawerTitle.textContent = mode === "episodes" ? "选集" : mode === "lines" ? "播放线路" : "更多设置";
    renderDrawer();
    // 选集定位到当前集
    const items = drawerItems();
    const active = items.find((item) => item.classList.contains("is-current")) || items[0];
    if (active) {
      focusItem(active);
      state.drawerIndex = items.indexOf(active);
    }
    resetIdle();
  }

  function closeDrawer() {
    drawer.hidden = true;
    state.drawerMode = "";
    state.zone = "controls";
    drawerBody.innerHTML = "";
    seekTip.hidden = true;
    showControls(toggleButton);
  }

  function renderDrawer() {
    if (state.drawerMode === "episodes") {
      const names = Array.isArray(currentMedia?.episodes) ? currentMedia.episodes : [];
      const currentIndex = Number(currentMedia?.episodeIndex) || 0;
      if (!names.length) {
        drawerBody.innerHTML = '<p class="player-drawer-empty">这个条目没有分集信息</p>';
        return;
      }
      drawerBody.innerHTML = `
        <p class="player-drawer-hint">共 ${names.length} 集 · 当前第 ${currentIndex + 1} 集</p>
        <div class="player-ep-grid">
          ${names
            .map(
              (name, index) => `
            <button class="player-ep focusable${index === currentIndex ? " is-current" : ""}" type="button"
              data-player-option data-episode-index="${index}">${escapeText(name)}</button>`
            )
            .join("")}
        </div>`;
      return;
    }

    if (state.drawerMode === "lines") {
      const list = lineSelector?.list || [];
      const activeId = lineSelector?.current()?.id || "";
      if (list.length < 2) {
        drawerBody.innerHTML = '<p class="player-drawer-empty">这个条目只有一条线路</p>';
        return;
      }
      drawerBody.innerHTML = `
        <p class="player-drawer-hint">共 ${list.length} 条线路 · 失败会自动切下一条</p>
        <div class="player-line-list">
          ${list
            .map((line) => {
              const dead = line.probeStatus === "dead";
              const mirrors = Number(line.mirrorCount) || 0;
              return `
              <button class="player-line focusable${line.id === activeId ? " is-current" : ""}${dead ? " is-dead" : ""}"
                type="button" data-player-option data-line-id="${escapeText(line.id)}">
                <span class="player-line-dot"></span>
                <span class="player-line-name">${escapeText(line.label || "线路")}</span>
                <span class="player-line-meta">${mirrors > 0 ? `${mirrors + 1} 镜像` : "单线"}</span>
                <span class="player-line-tag">${dead ? "已失效" : line.id === activeId ? "播放中" : "可切换"}</span>
              </button>`;
            })
            .join("")}
        </div>`;
      return;
    }

    // 更多设置
    const rateInfo = `${state.rate.toFixed(state.rate === 1 ? 1 : 2).replace(/0$/, "")}×`;
    const aspectLabel = ASPECTS.find((item) => item.id === state.aspect)?.label || "适应";
    const sleepLabel = state.sleepMinutes ? `${state.sleepMinutes} 分钟` : "关闭";
    const favKey = currentMedia?.key ? String(currentMedia.key) : "";
    const favSaved = favKey ? Boolean(window.NovaFav?.has?.(favKey)) : false;
    drawerBody.innerHTML = `
      <div class="player-opt">
        <span class="player-opt-label">播放速度</span>
        <div class="player-opt-values">
          ${RATES.map(
            (rate) =>
              `<button class="player-opt-chip focusable${rate === state.rate ? " is-current" : ""}" type="button"
                data-player-option data-rate="${rate}">${rate}×</button>`
          ).join("")}
        </div>
        <span class="player-opt-now">${rateInfo}</span>
      </div>
      <div class="player-opt">
        <span class="player-opt-label">画面比例</span>
        <div class="player-opt-values">
          ${ASPECTS.map(
            (item) =>
              `<button class="player-opt-chip focusable${item.id === state.aspect ? " is-current" : ""}" type="button"
                data-player-option data-aspect="${item.id}">${item.label}</button>`
          ).join("")}
        </div>
        <span class="player-opt-now">${aspectLabel}</span>
      </div>
      <div class="player-opt">
        <span class="player-opt-label">睡眠定时</span>
        <div class="player-opt-values">
          ${SLEEPS.map(
            (minutes) =>
              `<button class="player-opt-chip focusable${minutes === state.sleepMinutes ? " is-current" : ""}" type="button"
                data-player-option data-sleep="${minutes}">${minutes ? `${minutes} 分` : "关闭"}</button>`
          ).join("")}
        </div>
        <span class="player-opt-now">${sleepLabel}</span>
      </div>
      <div class="player-opt">
        <span class="player-opt-label">我的片单</span>
        <div class="player-opt-values">
          <button class="player-opt-chip focusable${favSaved ? " is-current" : ""}" type="button"
            data-player-option data-fav="1">${favSaved ? "已收藏 · 点按取消" : "加入我的片单"}</button>
        </div>
        <span class="player-opt-now">${favSaved ? "★" : ""}</span>
      </div>
      <div class="player-opt">
        <span class="player-opt-label">播放信息</span>
        <div class="player-opt-values">
          <button class="player-opt-chip focusable" type="button" data-player-option data-stats="1">查看码率 / 丢帧</button>
        </div>
        <span class="player-opt-now"></span>
      </div>`;
  }

  function handleDrawerKey(event) {
    const items = drawerItems();
    if (event.key === "Escape" || event.key === "Backspace" || event.key === "GoBack") {
      closeDrawer();
      return;
    }
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    const columns = state.drawerMode === "episodes" ? 6 : 1;
    const delta = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns
    }[event.key];

    if (delta !== undefined) {
      const next = Math.max(0, Math.min(items.length - 1, (index < 0 ? 0 : index) + delta));
      focusItem(items[next]);
      state.drawerIndex = next;
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      const active = document.activeElement;
      if (active?.dataset?.playerOption !== undefined) active.click();
    }
  }

  function escapeText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------- 自动连播 ---------- */

  function startNext(info) {
    if (!info) return;
    state.nextInfo = info;
    state.nextLeft = NEXT_SECONDS;
    nextTitle.textContent = info.title || "";
    nextCount.textContent = String(state.nextLeft);
    nextCard.hidden = false;
    showControls(nextPlay);
    window.clearInterval(state.nextTimer);
    state.nextTimer = window.setInterval(() => {
      state.nextLeft -= 1;
      nextCount.textContent = String(Math.max(0, state.nextLeft));
      if (state.nextLeft <= 0) runNext();
    }, 1000);
  }

  function runNext() {
    const info = state.nextInfo;
    cancelNext(true);
    if (info?.run) info.run();
  }

  function cancelNext(silent) {
    window.clearInterval(state.nextTimer);
    state.nextTimer = 0;
    state.nextInfo = null;
    nextCard.hidden = true;
    if (!silent) {
      showControls(toggleButton);
      toast("已取消自动播放");
    }
  }

  /* ---------- 播放信息 ---------- */

  function toggleStats() {
    if (!statsBox.hidden) {
      statsBox.hidden = true;
      window.clearInterval(state.statsTimer);
      return;
    }
    const draw = () => {
      const quality = video.getVideoPlaybackQuality?.();
      const level = hls?.levels?.[hls?.currentLevel];
      const lines = [
        `标题      ${currentMedia?.title || "-"}`,
        `线路      ${currentMedia?.lineLabel || currentMedia?.source || "-"}`,
        `分辨率    ${video.videoWidth}×${video.videoHeight}${level?.bitrate ? `  @ ${Math.round(level.bitrate / 1000)} kbps` : ""}`,
        `进度      ${formatTime(video.currentTime)} / ${formatTime(duration())}`,
        `已缓冲    ${Math.round(bufferedRatio() * 100)}%`,
        `丢帧      ${quality ? `${quality.droppedVideoFrames}/${quality.totalVideoFrames}` : "-"}`,
        `速度      ${state.rate}×    比例  ${ASPECTS.find((item) => item.id === state.aspect)?.label || "适应"}`,
        `分片      ${level ? `${level.width}×${level.height}` : "AUTO"}`
      ];
      statsBox.textContent = lines.join("\n");
    };
    statsBox.hidden = false;
    draw();
    state.statsTimer = window.setInterval(draw, 1000);
  }

  /* ---------- 设置动作 ---------- */

  function setRate(rate) {
    state.rate = rate;
    video.playbackRate = rate;
    rateTag.hidden = rate === 1;
    rateTag.textContent = `${rate}×`;
    toast(`播放速度 ${rate}×`);
  }

  function setAspect(id) {
    state.aspect = id;
    playerScreen.classList.remove("aspect-fit", "aspect-fill", "aspect-stretch");
    playerScreen.classList.add(`aspect-${id}`);
    const label = ASPECTS.find((item) => item.id === id)?.label || "适应";
    aspectTag.hidden = !label || id === "fit";
    aspectTag.textContent = label;
    toast(`画面比例：${label}`);
  }

  function setSleep(minutes) {
    state.sleepMinutes = minutes;
    window.clearTimeout(state.sleepTimer);
    if (!minutes) {
      toast("已关闭睡眠定时");
      return;
    }
    state.sleepTimer = window.setTimeout(() => {
      toast("睡眠定时到，正在关闭播放器", 1600);
      window.setTimeout(() => close(), 1200);
    }, minutes * 60 * 1000);
    toast(`将在 ${minutes} 分钟后停止播放`);
  }

  /* ---------- 视频事件 ---------- */

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  function showPlaybackError(message) {
    const info = humanizeError(typeof message === "object" ? message : null);
    showErrorPanel(info.heading, message && typeof message === "string" ? message : info.detail);
  }

  function playVideo() {
    const promise = video.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {
        setPanelState("loading", "已准备好播放", "按 OK 开始播放");
        updatePlaybackUI();
      });
    }
  }

  function attachSource() {
    if (!currentMedia) return;

    destroyHls();
    video.pause();
    video.removeAttribute("src");
    video.load();
    updateResolution();
    setPanelState("loading", "正在连接内容源", "首次加载可能需要几秒");

    const url = currentMedia.url;
    const isHls = /\.m3u8/i.test(url);

    if (!isHls) {
      video.src = url;
      video.load();
      playVideo();
      return;
    }

    const attachHlsJs = () => {
      hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30
      });
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        playVideo();
      });
      hls.on(window.Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls?.levels?.[data.level];
        if (level?.width && level?.height) {
          resolution.textContent = `${level.width}×${level.height}`;
        }
      });
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        // 先试线路切换，切不动才报错
        if (tryFailover(data.type === window.Hls.ErrorTypes.NETWORK_ERROR ? "网络线路" : "当前线路")) return;
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          showErrorPanel("网络线路中断", "按「重新加载」重试，或换一条线路");
        } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          showErrorPanel("解码失败", "这段编码电视解不了，换线路试试");
        } else {
          showErrorPanel("HLS 片源加载失败", "换线路或重新加载");
        }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    };

    let sameOrigin = false;
    try {
      sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
    } catch (_) {
      sameOrigin = false;
    }

    // HLS.js needs CORS. The local /api/proxy path is always same-origin.
    if (sameOrigin && window.Hls?.isSupported?.()) {
      attachHlsJs();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.load();
      playVideo();
      return;
    }

    if (window.Hls?.isSupported?.()) {
      attachHlsJs();
      return;
    }

    showErrorPanel("当前设备不支持 HLS 播放", "换一条直连（mp4）线路试试");
  }

  const PROXY = (target) => `/api/proxy?url=${encodeURIComponent(target)}`;
  const HLS_RE = /\.m3u8(\?|$)/i;
  const MP4_RE = /\.(mp4|webm)(\?|$)/i;

  // 采集站常把播放地址给成「分享页」，这里先抓页面再取真实 m3u8
  async function resolvePlayable(url) {
    if (!/^https?:/i.test(url)) return url;
    if (HLS_RE.test(url)) return PROXY(url);
    if (MP4_RE.test(url)) return url;

    const html = await fetch(PROXY(url), { credentials: "omit" }).then((response) => response.text());
    const patterns = [
      /var\s+main\s*=\s*["']([^"']+)["']/i,
      /"url"\s*:\s*"([^"]+\.m3u8[^"]*)"/i,
      /\burl\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i,
      /<source[^>]+src=["']([^"']+)["']/i
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return PROXY(new URL(match[1], url).href);
    }
    throw new Error("no-playable-source");
  }

  function open(media) {
    const rawUrl = typeof media?.url === "string" ? media.url.trim() : "";
    const needsResolve = /^https?:/i.test(rawUrl) && !HLS_RE.test(rawUrl) && !MP4_RE.test(rawUrl);

    if (!needsResolve) {
      const direct = rawUrl && HLS_RE.test(rawUrl) ? PROXY(rawUrl) : rawUrl;
      return openInner(media ? { ...media, url: direct || media.url } : media);
    }

    window.NovaToast?.("正在解析片源…");
    resolvePlayable(rawUrl)
      .then((finalUrl) => openInner({ ...media, url: finalUrl }))
      .catch(() => {
        window.NovaToast?.("该线路暂无法解析，请换一条线路");
      });
    return undefined;
  }

  function openInner(media) {
    if (!media?.url && !(Array.isArray(media?.lines) && media.lines.length)) {
      window.NovaToast?.("当前内容没有可用演示片源");
      return;
    }

    if (!playerScreen.hidden) close({ restoreFocus: false });

    lineSelector = null;
    autoSwitchLine = media.autoSwitchLine !== false;
    let prepared = { ...media };
    if (Array.isArray(media.lines) && media.lines.length && window.NovaLines) {
      lineSelector = window.NovaLines.createSelector(media.lines, {
        mode: media.lineSelectionMode || "auto"
      });
      const first = lineSelector.current();
      if (first) {
        prepared = {
          ...prepared,
          url: first.url,
          lineLabel: lineLabelOf(first),
          mirrorCount: Number(first.mirrorCount) || 0
        };
      }
    }

    currentMedia = prepared;
    returnFocus = document.activeElement;
    title.textContent = media.title || "NOVA TV";
    meta.textContent = media.meta || "开放演示片源";
    kind.textContent = media.isLive ? "LIVE · 电视直播" : media.kind || "开放演示影片";
    sourceLabel.textContent = prepared.lineLabel || media.source || "公开测试流";
    liveIndicator.hidden = !media.isLive;
    timeline.hidden = Boolean(media.isLive);
    rewindButton.hidden = Boolean(media.isLive);
    forwardButton.hidden = Boolean(media.isLive);
    episodesButton.hidden = !Array.isArray(media.episodes) || media.episodes.length < 2;
    linesButton.hidden = !(Array.isArray(media.lines) && media.lines.length > 1);
    rateTag.hidden = true;
    aspectTag.hidden = true;
    statsBox.hidden = true;
    nextCard.hidden = true;
    drawer.hidden = true;
    state.drawerMode = "";
    state.rate = 1;
    state.aspect = "fit";
    state.sleepMinutes = 0;
    window.clearTimeout(state.sleepTimer);
    playerScreen.classList.remove("aspect-fill", "aspect-stretch", "is-ambient", "is-idle");
    playerScreen.classList.add("aspect-fit");

    inertState = [document.getElementById("appRoot"), document.getElementById("detailScreen"), document.querySelector(".page-screen:not([hidden])")]
      .filter((element) => element && !element.hidden)
      .map((element) => ({ element, inert: element.inert }));
    inertState.forEach(({ element }) => {
      element.inert = true;
    });

    playerScreen.hidden = false;
    updatePlaybackUI();
    attachSource();
    window.requestAnimationFrame(() => showControls(toggleButton));
  }

  function close(options = {}) {
    if (playerScreen.hidden) return;
    const target = returnFocus;
    // 关窗就是一次确定的进度落盘
    saveProgress(true);
    const closed = currentMedia
      ? { key: currentMedia.key || "", episode: currentMedia.episode || "", title: currentMedia.title || "" }
      : null;
    cancelNext(true);
    window.clearInterval(state.nextTimer);
    window.clearInterval(state.statsTimer);
    window.clearTimeout(state.sleepTimer);
    window.clearTimeout(state.idleTimer);
    window.clearTimeout(state.seekTimer);
    window.clearTimeout(state.tipTimer);
    window.clearTimeout(state.ambientTimer);
    window.clearTimeout(state.exitAt);
    statsBox.hidden = true;
    drawer.hidden = true;
    nextCard.hidden = true;
    seekTip.hidden = true;
    playerScreen.hidden = true;
    playerScreen.classList.remove("is-idle", "is-ambient", "aspect-fill", "aspect-stretch");
    video.pause();
    destroyHls();
    video.removeAttribute("src");
    video.load();
    inertState.forEach(({ element, inert }) => {
      element.inert = inert;
    });
    inertState = [];
    currentMedia = null;
    returnFocus = null;
    lineSelector = null;
    state.zone = "idle";
    // 通知详情页刷新「已看标记 / 继续按钮」
    if (closed) document.dispatchEvent(new CustomEvent("nova:player-closed", { detail: closed }));
    if (options.restoreFocus !== false && target && document.contains(target)) {
      window.requestAnimationFrame(() => focusItem(target));
    }
  }

  /* ---------- 键盘 / 遥控器 ---------- */

  // 按住 OK 5 秒打开播放信息面板
  function armStats() {
    window.clearTimeout(state.statsArmTimer);
    state.statsArmTimer = window.setTimeout(() => {
      state.statsArmTimer = 0;
      toggleStats();
    }, 5000);
  }

  function exitRequested() {    const now = Date.now();
    if (state.exitAt && now - state.exitAt < EXIT_ARM_MS) {
      state.exitAt = 0;
      close();
      return;
    }
    state.exitAt = now;
    toast("再按一次退出播放", EXIT_ARM_MS);
  }

  function handleMainKey(event) {
    const key = event.key;

    if (key === "Escape" || key === "Backspace" || key === "GoBack") {
      if (!nextCard.hidden) {
        cancelNext(false);
        return;
      }
      if (controlsIdle()) {
        exitRequested();
      } else {
        hideControls();
      }
      return;
    }

    if (key === "ArrowUp") {
      if (controlsIdle()) {
        showControls(seek);
        return;
      }
      // 在进度条里按 ↑ 回到按钮行，再按一次才收起
      if (document.activeElement === seek) {
        focusItem(toggleButton);
        resetIdle();
        return;
      }
      hideControls();
      return;
    }

    if (key === "ArrowDown") {
      if (controlsIdle() || document.activeElement !== seek) {
        showControls(seek);
      }
      return;
    }

    if (key === "Enter" || key === " ") {
      // 长按时系统会连发 repeat，别让它反复开关播放
      if (event.repeat) return;
      const active = document.activeElement;
      if (!controlsIdle() && active && active !== document.body) {
        active.click?.();
      } else if (video.paused || video.ended) {
        playVideo();
      } else {
        video.pause();
      }
      resetIdle();
      // 按住 OK 5 秒看播放信息
      if (key === "Enter") armStats();
      return;
    }

    if (key === "ArrowLeft" || key === "ArrowRight") {
      const direction = key === "ArrowLeft" ? "left" : "right";
      const focusedSeek = document.activeElement === seek;
      if (!controlsIdle() && focusedSeek) {
        seekBy((direction === "left" ? -1 : 1) * scrubStep(direction));
        return;
      }
      if (!controlsIdle()) {
        const list = controlList();
        const index = list.indexOf(document.activeElement);
        const delta = direction === "left" ? -1 : 1;
        const next = list[(index + delta + list.length) % list.length];
        focusItem(next);
        resetIdle();
        return;
      }
      seekBy((direction === "left" ? -1 : 1) * seekStep(direction));
      // 只亮进度条，不把控制栏整体弹出来
      showSeekHint();
    }
  }

  function onKeyDown(event) {
    if (playerScreen.hidden) return;
    if (event.target?.matches?.("input, textarea")) return;

    const key = event.key;
    const handled = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      " ",
      "Escape",
      "Backspace",
      "GoBack",
      "MediaPlayPause",
      "MediaPlay",
      "MediaPause",
      "MediaStop"
    ].includes(key);
    if (!handled) return;

    // 播放器接管键盘：不让 app.js 的全局焦点导航再处理一遍
    event.preventDefault();
    event.stopPropagation();

    if (key === "MediaPlayPause") {
      if (video.paused) playVideo();
      else video.pause();
      return;
    }
    if (key === "MediaPlay") {
      playVideo();
      return;
    }
    if (key === "MediaPause" || key === "MediaStop") {
      video.pause();
      return;
    }

    if (state.zone === "drawer") {
      handleDrawerKey(event);
      resetIdle();
      return;
    }

    if (!nextCard.hidden) {
      if (key === "ArrowLeft" || key === "ArrowRight") {
        focusItem(document.activeElement === nextPlay ? nextCancel : nextPlay);
        return;
      }
      if (key === "Enter" || key === " ") {
        (document.activeElement || nextPlay).click?.();
        return;
      }
    }

    handleMainKey(event);
    resetIdle();
  }

  document.addEventListener("keydown", onKeyDown, true);

  // 松开 OK：长按计时清零
  document.addEventListener("keyup", (event) => {
    if (playerScreen.hidden) return;
    if (event.key === "Enter") {
      state.enterDownAt = 0;
      window.clearTimeout(state.statsArmTimer);
      state.statsArmTimer = 0;
    }
  });

  playerScreen.addEventListener("pointermove", () => {
    if (playerScreen.hidden) return;
    showControls();
  });

  /* ---------- 按钮 ---------- */

  closeButton.addEventListener("click", () => close());
  toggleButton.addEventListener("click", () => {
    if (video.paused || video.ended) playVideo();
    else video.pause();
    resetIdle();
  });
  rewindButton.addEventListener("click", () => {
    seekBy(-seekStep("left"));
    applySeek();
  });
  forwardButton.addEventListener("click", () => {
    seekBy(seekStep("right"));
    applySeek();
  });
  muteButton.addEventListener("click", () => {
    video.muted = !video.muted;
    updatePlaybackUI();
    toast(video.muted ? "已静音" : "已恢复声音");
  });
  episodesButton.addEventListener("click", () => openDrawer("episodes"));
  linesButton.addEventListener("click", () => openDrawer("lines"));
  moreButton.addEventListener("click", () => openDrawer("more"));
  retryButton.addEventListener("click", () => {
    hidePanelState();
    attachSource();
    toast("正在重新加载");
  });
  drawerClose.addEventListener("click", () => closeDrawer());
  stateRetryButton.addEventListener("click", () => {
    hidePanelState();
    attachSource();
  });
  stateSwitchButton.addEventListener("click", () => {
    hidePanelState();
    switchLine();
  });
  nextPlay.addEventListener("click", () => runNext());
  nextCancel.addEventListener("click", () => cancelNext(false));

  seek.addEventListener("click", () => {
    showControls(seek);
  });

  drawerBody.addEventListener("click", (event) => {
    const option = event.target.closest("[data-player-option]");
    if (!option) return;

    if (option.dataset.episodeIndex !== undefined) {
      const index = Number(option.dataset.episodeIndex);
      closeDrawer();
      currentMedia?.onEpisode?.(index);
      return;
    }
    if (option.dataset.lineId) {
      const id = option.dataset.lineId;
      const target = lineSelector?.select(id) || null;
      closeDrawer();
      if (target) applyLine(target, `已切到「${target.label}」`);
      return;
    }
    if (option.dataset.rate) {
      setRate(Number(option.dataset.rate));
      renderDrawer();
      const active = drawerItems().find((item) => item.classList.contains("is-current"));
      if (active) focusItem(active);
      return;
    }
    if (option.dataset.aspect) {
      setAspect(option.dataset.aspect);
      renderDrawer();
      const active = drawerItems().find((item) => item.classList.contains("is-current"));
      if (active) focusItem(active);
      return;
    }
    if (option.dataset.sleep !== undefined) {
      setSleep(Number(option.dataset.sleep));
      renderDrawer();
      const active = drawerItems().find((item) => item.classList.contains("is-current"));
      if (active) focusItem(active);
      return;
    }
    if (option.dataset.fav) {
      const key = currentMedia?.key ? String(currentMedia.key) : "";
      if (!key) {
        toast("这个条目没有可收藏的标识");
        return;
      }
      const result = window.NovaFav?.toggle?.({
        key,
        title: currentMedia.title || "",
        image: currentMedia.image || "",
        kind: /剧|集/.test(currentMedia.kind || "") ? "series" : "movie",
        source: currentMedia.source || "",
        meta: currentMedia.meta || ""
      });
      renderDrawer();
      const chip = drawerItems().find((item) => item.dataset.fav);
      if (chip) focusItem(chip);
      toast(result?.added ? "已加入我的片单" : "已从片单移除");
      return;
    }
    if (option.dataset.stats) {
      closeDrawer();
      toggleStats();
    }
  });

  /* ---------- 视频事件 ---------- */

  video.addEventListener("playing", () => {
    hidePanelState();
    updateResolution();
    updatePlaybackUI();
    playerScreen.classList.remove("is-ambient");
    window.clearTimeout(state.ambientTimer);
    resetIdle();
  });
  video.addEventListener("pause", () => {
    updatePlaybackUI();
    saveProgress(true);
    // 暂停时不收控件；长时间暂停降亮度防烧屏
    if (!playerScreen.hidden) showControls(document.activeElement?.closest?.(".player-controls") ? document.activeElement : toggleButton);
    window.clearTimeout(state.ambientTimer);
    if (!video.ended) {
      state.ambientTimer = window.setTimeout(() => {
        if (video.paused && !playerScreen.hidden) playerScreen.classList.add("is-ambient");
      }, 180000);
    }
  });
  video.addEventListener("ended", () => {
    updatePlaybackUI();
    const next = currentMedia?.onNext;
    if (next && settings().autoplayNext !== false) {
      startNext({ title: currentMedia?.nextEpisode || "下一集", run: next });
      return;
    }
    showControls(toggleButton);
    toast("播放结束", 2400);
  });
  video.addEventListener("timeupdate", () => {
    updatePlaybackUI();
    saveProgress(false);
  });
  video.addEventListener("durationchange", updatePlaybackUI);
  video.addEventListener("volumechange", updatePlaybackUI);
  video.addEventListener("progress", () => updateSeekUI());
  video.addEventListener("seeked", () => {
    updateSeekUI();
    captureThumb();
  });
  video.addEventListener("loadedmetadata", () => {
    // 「最近观看」续播：只跳一次，切线路不重复跳
    const startAt = Number(currentMedia?.startAt) || 0;
    if (startAt > 5 && Number.isFinite(video.duration) && video.duration > startAt + 5) {
      video.currentTime = startAt;
      if (currentMedia) currentMedia.startAt = 0;
      toast(`已从 ${formatTime(startAt)} 继续`, 4200);
    }
    updateResolution();
    updatePlaybackUI();
  });
  video.addEventListener("waiting", () => {
    if (!video.paused) {
      const percent = Math.round(bufferedRatio() * 100);
      setPanelState("loading", "正在缓冲", percent > 0 ? `已缓冲 ${percent}%` : "网络恢复后会自动继续");
    }
  });
  video.addEventListener("error", () => {
    if (!currentMedia) return;
    if (tryFailover("片源")) return;
    showErrorPanel(humanizeError().heading, humanizeError().detail);
  });

  /* ---------- 对外接口 ---------- */

  window.NovaPlayer = {
    open,
    close,
    isOpen: () => !playerScreen.hidden,
    // 兼容老调用：app.js 在极少数路径下还会问一句
    moveFocus: (direction) => {
      if (playerScreen.hidden) return false;
      if (direction === "up") {
        hideControls();
        return true;
      }
      if (direction === "down") {
        showControls(seek);
        return true;
      }
      const list = controlList();
      const index = list.indexOf(document.activeElement);
      const delta = direction === "left" ? -1 : 1;
      focusItem(list[(index + delta + list.length) % list.length]);
      return true;
    },
    switchLine,
    // 「最近观看」把进度里的地址喂回来之前，先把代理包装拆掉
    rawUrl: rawStreamUrl,
    lineInfo: () =>
      lineSelector
        ? {
            total: lineSelector.list.length,
            current: lineSelector.current()?.label || "",
            mode: lineSelector.mode
          }
        : null,
    state: () => ({ zone: state.zone, aspect: state.aspect, rate: state.rate, sleep: state.sleepMinutes })
  };
})();
