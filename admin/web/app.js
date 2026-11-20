/* NOVA TV 管理后台 · 前端（原生 JS，无构建） */
(() => {
  const state = {
    token: localStorage.getItem("nova.admin.token") || "",
    bootstrap: null,
    route: "sources",
    sites: { page: 1, size: 50, q: "", enabled: "", broken: "" },
    candidates: { page: 1, size: 50, grade: "", promoted: "", q: "" },
    selection: { sites: new Set(), candidates: new Set() }
  };

  const $ = (sel) => document.querySelector(sel);
  const view = () => $("#view");

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  let toastTimer = 0;
  function toast(text, bad) {
    const el = $("#toast");
    el.textContent = text;
    el.className = "toast" + (bad ? " bad" : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = "Bearer " + state.token;
    const res = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { raw: text };
    }
    if (!res.ok) {
      const message = data?.error || res.status + " " + res.statusText;
      if (res.status === 401) toast("token 不对：请从 data/nova/token.txt 复制", true);
      else toast(message, true);
      throw new Error(message);
    }
    return data;
  }

  async function refreshBootstrap() {
    state.bootstrap = await api("/api/bootstrap");
    renderStats();
    return state.bootstrap;
  }

  function renderStats() {
    const b = state.bootstrap;
    if (!b) return;
    const sites = b.sites || [];
    const enabled = sites.filter((s) => s.enabled).length;
    const broken = sites.filter((s) => s.health === -1).length;
    $("#stats").innerHTML = `
      <span>订阅 <b>${(b.sources || []).length}</b></span>
      <span>站点 <b>${sites.length}</b></span>
      <span>启用 <b>${enabled}</b></span>
      <span>异常 <b>${broken}</b></span>
      <span>候选 <b>${b.candidates || 0}</b></span>
    `;
  }

  // ---------------- 订阅 ----------------
  async function renderSources() {
    const b = state.bootstrap;
    const presets = b?.presets || [];
    view().innerHTML = `
      <div class="bar">
        <button class="primary" data-act="source-add-url">加远程订阅</button>
        <button data-act="source-add-paste">粘贴 JSON</button>
        ${presets.map((p) => `<button class="ghost" data-act="source-add-preset" data-id="${esc(p.id)}">内置：${esc(p.name)}</button>`).join("")}
        <span class="spacer"></span>
        <button data-act="refresh">刷新</button>
      </div>
      <table>
        <thead><tr><th>名称</th><th>类型</th><th>站点</th><th>直播</th><th>状态</th><th>地址</th><th></th></tr></thead>
        <tbody>
          ${
            (b?.sources || [])
              .map(
                (s) => `
            <tr>
              <td>${esc(s.name)}</td>
              <td><span class="tag">${esc(s.kind)}</span></td>
              <td>${(s.parsed?.sites || []).length}</td>
              <td>${(s.parsed?.lives || []).length}</td>
              <td><span class="tag ${s.enabled ? "ok" : ""}">${s.enabled ? "启用" : "停用"}</span></td>
              <td class="mono">${esc(s.url || s.id)}</td>
              <td class="row">
                <button class="ghost" data-act="source-toggle" data-id="${esc(s.id)}">${s.enabled ? "停用" : "启用"}</button>
                <button class="ghost" data-act="source-sync" data-id="${esc(s.id)}">同步</button>
                <button class="danger" data-act="source-del" data-id="${esc(s.id)}">删除</button>
              </td>
            </tr>`
              )
              .join("") || `<tr><td colspan="7" class="empty">还没有订阅，先加一个远程订阅或内置预设</td></tr>`
          }
        </tbody>
      </table>
    `;
  }

  // ---------------- 站点 ----------------
  async function loadSites() {
    const { page, size, q, enabled, broken } = state.sites;
    const qs = new URLSearchParams({ page, size });
    if (q) qs.set("q", q);
    if (enabled) qs.set("enabled", enabled);
    if (broken) qs.set("broken", broken);
    return api("/api/sites?" + qs.toString());
  }

  async function renderSites() {
    const data = await loadSites();
    const rows = data.items || [];
    const sel = state.selection.sites;
    view().innerHTML = `
      <div class="bar">
        <input id="siteQ" placeholder="搜索名称 / 接口 / key" value="${esc(state.sites.q)}" />
        <select id="siteEnabled">
          <option value="">全部</option>
          <option value="1" ${state.sites.enabled === "1" ? "selected" : ""}>仅启用</option>
          <option value="0" ${state.sites.enabled === "0" ? "selected" : ""}>仅停用</option>
        </select>
        <label class="muted"><input type="checkbox" id="siteBroken" ${state.sites.broken ? "checked" : ""}/> 只看异常</label>
        <button data-act="sites-search">筛选</button>
        <span class="spacer"></span>
        <button data-act="inspect-run">巡检一轮</button>
        <button class="ghost" data-act="sites-profile" ${sel.size ? "" : "disabled"}>抓分类 (${sel.size})</button>
        <button data-act="sites-test" ${sel.size ? "" : "disabled"}>测试选中 (${sel.size})</button>
        <button data-act="sites-enable" ${sel.size ? "" : "disabled"}>启用</button>
        <button data-act="sites-disable" ${sel.size ? "" : "disabled"}>停用</button>
        <button class="ghost" data-act="sites-select-all">全选本页</button>
      </div>
      <div id="inspectLine" class="muted" style="margin-bottom:8px"></div>
      <table>
        <thead><tr>
          <th style="width:28px"></th><th>名称</th><th>类型</th><th>接口</th>
          <th style="width:70px">延迟</th><th style="width:86px">健康</th><th style="width:86px">巡检</th><th style="width:60px">分类</th><th style="width:70px">状态</th><th style="width:150px"></th>
        </tr></thead>
        <tbody>
          ${
            rows
              .map(
                (s) => `
            <tr>
              <td><input type="checkbox" data-pick="site" data-key="${esc(s.key)}" ${sel.has(s.key) ? "checked" : ""}/></td>
              <td>${esc(s.name)}<div class="muted">${esc(s.sourceName || "")}</div></td>
              <td><span class="tag">${s.type}</span>${s.unsupported ? `<span class="tag warn" title="${esc(s.unsupported)}">需引擎</span>` : ""}</td>
              <td class="mono">${esc(s.api)}</td>
              <td>${s.health > 0 ? s.health + " ms" : "—"}</td>
              <td>${healthTag(s.health)}</td>
              <td>${inspectTag(s)}</td>
              <td>${s.classes || "—"}</td>
              <td><span class="tag ${s.enabled ? "ok" : ""}">${s.enabled ? "启用" : "停用"}</span></td>
              <td class="row">
                <button class="ghost" data-act="site-test" data-key="${esc(s.key)}">测试</button>
                <button class="ghost" data-act="site-toggle" data-key="${esc(s.key)}" data-on="${s.enabled ? "0" : "1"}">${s.enabled ? "停用" : "启用"}</button>
                <button class="ghost" data-act="site-up" data-key="${esc(s.key)}">↑</button>
                <button class="ghost" data-act="site-down" data-key="${esc(s.key)}">↓</button>
              </td>
            </tr>`
              )
              .join("") || `<tr><td colspan="10" class="empty">没有站点；先加订阅</td></tr>`
          }
        </tbody>
      </table>
      <div class="bar" style="margin-top:10px">
        <span class="muted">共 ${data.total} 个，第 ${data.page} 页</span>
        <button class="ghost" data-act="sites-prev" ${data.page <= 1 ? "disabled" : ""}>上一页</button>
        <button class="ghost" data-act="sites-next" ${data.page * data.size >= data.total ? "disabled" : ""}>下一页</button>
      </div>
    `;

    api("/api/inspect/status")
      .then((st) => {
        const line = document.getElementById("inspectLine");
        if (!line) return;
        const sum = st.summary || {};
        line.textContent = `巡检：每 ${st.intervalHours} 小时 · 已检查 ${sum.total || 0} 个（稳定 ${sum.ok || 0} / 连败 ${sum.warn || 0} / 降级 ${sum.degraded || 0}）${st.running ? " · 正在跑" : ""}`;
      })
      .catch(() => {});
  }

  function healthTag(health) {
    if (health === null || health === undefined) return `<span class="tag">未测</span>`;
    if (health === -1) return `<span class="tag bad">失败</span>`;
    if (health > 0 && health <= 3000) return `<span class="tag ok">正常</span>`;
    if (health > 3000) return `<span class="tag warn">偏慢</span>`;
    return `<span class="tag">未测</span>`;
  }

  function inspectTag(site) {
    const status = site.testStatus;
    if (!status) return `<span class="tag">—</span>`;
    if (status === "ok") return `<span class="tag ok">稳定</span>`;
    if (status === "warn") return `<span class="tag warn">${site.failStreak} 连败</span>`;
    return `<span class="tag bad" title="${esc(site.inspectMessage || "")}">已降级</span>`;
  }

  // ---------------- 收集 ----------------
  async function loadCandidates() {
    const { page, size, grade, promoted, q } = state.candidates;
    const qs = new URLSearchParams({ page, size });
    if (grade) qs.set("grade", grade);
    if (promoted) qs.set("promoted", promoted);
    if (q) qs.set("q", q);
    return api("/api/candidates?" + qs.toString());
  }

  async function renderCandidates() {
    const [data, seeds, run] = await Promise.all([
      loadCandidates(),
      api("/api/harvest/seeds"),
      api("/api/harvest/runs/current").catch(() => null)
    ]);
    const sel = state.selection.candidates;
    const c = data.counts || {};
    view().innerHTML = `
      <div class="card">
        <h3>种子 <span class="muted">（jsDelivr 镜像 / 任意订阅地址）</span></h3>
        <div class="row" style="margin-bottom:8px">
          ${(seeds.items || [])
            .map(
              (s) => `<span class="tag ${s.enabled === false ? "" : "ok"}">${esc(s.name)}${s.enabled === false ? " · 停" : ""}</span>`
            )
            .join("")}
        </div>
        <div class="row">
          <input id="seedName" placeholder="名称" style="width:140px" />
          <input id="seedUrl" placeholder="配置 JSON 地址" style="flex:1" />
          <button data-act="seed-add">加种子</button>
          <button class="primary" data-act="harvest-run">立即收集</button>
        </div>
        <div id="harvestProgress" class="muted" style="margin-top:8px">
          ${run && run.running ? `正在收集… ${run.progress?.done ?? 0}/${run.progress?.total ?? "?"}` : "上次：" + (run?.finishedAt ? new Date(run.finishedAt).toLocaleString() : "未运行")}
        </div>
      </div>

      <div class="bar">
        <span class="muted">候选 ${c.total ?? 0} · A ${c.A ?? 0} · B ${c.B ?? 0} · C ${c.C ?? 0} · D ${c.D ?? 0} · 已入池 ${c.promoted ?? 0}</span>
        <span class="spacer"></span>
        <select id="candGrade">
          <option value="">全部评级</option>
          ${["A", "B", "C", "D"].map((g) => `<option value="${g}" ${state.candidates.grade === g ? "selected" : ""}>${g}</option>`).join("")}
        </select>
        <select id="candPromoted">
          <option value="">全部</option>
          <option value="0" ${state.candidates.promoted === "0" ? "selected" : ""}>未入池</option>
          <option value="1" ${state.candidates.promoted === "1" ? "selected" : ""}>已入池</option>
        </select>
        <button data-act="cand-search">筛选</button>
        <button data-act="cand-probe" ${sel.size ? "" : "disabled"}>探测选中 (${sel.size})</button>
        <button data-act="cand-probe-new">探测新候选</button>
        <button class="primary" data-act="cand-promote" ${sel.size ? "" : "disabled"}>入池选中</button>
        <button class="danger" data-act="cand-exclude" ${sel.size ? "" : "disabled"}>排除</button>
      </div>
      <div id="probeLine" class="muted" style="margin-bottom:8px"></div>

      <table>
        <thead><tr>
          <th style="width:28px"></th><th style="width:44px">评级</th><th>品牌</th><th>接口</th>
          <th style="width:70px">延迟</th><th style="width:70px">播放</th><th style="width:70px">条数</th><th style="width:60px">分类</th><th style="width:110px">状态</th>
        </tr></thead>
        <tbody>
          ${
            (data.items || [])
              .map(
                (t) => `
            <tr>
              <td><input type="checkbox" data-pick="cand" data-key="${esc(t.key)}" ${sel.has(t.key) ? "checked" : ""}/></td>
              <td><span class="tag ${esc(t.grade || "")}">${esc(t.grade || "?")}</span></td>
              <td>${esc(t.brand)}</td>
              <td class="mono">${esc(t.api)}</td>
              <td>${t.probe?.ms ?? "—"}</td>
              <td>${t.probe ? Math.round((t.probe.playRate || 0) * 100) + "%" : "—"}</td>
              <td>${t.probe?.total ?? "—"}</td>
              <td>${t.probe?.categories ?? "—"}</td>
              <td>${
                t.excluded
                  ? `<span class="tag bad" title="${esc(t.excluded)}">已排除</span>`
                  : t.promotedSourceId
                    ? `<span class="tag ok">已入池</span>`
                    : `<span class="tag">待处理</span>`
              }</td>
            </tr>`
              )
              .join("") || `<tr><td colspan="9" class="empty">候选池是空的；点「立即收集」从种子拉取</td></tr>`
          }
        </tbody>
      </table>
      <div class="bar" style="margin-top:10px">
        <span class="muted">共 ${data.total} 个，第 ${data.page} 页</span>
        <button class="ghost" data-act="cand-prev" ${data.page <= 1 ? "disabled" : ""}>上一页</button>
        <button class="ghost" data-act="cand-next" ${data.page * data.size >= data.total ? "disabled" : ""}>下一页</button>
        <span class="spacer"></span>
        <a href="/api/report?format=md" target="_blank"><button class="ghost">导出 MD</button></a>
        <a href="/api/report?format=csv" target="_blank"><button class="ghost">导出 CSV</button></a>
      </div>
    `;
  }

  // ---------------- 发布 ----------------
  async function renderPublish() {
    const b = state.bootstrap;
    const pub = b?.publish;
    const url = pub ? `${location.origin}/config/${pub.token}.json` : "";
    view().innerHTML = `
      <div class="card">
        <h3>发布订阅</h3>
        <p>把当前所有启用的订阅合并成一份配置，TV 端订阅这个地址即可。</p>
        <p>版本：<b>${pub ? "v" + pub.version : "未发布"}</b>${pub ? ` · ${pub.sites} 站点 / ${pub.lives} 直播 · ${new Date(pub.publishedAt).toLocaleString()}` : ""}</p>
        <div class="row" style="margin-top:10px">
          <button class="primary" data-act="publish">${pub ? "重新发布" : "发布"}</button>
          ${pub ? `<input value="${esc(url)}" readonly style="flex:1" id="pubUrl" />` : ""}
          ${pub ? `<button class="ghost" data-act="copy-url">复制</button>` : ""}
        </div>
      </div>
      <div class="card">
        <h3>TV 端怎么用</h3>
        <p><b>发布不会主动推送到前台</b>，它只是生成一份快照。前台要「订阅」这个地址一次，之后才会跟着更新。</p>
        <p>1. NOVA TV 预览版：设置 → 订阅与内容源 → 添加订阅 → 远程订阅地址 → 粘贴上面的地址</p>
        <p>2. 第三方 TVBox / 影视仓：把地址填进「配置地址」</p>
        <p>3. 之后每次在这里点「重新发布」，前台<b>刷新页面</b>就会自动同步（启动时对远程订阅静默拉一次，30 分钟内不重复），也可以在前台那条订阅上点「同步」手动拉。</p>
        <p class="muted">发布地址固定不变，只换版本号；带 ETag，内容没变不会重复下载。</p>
      </div>
      <div class="card">
        <h3>合并预览</h3>
        <p class="muted">${(b?.sites || []).filter((s) => s.enabled).length} 个启用站点会被写进快照。</p>
      </div>
    `;
  }

  // ---------------- 设置 ----------------
  async function renderSettings() {
    const s = state.bootstrap?.settings || {};
    view().innerHTML = `
      <div class="card">
        <h3>请求</h3>
        <div class="grid2">
          <label>并发 <input id="setConcurrency" type="number" min="1" max="32" value="${s.concurrency ?? 8}" /></label>
          <label>超时（秒） <input id="setTimeout" type="number" min="5" max="120" value="${s.timeout ?? 20}" /></label>
        </div>
        <div class="row" style="margin-top:10px">
          <label class="muted"><input type="checkbox" id="setCommentary" ${s.filterCommentary ? "checked" : ""}/> 过滤解说/速看</label>
          <label class="muted"><input type="checkbox" id="setAutoLine" ${s.autoSwitchLine ? "checked" : ""}/> 播放失败自动切线路</label>
        </div>
        <div class="row" style="margin-top:10px">
          <button class="primary" data-act="settings-save">保存</button>
        </div>
      </div>
      <div class="card">
        <h3>数据</h3>
        <p>数据目录在启动日志里打印（默认 <code>preview/data/nova</code>）。</p>
        <p class="muted">备份：每个 JSON 写入前保留 .bak；收集与探测历史写在 .jsonl，可直接删。</p>
      </div>
      <div class="card">
        <h3>备份与恢复</h3>
        <p>一份 JSON 包含：订阅、覆盖表、候选池、种子、站点巡检状态、分类画像。</p>
        <div class="row" style="margin-top:8px">
          <a href="/api/backup" download="nova-admin-backup.json"><button class="ghost">下载备份</button></a>
          <button class="ghost" data-act="restore">粘贴恢复</button>
        </div>
      </div>
      <div class="card">
        <h3>巡检</h3>
        <p>默认每 6 小时自动跑一轮；连续 3 次失败的站点标为「已降级」，恢复后自动回到稳定。</p>
        <div class="row" style="margin-top:8px">
          <label>间隔（小时） <input id="setInspect" type="number" min="1" max="48" value="${s.inspectIntervalHours ?? 6}" /></label>
          <button class="ghost" data-act="settings-save">保存间隔</button>
        </div>
      </div>
    `;
  }

  // ---------------- 路由 ----------------
  const routes = {
    sources: { title: "订阅", render: renderSources },
    sites: { title: "站点", render: renderSites },
    candidates: { title: "收集", render: renderCandidates },
    publish: { title: "发布", render: renderPublish },
    settings: { title: "设置", render: renderSettings }
  };

  async function go(route) {
    state.route = routes[route] ? route : "sources";
    document.querySelectorAll("#nav button").forEach((b) => {
      b.classList.toggle("active", b.dataset.route === state.route);
    });
    $("#pageTitle").textContent = routes[state.route].title;
    try {
      await routes[state.route].render();
    } catch (error) {
      view().innerHTML = `<div class="empty">加载失败：${esc(error.message)}</div>`;
    }
  }

  // ---------------- 事件 ----------------
  document.addEventListener("click", async (event) => {
    const pick = event.target.closest("[data-pick]");
    if (pick) {
      const set = pick.dataset.pick === "site" ? state.selection.sites : state.selection.candidates;
      const key = pick.dataset.key;
      if (pick.checked) set.add(key);
      else set.delete(key);
      return;
    }

    const nav = event.target.closest("#nav button");
    if (nav) return go(nav.dataset.route);

    if (event.target.id === "tokenSave") {
      state.token = $("#tokenInput").value.trim();
      localStorage.setItem("nova.admin.token", state.token);
      toast("token 已保存");
      try {
        await refreshBootstrap();
        await go(state.route);
      } catch (_) {}
      return;
    }

    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    btn.disabled = true;
    try {
      await handleAction(act, btn);
    } catch (error) {
      /* api() 已提示 */
    } finally {
      btn.disabled = false;
    }
  });

  async function handleAction(act, btn) {
    switch (act) {
      case "refresh":
        await refreshBootstrap();
        await go(state.route);
        return;

      case "source-add-url": {
        const url = prompt("远程订阅地址（http/https）");
        if (!url) return;
        await api("/api/sources", { method: "POST", body: { url } });
        toast("已添加");
        await refreshBootstrap();
        return go("sources");
      }

      case "source-add-paste": {
        const json = prompt("粘贴 TVBox 配置 JSON");
        if (!json) return;
        await api("/api/sources", { method: "POST", body: { json } });
        toast("已导入");
        await refreshBootstrap();
        return go("sources");
      }

      case "source-add-preset": {
        await api("/api/sources/preset/" + encodeURIComponent(btn.dataset.id), { method: "POST" });
        toast("已添加内置预设");
        await refreshBootstrap();
        return go("sources");
      }

      case "source-toggle": {
        const id = btn.dataset.id;
        const source = (state.bootstrap.sources || []).find((s) => s.id === id);
        await api("/api/sources/" + encodeURIComponent(id), { method: "PATCH", body: { enabled: !source.enabled } });
        await refreshBootstrap();
        return go("sources");
      }

      case "source-sync": {
        toast("同步中…");
        const r = await api("/api/sources/" + encodeURIComponent(btn.dataset.id) + "/sync", { method: "POST" });
        toast(`已同步：${(r.source?.parsed?.sites || []).length} 个站点`);
        await refreshBootstrap();
        return go("sources");
      }

      case "source-del": {
        if (!confirm("删除这个订阅？（站点覆盖表会保留）")) return;
        await api("/api/sources/" + encodeURIComponent(btn.dataset.id), { method: "DELETE" });
        await refreshBootstrap();
        return go("sources");
      }

      case "sites-search": {
        state.sites.q = $("#siteQ").value.trim();
        state.sites.enabled = $("#siteEnabled").value;
        state.sites.broken = $("#siteBroken").checked ? "1" : "";
        state.sites.page = 1;
        return go("sites");
      }

      case "sites-select-all": {
        document.querySelectorAll('[data-pick="site"]').forEach((cb) => {
          cb.checked = true;
          state.selection.sites.add(cb.dataset.key);
        });
        return;
      }

      case "sites-test": {
        const keys = [...state.selection.sites].slice(0, 40);
        toast(`测试 ${keys.length} 个站点…`);
        const r = await api("/api/sites/test", { method: "POST", body: { keys } });
        const ok = (r.results || []).filter((x) => x.ok).length;
        toast(`完成：${ok}/${keys.length} 正常`);
        await refreshBootstrap();
        return go("sites");
      }

      case "sites-enable":
      case "sites-disable": {
        const keys = [...state.selection.sites];
        await api("/api/sites/bulk", { method: "POST", body: { action: act === "sites-enable" ? "enable" : "disable", keys } });
        state.selection.sites.clear();
        await refreshBootstrap();
        return go("sites");
      }

      case "site-test": {
        const r = await api("/api/sites/test", { method: "POST", body: { keys: [btn.dataset.key] } });
        const one = r.results?.[0];
        toast(one?.ok ? `正常，返回 ${one.count} 条` : `失败：${one?.message || "无响应"}`, !one?.ok);
        await refreshBootstrap();
        return go("sites");
      }

      case "site-toggle": {
        await api("/api/sites/" + encodeURIComponent(btn.dataset.key), { method: "PATCH", body: { enabled: btn.dataset.on === "1" } });
        await refreshBootstrap();
        return go("sites");
      }

      case "site-up":
      case "site-down": {
        await api("/api/sites/bulk", { method: "POST", body: { action: "move", keys: [btn.dataset.key], dir: act === "site-up" ? "up" : "down" } });
        return go("sites");
      }

      case "sites-prev":
        state.sites.page = Math.max(1, state.sites.page - 1);
        return go("sites");
      case "sites-next":
        state.sites.page += 1;
        return go("sites");

      case "seed-add": {
        const name = $("#seedName").value.trim() || "自定义种子";
        const url = $("#seedUrl").value.trim();
        if (!url) return toast("填个地址", true);
        await api("/api/harvest/seeds", { method: "POST", body: { name, url } });
        toast("已加种子");
        return go("candidates");
      }

      case "harvest-run": {
        await api("/api/harvest/run", { method: "POST" });
        toast("开始收集…");
        return pollHarvest();
      }

      case "cand-search": {
        state.candidates.grade = $("#candGrade").value;
        state.candidates.promoted = $("#candPromoted").value;
        state.candidates.page = 1;
        return go("candidates");
      }

      case "cand-probe":
      case "cand-probe-new": {
        const keys = act === "cand-probe" ? [...state.selection.candidates] : null;
        const r = await api("/api/candidates/probe", { method: "POST", body: keys ? { keys } : {} });
        if (r.job) {
          toast(`已排入探测：${r.queued || 0} 个，后台执行（${r.rounds || 3} 轮采样）`);
          return pollJob("probe", "probeLine");
        }
        toast(r.note || "没有需要探测的候选");
        return go("candidates");
      }

      case "inspect-run": {
        toast("巡检中…");
        const r = await api("/api/inspect/run", { method: "POST", body: { limit: 40 } });
        toast(`巡检完成：${r.checked} 个，正常 ${r.ok}，降级 ${r.degraded}`);
        await refreshBootstrap();
        return go("sites");
      }

      case "sites-profile": {
        const keys = [...state.selection.sites];
        toast("抓取分类…");
        const r = await api("/api/sites/profile", { method: "POST", body: { keys } });
        const got = (r.results || []).filter((x) => x.classes);
        toast(`分类抓取完成：${got.length}/${keys.length} 个站点有分类`);
        return go("sites");
      }

      case "cand-promote": {
        const keys = [...state.selection.candidates];
        const r = await api("/api/candidates/promote", { method: "POST", body: { keys } });
        toast(`已入池：${r.sites} 个站点（${r.brands} 个品牌）`);
        state.selection.candidates.clear();
        await refreshBootstrap();
        return go("candidates");
      }

      case "cand-exclude": {
        const reason = prompt("排除原因", "手动排除");
        if (!reason) return;
        const keys = [...state.selection.candidates];
        await api("/api/candidates/exclude", { method: "POST", body: { keys, reason } });
        toast("已排除");
        state.selection.candidates.clear();
        return go("candidates");
      }

      case "cand-prev":
        state.candidates.page = Math.max(1, state.candidates.page - 1);
        return go("candidates");
      case "cand-next":
        state.candidates.page += 1;
        return go("candidates");

      case "publish": {
        const r = await api("/api/publish", { method: "POST" });
        toast(`已发布 v${r.version}：${r.url}`);
        await refreshBootstrap();
        return go("publish");
      }

      case "copy-url": {
        const input = $("#pubUrl");
        if (input) {
          input.select();
          navigator.clipboard?.writeText(input.value);
          toast("已复制");
        }
        return;
      }

      case "settings-save": {
        const body = {
          concurrency: Number($("#setConcurrency").value),
          timeout: Number($("#setTimeout").value),
          filterCommentary: $("#setCommentary").checked,
          autoSwitchLine: $("#setAutoLine").checked
        };
        const inspectInput = $("#setInspect");
        if (inspectInput) body.inspectIntervalHours = Number(inspectInput.value);
        await api("/api/settings", { method: "POST", body });
        toast("已保存");
        await refreshBootstrap();
        return go("settings");
      }

      case "restore": {
        const text = prompt("粘贴之前下载的备份 JSON");
        if (!text) return;
        let payload = null;
        try {
          payload = JSON.parse(text);
        } catch (error) {
          return toast("不是合法 JSON", true);
        }
        const r = await api("/api/restore", { method: "POST", body: payload });
        toast(`已恢复：订阅 ${r.summary.sources} · 候选 ${r.summary.candidates} · 种子 ${r.summary.seeds}`);
        await refreshBootstrap();
        return go("settings");
      }

      default:
        return;
    }
  }

  async function pollJob(name, boxId) {
    const label = name === "probe" ? "探测" : name === "harvest" ? "收集" : name;
    for (let i = 0; i < 240; i += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      let job = null;
      try {
        job = await api("/api/jobs/current?name=" + encodeURIComponent(name));
      } catch (_) {}
      const box = document.getElementById(boxId);
      if (box && job) {
        box.textContent = job.running
          ? `${label}中：${job.progress?.done ?? 0}/${job.progress?.total ?? "?"}${job.progress?.current ? "（" + job.progress.current + "）" : ""}`
          : `${label}完成：${JSON.stringify(job.result || {}).slice(0, 100)}${job.error ? " · " + job.error : ""}`;
      }
      if (job && !job.running) break;
    }
    await refreshBootstrap();
    return go(state.route);
  }

  async function pollHarvest() {
    for (let i = 0; i < 240; i += 1) {
      await new Promise((r) => setTimeout(r, 1500));
      let run = null;
      try {
        run = await api("/api/harvest/runs/current");
      } catch (_) {}
      const box = $("#harvestProgress");
      if (box && run) {
        box.textContent = run.running
          ? `正在收集… ${run.progress?.done ?? 0}/${run.progress?.total ?? "?"}（${run.progress?.current || ""}）`
          : `收集完成：新增 ${run.result?.added ?? 0} · 更新 ${run.result?.updated ?? 0}${run.error ? " · 失败 " + run.error : ""}`;
      }
      if (run && !run.running) break;
    }
    return go("candidates");
  }

  // ---------------- 启动 ----------------
  async function boot() {
    $("#tokenInput").value = state.token;
    try {
      const health = await api("/api/health");
      $("#healthLine").textContent = `已连接 · 站点 ${health.sites} · 候选 ${health.candidates}`;
      await refreshBootstrap();
    } catch (error) {
      $("#healthLine").textContent = "未连接 · 检查 token";
    }
    const initial = (location.hash || "#sources").slice(1);
    go(initial);
  }

  window.addEventListener("hashchange", () => go((location.hash || "#sources").slice(1)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.id === "seedUrl") handleAction("seed-add", event.target);
    if (event.key === "Enter" && event.target.id === "siteQ") handleAction("sites-search", event.target);
  });

  boot();
})();
