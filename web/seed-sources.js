/*
  NOVA TV · 内容源种子
  用法：
    /?seed=lz    量子资源（带播放解析，可直出 m3u8）
    /?seed=dytt  电影天堂资源（可浏览，部分播放地址失效）

  首次访问（本地一个源都没有）时，自动送一个实测可用的公开源，
  让「打开就有片」成立；只送一次，用户删掉后不会再回来。
  显式带 ?seed= 时以参数为准，不触发自动送源。
*/
(function () {
  "use strict";

  const SEEDS = {
    lz: {
      name: "量子资源",
      sites: [
        {
          key: "lziapi",
          name: "量子资源",
          type: 3,
          api: "https://cj.lziapi.com/api.php/provide/vod",
          searchable: 1,
          quickSearch: 1
        }
      ],
      lives: []
    },
    dytt: {
      name: "电影天堂资源",
      sites: [
        {
          key: "dyttzy",
          name: "电影天堂资源",
          type: 3,
          api: "https://caiji.dyttzyapi.com/api.php/provide/vod",
          searchable: 1,
          quickSearch: 1
        }
      ],
      lives: []
    }
  };

  // 首访送的源：2026-11-19 实测 A 级（列表 20 条、播放抽样 10/10、935ms）
  const AUTOSEED_KEY = "nova.autoseed.v1";
  const AUTOSEED = {
    name: "无尽资源",
    notice: "NOVA TV 首次启动自动添加的公开测试源，可在设置里删除或换成自己的订阅。",
    sites: [
      {
        key: "wujin-me",
        name: "无尽资源",
        type: 3,
        api: "https://api.wujinapi.me/api.php/provide/vod",
        searchable: 1,
        quickSearch: 1
      }
    ],
    lives: []
  };

  const qp = new URLSearchParams(window.location.search);
  const kind = qp.get("seed");
  const SEED = SEEDS[kind];

  function run() {
    const api = window.NovaSources;
    if (!api) return;

    if (SEED) {
      try {
        api.importJson(JSON.stringify(SEED), { name: SEED.name });
      } catch (error) {
        const existing = api.list?.().find((item) => item.name === SEED.name);
        if (existing && api.setEnabled) api.setEnabled(existing.id, true);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("seed");
      window.location.replace(url.toString());
      return;
    }

    // 自动送源：只送一次，已有源就不打扰
    if (localStorage.getItem(AUTOSEED_KEY)) return;
    const current = api.list?.() || [];
    if (current.length) {
      localStorage.setItem(AUTOSEED_KEY, "1");
      return;
    }
    localStorage.setItem(AUTOSEED_KEY, "1");
    try {
      api.importJson(JSON.stringify(AUTOSEED), { name: AUTOSEED.name, kind: "autoseed" });
      // 首访只有这一次刷新，之后都走正常流程
      window.setTimeout(() => window.location.reload(), 120);
    } catch (error) {
      /* 送源失败不阻塞页面，用户仍可手动添加 */
    }
  }

  if (document.readyState === "complete") window.setTimeout(run, 80);
  else window.addEventListener("load", () => window.setTimeout(run, 80));
})();
