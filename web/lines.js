/**
 * NOVA TV · 多源线路聚合层（LineOption）
 *
 * 设计参考：kanju4 的 playback.line_options 抽象（见 kanjutv-re 分析文档）。
 * 只迁移「数据结构 + 选线策略」，不迁移它的接口、密钥、计费与广告：
 *
 *   - 一条线路用单一对象表达：直链 / 待解析 / 优先级 / 倍率 / 过期 / 探测延迟 / 镜像；
 *   - 「解析」与「播放」分离：resolveMode=parse 的线路必须先换出最终地址才能播；
 *   - 同一片源的多域名镜像合并成一条，避免线路面板被 4 个相同的源刷屏；
 *   - 失败自动切下一条，切完为止，然后才报错。
 *
 * 运行环境：浏览器（window.NovaLines）与 Node（module.exports）通用，无外部依赖。
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NovaLines = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const URL_KIND = Object.freeze({
    M3U8: "m3u8",
    MP4: "mp4",
    PAGE: "page",
    TICKET: "resolve_ticket"
  });

  const RESOLVE_MODE = Object.freeze({
    DIRECT: "direct",
    PARSE: "parse"
  });

  const PROBE_STATUS = Object.freeze({
    UNKNOWN: "unknown",
    OK: "ok",
    DEAD: "dead",
    SLOW: "slow",
    ENCRYPTED: "encrypted"
  });

  const TOKEN_SCENARIO = Object.freeze({
    DIRECT_ZERO: "direct_zero",
    PARSE_BILLED: "parse_billed"
  });

  const DEFAULT_WEIGHT = 800;
  const SLOW_LATENCY_MS = 2500;

  function text(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value).trim() || fallback;
  }

  function num(value, fallback) {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function slug(value) {
    const base = text(value).toLowerCase();
    const cleaned = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (cleaned) return cleaned;
    // 中文线路名没有 a-z 字符时，用稳定的短哈希保证 providerId 可复现。
    let hash = 0;
    for (let index = 0; index < base.length; index += 1) {
      hash = (hash * 31 + base.charCodeAt(index)) % 0xffffffff;
    }
    return `p${hash.toString(16)}`;
  }

  /** 按扩展名判定线路形态；识别不了的当「页面/需要解析」，不给播放器猜。 */
  function classifyUrl(url) {
    const value = text(url).toLowerCase();
    if (!value) return URL_KIND.PAGE;
    if (value.startsWith("resolve://")) return URL_KIND.TICKET;
    const withoutQuery = value.split("?")[0].split("#")[0];
    if (withoutQuery.endsWith(".m3u8")) return URL_KIND.M3U8;
    if (/\.(mp4|m4v|webm|mkv)$/.test(withoutQuery)) return URL_KIND.MP4;
    if (/\.(ts|flv)$/.test(withoutQuery)) return URL_KIND.MP4;
    return URL_KIND.PAGE;
  }

  /**
   * 镜像签名：只保留路径末尾 4 段，并丢掉纯数字日期段与 v14 / yyv14 这类档位前缀。
   * 结果是「跨域名可比」的片源指纹——同一片源的多域名镜像会得到同一个签名。
   */
  function signature(url) {
    const value = text(url);
    if (!value) return "";
    let pathname = value;
    try {
      pathname = new URL(value).pathname;
    } catch (_) {
      pathname = value.split("?")[0];
    }
    const segments = pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => !/^v\d+$/.test(segment))
      .filter((segment) => !/^yyv\d+$/.test(segment))
      .filter((segment) => !/^\d{6,8}$/.test(segment));
    if (!segments.length) return pathname.toLowerCase();
    return segments.slice(-4).join("/").toLowerCase();
  }

  /** 规范化为统一 LineOption。入参可以是 NOVA 内部结构，也可以是 kanju4 风格的 line_options。 */
  function normalize(raw, context = {}) {
    const source = raw || {};
    const url = text(source.url);
    const urlKind = text(source.urlKind ?? source.url_kind, classifyUrl(url));
    let resolveMode = text(source.resolveMode ?? source.resolve_mode, "");
    if (!resolveMode) {
      resolveMode =
        urlKind === URL_KIND.M3U8 || urlKind === URL_KIND.MP4
          ? RESOLVE_MODE.DIRECT
          : RESOLVE_MODE.PARSE;
    }
    const resolveRequired =
      typeof source.resolveRequired === "boolean"
        ? source.resolveRequired
        : typeof source.resolve_required === "boolean"
          ? source.resolve_required
          : resolveMode === RESOLVE_MODE.PARSE;
    const resolved =
      typeof source.resolved === "boolean"
        ? source.resolved
        : resolveMode === RESOLVE_MODE.DIRECT;

    const providerId = text(
      source.providerId ?? source.provider_id,
      slug(source.label ?? source.name ?? context.sourceName ?? "line")
    );
    const label = text(source.label ?? source.name, providerId);

    return {
      id: text(source.id, `${providerId}:${signature(url) || label}`),
      providerId,
      playFrom: text(source.playFrom ?? source.play_from ?? source.lineName, providerId),
      label,
      url,
      urlKind,
      resolved,
      resolveMode,
      resolveRequired,
      // NOVA TV 不做词元计费，倍率字段留着是为了对上上游模型，默认 0。
      priceMultiplierBps: num(
        source.priceMultiplierBps ?? source.price_multiplier_bps,
        0
      ),
      tokenScenario: text(
        source.tokenScenario ?? source.token_scenario,
        resolveMode === RESOLVE_MODE.DIRECT
          ? TOKEN_SCENARIO.DIRECT_ZERO
          : TOKEN_SCENARIO.PARSE_BILLED
      ),
      minimumUserLevel: num(source.minimumUserLevel ?? source.minimum_user_level, 0),
      preferenceWeight: num(
        source.preferenceWeight ?? source.preference_weight,
        num(context.fallbackWeight, DEFAULT_WEIGHT)
      ),
      selected: Boolean(source.selected ?? context.selected),
      defaultPriority: Boolean(
        source.defaultPriority ?? source.default_priority ?? context.defaultPriority
      ),
      // 探测结果：probe_status / latency_ms 沿用上游命名，probe 是本层结构化视图。
      probeStatus: text(
        source.probeStatus ?? source.probe_status,
        PROBE_STATUS.UNKNOWN
      ),
      latencyMs: num(source.latencyMs ?? source.latency_ms, -1),
      expiresAt: text(source.expiresAt ?? source.expires_at, ""),
      headers: source.headers && typeof source.headers === "object" ? { ...source.headers } : {},
      mirrors: Array.isArray(source.mirrors) ? source.mirrors.slice() : [],
      episodeName: text(source.episodeName, context.episodeName),
      siteName: text(source.siteName ?? context.siteName, ""),
      episodeIndex: num(source.episodeIndex, num(context.episodeIndex, 0)),
      signature: text(source.signature, signature(url))
    };
  }

  /**
   * 把一条片源的多域名镜像合并成一条：保留权重最高的一条作主线路，
   * 其余降级为 mirrors[]，播放器只在主线路失败时才动镜像。
   */
  function dedupe(options) {
    const groups = new Map();
    const loose = [];

    options.forEach((option) => {
      const key = option.signature;
      if (!key) {
        loose.push(option);
        return;
      }
      const bucket = groups.get(key);
      if (!bucket) {
        groups.set(key, { primary: option, mirrors: [] });
        return;
      }
      if (option.preferenceWeight > bucket.primary.preferenceWeight) {
        bucket.mirrors.push(bucket.primary);
        bucket.primary = option;
      } else {
        bucket.mirrors.push(option);
      }
    });

    const merged = [];
    groups.forEach(({ primary, mirrors }) => {
      merged.push({
        ...primary,
        mirrors: mirrors
          .sort((left, right) => right.preferenceWeight - left.preferenceWeight)
          .map((item) => ({
            id: item.id,
            label: item.label,
            providerId: item.providerId,
            url: item.url,
            preferenceWeight: item.preferenceWeight
          })),
        mirrorCount: mirrors.length
      });
    });
    return [...merged, ...loose];
  }

  function isAvailable(option, options = {}) {
    if (!option.url) return false;
    if (options.skipDead !== false && option.probeStatus === PROBE_STATUS.DEAD) return false;
    return true;
  }

  function compareOptions(left, right) {
    if (right.preferenceWeight !== left.preferenceWeight) {
      return right.preferenceWeight - left.preferenceWeight;
    }
    // 已解析的线路优先于待解析线路：少一次网络往返。
    if (left.resolved !== right.resolved) return left.resolved ? -1 : 1;
    const leftLatency = left.latencyMs >= 0 ? left.latencyMs : Number.POSITIVE_INFINITY;
    const rightLatency = right.latencyMs >= 0 ? right.latencyMs : Number.POSITIVE_INFINITY;
    if (leftLatency !== rightLatency) return leftLatency - rightLatency;
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  }

  /**
   * 排序：权重降序 → 已解析优先 → 探测延迟升序。
   * strictPreferred=true 时只保留当前最优的「首个高权重组」，等价于上游 strictPreferredLine。
   */
  function rank(options, settings = {}) {
    const usable = dedupe(options.filter((option) => isAvailable(option, settings)));
    const sorted = usable.slice().sort(compareOptions);
    if (!settings.strictPreferred || sorted.length < 2) return sorted;
    const top = sorted[0].preferenceWeight;
    const sameTier = sorted.filter((option) => option.preferenceWeight === top);
    return sameTier;
  }

  /** 从 NOVA 的 detail.lines 结构展开成 LineOption[]（每集一条可选线路组合）。 */
  function fromDetail(detail, settings = {}) {
    const lines = Array.isArray(detail?.lines) ? detail.lines : [];
    const episodeIndex = num(settings.episodeIndex, 0);
    const sourceName = text(detail?.sourceName ?? detail?.siteName, "");
    const options = [];

    lines.forEach((line, lineIndex) => {
      const episodes = Array.isArray(line?.episodes) ? line.episodes : [];
      if (!episodes.length) return;
      const episode = episodes[Math.min(episodeIndex, episodes.length - 1)];
      if (!episode?.url) return;
      const kind = classifyUrl(episode.url);
      options.push(
        normalize(
          {
            id: `${slug(line.name || `line-${lineIndex + 1}`)}:${episode.index ?? episodeIndex}`,
            providerId: slug(line.name || sourceName || `line-${lineIndex + 1}`),
            playFrom: line.name,
            label: text(line.name, `线路 ${lineIndex + 1}`),
            url: episode.url,
            urlKind: kind,
            // 页面型地址（HTML 规则站的播放页）必须先经适配器解析，不能直接喂播放器。
            resolveMode: kind === URL_KIND.PAGE ? RESOLVE_MODE.PARSE : RESOLVE_MODE.DIRECT,
            resolved: kind !== URL_KIND.PAGE,
            selected: lineIndex === 0,
            defaultPriority: lineIndex === 0,
            preferenceWeight: Number(line.preference) || 100 - lineIndex,
            episodeName: episode.name,
            episodeIndex
          },
          {
            sourceName,
            siteName: sourceName,
            // 越靠前的线路权重越高，和 vod_play_from 的书写顺序保持一致。
            fallbackWeight: Math.max(600, 900 - lineIndex * 10),
            episodeName: episode.name,
            episodeIndex
          }
        )
      );
    });

    return rank(options, settings);
  }

  /** 把上游 line_options 数组直接吃进来（将来接聚合 API 时零改动）。 */
  function fromLineOptions(rawOptions, settings = {}) {
    const list = (Array.isArray(rawOptions) ? rawOptions : []).map((raw, index) =>
      normalize(raw, { fallbackWeight: DEFAULT_WEIGHT - index, selected: index === 0 })
    );
    return rank(list, settings);
  }

  async function probeOne(option, settings = {}) {
    const fetchImpl = settings.fetchImpl || (typeof fetch === "function" ? fetch : null);
    if (!fetchImpl) return { ...option, probeStatus: PROBE_STATUS.UNKNOWN };
    const timeoutMs = num(settings.timeoutMs, 6000);
    const controller =
      typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const target = typeof settings.wrapUrl === "function" ? settings.wrapUrl(option) : option.url;
    const started = Date.now();
    try {
      const response = await fetchImpl(target, {
        method: "GET",
        signal: controller?.signal,
        headers: option.headers
      });
      const latencyMs = Date.now() - started;
      if (!response.ok) {
        return {
          ...option,
          probeStatus: PROBE_STATUS.DEAD,
          latencyMs,
          probeDetail: `HTTP ${response.status}`
        };
      }
      // 只读前 4KB：够判 #EXTM3U / #EXT-X-KEY，不为探测把整个清单拉完。
      const body = await response.text();
      const head = body.slice(0, 4096);
      const isPlaylist = head.includes("#EXTM3U");
      const encrypted = head.includes("#EXT-X-KEY");
      const keyMatch = head.match(/#EXT-X-KEY:[^\n]*URI="([^"]+)"/);
      const variants = (head.match(/#EXT-X-STREAM-INF/g) || []).length;
      const segments = (head.match(/#EXTINF/g) || []).length;
      if (!isPlaylist && !head.trim()) {
        return { ...option, probeStatus: PROBE_STATUS.DEAD, latencyMs, probeDetail: "空响应" };
      }
      const status = encrypted
        ? PROBE_STATUS.ENCRYPTED
        : latencyMs > num(settings.slowMs, SLOW_LATENCY_MS)
          ? PROBE_STATUS.SLOW
          : PROBE_STATUS.OK;
      return {
        ...option,
        probeStatus: status,
        latencyMs,
        keyUri: keyMatch ? keyMatch[1] : "",
        variants,
        segments,
        probeDetail: encrypted ? "AES-128 · 密钥同目录" : `${variants} 档 / ${segments} 切片`
      };
    } catch (error) {
      return {
        ...option,
        probeStatus: PROBE_STATUS.DEAD,
        latencyMs: Date.now() - started,
        probeDetail: error?.name === "AbortError" ? "探测超时" : text(error?.message, "探测失败")
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** 并发探测（默认 4 路），只探可直连的线路；待解析线路跳过。返回重新排序后的列表。 */
  async function probe(options, settings = {}) {
    const concurrency = Math.max(1, num(settings.concurrency, 4));
    const targets = options.filter(
      (option) => option.resolveMode === RESOLVE_MODE.DIRECT && !settings.onlySelected
    );
    const deadline = settings.maxLines === 0 ? [] : targets.slice(0, num(settings.maxLines, 8));
    const results = new Map();
    let cursor = 0;
    const workers = new Array(Math.min(concurrency, deadline.length || 1))
      .fill(0)
      .map(async () => {
        while (cursor < deadline.length) {
          const index = cursor;
          cursor += 1;
          const option = deadline[index];
          results.set(option.id, await probeOne(option, settings));
        }
      });
    await Promise.all(workers);
    const merged = options.map((option) => results.get(option.id) || option);
    return rank(merged, settings);
  }

  /**
   * 选线状态机：手动锁定 / 自动优先 / 失败自动下一条。
   * 对应上游的 lineSelectionMode(auto|manual) + switch_next_line。
   */
  function createSelector(options, settings = {}) {
    let list = rank(options, settings);
    let mode = settings.mode === "manual" ? "manual" : "auto";
    let currentId = text(settings.lineId);
    let failures = 0;

    function indexOf(id) {
      return list.findIndex((option) => option.id === id);
    }

    function pick() {
      if (currentId) {
        const locked = indexOf(currentId);
        if (locked >= 0) return list[locked];
        currentId = "";
      }
      return list[0] || null;
    }

    return {
      get mode() {
        return mode;
      },
      get list() {
        return list.slice();
      },
      get failures() {
        return failures;
      },
      current() {
        return pick();
      },
      select(id, nextMode = "manual") {
        mode = nextMode === "auto" ? "auto" : "manual";
        currentId = text(id);
        const found = currentId ? indexOf(currentId) : -1;
        return found >= 0 ? list[found] : this.current();
      },
      /**
       * 切到下一条可用线路：优先换 provider，其次才允许同 provider 的另一档。
       * 已标记 dead 的线路一律跳过，全部死掉时返回 null（由播放器决定报错还是回退）。
       */
      next() {
        const active = pick();
        if (!active) return null;
        const start = indexOf(active.id);
        const usable = (candidate) =>
          Boolean(candidate) &&
          candidate.id !== active.id &&
          candidate.probeStatus !== PROBE_STATUS.DEAD;
        for (let step = 1; step <= list.length; step += 1) {
          const candidate = list[(start + step) % list.length];
          if (usable(candidate) && candidate.providerId !== active.providerId) {
            currentId = candidate.id;
            return candidate;
          }
        }
        for (let step = 1; step <= list.length; step += 1) {
          const candidate = list[(start + step) % list.length];
          if (usable(candidate)) {
            currentId = candidate.id;
            return candidate;
          }
        }
        return null;
      },
      /** 播放失败回调：先标记死亡，再切下一条，并返回切换结果。 */
      fail() {
        const active = pick();
        if (active) {
          failures += 1;
          list = list.map((option) =>
            option.id === active.id ? { ...option, probeStatus: PROBE_STATUS.DEAD } : option
          );
        }
        return this.next();
      },
      replace(nextList) {
        list = rank(nextList, settings);
        return this.current();
      }
    };
  }

  /** 转成播放器入参，避免播放器直接依赖本模块内部字段。 */
  function toMedia(option, extra = {}) {
    if (!option) return null;
    return {
      url: option.url,
      title: extra.title,
      kind: extra.kind,
      meta: extra.meta,
      source: option.mirrorCount
        ? `${option.label} · ${option.mirrorCount + 1} 镜像`
        : option.label,
      isLive: false,
      lineId: option.id,
      headers: option.headers
    };
  }

  function summary(options) {
    const total = options.length;
    const direct = options.filter((option) => option.resolveMode === RESOLVE_MODE.DIRECT).length;
    const parsed = total - direct;
    const mirrorGroups = options.filter((option) => (option.mirrorCount || 0) > 0).length;
    const encrypted = options.filter(
      (option) => option.probeStatus === PROBE_STATUS.ENCRYPTED
    ).length;
    return { total, direct, parse: parsed, mirrorGroups, encrypted };
  }

  return {
    URL_KIND,
    RESOLVE_MODE,
    PROBE_STATUS,
    TOKEN_SCENARIO,
    signature,
    classifyUrl,
    slug,
    normalize,
    dedupe,
    rank,
    fromDetail,
    fromLineOptions,
    probeOne,
    probe,
    createSelector,
    toMedia,
    summary
  };
});
