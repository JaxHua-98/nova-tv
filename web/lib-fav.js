/* NOVA TV · 片单收藏
 * Banner「加入片单」与片库卡片共用一套本地存储，跨页可用。
 */
(function () {
  "use strict";

  if (typeof document === "undefined") return;

  const FAV_KEY = "nova.fav.items.v1";

  function load() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(raw) ? raw.filter((entry) => entry && entry.key) : [];
    } catch {
      return [];
    }
  }

  const KINDS = ["movie", "series", "live", "music"];

  // 传进来的海报可能已经是 /api/proxy 地址，存之前还原成原始 URL
  function unwrap(url) {
    const text = String(url || "");
    if (!/\/api\/proxy\?url=/i.test(text)) return text;
    try {
      return new URL(text, window.location.origin).searchParams.get("url") || "";
    } catch {
      return "";
    }
  }

  // 旧数据没有 kind，按 key 前缀与 type 文案推断
  function normalize(entry) {
    if (!entry || !entry.key) return null;
    let kind = entry.kind;
    if (!KINDS.includes(kind)) {
      if (String(entry.key).startsWith("music:")) kind = "music";
      else if (String(entry.key).startsWith("live:")) kind = "live";
      else if (/剧|集|部/.test(`${entry.type || ""}${entry.meta || ""}`)) kind = "series";
      else kind = "movie";
    }
    return {
      key: entry.key,
      title: entry.title || "",
      image: entry.image || "",
      type: entry.type || "",
      meta: entry.meta || "",
      remarks: entry.remarks || "",
      score: Number(entry.score) || 0,
      kind,
      source: entry.source || "",
      at: Number(entry.at) || 0,
      updatedAt: Number(entry.updatedAt) || Number(entry.at) || 0
    };
  }

  function save(list) {
    const rows = list.slice(0, 200).map(normalize).filter(Boolean);
    try {
      window.localStorage.setItem(FAV_KEY, JSON.stringify(rows));
    } catch {
      /* 存储满时静默失败，不影响播放 */
    }
    document.dispatchEvent(new CustomEvent("nova:fav-changed", { detail: { count: rows.length, list: rows } }));
  }

  function has(key) {
    return load().some((entry) => entry.key === key);
  }

  function toggle(item) {
    if (!item?.key) return { added: false, count: load().length };
    const list = load();
    const index = list.findIndex((entry) => entry.key === item.key);
    if (index >= 0) {
      list.splice(index, 1);
      save(list);
      return { added: false, count: list.length };
    }
    const now = Date.now();
    list.unshift(
      normalize({
        key: item.key,
        title: item.title || item.name || "",
        image: unwrap(item.image || item.pic || ""),
        type: item.type || "",
        meta: item.meta || "",
        remarks: item.remarks || "",
        score: item.score || 0,
        kind: item.kind || "",
        source: item.provider || item.source || "",
        at: now,
        updatedAt: now
      })
    );
    save(list);
    return { added: true, count: list.length };
  }

  function list() {
    return load().map(normalize).filter(Boolean);
  }

  function clear() {
    save([]);
    return [];
  }

  function update(key, patch) {
    const rows = load();
    const index = rows.findIndex((entry) => entry.key === key);
    if (index < 0) return rows;
    rows[index] = normalize({ ...rows[index], ...patch, updatedAt: Date.now() });
    save(rows);
    return rows;
  }

  function remove(key) {
    const next = load().filter((entry) => entry.key !== key);
    save(next);
    return next;
  }

  /* ---------- Banner 三个按钮 ---------- */

  function bannerItem() {
    return window.NovaLibraryUI?.bannerItem?.() || null;
  }

  function paintBannerButton(button, saved) {
    if (!button) return;
    button.classList.toggle("is-saved", saved);
    const label = button.querySelector("span");
    if (label) label.textContent = saved ? "已加入片单" : "加入片单";
    const use = button.querySelector("use");
    if (use) use.setAttribute("href", saved ? "#i-check" : "#i-star");
  }

  function syncBannerButton() {
    const button = document.querySelector('[data-banner-action="favorite"]');
    if (!button) return;
    const item = bannerItem();
    paintBannerButton(button, item ? has(item.key) : false);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-banner-action]");
    if (!button) return;
    const action = button.dataset.bannerAction;
    const item = bannerItem();

    if (action === "favorite") {
      if (!item) return;
      const result = toggle(item);
      paintBannerButton(button, result.added);
      window.NovaToast?.(
        result.added ? `已加入片单 · ${item.title || item.name || ""}` : `已从片单移除`
      );
      return;
    }

    if (action === "play") {
      if (!item) return;
      const playBtn = document.querySelector(".lib-card[data-lib-key]");
      window.NovaPages?.openDetail?.(item) || window.NovaLibraryUI?.play?.(item);
      return;
    }

    if (action === "detail") {
      if (!item) return;
      window.NovaPages?.openDetail?.(item);
    }
  });

  /* ---------- 卡片展开条按钮 ---------- */

  function cardItem(button) {
    const card = button.closest(".lib-card");
    if (!card) return null;
    const key = card.dataset.vod;
    const title = card.querySelector(".poster-title")?.textContent || "";
    const img = card.querySelector(".poster-cover img")?.getAttribute("src") || "";
    return { key, title, image: img };
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-expand]");
    if (!button) return;
    event.stopPropagation();
    const item = cardItem(button);
    if (!item) return;
    const kind = button.dataset.expand;

    if (kind === "favorite") {
      const result = toggle(item);
      button.style.background = result.added ? "rgba(109,92,246,.5)" : "";
      window.NovaToast?.(result.added ? `已加入片单 · ${item.title}` : "已从片单移除");
      return;
    }
    if (kind === "play" || kind === "info") {
      window.NovaPages?.openLibraryEntry?.({ key: item.key, title: item.title });
    }
  });

  // 片库数据刷新后同步按钮状态
  document.addEventListener("nova:library-ready", syncBannerButton);
  document.addEventListener("nova:fav-changed", () => {
    const button = document.querySelector('[data-banner-action="favorite"]');
    const item = bannerItem();
    if (button && item) paintBannerButton(button, has(item.key));
  });

  const timer = window.setInterval(() => {
    const button = document.querySelector('[data-banner-action="favorite"]');
    if (button && bannerItem()) {
      syncBannerButton();
      window.clearInterval(timer);
    }
  }, 500);

  window.NovaFav = { toggle, has, list, remove, clear, update, normalize, syncBannerButton };
})();
