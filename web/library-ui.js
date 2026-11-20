/*
  NOVA TV · 聚合片库页面（视觉框架版）
  - 只做 UI 与交互：卡片、Banner 全部使用占位，不接真实影视数据
  - 焦点导航按元素几何位置计算，方向键在任意布局下都能走通
  - 旧版片库渲染仍在隐藏容器里运行，数据链路不受影响
*/
(function () {
  "use strict";

  const page = document.getElementById("libraryPage");
  if (!page) return;

  const CATEGORIES = [
    { key: "movie", label: "电影", desc: "院线大片 · 经典佳作", tone: "violet", icon: "i-film" },
    { key: "series", label: "电视剧", desc: "热播剧集 · 海外剧场", tone: "rose", icon: "i-tv" },
    { key: "variety", label: "综艺", desc: "热门综艺 · 真人秀", tone: "amber", icon: "i-flame" },
    { key: "anime", label: "动漫", desc: "热门番剧 · 经典动画", tone: "sky", icon: "i-star" },
    { key: "doc", label: "纪录片", desc: "自然 · 人文 · 历史", tone: "mint", icon: "i-eye" },
    { key: "more", label: "更多分类", desc: "体育 · 少儿 · 短剧", tone: "plum", icon: "i-grid" }
  ];

  const FILTERS = [
    { key: "type", label: "内容类型", options: ["全部", "电影", "电视剧", "综艺", "动漫"] },
    { key: "region", label: "地区", options: ["全部", "中国大陆", "中国香港", "中国台湾", "美国", "韩国", "日本"] },
    { key: "year", label: "年份", options: ["全部", "2026", "2025", "2024", "2023", "更早"] },
    { key: "genre", label: "题材", options: ["全部", "科幻", "悬疑", "爱情", "动作", "喜剧", "纪录片"] },
    { key: "quality", label: "清晰度", options: ["全部", "4K", "1080P", "720P"] }
  ];

  const SORTS = [
    { key: "default", label: "综合排序" },
    { key: "latest", label: "最新更新" },
    { key: "hot", label: "热度优先" },
    { key: "score", label: "评分优先" }
  ];

  const state = {
    category: "movie",
    panel: "",
    filter: { type: "全部", region: "全部", year: "全部", genre: "全部", quality: "全部" },
    sort: "default"
  };

  /* ---------- 占位内容 ---------- */

  const ART_TONES = ["violet", "rose", "sky", "amber", "plum", "mint"];

  function cardMarkup(index) {
    const tone = ART_TONES[index % ART_TONES.length];
    return `
      <button class="lib-card poster-card focusable" type="button" data-lib-card="${index + 1}" aria-label="占位内容 ${index + 1}">
        <span class="poster-cover tone-${tone}">
          <span class="lib-card-grain"></span>
          <span class="lib-card-shade"></span>
          <span class="poster-badges"><span class="poster-status"></span></span>
          <span class="poster-copy">
            <span class="poster-title"></span>
            <span class="poster-meta"></span>
          </span>
        </span>
      </button>
    `;
  }

  function renderRails() {
    const hot = document.getElementById("libHotRail");
    if (hot) hot.innerHTML = Array.from({ length: 6 }, (_, i) => cardMarkup(i)).join("");
  }

  let currentBannerItem = null;

  function renderCategories() {
    const first = document.getElementById("libCatRowTop");
    const second = document.getElementById("libCatRowBottom");
    if (!first || !second) return;
    const build = (item) => `
      <button class="lib-cat focusable tone-${item.tone}" type="button" data-lib-category="${item.key}" aria-label="${item.label}">
        <span class="lib-cat-glow"></span>
        <span class="lib-cat-icon"><svg class="icon"><use href="#${item.icon}" /></svg></span>
        <span class="lib-cat-copy">
          <strong>${item.label}</strong>
          <em>${item.desc}</em>
        </span>
      </button>
    `;
    first.innerHTML = CATEGORIES.slice(0, 3).map(build).join("");
    second.innerHTML = CATEGORIES.slice(3).map(build).join("");
  }

  function paintCategoryState() {
    page.querySelectorAll("[data-lib-category]").forEach((node) => {
      const active = node.dataset.libCategory === state.category;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", String(active));
    });
  }

  function renderCategoriesInteractions() {
    page.querySelectorAll("[data-lib-category]").forEach((node) => {
      node.addEventListener("click", () => {
        state.category = node.dataset.libCategory;
        paintCategoryState();
        if (!window.NovaCategories) return;
        if (node.dataset.libCategory === "more") {
          window.NovaCategories.openMore?.();
        } else {
          window.NovaCategories.open(node.dataset.libCategory);
        }
      });
    });
  }

  /* ---------- 筛选 / 排序面板 ---------- */

  function panelMarkup() {
    return `
      <div class="lib-panel-card" role="dialog" aria-modal="true">
        <div class="lib-panel-head">
          <div>
            <span class="lib-panel-kicker" id="libPanelKicker">FILTER</span>
            <h2 id="libPanelTitle">筛选</h2>
          </div>
          <button class="lib-panel-close focusable" type="button" data-lib-panel-close aria-label="关闭">
            <svg class="icon"><use href="#i-close" /></svg>
          </button>
        </div>
        <div class="lib-panel-body" id="libPanelBody"></div>
        <div class="lib-panel-foot">
          <button class="lib-btn ghost focusable" type="button" data-lib-panel-close><span>取消</span></button>
          <button class="lib-btn primary focusable" type="button" data-lib-panel-apply><span>应用</span></button>
        </div>
      </div>
    `;
  }

  function paintPanelBody() {
    const body = document.getElementById("libPanelBody");
    const kicker = document.getElementById("libPanelKicker");
    const title = document.getElementById("libPanelTitle");
    if (!body) return;

    if (state.panel === "sort") {
      if (kicker) kicker.textContent = "SORT";
      if (title) title.textContent = "排序";
      body.innerHTML = `
        <div class="lib-option-list">
          ${SORTS.map(
            (item) => `
            <button class="lib-option focusable ${state.sort === item.key ? "is-active" : ""}" type="button" data-lib-sort="${item.key}">
              <span>${item.label}</span>
              <svg class="icon"><use href="#i-check" /></svg>
            </button>`
          ).join("")}
        </div>
      `;
      return;
    }

    if (kicker) kicker.textContent = "FILTER";
    if (title) title.textContent = "筛选";
    body.innerHTML = FILTERS.map(
      (group) => `
      <div class="lib-filter-group">
        <span class="lib-filter-label">${group.label}</span>
        <div class="lib-chip-row">
          ${group.options
            .map(
              (option) => `
            <button class="lib-chip focusable ${state.filter[group.key] === option ? "is-active" : ""}" type="button"
              data-lib-filter="${group.key}" data-lib-value="${option}">${option}</button>`
            )
            .join("")}
        </div>
      </div>`
    ).join("");
  }

  function bindPanelBody() {
    document.querySelectorAll("[data-lib-sort]").forEach((node) => {
      node.addEventListener("click", () => {
        state.sort = node.dataset.libSort;
        paintPanelBody();
        bindPanelBody();
      });
    });
    document.querySelectorAll("[data-lib-filter]").forEach((node) => {
      node.addEventListener("click", () => {
        state.filter[node.dataset.libFilter] = node.dataset.libValue;
        paintPanelBody();
        bindPanelBody();
      });
    });
  }

  function openPanel(kind) {
    const panel = document.getElementById("libPanel");
    if (!panel) return;
    state.panel = kind;
    panel.innerHTML = panelMarkup();
    panel.hidden = false;
    paintPanelBody();
    bindPanelBody();

    panel.querySelectorAll("[data-lib-panel-close]").forEach((node) => {
      node.addEventListener("click", () => closePanel(true));
    });
    const apply = panel.querySelector("[data-lib-panel-apply]");
    apply?.addEventListener("click", () => closePanel(true));
    focusFirst(panel);
  }

  function closePanel(restoreFocus) {
    const panel = document.getElementById("libPanel");
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    panel.innerHTML = "";
    const previous = state.panel === "sort" ? "libSortButton" : "libFilterButton";
    state.panel = "";
    if (restoreFocus) focusEl(document.getElementById(previous));
  }

  /* ---------- 焦点 ---------- */

  function isFocusable(node) {
    if (!node || node.disabled) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2 && node.offsetParent !== null;
  }

  function focusEl(node) {
    if (!node) return false;
    page.querySelectorAll(".is-focused").forEach((el) => el.classList.remove("is-focused"));
    node.classList.add("is-focused");
    node.focus({ preventScroll: true });
    return true;
  }

  function focusFirst(scope) {
    const candidates = [...(scope || page).querySelectorAll(".focusable")].filter(isFocusable);
    if (candidates.length) focusEl(candidates[0]);
  }

  function spatial(active, direction) {
    const items = [...page.querySelectorAll(".focusable")].filter(isFocusable);
    const a = active.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;

    for (const node of items) {
      if (node === active) continue;
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = cx - ax;
      const dy = cy - ay;
      let primary = 0;
      let secondary = 0;

      if (direction === "left") {
        if (dx > -12) continue;
        primary = -dx;
        secondary = Math.abs(dy);
      } else if (direction === "right") {
        if (dx < 12) continue;
        primary = dx;
        secondary = Math.abs(dy);
      } else if (direction === "up") {
        if (dy > -12) continue;
        primary = -dy;
        secondary = Math.abs(dx);
      } else if (direction === "down") {
        if (dy < 12) continue;
        primary = dy;
        secondary = Math.abs(dx);
      } else {
        continue;
      }

      // 主轴距离为主，垂直错位加重惩罚，避免斜着跳太远
      const score = primary + secondary * 1.8;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  function activeElement() {
    const focused = page.querySelector(".focusable.is-focused");
    if (focused) return focused;
    if (document.activeElement && page.contains(document.activeElement)) return document.activeElement;
    return null;
  }

  /* ---------- 键盘 ---------- */

  const KEY_MAP = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down"
  };

  function onKeyDown(event) {
    if (page.hidden) return;
    const panel = document.getElementById("libPanel");
    const panelOpen = panel && !panel.hidden;

    if (event.key === "Escape") {
      if (panelOpen) {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      const active = activeElement();
      if (active) {
        event.preventDefault();
        event.stopPropagation();
        active.click();
      }
      return;
    }

    const direction = KEY_MAP[event.key];
    if (!direction) return;

    const active = activeElement();
    if (!active) {
      focusFirst(panelOpen ? panel : page);
      event.preventDefault();
      return;
    }

    // 面板打开时焦点限制在面板内
    const scope = panelOpen ? panel : page;
    const pool = [...scope.querySelectorAll(".focusable")].filter(isFocusable);
    let target = null;

    if (pool.includes(active)) {
      const a = active.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
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
        if (score < bestScore) { bestScore = score; target = node; }
      }
    }

    if (!target && !panelOpen) target = spatial(active, direction);
    if (target) {
      event.preventDefault();
      event.stopPropagation();
      focusEl(target);
    }
  }

  /* ---------- 初始化 ---------- */

  renderCategories();
  paintCategoryState();
  renderCategoriesInteractions();
  renderRails();

  document.getElementById("libFilterButton")?.addEventListener("click", () => openPanel("filter"));
  document.getElementById("libSortButton")?.addEventListener("click", () => openPanel("sort"));

  document.addEventListener("keydown", onKeyDown, true);

  // 页面打开后把焦点放到搜索框
  const observer = new MutationObserver(() => {
    if (!page.hidden) {
      window.setTimeout(() => {
        if (!activeElement()) focusEl(document.querySelector("#libraryPage .lib-tab") || document.querySelector("#libraryPage .brand-button"));
      }, 30);
    } else {
      closePanel(false);
    }
  });
  observer.observe(page, { attributes: true, attributeFilter: ["hidden"] });

  /* ---------- 真实内容：有源时用真实条目替换占位卡 ---------- */

  // meta 形如「2021 · 中国大陆 · 更新至第501集 · 0.0 分」，拆开才能各自安排位置
  function splitMeta(meta) {
    const parts = String(meta || "").split("·").map((part) => part.trim()).filter(Boolean);
    const year = parts.find((part) => /^\d{4}$/.test(part)) || "";
    const scoreRaw = parts.find((part) => /分$/.test(part)) || "";
    const status = parts.find((part) => /更新|全\s*\d|完结|连载|第\d+[集期]/.test(part) && !/分$/.test(part)) || "";
    const region = parts.find((part) => part !== year && part !== status && part !== scoreRaw) || "";
    return { year, region, status, score: scoreRaw.replace(/\s*分$/, "") };
  }

  // 角标只留最短的状态：501 集 / 全 40 集 / ★8.2
  function badgeText(info) {
    if (info.status) {
      const numbers = info.status.match(/\d+\s*[集期]/);
      if (numbers) return info.status.startsWith("全") ? `全 ${numbers[0]}` : numbers[0];
      return info.status.slice(0, 8);
    }
    if (info.score && info.score !== "0.0") return `★ ${info.score}`;
    return info.region.slice(0, 6);
  }

  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function posterSrc(url) {
    if (!url) return "";
    // 数据层可能已经包过代理，避免二次代理
    if (url.startsWith("/api/proxy") || url.includes("/api/proxy?url=")) return url;
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  /* ---------- 海报取色：给 Banner 做背景光晕 ---------- */

  function rgbToHsl(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      else if (max === gn) h = ((bn - rn) / d + 2) / 6;
      else h = ((rn - gn) / d + 4) / 6;
    }
    return { h: Math.round(h * 360), s, l };
  }

  function tintFromPoster(url, art, scrim) {
    if (!url || !art) return;
    // 海报模糊铺底：把图挂成 CSS 变量，取色失败也照样有底图
    const banner = art.closest(".lib-banner");
    if (banner) banner.style.setProperty("--hero-poster", `url("${url}")`);
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(probe, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const lum = 0.299 * pr + 0.587 * pg + 0.114 * pb;
          // 跳过纯黑与纯白，只统计有色彩的部分
          if (lum < 22 || lum > 238) continue;
          r += pr; g += pg; b += pb; n += 1;
        }
        if (!n) return;

        const hsl = rgbToHsl(Math.round(r / n), Math.round(g / n), Math.round(b / n));
        // 提饱和度、锁定中等亮度，避免出现过艳或过灰的底色
        const sat = Math.round(Math.min(0.74, Math.max(0.44, hsl.s * 1.75)) * 100);
        const lit = Math.round(Math.min(0.44, Math.max(0.28, hsl.l)) * 100);
        const hue = hsl.h;

        art.style.background = [
          `radial-gradient(118% 132% at 74% 46%, hsla(${hue}, ${sat}%, ${lit}%, 0.5) 0%, hsla(${hue}, ${sat}%, ${lit}%, 0.2) 40%, transparent 70%)`,
          `radial-gradient(80% 100% at 96% 82%, hsla(${hue}, ${sat}%, ${Math.min(56, lit + 14)}%, 0.26) 0%, transparent 62%)`,
          // 半透明紫底：让下面那层模糊海报透出来，不再是近黑
          "linear-gradient(112deg, rgba(36, 27, 74, 0.4) 0%, rgba(44, 33, 89, 0.36) 46%, rgba(53, 42, 104, 0.32) 100%)"
        ].join(", ");
        art.classList.add("has-tint");
        if (scrim) scrim.classList.add("is-tinted");
      } catch {
        /* 取色失败就保持默认深色底 */
      }
    };
    probe.onerror = () => {};
    probe.src = url;
  }

  /* ---------- Banner 轮播 ---------- */

  const HERO_INTERVAL = 8000;
  let heroList = [];
  let heroIndex = 0;
  let heroTimer = 0;
  let heroPausedUntil = 0;

  function heroPage() {
    return document.getElementById("libraryPage");
  }

  function paintHero(index) {
    const page = heroPage();
    if (!page || !heroList.length) return;
    heroIndex = ((index % heroList.length) + heroList.length) % heroList.length;
    const item = heroList[heroIndex];
    if (!item) return;
    currentBannerItem = item;

    const title = page.querySelector(".lib-banner-title");
    const meta = page.querySelector(".lib-banner-meta");
    const desc = page.querySelector(".lib-banner-desc");
    const tag = page.querySelector(".lib-banner-tag");
    const art = page.querySelector(".lib-banner-art");
    const scrim = page.querySelector(".lib-banner-scrim");

    if (title) title.textContent = item.title || item.name || "";

    if (meta) {
      const parts = [];
      if (item.type) parts.push(String(item.type).slice(0, 6));
      const year = /(19|20)\d{2}/.exec(String(item.meta || item.year || ""));
      if (year) parts.push(year[0]);
      const remark = /全\s*\d+\s*集|更新至?\s*第?\s*\d+\s*集?|完结|\d+\s*集/.exec(
        String(item.remarks || item.meta || "")
      );
      if (remark) parts.push(remark[0].replace(/\s+/g, ""));
      const score = Number(item.score);
      const html = parts.map((part) => `<span>${part}</span>`);
      if (Number.isFinite(score) && score > 0) html.push(`<span><em>${score.toFixed(1)}分</em></span>`);
      meta.innerHTML = html.join("");
    }

    if (desc) desc.textContent = item.description || "";

    if (tag) {
      const text = String(item.remarks || item.meta || "");
      let label = "热播剧集";
      if (/新|上线/.test(text)) label = "新剧上线";
      else if (/完结|全集/.test(text)) label = "完结好剧";
      tag.textContent = `🔥 ${label}`;
    }

    const pic = posterSrc(item.image || item.pic || "");
    if (art && pic) {
      art.classList.add("has-photo");
      tintFromPoster(pic, art, scrim);
      setPosterSrc(posterImage(), pic);
    }

    paintHeroPeek();
    paintHeroDots();
  }

  /* 主海报节点只建一次；图片被 onerror 摘掉后要能补回来 */
  function posterImage() {
    let poster = page.querySelector(".lib-banner-poster");
    if (!poster) {
      poster = document.createElement("div");
      poster.className = "lib-banner-poster";
      const copy = page.querySelector(".lib-banner-copy");
      if (copy && copy.parentElement) copy.parentElement.insertBefore(poster, copy);
    }
    let img = poster.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.alt = "";
      img.width = 250;
      img.height = 378;
      poster.appendChild(img);
    }
    return img;
  }

  function setPosterSrc(img, pic) {
    if (!img || !pic) return;
    if (img.getAttribute("src") === pic && img.complete && img.naturalWidth) {
      img.style.opacity = "1";
      return;
    }
    img.style.opacity = "0";
    const next = new Image();
    next.onload = () => {
      img.src = pic;
      img.style.opacity = "1";
    };
    next.onerror = () => {
      img.style.opacity = "1";
    };
    next.src = pic;
  }

  /* 主海报左边再挂两张「接下来」，把中段留白填成可读的队列 */
  function paintHeroPeek() {
    const host = page.querySelector(".lib-banner-next");
    if (!host) return;
    const picks = [];
    const current = heroList[heroIndex];
    for (let step = 1; step < heroList.length && picks.length < 2; step += 1) {
      const item = heroList[(heroIndex + step) % heroList.length];
      if (!item || item === current) continue;
      if (picks.some((pick) => pick.key && pick.key === item.key)) continue;
      const pic = posterSrc(item.image || item.pic || "");
      if (!pic) continue;
      picks.push({ key: item.key || "", pic });
    }
    if (!picks.length) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    // 倒序渲染：贴着主海报的那张亮度更高
    const ordered = picks.slice().reverse();
    host.innerHTML = ordered
      .map(
        (pick, index) =>
          `<span class="lib-banner-peek${index < ordered.length - 1 ? " is-far" : ""}"><img src="${esc(
            pick.pic
          )}" alt="" /></span>`
      )
      .join("");
    host.hidden = false;
  }

  function paintHeroDots() {
    const dots = heroPage()?.querySelector(".lib-dots");
    if (!dots) return;
    dots.innerHTML = heroList
      .map((_, i) => `<i${i === heroIndex ? ' class="is-active"' : ""}></i>`)
      .join("");
  }

  function stopHeroRotation() {
    if (heroTimer) {
      window.clearInterval(heroTimer);
      heroTimer = 0;
    }
  }

  function startHeroRotation() {
    stopHeroRotation();
    if (heroList.length < 2) return;
    heroTimer = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() < heroPausedUntil) return;
      // 焦点停在 banner 上时不动，避免用户正在看的时候画面跳走
      const active = document.activeElement;
      if (active && active.closest(".lib-banner")) return;
      paintHero(heroIndex + 1);
    }, HERO_INTERVAL);
  }

  function pauseHero(ms) {
    heroPausedUntil = Date.now() + (ms || 12000);
  }

  function stepHero(step) {
    paintHero(heroIndex + step);
    pauseHero();
  }

  /* 卡片 → 条目 的登记表：点卡片时靠它把完整对象交给详情页 */
  const cardItems = new Map();

  function rememberCard(item) {
    if (item?.key) cardItems.set(String(item.key), item);
  }

  function cardFor(item, index) {
    const tone = ["violet", "rose", "sky", "amber", "plum", "mint"][index % 6];
    const rawPic = item.image || item.pic || "";
    const pic = posterSrc(rawPic);
    const title = item.title || item.name || "";
    const info = splitMeta(item.meta || [item.type, item.group].filter(Boolean).join(" · "));
    const badge = badgeText(info);
    return `
      <button class="lib-card poster-card has-art focusable" type="button" data-vod="${item.key || ""}" aria-label="${title}">
        <span class="poster-cover tone-${tone}" data-initial="${esc(title.slice(0, 1))}">
          ${pic ? `<img src="${pic}" alt="${title}" width="300" height="420" loading="${index < 6 ? "eager" : "lazy"}" decoding="async" onerror="this.style.display='none';this.parentElement.classList.add('is-fallback')" />` : ""}
          <span class="lib-card-grain"></span>
          <span class="lib-card-shade"></span>
          <span class="poster-badges">
            ${badge ? `<span class="poster-status">${badge}</span>` : ""}
            ${info.score && info.score !== "0.0" ? `<span class="poster-score">★ ${info.score}</span>` : ""}
          </span>
          <span class="poster-copy">
            <span class="poster-title" title="${title}">${title}</span>
            <span class="poster-meta">${[info.year, item.type || info.region].filter(Boolean).join(" · ")}</span>
          </span>
        </span>
      </button>`;
  }

  // 热播池：剧集 / 电影 / 综艺 三类，各取几条，按「在更 + 今年 + 有评分」加权
  const HOT_TYPES = [13, 15, 22, 16, 6, 11, 9, 25, 26, 27];

  function hotScore(item) {
    let score = 0;
    if (/更新至|第\s*\d+\s*[期集]/.test(item.status || "")) score += 3;
    if (String(item.year || "") === String(new Date().getFullYear())) score += 2;
    if (Number(item.score) > 0) score += 1;
    if (item.description && item.description.length > 24) score += 1;
    return score;
  }

  // 「更新至第 20 集」里的集数/期号；20261119 这种日期型期号不当集数用
  function episodeIndex(item) {
    const matched = String(item.status || "").match(/(\d+)\s*[集期]/);
    const number = matched ? Number(matched[1]) : 0;
    return number > 0 && number < 5000 ? number : 0;
  }

  // 首页这条带与「查看全部」共用同一套排序：
  // 热播权重 → 评分 → 更新集数，三层下来同分才靠原有的稳定顺序
  function compareHot(a, b) {
    return (
      hotScore(b) - hotScore(a) ||
      (Number(b.score) || 0) - (Number(a.score) || 0) ||
      episodeIndex(b) - episodeIndex(a)
    );
  }

  async function loadHotPool(api) {
    const lists = await Promise.all(
      HOT_TYPES.map((type) =>
        api.loadLibraryItems({ type, limit: 8 })
          .then((response) => response?.items || response || [])
          .catch(() => [])
      )
    );
    const seen = new Set();
    const pool = [];
    lists.flat().forEach((item) => {
      if (!item?.key || seen.has(item.key) || !item.image) return;
      seen.add(item.key);
      pool.push(item);
    });
    return pool.sort(compareHot);
  }

  // 剧 / 综 / 影 三类轮流取，保证一屏里三种都有
  function pickMixed(pool, excludeKey, size = 6) {
    const groups = [[], [], []];
    pool.forEach((item) => {
      if (item.key === excludeKey) return;
      const type = item.type || "";
      if (/剧/.test(type)) groups[0].push(item);
      else if (/综艺/.test(type)) groups[1].push(item);
      else if (/片|电影/.test(type)) groups[2].push(item);
    });
    const out = [];
    let guard = 0;
    while (out.length < size && guard < 40) {
      guard += 1;
      for (const group of groups) {
        if (out.length >= size) break;
        const next = group.shift();
        if (next) out.push(next);
      }
      if (groups.every((group) => !group.length)) break;
    }
    return out;
  }

  function showShelfNotice(text) {
    const rail = document.getElementById("libHotRail");
    if (!rail) return;
    rail.innerHTML = `
      <div class="lib-shelf-empty">
        <svg class="icon"><use href="#i-film" /></svg>
        <span>${text}</span>
      </div>`;
    const title = page.querySelector(".lib-banner-title");
    const meta = page.querySelector(".lib-banner-meta");
    const desc = page.querySelector(".lib-banner-desc");
    const tag = page.querySelector(".lib-banner-tag");
    if (title) title.textContent = "还没有内容";
    if (meta) meta.textContent = "启用内容源后这里会显示推荐";
    if (desc) desc.textContent = "去「设置 → 影视源」里添加「量子资源」，或导入你自己的订阅。";
    if (tag) tag.textContent = "内容源";
  }

  let hydrateAttempts = 0;

  async function hydrateRealContent() {
    const api = window.NovaSources;
    if (!api?.loadLibraryItems) return;
    let items = [];
    try {
      items = await loadHotPool(api);
    } catch (_) {
      items = [];
    }
    if (!items.length) {
      // 源配置/网络可能还没就绪：退避重试三次，别让片库一直是空的
      if (hydrateAttempts < 3) {
        hydrateAttempts += 1;
        window.setTimeout(hydrateRealContent, 900 * hydrateAttempts);
        return;
      }
      showShelfNotice("没有可用内容：请到「设置 → 影视源」启用一个内容源");
      return;
    }
    hydrateAttempts = 0;
    const bannerItem = items.find((item) => item.description && item.description.length > 24) || items[0];
    const railItems = items.filter((item) => item.key !== bannerItem.key);

    // 每个内容带只出一排 6 张，不做横向滚动
    const ROW_LIMIT = 6;
    const paint = (host, slice) => {
      if (!host || !slice.length) return;
      const shown = slice.slice(0, ROW_LIMIT);
      shown.forEach(rememberCard);
      host.innerHTML = shown.map(cardFor).join("");
    };
    paint(document.getElementById("libHotRail"), railItems);

    // 轮播池：挑 5 部有简介的，配上没有的当补充
    heroList = items.slice(0, 5);
    heroIndex = 0;
    paintHero(0);
    startHeroRotation();
  }

  /* ============================================================
     首页「热门内容」：在更国产剧 + 最新综艺（2026-11-19）
     数据源：loadLibraryItems({ type })  type 13 = 国产剧 / 25 = 大陆综艺
     状态字段用 item.status（remarks 在列表接口里是空的）
     ============================================================ */

  const HOME_SHELVES = [
    { id: "drama", type: 13, railId: "shelfDrama", metaId: "shelfDramaMeta", label: "国产剧" },
    { id: "variety", type: 25, railId: "shelfVariety", metaId: "shelfVarietyMeta", label: "大陆综艺" }
  ];

  const homeShelfItems = new Map();

  function isUpdatingShow(item) {
    const status = String(item?.status || item?.remarks || "");
    if (!status) return false;
    if (/全\s*\d+\s*[集期]|完结|已完结|BD|HD|全集/.test(status)) return false;
    return /更新至|更新到|连载|第\s*\d+\s*[集期]|期/.test(status);
  }

  // 综艺期号多是 20261120 这种日期；剧集取「第N集」的数字
  function periodStamp(item) {
    const matched = String(item?.status || "").match(/(20\d{6})/);
    return matched ? Number(matched[1]) : 0;
  }

  function sortDrama(a, b) {
    return episodeIndex(b) - episodeIndex(a) || Number(b.year || 0) - Number(a.year || 0);
  }

  function sortVariety(a, b) {
    return periodStamp(b) - periodStamp(a) || episodeIndex(b) - episodeIndex(a);
  }

  function shelfStatusLabel(item) {
    const status = String(item?.status || "").trim();
    if (!status) return "";
    // 「更新至20261120期」→「20261120 期」；「更新至第15集」原样
    const dateMatched = status.match(/(20\d{6})/);
    if (dateMatched) return `${dateMatched[1]} 期`;
    return status.replace(/^更新至/, "");
  }

  function shelfCardFor(item, index) {
    const tone = ["violet", "rose", "sky", "amber", "plum", "mint"][index % 6];
    const pic = posterSrc(item.image || item.pic || "");
    const title = item.title || item.name || "";
    const statusLabel = shelfStatusLabel(item);
    const metaText = [item.year, item.type].filter(Boolean).join(" · ");
    homeShelfItems.set(String(item.key), item);
    return `
      <button class="lib-card poster-card has-art focusable home-shelf-card" type="button" data-vod="${item.key || ""}" aria-label="${title}">
        <span class="poster-cover tone-${tone}" data-initial="${esc(title.slice(0, 1))}">
          ${pic ? `<img src="${pic}" alt="${title}" width="300" height="420" loading="${index < 5 ? "eager" : "lazy"}" decoding="async" onerror="this.style.display='none';this.parentElement.classList.add('is-fallback')" />` : ""}
          <span class="lib-card-grain"></span>
          <span class="lib-card-shade"></span>
          <span class="poster-badges">
            <span class="poster-status home-badge-live"><i></i>在更</span>
            ${statusLabel ? `<span class="poster-score home-badge-ep">${esc(statusLabel)}</span>` : ""}
          </span>
          <span class="poster-copy">
            <span class="poster-title" title="${title}">${title}</span>
            <span class="poster-meta">${metaText}</span>
          </span>
        </span>
      </button>`;
  }

  function shelfFailMarkup(text) {
    return `<div class="lib-shelf-empty home-shelf-empty"><svg class="icon"><use href="#i-film" /></svg><span>${text}</span></div>`;
  }

  const homeShelfData = { drama: [], variety: [] };
  let homeShelfTab = "drama";

  function paintHomeShelfMeta() {
    const active = homeShelfData[homeShelfTab] || [];
    const meta = document.getElementById("shelfMeta");
    if (!meta) return;
    const sourceNames = [...new Set(active.map((item) => item.sourceName || item.siteName).filter(Boolean))];
    meta.textContent = active.length
      ? `${active.length} 部在更 · ${sourceNames[0] || "内容源"}`
      : "暂无在更内容";
  }

  function paintHomeShelfRail(tab) {
    homeShelfTab = tab === "variety" ? "variety" : "drama";
    const rail = document.getElementById("shelfRail");
    if (!rail) return;
    const items = homeShelfData[homeShelfTab] || [];
    rail.dataset.loaded = "1";
    rail.innerHTML = items.length
      ? items.map((item, index) => shelfCardFor(item, index)).join("")
      : shelfFailMarkup(`暂时没有在更的${homeShelfTab === "drama" ? "国产剧" : "综艺"}`);
    rail.scrollLeft = 0;

    document.querySelectorAll("[data-shelf-tab]").forEach((chip) => {
      const on = chip.dataset.shelfTab === homeShelfTab;
      chip.classList.toggle("is-active", on);
      chip.setAttribute("aria-selected", String(on));
    });
    paintHomeShelfMeta();
  }

  async function renderHomeShelves(force = false) {
    const api = window.NovaSources;
    if (!api?.loadLibraryItems) return;
    const rail = document.getElementById("shelfRail");
    if (rail && !rail.dataset.loaded) {
      rail.innerHTML = `<div class="home-shelf-loading">正在读取在更内容…</div>`;
    }

    await Promise.all(
      HOME_SHELVES.map(async (shelf) => {
        try {
          const response = await api.loadLibraryItems({ type: shelf.type, limit: 30, force });
          const list = response?.items || response || [];
          const picked = list
            .filter((item) => item?.key && item.image && isUpdatingShow(item))
            .sort(shelf.id === "drama" ? sortDrama : sortVariety)
            .slice(0, 12);
          homeShelfData[shelf.id] = picked;
        } catch (_) {
          homeShelfData[shelf.id] = homeShelfData[shelf.id] || [];
        }
        const chip = document.getElementById(shelf.id === "drama" ? "shelfChipDrama" : "shelfChipVariety");
        if (chip) chip.textContent = String((homeShelfData[shelf.id] || []).length);
      })
    );

    paintHomeShelfRail(homeShelfTab);

    const total = (homeShelfData.drama?.length || 0) + (homeShelfData.variety?.length || 0);
    const heading = document.getElementById("homeShelvesMeta");
    if (heading) heading.textContent = total ? `${total} 部在更` : "暂无在更内容";
  }

  // chip 上直接 ←/→ 切分类，不用先移出 chip 再按 OK
  document.addEventListener(
    "keydown",
    (event) => {
      const chip = document.activeElement && document.activeElement.closest
        ? document.activeElement.closest("[data-shelf-tab]")
        : null;
      if (!chip) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      const tabs = ["drama", "variety"];
      const index = tabs.indexOf(chip.dataset.shelfTab);
      const step = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      paintHomeShelfRail(next);
      window.NovaFocus?.to?.(document.querySelector(`[data-shelf-tab="${next}"]`));
    },
    true
  );

  // chip 切换
  document.addEventListener("click", (event) => {
    const chip = event.target.closest?.("[data-shelf-tab]");
    if (!chip) return;
    const tab = chip.dataset.shelfTab;
    if (tab === homeShelfTab) return;
    paintHomeShelfRail(tab);
  });

  // 卡片点击 → 详情页
  document.addEventListener("click", (event) => {
    const card = event.target.closest?.("#homeShelves [data-vod]");
    if (!card) return;
    const item = homeShelfItems.get(String(card.dataset.vod));
    if (!item) return;
    event.preventDefault();
    window.NovaPages?.openDetail?.(item);
  });

  // 查看全部 → 进聚合片库（对应分类）
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("#homeShelves [data-shelf-all]");
    if (!link) return;
    window.NovaPages?.open?.("library");
  });

  window.renderHomeShelves = renderHomeShelves;
  window.NovaLibraryUI = window.NovaLibraryUI || {};
  window.NovaLibraryUI.bannerItem = () => currentBannerItem;
  // 「查看全部」列表页要和这条带用同一批分类、同一套排序，别各写一份
  window.NovaLibraryUI.hotTypes = HOT_TYPES.slice();
  window.NovaLibraryUI.compareHot = compareHot;
  window.NovaLibraryUI.hero = {
    next: () => stepHero(1),
    prev: () => stepHero(-1),
    goto: (index) => { paintHero(index); pauseHero(); },
    pause: (ms) => pauseHero(ms),
    count: () => heroList.length,
    index: () => heroIndex
  };
  window.NovaLibraryUI.hydrate = hydrateRealContent;
  window.NovaSources?.onChange?.(() => window.setTimeout(hydrateRealContent, 400));
  window.setTimeout(hydrateRealContent, 1200);
  // 首页两条「在更」货架：内容源就绪后拉一次
  window.NovaSources?.onChange?.(() => window.setTimeout(() => renderHomeShelves(true), 600));
  window.setTimeout(() => renderHomeShelves(), 1600);
  window.NovaLibraryUI = {
    ...(window.NovaLibraryUI || {}),
    focusCategory(key) {
      const target = page.querySelector(`[data-lib-category="${key}"]`);
      if (target) focusEl(target);
    }
  };

  /* ---------- 卡片 → 详情 ---------- */

  page.addEventListener("click", (event) => {
    const card = event.target.closest(".lib-card");
    if (!card || !page.contains(card)) return;
    const key = card.dataset.vod;
    if (!key) return;
    const item = cardItems.get(key);
    if (!item) return;
    if (typeof window.NovaPages?.openLibraryEntry === "function") {
      window.NovaPages.openLibraryEntry(item);
    } else {
      window.NovaOpenDetail?.(item);
    }
  });

  /* ---------- 「正在热播」查看全部 → 列表页 ---------- */

  page.addEventListener("click", (event) => {
    if (!event.target.closest("[data-lib-hot-all]")) return;
    event.preventDefault();
    window.NovaCategories?.openList?.({ pageKey: "library", index: 0 });
  });

  /* ---------- 调试：?page=library 自动打开，?diag=1 输出几何信息 ---------- */

  const params = new URLSearchParams(window.location.search);
  const playParam = params.get("play");
  if (playParam) {
    window.setTimeout(() => {
      window.NovaPlayer?.open({ url: playParam, title: "预览播放" });
    }, 2600);
  }
  if (params.get("page") === "library") {
    window.setTimeout(() => {
      window.NovaPages?.open("library", document.body, { category: "全部" });
      // 自检模式：确保页面处于激活态，便于截图/诊断
      page.hidden = false;
      page.classList.add("is-active");
      if (params.get("panel")) {
        window.setTimeout(() => openPanel(params.get("panel")), 300);
      }
      if (params.get("diag") === "1") {
        window.setTimeout(writeDiag, 400);
      }
    }, 200);
  }

  function writeDiag() {
    const scale = document.querySelector(".stage").getBoundingClientRect().height / 1080;
    const box = (sel) => {
      const el = page.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x / scale), y: Math.round(r.y / scale),
        w: Math.round(r.width / scale), h: Math.round(r.height / scale)
      };
    };
    let maxBottom = 0;
    let maxRight = 0;
    page.querySelectorAll(".lib-shell *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1) return;
      maxBottom = Math.max(maxBottom, r.bottom / scale);
      maxRight = Math.max(maxRight, r.right / scale);
    });
    const data = {
      topbar: box(".lib-topbar"),
      banner: box(".lib-banner"),
      categories: box(".lib-categories"),
      rowTop: box(".lib-cat-row.is-two"),
      rowBottom: box(".lib-cat-row.is-three"),
      cat: box(".lib-cat"),
      rail: box(".lib-rail"),
      card: box(".lib-card"),
      cards: page.querySelectorAll(".lib-card").length,
      cats: page.querySelectorAll(".lib-cat").length,
      maxBottom: Math.round(maxBottom),
      maxRight: Math.round(maxRight),
      focus: document.querySelector("#libraryPage .is-focused")?.id || ""
    };
    const pre = document.createElement("pre");
    pre.id = "libDiag";
    pre.textContent = JSON.stringify(data);
    document.body.appendChild(pre);
  }
})();
