# NOVA TV 管理后台

本地网页后台，用来管理内容源：订阅、站点、候选收集、发布。

## 启动

```bash
cd preview
node admin-server.mjs                        # http://127.0.0.1:4180/admin/（只本机可访问）
node admin-server.mjs --host 0.0.0.0         # 局域网可访问，启动会打印 http://192.168.x.x:4180
node admin-server.mjs --host 0.0.0.0 --allow-remote-write   # 允许远程写（默认只有本机能写）
node admin-server.mjs --port 4190            # 换端口
node admin-server.mjs --data D:/nova         # 换数据目录
```

首次启动会生成 `data/nova/token.txt`，控制台也会打印。**写操作需要它**：在页面左下角「token」框粘贴后保存。

- 默认只监听 `127.0.0.1`：管理端只有本机能改
- 加 `--host 0.0.0.0`：局域网设备能拉订阅地址（`/config/<token>.json` 免 token，带 CORS + ETag）
- 写操作默认仍只放行本机来源；确实要远程管理再加 `--allow-remote-write`

## 回归测试

```bash
node tools/verify-admin.mjs      # 18 项：健康/导入/测试/覆盖/发布+ETag/收集/探测/入池/鉴权/代理
node tools/verify-admin-ui.mjs   # 9 项：五个页面渲染 + 页面内触发测试 + 控制台错误
```

都是失败即非 0 退出；UI 那套找不到 Playwright 时会打印 SKIP 并返回 0，不会误报。

## 五个页面

| 页面 | 能做什么 |
|---|---|
| **订阅** | 加远程订阅 / 粘贴 JSON / 内置预设；启停、同步、删除。同步会重新解析并把站点并进站点表 |
| **站点** | 搜索筛选、勾选批量测试/启停、单站测试、上下移动排序、看延迟与健康；**巡检一轮**、**抓分类**、巡检状态列（稳定 / 连败 N / 已降级） |
| **收集** | 管理种子（jsDelivr 镜像或任意配置地址）、立即收集、候选表（A/B/C/D 评级）、探测（后台异步 + 3 轮采样）、入池、排除、导出 MD/CSV |
| **发布** | 把启用的订阅合并成一份配置，给 TV 端一个固定订阅地址，支持 ETag |
| **设置** | 并发、超时、解说过滤、自动切线路、巡检间隔、备份下载 / 恢复 |

## 自动化能力

| 能力 | 说明 |
|---|---|
| **定时巡检** | 默认每 6 小时，启动 60 秒后先跑一轮；连续 3 次失败的站点标 `degraded`，成功一次自动恢复 `ok` |
| **探测异步化** | `POST /api/candidates/probe` 立即返回 202，结果写回候选池；前端轮询 `/api/jobs/current?name=probe` |
| **多轮采样** | 每个候选默认跑 3 轮：延迟取中位数、连通取多数，避免网络抖一下就把源判死 |
| **代理缓存** | m3u8 30 秒、分片 20 分钟、总量上限 300MB（LRU）；同一分片并发请求合并，单域并发上限 4 |
| **分类画像** | `POST /api/sites/profile` 抓 `ac=list` 的分类 id/名称，存 `profiles.json`，为首页行提供依据 |
| **备份恢复** | `GET /api/backup` / `POST /api/restore`：订阅、覆盖表、候选池、种子、巡检状态、画像一次搬走 |
| **指标** | `GET /api/metrics`：请求量/状态分布、延迟 avg/p95、缓存命中率、任务与巡检状态 |

巡检状态单独存 `data/nova/site-status.json`，不写进前台覆盖表（覆盖表只认 enabled/order/health/timeout/header/name 六个字段）。

## TV 端接入

发布页会给出地址：

```
http://127.0.0.1:4180/config/<token>.json
```

- NOVA TV 预览版：设置 → 内容源管理 → 加远程订阅 → 粘贴
- 第三方 TVBox / 影视仓：填进「配置地址」

地址固定不变；改完源点「重新发布」即可，TV 端下次同步生效。

## 数据

```
preview/data/nova/
├── token.txt                写操作凭证
├── sources.json             订阅（含原始配置）
├── sites.json               站点覆盖表（启停/排序/超时/Header）
├── settings.json            请求参数
├── parses.json              解析接口
├── candidates.json          候选池（含探测指标与评级）
├── harvest-seeds.json       收集种子
├── publish.json             当前发布快照与 token
├── probe-history.jsonl      站点测试历史（按行追加）
├── harvest-runs.jsonl       收集运行记录
└── audit.jsonl              写操作审计
```

写入是原子的（临时文件 + rename），每次写前留 `.bak`。这些文件可以直接拷走或纳入 git。

## 收集器怎么判断可用

对每个候选的苹果 CMS 接口，按四段式探测：

1. `?ac=videolist&pg=1` 取列表，**不看 content-type**（很多站把 JSON 标成 `text/html`），直接 `JSON.parse`
2. `judgeCms(payload)` 判定（复用前台的 `site-health.js`）
3. `vod_play_url` 取播放地址 → 拉 m3u8 头 → 再取首个分片验证；列表没有播放地址时回退 `ac=detail&ids=`
4. 打分：`0.45×播放率 + 0.25×可播 + 0.20×延迟 + 0.10×目录规模`，A≥0.8 / B≥0.6 / C≥0.4

命中排除规则的（成人内容、分类过少等）直接 D 级，重探不复活。

## 边界

- 只探测**可用性**，不下载、不存储任何影片内容
- `csp_*` / `jar` 形态的 Spider 源不探测（需要 TVBox 内核，浏览器与后台都跑不了）
- 不修改前台的任何文件；前台仍用 `localStorage`，两边数据独立
- 探测限并发 4、间隔 250ms、单轮上限 200，避免把源站惹毛

## 与前台共用的逻辑

后台通过 `admin/lib/nova.mjs` 用 20 行 DOM 垫片，直接 `require` 前台的
`site-health.js`、`site-overrides.js`、`nova-settings.js`、`lines.js`、`presets.js`、`sources.js`。
所以「后台判定能用」与「TV 端能播」用的是同一套代码，不存在两套口径。

## 已知取舍

- 任务状态（收集中/探测中）存在内存，重启后 `/api/harvest/runs/current` 会显示未运行，历史仍在 `harvest-runs.jsonl`
- 没有多用户/权限体系：单人 token，够用
- 候选探测是同步请求（6 个约 20 秒），候选多时建议分批
- 后台自己实现了 `/api/proxy`（含 SSRF 防护与 m3u8 改写），因为前台 `sources.js` 跨域时会走这个地址
