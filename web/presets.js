/**
 * NOVA TV · 内置订阅预设
 *
 * 对齐 tvbox-desktop 的 presets.ts：装完就能用，不必先找订阅地址。
 * 但这里只内置「公开可用的苹果 CMS 采集接口」，不带任何私有/付费/DRM 源；
 * 每个接口都是标准 /api.php/provide/vod，能在浏览器里直接请求。
 *
 * 浏览器版不写盘：预设内容直接落进 localStorage 的订阅表（nova.tvbox.sources.v1），
 * 所以「送一次就不管」要靠 sources.js 里的 bundled 标志位，删干净了也不会自己长回来。
 *
 * 接口会失效。失效时进「设置 → 影视源」逐个测试即可看到，不会假装可用。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NovaPresets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PUBLIC_CMS = {
    id: "public-cms",
    name: "公开可用源（苹果 CMS 采集站）",
    desc: "5 个公开苹果 CMS 接口 + 1 个公开直播源。接口随时可能失效，失效后在「影视源」里逐个测试就能看出来。",
    siteCount: 5,
    liveCount: 1,
    config: {
      format: "tvbox-desktop/1",
      name: "公开可用源（苹果 CMS 采集站）",
      note: "全部是标准苹果 CMS v10 的 /api.php/provide/vod 接口：列表有数据、带 wd 的搜索有结果、详情能解析出剧集地址。只用于验证聚合链路，不代表任何正版授权。",
      sites: [
        { key: "ffzy", name: "非凡资源", type: "cms", api: "https://api.ffzyapi.com/api.php/provide/vod", searchable: 1 },
        { key: "lzi", name: "量子资源", type: "cms", api: "https://cj.lziapi.com/api.php/provide/vod", searchable: 1 },
        { key: "dyttzy", name: "电影天堂资源", type: "cms", api: "https://caiji.dyttzyapi.com/api.php/provide/vod", searchable: 1 },
        { key: "guangsu", name: "光速资源", type: "cms", api: "https://api.guangsuapi.com/api.php/provide/vod", searchable: 1 },
        { key: "subo", name: "素博资源", type: "cms", api: "https://subocaiji.com/api.php/provide/vod", searchable: 1 }
      ],
      lives: [
        { name: "公开直播源·IPv4（txt）", type: 0, url: "https://live.zbds.top/tv/iptv4.txt" }
      ],
      parses: [],
      flags: ["nova", "preset", "public-cms"],
      tvboxDesktop: {
        format: "tvbox-desktop/1",
        timeout: 20,
        home: {
          sections: [
            { title: "电影 · 最近更新", site: "dyttzy" },
            { title: "电视剧 · 国产剧", site: "lzi" }
          ]
        }
      }
    }
  };

  // 预览版不再内置任何内容源/影视源：装好是空的，全靠用户自己导入
  // 内置源清单：全部是公开苹果 CMS v10 接口，可在浏览器里直接请求
  const BUILTIN_SOURCES = [
    {
      id: "lzi",
      siteKey: "lzi",
      name: "量子资源",
      api: "https://cj.lziapi.com/api.php/provide/vod",
      desc: "片库 16 万条；播放地址是分享页，解析后出 m3u8。"
    },
    {
      id: "ffzy",
      siteKey: "ffzy",
      name: "非凡资源",
      api: "https://api.ffzyapi.com/api.php/provide/vod",
      desc: "公开苹果 CMS 接口，片库较大。"
    },
    {
      id: "dyttzy",
      siteKey: "dyttzy",
      name: "电影天堂资源",
      api: "https://caiji.dyttzyapi.com/api.php/provide/vod",
      desc: "电影天堂采集接口；分享页可能 404，播放成功率较低。"
    },
    {
      id: "guangsu",
      siteKey: "guangsu",
      name: "光速资源",
      api: "https://api.guangsuapi.com/api.php/provide/vod",
      desc: "公开苹果 CMS 接口。"
    },
    {
      id: "subo",
      siteKey: "subo",
      name: "素博资源",
      api: "https://subocaiji.com/api.php/provide/vod",
      desc: "公开苹果 CMS 接口。"
    },
      {
      id: "wujin",
      siteKey: "wujin",
      name: "无尽资源",
      api: "https://api.wujinapi.me/api.php/provide/vod",
      desc: "公开苹果 CMS 接口，和合并包里的无尽镜像互为备份。"
    },
    {
      id: "nova-pack",
      name: "NOVA 合并包",
      desc: "16 个公开采集站 + 1 个公开直播源，一次装齐。"
      ,sites: [
        {
          "key": "zuidazy-me",
          "name": "最大资源",
          "type": 3,
          "api": "http://zuidazy.me/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "api-wujinapi-me",
          "name": "无尽资源",
          "type": 3,
          "api": "https://api.wujinapi.me/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "yayazy2-com",
          "name": "丫丫点播",
          "type": 3,
          "api": "https://yayazy2.com/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "api-niuniuzy-me",
          "name": "牛牛点播",
          "type": 3,
          "api": "https://api.niuniuzy.me/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "sdzyapi-com",
          "name": "闪电资源",
          "type": 3,
          "api": "https://sdzyapi.com/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "api-guangsuapi-com",
          "name": "光速资源",
          "type": 3,
          "api": "https://api.guangsuapi.com/api.php/provide/vod/from/gsm3u8/",
          "searchable": 1
        },
        {
          "key": "ty-tyyszy5-com",
          "name": "天涯资源",
          "type": 3,
          "api": "https://ty.tyyszy5.com/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "www-mdzyapi-com",
          "name": "魔都资源",
          "type": 3,
          "api": "https://www.mdzyapi.com/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "360zy-tv",
          "name": "360资源",
          "type": 3,
          "api": "https://360zy.tv/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "cj-yayazy-net",
          "name": "丫丫点播·备用",
          "type": 3,
          "api": "https://cj.yayazy.net/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "api-wujinapi-net",
          "name": "无尽资源·备用",
          "type": 3,
          "api": "https://api.wujinapi.net/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "zuidazy-co",
          "name": "最大资源·备用",
          "type": 3,
          "api": "https://zuidazy.co/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "360zy-com",
          "name": "360资源·备用",
          "type": 3,
          "api": "https://360zy.com/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "caiji-moduapi-cc",
          "name": "魔都资源·备用",
          "type": 3,
          "api": "https://caiji.moduapi.cc/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "niuniuzy3-com",
          "name": "牛牛点播·备用",
          "type": 3,
          "api": "https://niuniuzy3.com/api.php/provide/vod/",
          "searchable": 1
        },
        {
          "key": "tyyszy-com",
          "name": "天涯资源·备用",
          "type": 3,
          "api": "https://tyyszy.com/api.php/provide/vod/",
          "searchable": 1
        }
      ],
      lives: [
        {
          "name": "公开 IPTV（zbds）",
          "type": 0,
          "url": "https://live.zbds.top/tv/iptv4.txt"
        }
      ]
    }
];

  const PRESETS = BUILTIN_SOURCES.map((source) => {
    const sites = source.sites || [
      {
        key: source.siteKey,
        name: source.name,
        type: "cms",
        api: source.api,
        searchable: 1
      }
    ];
    const lives = source.lives || [];
    return {
      id: source.id,
      name: source.name,
      desc: source.desc,
      siteCount: sites.length,
      liveCount: lives.length,
      config: {
        format: "tvbox-desktop/1",
        name: source.name,
        sites,
        lives
      }
    };
  });

  function list() {
    return PRESETS.map(({ id, name, desc, siteCount, liveCount }) => ({
      id,
      name,
      desc,
      siteCount,
      liveCount
    }));
  }

  function get(id) {
    return PRESETS.find((preset) => preset.id === id) || null;
  }

  /** 生成一份独立配置副本，避免调用方改到预设本体 */
  function buildConfig(id) {
    const preset = get(id);
    if (!preset) throw new Error("没有这个内置订阅");
    return JSON.parse(JSON.stringify(preset.config));
  }

  /** 预设订阅在本地订阅表里的固定标识，用来做去重 */
  function presetUrl(id) {
    return `preset://${id}`;
  }

  return { PRESETS, list, get, buildConfig, presetUrl };
});
