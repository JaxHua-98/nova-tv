/* NOVA TV · 电视直播（单页）
 * 左：内联播放器 + 当前节目；右：分组 + 频道列表。
 * 数据全部来自真实直播源与 EPG，不再有占位模块与子页面。
 */
(function () {
  "use strict";

  const stage = document.querySelector(".stage");
  const livePage = document.getElementById("livePage");
  if (!stage || !livePage) return;

  const icon = (id) =>
    `<svg class="icon" aria-hidden="true"><use href="#${id}" /></svg>`;

  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const state = {
    channels: [],
    groups: [],
    activeGroup: "全部",
    keyword: "",
    currentKey: "",
    epg: null,
    epgReady: false,
    loading: false,
    error: "",
    ranked: [],
    rankIndex: 0,
    recent: [],
    epgRate: 0,
    favorites: new Set(),
    playUrl: "",
    playStartedAt: 0
  };

  let hls = null;

  /* ---------------- 骨架 ---------------- */

  const LIVE_ENTRIES = [
    { key: "央视", label: "央视频道", desc: "CCTV · CGTN · CETV", tone: "cctv" },
    { key: "卫视", label: "卫视频道", desc: "省级卫视 · 高清", tone: "sat" },
    { key: "体育", label: "体育赛事", desc: "赛事直播 · 回看", tone: "sport" },
    { key: "全部", label: "全部频道", desc: "完整频道表", tone: "all" }
  ];

  function buildLiveHome() {
    return `
      <div class="lv-home" data-lv-home>
        <header class="lv-home-head">
          <h1 class="lv-home-title">电视直播</h1>
          <span class="lv-home-sub" data-lv-home-sub>正在加载频道…</span>
        </header>
        <div class="lv-entries">
          ${LIVE_ENTRIES.map(
            (entry) => `
            <button class="lv-entry focusable tone-${entry.tone}" type="button" tabindex="0" data-lv-entry="${entry.key}">
              <span class="lv-entry-label">${entry.label}</span>
              <span class="lv-entry-desc">${entry.desc}</span>
              <span class="lv-entry-count" data-lv-entry-count="${entry.key}">—</span>
            </button>
          `
          ).join("")}
        </div>
        <div class="lv-home-rails">
          <section class="lv-home-rail">
            <div class="lv-home-rail-head"><h2>最近观看</h2></div>
            <div class="lv-home-rail-track" data-lv-recent-track></div>
          </section>
          <section class="lv-home-rail">
            <div class="lv-home-rail-head"><h2>正在直播</h2><span data-lv-onair-count></span></div>
            <div class="lv-home-rail-track" data-lv-onair-track></div>
          </section>
          <section class="lv-home-rail">
            <div class="lv-home-rail-head"><h2>收藏频道</h2></div>
            <div class="lv-home-rail-track" data-lv-fav-track></div>
          </section>
        </div>
      </div>
    `;
  }

  function buildHome() {
    return `
      <div class="lv-bg"></div>
      <div class="lv-shell">
        <header class="lv-topbar">
          <button class="lv-brand brand-button focusable" type="button" tabindex="0" data-go-home aria-label="回到首页">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48"><path d="M12 36V12l20 20" fill="none" stroke="#fff" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" /><path d="M32 11 45 24 32 37z" fill="#fff" /></svg>
            </span>
            <span class="brand-name">NOVA</span>
          </button>
          <span class="lv-divider"></span>
          <h1 class="lv-title">电视直播</h1>
          <span class="lv-spacer"></span>
          <button class="lv-search focusable" type="button" tabindex="0" data-lv-search>
            ${icon("i-search")}<span data-lv-search-text>搜索频道</span>
          </button>
          <span class="lv-status is-empty" data-lv-status><i></i><span>未加载</span></span>
        <button class="lv-empty-cta focusable" type="button" data-lv-import hidden>去导入直播源</button>
        </header>

        <div class="lv-main">
          <section class="lv-player">
            <div class="lv-stage">
              <video data-lv-video playsinline preload="none" hidden></video>
              <div class="lv-blank" data-lv-blank>
                <div class="lv-blank-inner">
                  <span class="lv-blank-icon">${icon("i-tv")}</span>
                  <span data-lv-blank-text>选择右侧频道开始播放</span>
                </div>
              </div>
              <div class="lv-overlay">
                <span class="lv-channel-tag" data-lv-tag>未选择频道</span>
                <span class="lv-live-badge" data-lv-live hidden><i></i>LIVE</span>
              </div>
            </div>
            <div class="lv-info">
              <div class="lv-now-title" data-lv-now>暂无节目信息</div>
              <div class="lv-now-sub" data-lv-sub>接入直播源后这里会显示当前节目与进度</div>
              <div class="lv-progress"><i data-lv-progress></i></div>
              <div class="lv-controls">
                <button class="lv-btn primary focusable" type="button" tabindex="0" data-lv-play>${icon("i-play")}<span>播放</span></button>
                <button class="lv-btn focusable" type="button" tabindex="0" data-lv-line>${icon("i-refresh")}<span>换线路</span></button>
                <button class="lv-btn focusable" type="button" tabindex="0" data-lv-fullscreen>${icon("i-tv")}<span>全屏</span></button>
                <span class="lv-src" data-lv-src>—</span>
              </div>
            </div>
          </section>

          <aside class="lv-side">
            <div class="lv-side-head">
            <div class="lv-groups" data-lv-groups></div>
            <button class="lv-search-btn focusable" type="button" tabindex="0" data-lv-search>${icon("i-search")}<span>搜索</span></button>
          </div>
            <div class="lv-channels" data-lv-channels></div>
          </aside>
        </div>

        <div class="lv-hint">${icon("i-tune")}<span><b>↑↓</b> 选频道 · <b>←→</b> 换焦点 · <b>OK</b> 播放 · <b>分组</b> 过滤频道</span></div>
      </div>
    `;
  }

  const legacyShell = livePage.querySelector(".page-shell");
  if (legacyShell) legacyShell.remove();
  const legacyScrim = livePage.querySelector(".page-scrim");
  if (legacyScrim) legacyScrim.remove();
  livePage.classList.add("lv-home-host");
  livePage.insertAdjacentHTML("afterbegin", buildHome());
  const homeScreen = null;
  const listScreen = livePage.querySelector(".lv-shell");
  if (listScreen) listScreen.style.display = "";

  const $ = (selector) => livePage.querySelector(selector);
  const video = $("[data-lv-video]");
  const blank = $("[data-lv-blank]");
  const blankText = $("[data-lv-blank-text]");
  const tag = $("[data-lv-tag]");
  const liveBadge = $("[data-lv-live]");
  const nowTitle = $("[data-lv-now]");
  const nowSub = $("[data-lv-sub]");
  const progressBar = $("[data-lv-progress]");
  const srcLabel = $("[data-lv-src]");
  const groupBox = $("[data-lv-groups]");
  const listBox = $("[data-lv-channels]");
  const statusBox = $("[data-lv-status]");

  /* ---------------- 数据 ---------------- */

  // 按中国大陆归类：央视 / 卫视 / 地方，其余（港澳台、海外、宗教台）统一进「国际」且不计入「全部」
  const GROUP_ORDER = ["央视", "卫视", "体育", "地方", "国际"];

  // 央视付费频道在国内源里是中文名（风云音乐、第一剧场…），单独列一份关键词，避免被当成地方台
  const CCTV_PAY = /风云|第一剧场|文化精品|怀旧剧场|女性时尚|世界地理|兵器科技|卫生健康|央视台球|梨园|高尔夫|网球|体操|武术世界|求索/;

  const SPORT_RULE = /体育|足球|篮球|赛事|cctv-?5|风云足球|五星体育|劲爆体育|高尔夫|网球|台球|赛车|搏击|电竞/i;

  function bucketOf(channel) {
    const name = channel.name || "";
    if (SPORT_RULE.test(name)) return "体育";
    if (/cctv|cgtn|cetv|央视|中央/i.test(name) || CCTV_PAY.test(name)) return "央视";
    if (/卫视/.test(name)) return "卫视";
    if (/[\u4e00-\u9fa5]/.test(name)) return "地方";
    return "国际";
  }

  function isMainland(channel) {
    return bucketOf(channel) !== "国际";
  }

  function groupChannels() {
    const counter = new Map(GROUP_ORDER.map((name) => [name, 0]));
    state.channels.forEach((channel) => {
      const bucket = bucketOf(channel);
      counter.set(bucket, (counter.get(bucket) || 0) + 1);
    });
    const groups = GROUP_ORDER.map((name) => ({ name, count: counter.get(name) || 0 }));
    const mainland = counter.get("央视") + counter.get("卫视") + counter.get("体育") + counter.get("地方");
    const head = [{ name: "全部", count: mainland }];
    if (state.favorites.size) {
      const alive = state.channels.filter((channel) => state.favorites.has(channel.key)).length;
      if (alive) head.push({ name: "收藏", count: alive });
    }
    return [...head, ...groups];
  }

  function visibleChannels() {
    const keyword = state.keyword.trim().toLowerCase();
    return state.channels.filter((channel) => {
      if (state.activeGroup === "收藏") {
        if (!state.favorites.has(channel.key)) return false;
      } else if (state.activeGroup === "全部") {
        if (!isMainland(channel)) return false;
      } else if (bucketOf(channel) !== state.activeGroup) {
        return false;
      }
      if (!keyword) return true;
      return String(channel.name || "").toLowerCase().includes(keyword);
    });
  }

  function epgFor(channel) {
    if (!state.epg || !window.NovaEpg) return null;
    const entry = window.NovaEpg.matchChannel(state.epg, channel.tvgId, channel.name);
    if (!entry) return null;
    return window.NovaEpg.current(entry);
  }

  function clockText(timestamp) {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  /* ---------------- 渲染 ---------------- */

  function renderGroups() {
    state.groups = groupChannels();
    groupBox.innerHTML = state.groups
      .map(
        (group) => `
          <button class="lv-chip focusable${group.name === state.activeGroup ? " is-active" : ""}"
            type="button" tabindex="0" data-lv-group="${esc(group.name)}">
            <span>${esc(group.name)}</span><em>${group.count}</em>
          </button>
        `
      )
      .join("");
  }

  function renderChannels(options = {}) {
    const rows = visibleChannels();
    if (!rows.length) {
      listBox.innerHTML = `
        <div class="lv-empty">
          ${icon("i-tv")}
          <span>${state.channels.length ? "这个分组下没有频道" : "还没有直播源，去「设置 → 电视直播源」添加"}</span>
        </div>`;
      return;
    }
    listBox.innerHTML = rows
      .map((channel) => {
        const now = epgFor(channel);
        const percent = now ? Math.round(now.progress * 100) : 0;
        const bestQuality = Math.max(0, ...(channel.urls || []).map((item) => item.quality || 0));
        const qualityTag = bestQuality >= 1080 ? "1080p" : bestQuality >= 720 ? "720p" : "";
        const lines = (channel.urls || []).length;
        const sigClass = lines >= 5 ? "is-strong" : lines >= 3 ? "is-ok" : "is-weak";
        const signal = `<span class="lv-row-sig ${sigClass}"><i></i>${lines}</span>`;
        const star = state.favorites.has(channel.key)
          ? `<span class="lv-row-fav is-on" data-lv-fav="${esc(channel.key)}">★</span>`
          : "";
        const sub = now
          ? `${esc(now.title)} · ${clockText(now.start)}–${clockText(now.stop)}${qualityTag ? ` · ${qualityTag}` : ""}`
          : `${esc(channel.group || "其它")} · ${lines} 条线路${qualityTag ? ` · ${qualityTag}` : ""}`;
        // 台标统一走本地代理：图床常见跨域/防盗链/直连不通，失败则落回默认图标
        const logoSrc = channel.logo
          ? `/api/proxy?url=${encodeURIComponent(channel.logo)}`
          : "";
        const logo = `${icon("i-tv")}${
          logoSrc
            ? `<img src="${esc(logoSrc)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" onload="this.previousElementSibling.style.display='none'" />`
            : ""
        }`;
        return `
          <button class="lv-row focusable${channel.key === state.currentKey ? " is-playing" : ""}"
            type="button" tabindex="0" data-lv-key="${esc(channel.key)}">
            <span class="lv-row-logo">${logo}</span>
            <span class="lv-row-copy">
              <span class="lv-row-name">${esc(channel.name)}</span>
              <span class="lv-row-sub">${sub}</span>
            </span>
            ${star}

            ${signal}
            ${now ? `<span class="lv-row-bar">${percent}%</span>` : ""}
            ${now ? `<span class="lv-row-progress"><i style="width:${percent}%"></i></span>` : ""}
          </button>
        `;
      })
      .join("");

    if (options.focusKey) {
      const target = listBox.querySelector(`[data-lv-key="${CSS.escape(options.focusKey)}"]`);
      if (target) {
        target.focus({ preventScroll: true });
        target.classList.add("is-focused");
      }
    }
  }

  function renderStatus() {
    const importBtn = document.querySelector("[data-lv-import]");
    const total = state.channels.length;
    statusBox.classList.toggle("is-empty", !total);
    if (state.loading) {
      statusBox.querySelector("span").textContent = "加载频道中";
      return;
    }
    if (!total) {
      if (importBtn) importBtn.hidden = false;
      statusBox.querySelector("span").textContent = state.error || "没有频道";
      return;
    }
    if (importBtn) importBtn.hidden = true;
    const sources = window.NovaSources?.listLiveSources?.().filter((item) => item.enabled !== false).length || 0;
    const epg = state.epgReady && state.epgRate ? ` · EPG ${state.epgRate}%` : "";
    statusBox.querySelector("span").textContent = `${sources} 源 · ${total} 频道${epg}`;
  }

  /* ---------------- 线路探测与排序 ---------------- */

  const HISTORY_KEY = "nova.live.probe.v1";
  const probeCache = new Map();

  function urlHash(value) {
    let hash = 5381;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36);
  }

  function loadHistory() {
    try {
      return JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveHistory(map) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  async function probeOnce(url) {
    const started = performance.now();
    const done = (payload) => ({ url, ms: Math.round(performance.now() - started), ...payload });
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(7000),
        cache: "no-store"
      });
      if (!response.ok) return done({ ok: false, height: 0 });
      let text = await response.text();
      const master = /RESOLUTION=(\d+)x(\d+)/i.exec(text);
      let height = master ? Number(master[2]) : 0;
      let segment = text.split(/\r?\n/).find((line) => line && !line.startsWith("#"));
      if (!segment) return done({ ok: false, height });
      // master playlist：再拉一层子列表拿分片
      if (/\.m3u8(\?|$)/i.test(segment)) {
        const child = await fetch(segment, { signal: AbortSignal.timeout(7000), cache: "no-store" });
        if (!child.ok) return done({ ok: false, height });
        text = await child.text();
        const childRes = /RESOLUTION=(\d+)x(\d+)/i.exec(text);
        if (!height && childRes) height = Number(childRes[2]);
        segment = text.split(/\r?\n/).find((line) => line && !line.startsWith("#"));
        if (!segment) return done({ ok: false, height });
      }
      const media = await fetch(segment, { signal: AbortSignal.timeout(9000), cache: "no-store" });
      const size = media.ok ? (await media.arrayBuffer()).byteLength : 0;
      return done({ ok: media.ok && size > 512, height, bytes: size });
    } catch (error) {
      return done({ ok: false, height: 0, error: error.name });
    }
  }

  async function rankLines(channel) {
    const urls = channel.urls || [];
    if (!urls.length) return [];
    const cached = probeCache.get(channel.key);
    const fresh = cached && Date.now() - cached.at < 5 * 60 * 1000;
    const sample = urls.slice(0, 4);
    const probes = fresh
      ? cached.probes
      : await Promise.all(sample.map((line) => probeOnce(line.url)));
    const history = loadHistory();
    const items = urls
      .map((line, index) => {
        const probe = probes[index] || null;
        const hist = history[urlHash(line.url)] || null;
        const height = probe?.height || line.quality || hist?.h || 0;
        const score =
          (probe?.ok ? 1000 : 0) +
          (probe && !probe.ok ? -300 : 0) +
          (hist?.ok ? 150 : 0) +
          (hist?.ok === false ? -400 : 0) +
          height -
          Math.min(400, (probe?.ms || 6000) / 20);
        return { line, index, probe, height, score };
      })
      .sort((left, right) => right.score - left.score);

    probeCache.set(channel.key, { at: Date.now(), probes });
    return items;
  }

  /* ---------------- 全屏与遥控器 ---------------- */

  const playerEl = () => document.querySelector(".lv-player");
  let hideTimer = 0;
  let toastTimer = 0;

  function toast(message) {
    let node = document.querySelector(".lv-toast");
    if (!node) {
      node = document.createElement("div");
      node.className = "lv-toast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("is-on"), 1600);
  }

  function armHideUi() {
    const player = playerEl();
    if (!player || !player.classList.contains("is-fullscreen")) return;
    player.classList.add("show-ui");
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => player.classList.remove("show-ui"), 3000);
  }

  async function toggleFullscreen() {
    const host = document.querySelector(".stage");
    const player = playerEl();
    if (!player) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }
    try {
      await host.requestFullscreen?.();
      player.classList.add("is-fullscreen");
      armHideUi();
    } catch {
      /* 浏览器拒绝时保持内联 */
    }
  }

  document.addEventListener("fullscreenchange", () => {
    const player = playerEl();
    if (!player) return;
    if (!document.fullscreenElement) {
      player.classList.remove("is-fullscreen", "show-ui");
      clearTimeout(hideTimer);
    }
  });

  function switchChannel(step) {
    const list = visibleChannels();
    if (!list.length) return;
    const index = list.findIndex((channel) => channel.key === state.currentKey);
    const next = list[(index + step + list.length) % list.length];
    if (!next || next.key === state.currentKey) return;
    playChannel(next);
    toast(next.name);
    armHideUi();
  }

  function changeVolume(delta) {
    if (!video) return;
    const next = Math.max(0, Math.min(1, (video.volume || 0) + delta));
    video.volume = next;
    video.muted = next === 0;
    toast(`音量 ${Math.round(next * 100)}%`);
  }

  function togglePlay() {
    if (!video || video.hidden) return;
    if (video.paused) {
      video.play().catch(() => {});
      toast("播放");
    } else {
      video.pause();
      toast("暂停");
    }
    armHideUi();
  }

  document.addEventListener("keydown", (event) => {
    const player = playerEl();
    const fullscreen = player?.classList.contains("is-fullscreen");
    if (!fullscreen) {
      if (event.key === "Escape" && listScreen && listScreen.style.display !== "none") {
        event.preventDefault();
        backToLiveHome();
      }
      return;
    }
    if (event.key === "Escape") return;
    const key = event.key;
    if (key === "ArrowRight" || key === "ArrowLeft") {
      event.preventDefault();
      switchChannel(key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      changeVolume(key === "ArrowUp" ? 0.1 : -0.1);
      return;
    }
    if (key === " " || key === "Enter") {
      event.preventDefault();
      togglePlay();
    }
  });

  document.addEventListener("mousemove", () => armHideUi());
  document.querySelector(".lv-stage")?.addEventListener("dblclick", () => toggleFullscreen());

  /* ---------------- 最近观看 ---------------- */

  const RECENT_KEY = "nova.live.recent.v1";

  function loadRecent() {
    try {
      return JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function pushRecent(channel) {
    if (!channel) return;
    const list = loadRecent().filter((item) => item.key !== channel.key);
    list.unshift({
      key: channel.key,
      name: channel.name,
      logo: channel.logo || "",
      at: Date.now()
    });
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
    } catch {
      /* ignore */
    }
    state.recent = list.slice(0, 8);
  }

  function renderBlank() {
    const valid = loadRecent().filter((item) =>
      state.channels.some((channel) => channel.key === item.key)
    );
    if (!valid.length) return;
    const cards = valid
      .slice(0, 4)
      .map((item) => {
        const src = item.logo
          ? `/api/proxy?url=${encodeURIComponent(item.logo)}`
          : "";
        return `
          <button class="lv-recent-card focusable" type="button" tabindex="0" data-lv-key="${esc(item.key)}">
            <span class="lv-recent-logo">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()" />` : icon("i-tv")}</span>
            <span class="lv-recent-name">${esc(item.name)}</span>
          </button>
        `;
      })
      .join("");
    blank.innerHTML = `
      <div class="lv-recent">
        <span class="lv-recent-title">最近观看</span>
        <div class="lv-recent-row">${cards}</div>
      </div>
    `;
  }

  /* ---------------- 收藏与数字直选 ---------------- */

  const FAV_KEY = "nova.live.fav.v1";

  function loadFavorites() {
    try {
      const list = JSON.parse(window.localStorage.getItem(FAV_KEY) || "[]");
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  function saveFavorites(set) {
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
    } catch {
      /* ignore */
    }
  }

  function toggleFavorite(channel) {
    if (!channel) return;
    const favKey = `live:${channel.key}`;
    const wantSaved = !state.favorites.has(channel.key);
    if (wantSaved) state.favorites.add(channel.key);
    else state.favorites.delete(channel.key);
    saveFavorites(state.favorites);
    // 同步到统一收藏，片单页「我的收藏」里能看到这个台
    if (Boolean(window.NovaFav?.has?.(favKey)) !== wantSaved) {
      window.NovaFav?.toggle?.({
        key: favKey,
        title: channel.name || "",
        image: channel.logo || "",
        kind: "live",
        source: channel.group || "",
        meta: "直播频道"
      });
    }
    toast(wantSaved ? `已收藏 ${channel.name}` : `已取消收藏 ${channel.name}`);
    renderGroups();
    renderChannels({ focusKey: channel.key });
  }

  // 遥控器长按 OK 收藏
  let okTimer = 0;
  let okFired = false;
  livePage.addEventListener("keydown", (event) => {
    const row = event.target.closest?.(".lv-row");
    if (!row) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.repeat) return;
    okFired = false;
    clearTimeout(okTimer);
    okTimer = window.setTimeout(() => {
      okFired = true;
      const channel = state.channels.find((item) => item.key === row.dataset.lvKey);
      toggleFavorite(channel);
    }, 600);
  });
  livePage.addEventListener("keyup", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    clearTimeout(okTimer);
    if (okFired) {
      event.preventDefault();
      event.stopPropagation();
      okFired = false;
    }
  }, true);

  // 数字键直选：按 N 跳到第 N 个，连续输入拼两位数
  let digitBuffer = "";
  let digitTimer = 0;
  document.addEventListener("keydown", (event) => {
    if (!/^[0-9]$/.test(event.key)) return;
    if (!livePage || livePage.hidden) return;
    if (document.activeElement === document.querySelector("[data-lv-search]")) return;
    digitBuffer += event.key;
    clearTimeout(digitTimer);
    digitTimer = window.setTimeout(() => {
      digitBuffer = "";
    }, 900);
    const target = Number(digitBuffer);
    const rows = [...livePage.querySelectorAll(".lv-channels .lv-row")];
    if (target > 0 && target <= rows.length) {
      rows[target - 1].scrollIntoView({ block: "center" });
      rows[target - 1].focus({ preventScroll: true });
      rows[target - 1].classList.add("is-focused");
      toast(`跳到第 ${target} 个`);
    }
    if (digitBuffer.length >= 2) digitBuffer = "";
  });

  /* ---------------- 直播首页导航 ---------------- */

  const homeNav = { column: 0 };

  function homeTracks() {
    return [
      livePage.querySelector("[data-lv-recent-track]"),
      livePage.querySelector("[data-lv-onair-track]"),
      livePage.querySelector("[data-lv-fav-track]")
    ].filter(Boolean);
  }

  function navigateLiveHome(direction, active) {
    if (!homeScreen) return false;
    const entries = [...livePage.querySelectorAll("[data-lv-entry]")];
    const tracks = homeTracks();
    const focusTo = (node) => {
      if (!node) return false;
      node.focus({ preventScroll: true });
      node.classList.add("is-focused");
      node.scrollIntoView({ block: "nearest" });
      return true;
    };

    if (entries.includes(active)) {
      const index = entries.indexOf(active);
      if (direction === "left" || direction === "right") {
        const next = entries[index + (direction === "left" ? -1 : 1)];
        if (next) return focusTo(next);
        return true;
      }
      if (direction === "down") {
        // 跳过空的轨道（比如没有最近观看时），落到第一个有内容的轨道
        for (const track of tracks) {
          const list = [...track.querySelectorAll(".focusable")];
          if (!list.length) continue;
          return focusTo(list[Math.min(index, list.length - 1)]) || true;
        }
        // 全空时给个出口，别让遥控器卡死
        const exit = livePage.querySelector("[data-lv-search]") || livePage.querySelector("[data-lv-home] .focusable");
        return focusTo(exit) || true;
      }
      return true;
    }

    const track = active.closest?.(".lv-home-rail-track");
    if (track) {
      const railIndex = tracks.indexOf(track);
      const list = [...track.querySelectorAll(".focusable")];
      const index = list.indexOf(active);
      if (direction === "left" || direction === "right") {
        const next = list[index + (direction === "left" ? -1 : 1)];
        if (!next) return true;
        homeNav.column = index + (direction === "left" ? -1 : 1);
        return focusTo(next);
      }
      if (direction === "up") {
        homeNav.column = index;
        if (railIndex === 0) {
          return focusTo(entries[Math.min(index, entries.length - 1)]) || true;
        }
        for (let i = railIndex - 1; i >= 0; i -= 1) {
          const list = [...tracks[i].querySelectorAll(".focusable")];
          if (!list.length) continue;
          return focusTo(list[Math.min(homeNav.column, list.length - 1)]) || true;
        }
        return true;
      }
      if (direction === "down") {
        homeNav.column = index;
        for (let i = railIndex + 1; i < tracks.length; i += 1) {
          const list = [...tracks[i].querySelectorAll(".focusable")];
          if (!list.length) continue;
          return focusTo(list[Math.min(homeNav.column, list.length - 1)]) || true;
        }
        return true;
      }
      return true;
    }
    return false;
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-lv-import]")) return;
    window.NovaPages?.open?.("settings", null, { section: "lives" });
  });

  state.favorites = loadFavorites();
  // 合并统一收藏里的直播条目：片单页加过的要出现在直播收藏里
  state.unifiedLive = new Set(
    (window.NovaFav?.list?.() || [])
      .filter((entry) => entry.kind === "live" && String(entry.key).startsWith("live:"))
      .map((entry) => String(entry.key).slice(5))
  );
  state.unifiedLive.forEach((key) => state.favorites.add(key));
  saveFavorites(state.favorites);

  // 片单页删除 / 新增直播收藏时，保持两边同步
  document.addEventListener("nova:fav-changed", (event) => {
    const list = event.detail?.list || window.NovaFav?.list?.() || [];
    const nextLive = new Set(
      list
        .filter((entry) => entry.kind === "live" && String(entry.key).startsWith("live:"))
        .map((entry) => String(entry.key).slice(5))
    );
    const prev = state.unifiedLive || new Set();
    prev.forEach((key) => {
      if (!nextLive.has(key)) state.favorites.delete(key);
    });
    nextLive.forEach((key) => state.favorites.add(key));
    state.unifiedLive = nextLive;
    saveFavorites(state.favorites);
    if (!livePage.hidden) {
      renderGroups();
      renderChannels({ focusKey: state.activeKey });
    }
  });

  /* ---------------- 直播首页 ---------------- */

  function entryChannels(key) {
    if (key === "全部") return state.channels;
    return state.channels.filter((channel) => bucketOf(channel) === key);
  }

  function paintLiveHome() {
    const total = state.channels.length;
    const sub = livePage.querySelector("[data-lv-home-sub]");
    if (sub) sub.textContent = total ? `${total} 个频道 · ${state.epgReady ? "节目单已就绪" : "节目单加载中"}` : "还没有直播源";
    LIVE_ENTRIES.forEach((entry) => {
      const node = livePage.querySelector(`[data-lv-entry-count="${entry.key}"]`);
      if (node) node.textContent = total ? `${entryChannels(entry.key).length} 个` : "—";
    });

    const recentTrack = livePage.querySelector("[data-lv-recent-track]");
    if (recentTrack) {
      const recent = loadRecent().filter((item) => state.channels.some((channel) => channel.key === item.key));
      recentTrack.innerHTML = recent.length
        ? recent.slice(0, 8).map((item) => miniCard(item)).join("")
        : `<span class="lv-home-tip">还没有观看记录</span>`;
    }

    const onairTrack = livePage.querySelector("[data-lv-onair-track]");
    const onairCount = livePage.querySelector("[data-lv-onair-count]");
    if (onairTrack) {
      const rows = [];
      for (const channel of state.channels) {
        const entry = state.epg && window.NovaEpg ? window.NovaEpg.matchChannel(state.epg, channel.tvgId, channel.name) : null;
        const now = entry ? window.NovaEpg.current(entry) : null;
        if (now) rows.push({ channel, now });
        if (rows.length >= 10) break;
      }
      if (onairCount) onairCount.textContent = rows.length ? `${rows.length} 个正在播` : "";
      onairTrack.innerHTML = rows.length
        ? rows.map((row) => onairCard(row)).join("")
        : `<span class="lv-home-tip">${state.epgReady ? "暂无节目单数据" : "节目单加载中…"}</span>`;
    }

    const favTrack = livePage.querySelector("[data-lv-fav-track]");
    if (favTrack) {
      const favs = state.channels.filter((channel) => state.favorites.has(channel.key));
      favTrack.innerHTML = favs.length
        ? favs.slice(0, 10).map((channel) => miniCard({ key: channel.key, name: channel.name, logo: channel.logo || "" })).join("")
        : `<span class="lv-home-tip">长按 OK 可以收藏频道</span>`;
    }
  }

  function miniCard(item) {
    const src = item.logo ? `/api/proxy?url=${encodeURIComponent(item.logo)}` : "";
    return `
      <button class="lv-mini focusable" type="button" tabindex="0" data-lv-key="${esc(item.key)}">
        <span class="lv-mini-logo">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()" />` : icon("i-tv")}</span>
        <span class="lv-mini-name">${esc(item.name)}</span>
      </button>
    `;
  }

  function onairCard(row) {
    const src = row.channel.logo ? `/api/proxy?url=${encodeURIComponent(row.channel.logo)}` : "";
    const percent = Math.round((row.now.progress || 0) * 100);
    return `
      <button class="lv-air focusable" type="button" tabindex="0" data-lv-key="${esc(row.channel.key)}">
        <span class="lv-air-logo">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()" />` : icon("i-tv")}</span>
        <span class="lv-air-name">${esc(row.channel.name)}</span>
        <span class="lv-air-now">${esc(row.now.title)}</span>
        <span class="lv-air-bar"><i style="width:${percent}%"></i></span>
      </button>
    `;
  }

  function openEntry(key) {
    state.activeGroup = key;
    if (homeScreen) homeScreen.style.display = "none";
    if (listScreen) listScreen.style.display = "";
    renderGroups();
    renderChannels();
    const first = livePage.querySelector(".lv-channels .lv-row");
    if (first) {
      first.focus({ preventScroll: true });
      first.classList.add("is-focused");
    }
  }

  function backToLiveHome() {
    if (homeScreen) homeScreen.style.display = "";
    if (listScreen) listScreen.style.display = "none";
    paintLiveHome();
    const first = livePage.querySelector("[data-lv-entry]");
    if (first) {
      first.focus({ preventScroll: true });
      first.classList.add("is-focused");
    }
  }

  /* ---------------- 节目单 ---------------- */

  function openEpgPanel(channel) {
    if (!channel || !state.epg) return;
    const entry = window.NovaEpg?.matchChannel?.(state.epg, channel.tvgId, channel.name);
    if (!entry) {
      toast("这个频道没有节目单");
      return;
    }
    const now = window.NovaEpg.current(entry);
    const list = window.NovaEpg.timeline(entry, Date.now(), 12);
    let panel = livePage.querySelector("[data-lv-epg-panel]");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "lv-epg";
      panel.dataset.lvEpgPanel = "1";
      livePage.querySelector(".lv-shell")?.appendChild(panel);
    }
    panel.hidden = false;
    panel.innerHTML = `
      <div class="lv-epg-head">
        <span class="lv-epg-title">${esc(channel.name)} · 节目单</span>
        <button class="lv-btn focusable" type="button" tabindex="0" data-lv-epg-close>关闭</button>
      </div>
      <div class="lv-epg-list">
        ${list
          .map((program) => {
            const live = now && program.start === now.start;
            return `<div class="lv-epg-row${live ? " is-live" : ""}">
              <span class="lv-epg-time">${clockText(program.start)}</span>
              <span class="lv-epg-name">${esc(program.title)}</span>
              ${live ? `<span class="lv-epg-badge">正在播</span>` : ""}
            </div>`;
          })
          .join("")}
      </div>
    `;
    const close = panel.querySelector("[data-lv-epg-close]");
    if (close) {
      close.focus({ preventScroll: true });
      close.classList.add("is-focused");
    }
  }

  function closeEpgPanel() {
    const panel = livePage.querySelector("[data-lv-epg-panel]");
    if (panel) panel.hidden = true;
  }

  /* ---------------- 播放 ---------------- */

  function currentChannel() {
    return state.channels.find((channel) => channel.key === state.currentKey) || null;
  }

  function destroyPlayer() {
    if (hls) {
      try {
        hls.destroy();
      } catch {
        /* ignore */
      }
      hls = null;
    }
    video.removeAttribute("src");
    video.load();
  }

  function attach(url) {
    const proxied = `/api/proxy?url=${encodeURIComponent(url)}`;
    state.playUrl = url;
    state.playStartedAt = Date.now();
    destroyPlayer();
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // 直播源经常整条失效，快速失败好过长时间转圈
        manifestLoadingTimeOut: 9000,
        manifestLoadingMaxRetry: 0,
        levelLoadingTimeOut: 9000,
        levelLoadingMaxRetry: 0,
        fragLoadingTimeOut: 14000,
        fragLoadingMaxRetry: 1
      });
      hls.loadSource(proxied);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) playNextLine("线路不可用");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = proxied;
    } else {
      blankText.textContent = "当前浏览器不支持 HLS 播放";
      return;
    }
    video.play().catch(() => {});
  }

  async function playChannel(channel) {
    if (!channel) return;
    state.currentKey = channel.key;
    pushRecent(channel);
    tag.textContent = channel.name;
    liveBadge.hidden = false;
    video.hidden = true;
    blank.hidden = false;
    blankText.textContent = `正在检测 ${Math.min(4, (channel.urls || []).length)} 条线路…`;
    srcLabel.textContent = "探测中…";
    renderChannels();
    renderNowPlaying();

    // 历史里验证过能播的线路：立即起播，探测放后台，第二次点同一个台就是秒开
    const history = loadHistory();
    const known = (channel.urls || [])
      .map((line) => ({ line, hist: history[urlHash(line.url)] || null }))
      .filter((item) => item.hist?.ok)
      .sort((left, right) => (right.hist.h || 0) - (left.hist.h || 0))[0];
    if (known) {
      state.ranked = [
        { line: known.line, height: known.hist.h || 0, probe: { ok: true, ms: known.hist.ms || 0 } }
      ];
      state.rankIndex = 0;
      playRanked(0);
      rankLines(channel).then((items) => {
        state.ranked = items;
      });
      return;
    }

    const ranked = await rankLines(channel);
    if (!ranked.length) {
      blankText.textContent = "这个频道没有可用地址";
      return;
    }
    state.ranked = ranked;
    playRanked(0);
  }

  function playRanked(index) {
    const entry = state.ranked?.[index];
    if (!entry) {
      video.hidden = true;
      blank.hidden = false;
      blankText.textContent = "所有线路均不可用";
      liveBadge.hidden = true;
      srcLabel.textContent = "无可用线路";
      return;
    }
    state.rankIndex = index;
    const height = entry.height ? `${entry.height}p` : "分辨率未知";
    const speed = entry.probe ? `${entry.probe.ms}ms` : "未测速";
    srcLabel.textContent = `${height} · ${speed} · ${entry.line.sourceName || "直播源"}`;
    blank.hidden = true;
    video.hidden = false;
    attach(entry.line.url);
  }

  function playNextLine() {
    playRanked((state.rankIndex || 0) + 1);
  }

  // 缓冲指示
  const spinner = $("[data-lv-spinner]");
  video.addEventListener("waiting", () => spinner?.classList.add("is-on"));
  video.addEventListener("playing", () => spinner?.classList.remove("is-on"));
  video.addEventListener("canplay", () => spinner?.classList.remove("is-on"));
  video.addEventListener("pause", () => spinner?.classList.remove("is-on"));

  // 起播后回写实测分辨率：m3u 标注不可信，只认 videoHeight
  video.addEventListener("loadedmetadata", () => {
    const height = video.videoHeight;
    if (!height || !state.playUrl) return;
    const map = loadHistory();
    const key = urlHash(state.playUrl);
    const cost = Date.now() - (state.playStartedAt || Date.now());
    map[key] = { h: height, ms: cost, ok: true, at: Date.now() };
    saveHistory(map);
    const entry = state.ranked?.[state.rankIndex];
    if (entry) entry.height = height;
    srcLabel.textContent = `${height}p · ${cost}ms · ${entry?.line?.sourceName || "直播源"}`;
  });

  function renderNowPlaying() {
    const channel = currentChannel();
    if (!channel) return;
    const now = epgFor(channel);
    if (now) {
      nowTitle.textContent = now.title;
      const next = now.next ? ` · 下一档 ${now.next.title}` : "";
      nowSub.textContent = `${clockText(now.start)}–${clockText(now.stop)} · ${Math.round(now.progress * 100)}%${next}`;
      progressBar.style.width = `${Math.round(now.progress * 100)}%`;
    } else {
      nowTitle.textContent = channel.name;
      nowSub.textContent = state.epgReady
        ? "这个频道暂无节目单"
        : "正在加载节目单…";
      progressBar.style.width = "0%";
    }
  }

  /* ---------------- 加载 ---------------- */

  async function loadChannels(force = false) {
    if (state.loading) return;
    if (!window.NovaSources) return;
    state.loading = true;
    state.error = "";
    renderStatus();
    try {
      const result = await window.NovaSources.loadLiveChannels({ force });
      state.channels = result.channels || [];
      const buckets = new Set(state.channels.map(bucketOf));
      if (state.activeGroup !== "全部" && !buckets.has(state.activeGroup)) {
        state.activeGroup = "全部";
      }
      if (state.channels.length && !state.currentKey) {
        state.currentKey = state.channels[0].key;
      }
    } catch (error) {
      state.channels = [];
      state.error = error?.message || "直播源加载失败";
    } finally {
      state.loading = false;
      renderGroups();
      renderChannels();
      renderStatus();
      renderNowPlaying();
      renderBlank();
      paintLiveHome();
    }
  }

  async function loadEpg() {
    if (!window.NovaEpg) return;
    try {
      state.epg = await window.NovaEpg.load();
      state.epgReady = true;
      let matched = 0;
      state.channels.forEach((channel) => {
        if (window.NovaEpg.matchChannel(state.epg, channel.tvgId, channel.name)) matched += 1;
      });
      state.epgRate = state.channels.length
        ? Math.round((matched / state.channels.length) * 100)
        : 0;
      renderChannels();
      renderNowPlaying();
      renderStatus();
      paintLiveHome();
    } catch {
      state.epgReady = false;
    }
  }

  /* ---------------- 交互 ---------------- */

  livePage.addEventListener("click", (event) => {
    if (event.target.closest("[data-lv-search]")) {
      window.NovaSearch?.open?.({ filter: "live" });
      return;
    }
    const entry = event.target.closest("[data-lv-entry]");
    if (entry) {
      openEntry(entry.dataset.lvEntry);
      return;
    }

    const chip = event.target.closest("[data-lv-group]");
    if (chip) {
      state.activeGroup = chip.dataset.lvGroup;
      renderGroups();
      renderChannels({ focusKey: undefined });
      const next = listBox.querySelector(".lv-row");
      next?.focus({ preventScroll: true });
      next?.classList.add("is-focused");
      return;
    }

    if (event.target.closest("[data-lv-epg-close]")) {
      closeEpgPanel();
      return;
    }
    const epgBtn = event.target.closest(".lv-row-epg");
    if (epgBtn) {
      const channel = state.channels.find((item) => item.key === epgBtn.dataset.lvEpg);
      openEpgPanel(channel);
      return;
    }
    const row = event.target.closest("[data-lv-key]");
    if (row) {
      const channel = state.channels.find((item) => item.key === row.dataset.lvKey);
      playChannel(channel);
      return;
    }

    if (event.target.closest("[data-lv-play]")) {
      const channel = currentChannel();
      if (channel) playChannel(channel);
      return;
    }

    if (event.target.closest("[data-lv-line]")) {
      playNextLine("手动切换");
      return;
    }

    if (event.target.closest("[data-lv-fullscreen]")) {
      toggleFullscreen();
      return;
    }

    if (event.target.closest("[data-lv-search]")) {
      const keyword = window.prompt("搜索频道", state.keyword);
      if (keyword === null) return;
      state.keyword = keyword.trim();
      $("[data-lv-search-text]").textContent = state.keyword || "搜索频道";
      renderChannels();
    }
  });

  document.addEventListener("nova:sources-changed", () => loadChannels(true));

  // 首次进入时预热；直播页打开时确保已有数据
  window.setTimeout(() => {
    loadChannels();
    loadEpg();
  }, 300);

  // 预览调试入口：?page=live 直接打开直播页
  const params = new URLSearchParams(window.location.search);
  if (params.get("page") === "live") {
    window.setTimeout(() => window.NovaPages?.open?.("live"), 220);
  }

  window.NovaLiveUI = {
    navigateHome: navigateLiveHome,
    home: backToLiveHome,
    openEntry,
    reload: () => loadChannels(true),
    play: (key) => {
      const channel = state.channels.find((item) => item.key === key);
      if (channel) playChannel(channel);
    },
    // 离开直播页时停流：否则 HLS 在后台继续拉流、声音也跟着跑
    stop: () => {
      destroyPlayer();
      state.playUrl = "";
    },
    state
  };
})();
