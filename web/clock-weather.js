/*
  NOVA TV preview - live clock, date and weather.
  Dependency-free: time from the device, lunar date from Intl's chinese calendar,
  weather from wttr.in through the local proxy (the only reachable endpoint here).
*/
(function () {
  const pad = (value) => String(value).padStart(2, "0");
  const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const LUNAR_DAYS = [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
  ];
  const CITY_KEY = "nova.weather.city.v1";
  const REFRESH_MS = 15 * 60 * 1000;

  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("dateText");
  const weekEl = document.getElementById("weekdayText");
  const lunarEl = document.getElementById("lunarText");
  const lineEl = document.getElementById("dateLine");
  const iconUse = document.getElementById("weatherIconUse");
  const tempEl = document.getElementById("temperature");
  const cityEl = document.getElementById("weatherCity");
  const condEl = document.getElementById("weatherCondition");
  const highEl = document.getElementById("tempHigh");
  const lowEl = document.getElementById("tempLow");

  if (!clockEl) return;

  /* ---------- 时间 / 日期 / 农历 ---------- */

  let lunarFormatter = null;

  function formatLunar(date) {
    if (!lunarEl) return;
    try {
      lunarFormatter ??= new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
        month: "long",
        day: "numeric"
      });
      const parts = lunarFormatter.formatToParts(date);
      const month = parts.find((part) => part.type === "month")?.value || "";
      const rawDay = parts.find((part) => part.type === "day")?.value || "";
      const dayNumber = Number.parseInt(rawDay, 10);
      const day = Number.isFinite(dayNumber)
        ? LUNAR_DAYS[Math.min(29, Math.max(0, dayNumber - 1))]
        : rawDay;
      lunarEl.textContent = month ? `农历${month}${day}` : "";
    } catch {
      lunarEl.textContent = "";
    }
  }

  function paintClock() {
    const now = new Date();
    if (clockEl) clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (dateEl) dateEl.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    if (weekEl) weekEl.textContent = WEEKDAYS[now.getDay()];
    formatLunar(now);
  }

  paintClock();
  window.setInterval(paintClock, 1000);

  /* ---------- 天气 ---------- */

  // wttr.in 的 areaName 是拼音，常见城市映射回中文
  const CITY_ZH = {
    anqing: "安庆", beijing: "北京", shanghai: "上海", tianjin: "天津", chongqing: "重庆",
    guangzhou: "广州", shenzhen: "深圳", hangzhou: "杭州", nanjing: "南京", wuhan: "武汉",
    chengdu: "成都", xian: "西安", "xi'an": "西安", suzhou: "苏州", qingdao: "青岛",
    dalian: "大连", xiamen: "厦门", changsha: "长沙", zhengzhou: "郑州", jinan: "济南",
    hefei: "合肥", fuzhou: "福州", nanchang: "南昌", kunming: "昆明", guiyang: "贵阳",
    shenyang: "沈阳", harbin: "哈尔滨", changchun: "长春", shijiazhuang: "石家庄",
    taiyuan: "太原", lanzhou: "兰州", urumqi: "乌鲁木齐", lhasa: "拉萨", haikou: "海口",
    nanning: "南宁", hongkong: "香港", macau: "澳门", taipei: "台北",
    pootung: "浦东", pudong: "浦东", yenchuang: "鄢陵", henan: "河南"
  };

  const REGION_ZH = {
    anhui: "安徽", beijing: "北京", chongqing: "重庆", fujian: "福建", gansu: "甘肃",
    guangdong: "广东", guangxi: "广西", guizhou: "贵州", hainan: "海南", hebei: "河北",
    heilongjiang: "黑龙江", henan: "河南", hubei: "湖北", hunan: "湖南", "inner mongolia": "内蒙古",
    jiangsu: "江苏", jiangxi: "江西", jilin: "吉林", liaoning: "辽宁", ningxia: "宁夏",
    qinghai: "青海", shaanxi: "陕西", shandong: "山东", shanghai: "上海", shanxi: "山西",
    sichuan: "四川", tianjin: "天津", tibet: "西藏", xinjiang: "新疆", yunnan: "云南",
    zhejiang: "浙江", hongkong: "香港", macau: "澳门", taiwan: "台湾"
  };

  function localizeCity(name) {
    const key = String(name || "").trim().toLowerCase();
    return CITY_ZH[key] || "";
  }

  // wttr.in 用 WWO 天气代码，不是 WMO
  const WWO_KINDS = [
    { codes: [113], label: "晴", icon: "i-sun" },
    { codes: [116], label: "晴间多云", icon: "i-cloud-sun" },
    { codes: [119], label: "多云", icon: "i-cloud" },
    { codes: [122], label: "阴", icon: "i-cloud" },
    { codes: [143, 248, 260], label: "雾", icon: "i-fog" },
    { codes: [149], label: "霾", icon: "i-fog" },
    { codes: [176, 263, 266, 293, 296, 353], label: "小雨", icon: "i-rain" },
    { codes: [299, 302, 356], label: "中雨", icon: "i-rain" },
    { codes: [305, 308, 359], label: "大雨", icon: "i-rain" },
    { codes: [200, 386, 389], label: "雷雨", icon: "i-storm" },
    {
      codes: [179, 182, 185, 227, 230, 320, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377, 392, 395],
      label: "降雪",
      icon: "i-snow"
    }
  ];

  function describeWeather(code, fallbackText) {
    const hit = WWO_KINDS.find((kind) => kind.codes.includes(code));
    if (hit) return hit;
    return { label: fallbackText || "天气", icon: "i-cloud-sun" };
  }

  function setState(state) {
    lineEl?.setAttribute("data-weather", state);
  }

  function proxy(url) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  async function fetchJson(url) {
    const response = await fetch(proxy(url), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function preferredCity() {
    const fromQuery = new URLSearchParams(window.location.search).get("city");
    if (fromQuery) return fromQuery.trim();
    try {
      return (window.localStorage.getItem(CITY_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  /* ---------- 定位：GPS > 手动城市 > 中文 IP 库 ---------- */

  const GEO_KEY = "nova.weather.geo.v1";
  const GEO_TTL = 10 * 60 * 1000;

  function readGeo() {
    try {
      const raw = window.localStorage.getItem(GEO_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude)) return null;
      if (Date.now() - Number(parsed.at || 0) > GEO_TTL) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveGeo(geo) {
    try {
      window.localStorage.setItem(GEO_KEY, JSON.stringify({ ...geo, at: Date.now() }));
    } catch {
      /* 隐私模式忽略 */
    }
  }

  function browserPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      const timer = window.setTimeout(() => resolve(null), 8000);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          window.clearTimeout(timer);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: "gps",
            accuracy: Math.round(position.coords.accuracy || 0)
          });
        },
        () => {
          window.clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
      );
    });
  }

  function stripJsonPrefix(text) {
    const start = text.indexOf("{");
    return start >= 0 ? text.slice(start) : text;
  }

  async function ipPlace() {
    try {
      const response = await fetch(proxy("https://whois.pconline.com.cn/ipJson.jsp?json=true"), { cache: "no-store" });
      if (!response.ok) return null;
      // pconline 用 GBK，按 UTF-8 解会变乱码，城市名就废了
      const raw = await response.arrayBuffer();
      let text;
      try {
        text = new TextDecoder("gbk").decode(raw);
      } catch {
        text = new TextDecoder("utf-8").decode(raw);
      }
      const data = JSON.parse(stripJsonPrefix(text));
      const city = (data.city || "").trim();
      const province = (data.pro || "").trim();
      const name = city && city !== province ? city : province;
      if (!name) return null;
      return { name, province, source: "ip" };
    } catch {
      return null;
    }
  }

  async function geocode(name) {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search" +
      `?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`;
    const data = await fetchJson(url);
    const hit = data.results?.[0];
    if (!hit) return null;
    return {
      latitude: hit.latitude,
      longitude: hit.longitude,
      city: hit.name || name,
      admin: hit.admin1 || "",
      source: "fuzzy"
    };
  }

  async function resolveTarget() {
    const manual = preferredCity();
    if (manual) {
      const geo = await geocode(manual).catch(() => null);
      if (geo) return { ...geo, source: "manual" };
      return { latitude: null, longitude: null, city: manual, source: "manual", nameOnly: true };
    }

    const cached = readGeo();
    if (cached) return cached;

    const gps = await browserPosition();
    if (gps) {
      saveGeo(gps);
      return gps;
    }

    const ip = await ipPlace();
    if (ip) {
      const geo = await geocode(ip.city || ip.name).catch(() => null);
      if (geo) return { ...geo, city: ip.name, source: "ip" };
      return { latitude: null, longitude: null, city: ip.name, source: "ip", nameOnly: true };
    }

    return { latitude: null, longitude: null, city: "", source: "none", nameOnly: true };
  }

  function weatherUrl(target) {
    if (target.latitude != null && target.longitude != null) {
      const lat = Number(target.latitude).toFixed(4);
      const lon = Number(target.longitude).toFixed(4);
      return `https://wttr.in/${lat},${lon}?format=j1&lang=zh`;
    }
    if (target.city) {
      return `https://wttr.in/${encodeURIComponent(target.city)}?format=j1&lang=zh`;
    }
    return "https://wttr.in/?format=j1&lang=zh";
  }

  function sourceLabel(source) {
    return { gps: "GPS 定位", manual: "手动指定", ip: "IP 定位", fuzzy: "城市检索", none: "默认位置" }[source] || "定位";
  }

  function render(block, target) {
    const current = block.current_condition?.[0] || {};
    const today = block.weather?.[0] || {};
    const nearest = block.nearest_area?.[0] || {};
    const areaName = nearest.areaName?.[0]?.value || "";
    const regionName = nearest.region?.[0]?.value || "";
    const code = Number(current.weatherCode);
    const desc = current.weatherDesc?.[0]?.value || "";
    const kind = describeWeather(Number.isFinite(code) ? code : -1, desc);

    const displayCity =
      target.city ||
      localizeCity(areaName) ||
      REGION_ZH[String(regionName).toLowerCase()] ||
      areaName ||
      "当前位置";

    if (iconUse) iconUse.setAttribute("href", `#${kind.icon}`);
    if (tempEl) tempEl.textContent = `${Math.round(Number(current.temp_C))}°`;
    if (cityEl) cityEl.textContent = displayCity;
    if (condEl) condEl.textContent = kind.label;
    if (highEl) highEl.textContent = `${Math.round(Number(today.maxtempC))}°`;
    if (lowEl) lowEl.textContent = `${Math.round(Number(today.mintempC))}°`;
    lastGoodCity = displayCity;
    lastGoodTarget = target;

    setState("ready");
    const astronomy = today.astronomy?.[0] || {};
    const aqi = current["air_quality"]?.["us-epa-index"];
    const aqiLevel = { 1: "优", 2: "良", 3: "轻度", 4: "中度", 5: "重度", 6: "严重" }[String(aqi)] || "";
    const stamp = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const detail = [
      sourceLabel(target.source) + (target.accuracy ? ` ±${target.accuracy}m` : ""),
      areaName ? `${areaName}${regionName ? " · " + regionName : ""}` : "",
      current.FeelsLikeC ? `体感 ${Math.round(Number(current.FeelsLikeC))}°` : "",
      current.humidity ? `湿度 ${current.humidity}%` : "",
      current.windspeedKmph ? `${current.winddir16Point || ""} ${current.windspeedKmph}km/h` : "",
      astronomy.sunrise ? `日出 ${astronomy.sunrise}` : "",
      astronomy.sunset ? `日落 ${astronomy.sunset}` : "",
      aqiLevel ? `空气${aqiLevel}` : ""
    ].filter(Boolean).join(" · ");
    lineEl?.setAttribute("title", `${detail} · 更新于 ${stamp} · 点击重新定位`);
  }

  function renderError(message) {
    if (tempEl) tempEl.textContent = "--°";
    if (condEl) condEl.textContent = message;
    if (highEl) highEl.textContent = "--°";
    if (lowEl) lowEl.textContent = "--°";
    if (cityEl) cityEl.textContent = preferredCity() || lastGoodCity || "位置未知";
    setState("error");
    lineEl?.setAttribute("title", "点击重试");
  }

  let busy = false;
  let lastGoodCity = "";
  let lastGoodTarget = null;

  async function loadWeather(options = {}) {
    if (busy) return;
    busy = true;
    setState("loading");
    if (condEl) condEl.textContent = "读取天气";
    let target = lastGoodTarget;
    try {
      if (options.relocate) {
        try {
          window.localStorage.removeItem(GEO_KEY);
        } catch {
          /* ignore */
        }
      }
      target = await resolveTarget();
      if (target.city && cityEl) cityEl.textContent = target.city;
      render(await fetchJson(weatherUrl(target)), target);
    } catch {
      renderError(navigator.onLine ? "天气暂不可用" : "当前离线");
    } finally {
      busy = false;
    }
  }

  loadWeather();
  window.setInterval(() => loadWeather({ relocate: true }), REFRESH_MS);
  lineEl?.addEventListener("click", () => loadWeather({ relocate: true }));
  window.addEventListener("online", () => loadWeather());
})();