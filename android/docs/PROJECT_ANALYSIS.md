# tvbox-desktop 结构分析与 NOVA TV 迁移结论

## 1. 原项目是什么

`hgtuj5688/tvbox-desktop` 是一个 Electron 桌面应用，不是 Android 工程。它使用
React 构建界面，业务能力集中在 Electron 主进程，通过 preload 暴露受控 API。

```text
src/main        Electron 主进程：网络、配置、搜索、详情、解析、直播、本地存储
src/preload     contextBridge：把主进程能力映射给渲染层
src/renderer    React UI：首页、搜索、详情、播放器、直播、收藏、设置
src/shared      主进程与渲染层共享的类型和工具
```

因此它不能直接打包成 Android TV 应用。可迁移的是业务模型、配置方言和数据链路，
不是 Electron 外壳或 React 页面本身。

## 2. 原项目核心服务

| 服务 | 作用 | Android 迁移判断 |
| --- | --- | --- |
| `config.ts` / `sources.ts` | 读取远程或本地 JSON 配置 | 保留，改为 OkHttp + Room/DataStore 缓存 |
| `sites.ts` / `cms.ts` | CMS type 3/4 站点适配 | 保留，抽象为 SourceAdapter |
| `htmlRules.ts` | HTML 规则站点适配 | 保留，使用 Jsoup |
| `search.ts` | 聚合搜索并发池、流式结果 | 保留，改为 Kotlin Flow |
| `category.ts` | 分类树归并 | 保留 |
| `detail.ts` | 详情、线路和剧集拆解 | 保留 |
| `player.ts` / `parse.ts` | 播放页解析、解析接口轮询 | 保留通用部分，串成 PlaybackResolver |
| `live.ts` / `liveHealth.ts` | m3u/txt 直播、分组、同名线路、体检 | 保留标准直播源部分 |
| `library.ts` / `store.ts` | 收藏、历史、继续观看、本地 JSON | 改为 Room + DataStore |
| `proxy.ts` / `http.ts` | 网络、请求头、代理 | 改为 OkHttp，按通用配置处理 |
| `ai.ts` | 内容摘要等 AI 能力 | 暂不进入 NOVA TV 首页试玩范围 |

## 3. 原项目数据链路

### 影视

```text
配置 URL / 本地 JSON
  -> 站点与源规则
  -> 聚合搜索 / 分类
  -> 详情与线路
  -> 剧集选择
  -> 直链或播放页解析
  -> Media3 ExoPlayer
  -> 历史 / 收藏 / 续播
```

详情线路沿用原项目的常见字符串格式：

- 多线路：`线路名$$$线路地址$$$...`
- 剧集：`名称$地址#名称$地址#...`

解析时应将这种“传输格式”转换成 Android 领域模型，不要让它进入 Compose UI。

### 标准直播

```text
M3U / TXT
  -> #genre# / group-title 分组
  -> 同名频道合并线路
  -> 播放地址数组
  -> 频道列表
  -> 可选线路体检
  -> Media3 播放
```

NOVA TV 排除以下内容：

- 虎牙房间号换真实播放地址；
- 抖音房间号换真实播放地址；
- 针对上述平台编写的专用防盗链、签名或解析逻辑。

通用 HTTP/HTTPS/RTMP/RTSP 标准直播源仍可支持。

## 4. Android TV 版模块划分

```text
ui/
  home        首页、19 点遥控器焦点导航
  search      搜索弹层与结果
  detail      内容详情
  live        标准直播源列表
  library     聚合片库
  music       独立音乐页面
  saved       收藏与历史
  settings    内容源、播放、音乐、外观设置

data/
  config      配置导入、方言解析、缓存
  source      CMS / HTML 源适配器
  live        M3U / TXT 解析、分组、线路
  local       Room、DataStore

domain/
  search      并发聚合与结果归并
  category    分类树归并
  detail      详情与线路模型

playback/
  media       影视 Media3 播放协调
  music       MediaSessionService 独立后台音乐域

network/
  OkHttp 客户端、请求头、重试、缓存
```

## 5. 关键产品决策

- NOVA TV 使用原生 Kotlin + Jetpack Compose，不使用 WebView 套壳。
- 视觉基准固定为 1920×1080 逻辑画布，等比适配 1080p、4K 和超宽屏留边。
- 首页只显示“电视直播、聚合片库、音乐、收藏与历史”四个入口。
- 内容源管理只在设置页，首页不增加内容源模块。
- 音乐是独立媒体域，使用 Media3 `MediaSessionService`，不塞进影视播放器。
- 遥控器焦点采用白色实心描边、外发光和轻微放大，不只依赖颜色变化。
- 边缘卡片从屏幕边缘方向缩放，防止焦点放大越过 64px 安全边距。

## 6. 本轮原生试玩范围

已实现：

- 首页全部视觉层与 19 个遥控器焦点目标；
- 搜索弹层、真实本地筛选、详情层；
- 电视直播、聚合片库、音乐、收藏、设置页面入口；
- 标准 M3U/TXT 解析器及单元测试；
- Media3 音乐后台播放域与本地演示音轨。

尚未接入：

- 远程影视配置订阅；
- CMS / HTML 站点真实网络数据；
- 影视播放解析与线路容错；
- Room / DataStore 持久化；
- 真实直播源播放器。

这些属于下一阶段，不影响本轮 UI 与遥控器交互评审。
