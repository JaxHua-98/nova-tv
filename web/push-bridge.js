/*
 * NOVA TV · 手机推送订阅
 * 电视上打字太麻烦：点这里出一个地址，手机浏览器打开后粘订阅地址，电视自动接收。
 * 仅在 APK 内可用（本地 HTTP 服务提供 /push 接口）。
 */
(function () {
  "use strict";

  let panel = null;
  let timer = 0;
  let code = "";
  let pollFails = 0;

  function api(path) {
    return fetch(path, { cache: "no-store" }).then((r) => r.json());
  }

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "push-panel overlay-screen";
    panel.id = "pushPanel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "用手机添加订阅");
    panel.innerHTML = `
      <div class="push-backdrop"></div>
      <div class="push-card">
        <div class="push-head">
          <h2>用手机添加订阅</h2>
          <p>手机和电视连同一个 Wi-Fi，用手机浏览器打开下面的地址</p>
        </div>
        <div class="push-body">
          <div class="push-url" id="pushUrl">正在读取地址…</div>
          <div class="push-code-row">
            <span>配对码</span>
            <strong id="pushCode">----</strong>
          </div>
          <div class="push-status" id="pushStatus">等待手机连接…</div>
          <div class="push-tip">
            打开上面的地址 → 输入这个配对码 → 粘贴订阅地址 → 点「发送到电视」
          </div>
        </div>
        <div class="push-foot">
          <button class="page-secondary-button focusable" type="button" data-push-close>关闭（返回键）</button>
        </div>
      </div>`;
    document.querySelector(".stage")?.appendChild(panel) || document.body.appendChild(panel);

    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-push-close]") || event.target.closest(".push-backdrop")) {
        close();
      }
    });
    return panel;
  }

  function setStatus(text, tone) {
    const node = document.getElementById("pushStatus");
    if (!node) return;
    node.textContent = text;
    node.dataset.tone = tone || "";
  }

  async function poll() {
    if (panel?.hidden) return;
    try {
      const data = await api(`/push/api/poll?c=${encodeURIComponent(code)}`);
      pollFails = 0;
      if (data?.code && data.code !== code) {
        code = data.code;
        const el = document.getElementById("pushCode");
        if (el) el.textContent = code;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length) {
        await receive(items);
      }
    } catch (_) {
      pollFails += 1;
      if (pollFails === 3) setStatus("连接不稳定，保持这个页面开着就好", "warn");
    }
  }

  async function receive(items) {
    let added = 0;
    for (const item of items) {
      try {
        if (item.url) {
          await window.NovaSources?.addRemote?.(item.url);
          added += 1;
        } else if (item.raw) {
          window.NovaSources?.importJson?.(item.raw, { name: "手机推送" });
          added += 1;
        }
      } catch (error) {
        setStatus(String(error?.message || "导入失败").slice(0, 40), "error");
      }
    }
    if (added) {
      setStatus(`已接收 ${added} 个订阅`, "ok");
      window.NovaToast?.("已从手机接收到订阅");
      window.dispatchEvent(new CustomEvent("nova:push-imported", { detail: { count: added } }));
      setTimeout(close, 900);
    }
  }

  async function open() {
    const node = ensurePanel();
    node.hidden = false;
    node.classList.add("is-active");
    requestAnimationFrame(() => node.querySelector("[data-push-close]")?.focus?.());
    try {
      const info = await api("/push/api/info");
      code = info?.code || "0000";
      const host = info?.ip && info.ip !== "127.0.0.1" ? info.ip : location.hostname;
      const port = info?.port || location.port;
      document.getElementById("pushUrl").textContent = `http://${host}:${port}/push`;
      document.getElementById("pushCode").textContent = code;
      setStatus("等待手机连接…");
    } catch (_) {
      setStatus("这个功能只在电视 App 里可用", "error");
    }
    clearInterval(timer);
    timer = window.setInterval(poll, 1500);
  }

  function close() {
    clearInterval(timer);
    timer = 0;
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove("is-active");
  }

  function isOpen() {
    return Boolean(panel && !panel.hidden);
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isOpen()) return;
      if (event.key === "Escape" || event.key === "Backspace" || event.key === "GoBack" || event.key === "BrowserBack") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    },
    true
  );

  /* 设置页「订阅与内容源」里挂一个入口；面板重渲染后自动补回 */
  function injectEntry() {
    const panelEl = document.getElementById("settingsPanel");
    if (!panelEl) return;
    const head = panelEl.querySelector(".settings-panel-head h2")?.textContent?.trim();
    if (head !== "订阅与内容源") return;
    if (panelEl.querySelector("[data-push-open]")) return;
    const card = document.createElement("div");
    card.className = "settings-section-card push-entry-card";
    card.innerHTML = `
      <div class="settings-section-title">
        <h3>手机推送订阅</h3>
        <span>不用遥控器打字</span>
      </div>
      <p>电视上不显示键盘，远程订阅地址很难输。用手机打开电视给出的地址，粘一下就同步过来。</p>
      <div class="settings-choice-row">
        <button class="settings-choice focusable" type="button" data-push-open>显示接收地址</button>
      </div>`;
    card.querySelector("[data-push-open]")?.addEventListener("click", open);
    const anchor = panelEl.querySelector(".settings-section-card");
    if (anchor) anchor.before(card);
    else panelEl.appendChild(card);
  }

  const observer = new MutationObserver(() => injectEntry());
  function start() {
    const panelEl = document.getElementById("settingsPanel");
    if (panelEl) observer.observe(panelEl, { childList: true, subtree: false });
    injectEntry();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else window.setTimeout(start, 1200);

  window.NovaPush = { open, close, isOpen };
})();
