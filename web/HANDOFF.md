# NOVA TV · 聚合片库首页交接文档

> 最后更新：2026-11-19（Hero 留白 / 继续观看 / 我的片单 三项已落地）
> 用途：在新对话里继续调整页面时，把这份文档整份贴给 AI，可省去重新摸清结构的时间。

---

## 一、项目位置与启动

```
代码    work/nova-tv-github-upload/preview/
镜像    outputs/nova-tv-preview/        （改完 preview 记得同步这里）
截图    outputs/screenshots/
```

启动预览服务：

```powershell
cd work/nova-tv-github-upload/preview
node preview-server.mjs
```

- 地址 `http://127.0.0.1:4178/`
- 带种子源：`?seed=lz`（自动添加量子资源）
- 直达页面：`?page=library` / `?page=live` / `?page=settings`
- 自检度量：`?page=library&diag=1`（页面底部输出 `#libDiag` 的几何 JSON）
- 浏览器：**用 Edge**（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`）

**已知问题**：服务进程在大量并发验证后可能自行退出。症状是页面打不开、`ERR: 无法连接到远程服务器`。重启即可。

---

## 二、当前设计参数（精确值）

### 电视适配：字号标尺 / 安全区（`tv-scale.css`，最后加载）

```
思路        所有字号集中在 tv-scale.css 的 :root 变量里，改一处全站跟着变
            （它排在 player.css 之后，同特异性规则由它拍板）

--t-cap  14   角标 / kicker / 类型胶囊 / 信息卡 label
--t-sm   16   卡片 meta / 查看全部 / 分组条 / 列表筛选 / 信息卡 value
--t-md   17   meta / 线路 chip / 列表排序 / 播放器时间
--t-lg   19   正文 / 简介 / 集数按钮 / 播放器帮助
--t-xl   22   卡片标题
--t-2xl  23   顶栏 Tab
--t-3xl  25   货架标题 / 首页分区标题
--t-4xl  36   播放器标题
--t-5xl  40   详情大标题

--safe-x 80   左右安全区（电视 overscan 5%），原来是 64

实测        片库 Tab 23 · 货架标题 25 · 卡片标题 22 / meta 16
            详情 标题 40 / meta 17 / 简介 19 / 集数 19（按钮 62 高）
            列表 排序 17（44 高）· 播放器 标题 36 / 时间 13 / 帮助 12
```

> 基准口径：从前查 CSS 源文件里的字面值会看错——同一个 `.poster-title`
> 在 `library.css` 里先后写过多遍，屏幕上生效的是最后一条。改字号前先量
> `getComputedStyle`。

### 音乐 2.0（2026-11-19）

```
顶栏      换成统一 logo 条（复用 .lib-topbar 网格）：logo / 标题 / 音质胶囊 / 设置
          .page-music .page-shell 改成 display:flex + gap 22 + padding 36/80/40

布局      .music-page-main 468px | 1fr
          左：正方形封面（aspect-ratio 1/1，上限 380）、标题、进度条、三键、试听说明
          右：队列 4 条（74 高）+ 电台 4 条（66 高）+ 说明卡

进度条    #musicProgress 可聚焦（tabindex=0 / role=slider）
          点哪儿跳哪儿；聚焦后 ←/→ ±5 秒；↑ 回控制键，↓ 进队列

键位      logo → 设置 → ⏯ → 进度条 → 队列 → 电台，闭环；
          电台列表 ←/→ 直接上一首/下一首

电台      SomaFM Groove Salad / Drone Zone / Secret Agent + Radio Paradise
          走 /api/proxy（直连会被跳转挡），失败自动退回直连
          三态文案：连接中… / 播放中 / 线路不可用

播放域    MediaSession：metadata + play / pause / previoustrack / nexttrack /
          seekbackward / seekforward / seekto
          （以前页面文案写着 MediaSession，其实一行没接）

持久化    nova.music.v1 = {mode,index,radioIndex,time,volume}
          刷新后恢复曲目与位置，但不自动播放

mini 条   #musicMini 绝对定位在 .stage 底部居中，74 高，仅离开音乐页时显示
          .stage.has-music-mini 时给 .lib-main / .page-main / .nv-scroll 加 96 底部内边距
          内容：封面 + 标题 + 波形 + 播放暂停 + 下一首，点主体回音乐页

坑        · audio 元素从音乐面板里挪到 .stage 末尾，避免"页面 hidden 还在放"的歧义
          · 电台曾把 NotAllowedError（自动播放拦截）误报成线路故障，现在分开处理
          · 音乐页 logo 按钮没有 .lib-brand 包裹层，需在 .brand-button 上补 display:flex，
            否则图形和字标会竖着排、宽度塌成 63
```

### 音乐全屏屏 v2：歌词版（2026-11-19 重做）

```
为什么重做   v1 是「封面 | 信息 | 队列」三列，观感像详情页，不像在听歌
             → 改成歌词居中滚动 + 底部通栏 dock

结构        #musicScreen（z-index 75，覆盖 .stage）
            背景  .ms-bg = 当前封面，blur(30px) brightness(.42) + 双径向压角
            顶栏  NOW PLAYING · 模式胶囊 ……… 时钟（44 高）
            歌词  .ms-lyrics-wrap：居中 1100 宽，top 118 / bottom 236（高 726）
                  上下各 16% 渐隐遮罩；行高 84，可见 7 行
                  当前行 46px/白/scale 1.02，相邻行 30px/0.46，其余 30px/0.28
            底部  .ms-dock (80,886) 1760×152：缩略封面 64 + 歌名 22 / 艺人 13.5
                  + 三键 62·78·62；第二行 时间 + 进度条 1574×24 + 时间
            提示  .ms-hint 贴底 12px

歌词数据    musicQueueData[].lrc 内嵌，标准 [mm:ss.xx] 文本
            4 首 demo 是合成音轨（无人声），歌词为演示占位，已标注
            接真实歌曲：把 .lrc 放 assets/lyrics/ 填 lrcUrl 即可，解析逻辑通用
            parseLrc 支持一行多时间戳（合唱/重复段）、[mm:ss] 与 [mm:ss.xxx]

滚动        按 currentTime + 0.12 命中当前行 → 只换 class
            容器 translateY = wrapH/2 - (index*84 + 42)，520ms cubic-bezier(.22,1,.36,1)
            不用 scrollTop，避免低帧率电视上抖动

无歌词      显示「纯音乐 · 暂无歌词」（电台模式为「电台直播 · 暂无歌词」）
            + 4 根呼吸竖条，位置同样居中（translateY = wrapH/2 - 42）

键位        播放模式：←/→ 切歌，OK 暂停，↓ 进进度模式，返回 退出
            进度模式：←/→ ±5 秒，↑/↓ 退回播放模式
            歌词不参与焦点，自动跟随

淡出        静止 5.2s 只留背景与歌词；dock / 顶栏 / 提示淡出
            歌词位置不随淡出移动（早期版本会跳一下，已修）
```

### 音乐全屏屏 · 完整版（2026-11-19 收尾）

```
本轮补齐   ① 歌词点句跳转  ② 频谱  ③ 长句折行  ④ 播放模式  ⑤ 静音

歌词模式   ↑ 进入：当前句聚焦（outline），↑/↓ 选句，OK 跳到该句，←/→ 退出
           点句也行：.ms-lyric-line 带 data-lyric-time，点击 seek 到该句

频谱       48 根竖条，贴在 dock 上方（bottom 214，高 64）
           Web Audio：createMediaElementSource → AnalyserNode(fft 128, smoothing .75)
           rAF 驱动，退出全屏时 cancelAnimationFrame
           注意：接了 analyser 后跨域音源会被静音，所以电台只走 /api/proxy（同源），
                 去掉了「直连回退」

长句折行   .ms-lyric-line 高度改 auto + min-height 84，最大宽 1000
           滚动位置不再按固定 84 计算：measureLyrics() 逐行量 offsetHeight 累加
           当前行 30→46px 会改行高，切换后 430ms 再量一次校正（drift 实测 0）

播放模式   列表 / 单曲 / 随机（dock 里的胶囊按钮，循环切换）
           单曲：ended 时 currentTime=0 重播；随机：musicStep 随机取一首（不与当前重复）
           持久化到 nova.music.v1 的 playMode

静音       dock 里 i-volume / i-mute 切换，写进 nova.music.v1 的 muted

dock 结构调整  按钮从 3 个变成 5 个（上一首 62 / 播放 78 / 下一首 62 / 模式胶囊 71 / 静音 62）
               高度仍是 152，进度条 1574×24 不变

提示行     ←/→ 上一首下一首 · OK 暂停 · ↓ 进度模式 · ↑ 歌词选句 · 返回 退出

已知限制   预览服务器不支持 Range，进度条拖动会提示「当前音源不支持拖动进度」
           （真机本地文件正常）
```

### 音乐源接入（2026-11-19，内容量优先）

```
新增文件   music-source.js —— 音乐源适配层，统一 provider 接口
           加载顺序：music-source.js → pages.js

对外接口   NovaMusicSources.radio.list({country,tag,limit})
           NovaMusicSources.radio.search(keyword)
           NovaMusicSources.search(keyword,{limit,providers})
           NovaMusicSources.getUrl(track)   → { url, type }
           NovaMusicSources.getLyric(track) → lrc
           NovaMusicSources.status()        → 各源状态
           NovaMusicSources.setAggregatorBase(url)

已接入     Radio Browser（免 key，4 个镜像自动切换，失败换下一个）
           实测：CN 前 24 个电台，CNR-1 中国之声 / 怀集音乐之声 等，播放正常
           电台列表为空时自动退回内置 4 条，界面永远有内容

聚合 API   默认 https://music-api.gdstudio.xyz/api.php（公共实例，可换自建）
           types=search / url / lyric，source=netease|tencent|kugou|migu
           实测：搜索「周杰伦」返回 20 条，取直链走网易 CDN，歌词 55 行
           歌词里的「作词 : / 作曲 :」等制作信息行会被过滤掉

音乐页搜索   顶栏加放大镜 → 面板（80,118）1760×922
           输入关键词回车 → 20 条结果 → OK 播放（先取直链再播放）
           返回键关闭面板；面板内 ↑/↓ 在结果间移动

播放模式扩展   musicState.mode 现在有 track / radio / search 三种
           currentMusicEntry() 按 mode 取条目，歌词屏 / MediaSession 都跟着走

约定       所有远端请求走 /api/proxy；8 秒超时；搜索缓存 10 分钟、直链 5 分钟
           失败不抛错，返回空数组并在 status() 里记录原因

风险提示   聚合 API 是公共实例，随时可能限流或换域名；
           设置页里已有聚合基址的读写接口（NovaMusicSources.setAggregatorBase），
           换自建地址即可，代码不用改
```

### 曲库切换：本地 4 首 → 聚合源（2026-11-19）

```
删掉      musicQueueData（4 首 demo）+ 4 个 WAV（assets/audio 已清空，共释放 8.4 MB）
          <audio> 的默认 src 也去掉，改由播放时按源写入
          遗留文件 nova-pages.js 里的旧音频引用：该文件未被任何页面加载，属历史残留

替换为    musicFeed：music-source.js 的 feed() 拉网易云榜单
          热歌榜 3778678 → 新歌榜 3779629 → 飙升榜 19723756 → 全挂则退化为「热歌」搜索
          实测：20 首，含曲名 / 艺人 / 专辑 / 封面 / 时长

播放链路  playMusicTrack(index)
            → NovaMusicSources.getUrl(track)  取直链（走 /api/proxy，缓存 5 分钟）
            → NovaMusicSources.getLyric(track) 取 LRC（缓存）
            → 写 audio.src → play()
          直链取不到时只提示不报错，界面不崩

队列面板  封面取 track.cover（走代理），时长按秒格式化
          空状态：正在拉取曲库… / 曲库拉取失败
          面板标题动态显示「20 首 · 聚合 API」

歌词      聚合源的 LRC 会先过一层制作信息过滤：
          前 24 字符内含冒号且命中 作词/作曲/编曲/制作/混音/母带/和声/录音/配唱/
          发行/出品/吉他/贝斯/鼓/弦乐/钢琴/Vocals/Producer/Mix/Master/Studio/
          Recorded/Written/Composed/Arrang 的行会被丢掉
          实测《冬天又来临》62 行原始 LRC → 26 行有效歌词

封面      全屏背景 / dock 缩略图 / MediaSession artwork 现在都读 track.cover || track.image

恢复      nova.music.v1 只存索引与时间；曲目身份由 feed 决定，
          刷新后按索引取同一首，位置在取流完成后回填
```

### 音乐页重排 + 播放器补完（2026-11-19）

```
问题      曲库 20 条竖向列表 1632 高，右面板只有 867（overflow: hidden）
          → 电台标题落到 y=1921、列表高度 0、说明卡 y=1987，全部不可见

重排      右栏改成两条横向 rail（和片库同一套视觉语言）
          ├ 为你推荐   rail 高 278，(597,255) 1218×278，卡片 208 宽（1:1 封面 + 曲名/艺人/时长）
          ├ 电台       rail 高 88，卡片 268×~72 横版（FM 徽标 + 名称 + 编码/状态）
          └ 说明条     压到 47 高，(597,970)，始终可见
          实测面板内容 865 = 客户区 865，不再溢出

rail 细节  .music-rail：横向 overflow-x auto + 隐藏滚动条 + scroll-behavior smooth
          卡片选中：边框紫 + 底色紫；聚焦：3px 白描边 + 上浮 4 + 投影
          focusNow() 增加横向滚动跟随：目标卡不在可视区就 scrollTo(left-32)

播放器    状态胶囊  顶栏 NOW PLAYING / 模式 / 状态点：播放中 · 缓冲中… · 已暂停 · 线路失效
          缓冲条    顶栏下 3px 流光条，buffering 时出现
          暂停视觉  封面与背景降饱和 + 中央 132px 暂停圆片
          错误卡    「这首取不到播放地址」+ 提示，OK 直接 next
          下一首    剩余 ≤12s 时右下 (1520,756) 320×98 滑入「接下来 · 歌名 / 艺人」
          进度气泡  进度模式 ←/→ 时浮出目标时间 + 偏移量，1 秒后消失
          音量      进度模式 ↑/↓ ±10%，顶部 5 格音量条，1.3 秒后消失
          频谱      暂停时停 rAF，播放时重启

键位      播放：←/→ 切歌 · ↑ 歌词 · ↓ 进度 · OK 暂停
          进度：←/→ ±5s（带气泡）· ↑/↓ 音量 · OK 退出
          歌词：↑/↓ 选句 · OK 跳句 · ←/→ 退出
          错误态：OK 直接下一首
```

### 播放器背景：模糊封面 + 取色光斑（2026-11-19）

```
问题      原实现 .ms-bg blur(64px) brightness(0.34) + scrim 0.86 + 实心 rgb(5,6,15)
          实测亮度 左 15 / 中 45 / 右 15 —— 肉眼就是纯黑，封面的颜色一点没透

改法      三层叠起来
          ① .ms-bg      封面 blur 42 / brightness .8 / saturate 1.45 / scale 1.12
          ② .ms-glow    封面左上 + 右下两个区域取色，两团大径向光斑（blur 46）
                        --ms-h1 / --ms-h2 由 JS 写入，每首歌色调不同
          ③ .ms-scrim   中心 0.24 → 边缘 0.84 的径向 + 上下压角

实测      改后亮度 左 59 / 中 68 / 右 40 / 歌词区 61
          背景带出封面的青色 rgb(15,69,83)，不再是灰黑

切歌      #msBg / #msBgAlt 双層交叉淡入 620ms，替代 background-image 硬切

歌词      text-shadow 加重（当前行 0 6px 34px / 0.74）
          .ms-lyrics-wrap::before 加一条竖向柔光带 rgba(4,6,18,.44)
          → 背景亮了但歌词区仍是暗的

暂停      .is-paused 时背景降到 brightness .6 / saturate .5，光斑 opacity .55

取色      extractCoverHues()：canvas 32×32，跳过过暗(<18)过亮(>242)像素，
          左上 / 右下各取平均 → rgbToHsl → 写 CSS 变量
          封面走代理是同源的，canvas 不会被污染
```

### 收藏与历史（2026-11-19，P0 + P1 全做）

```
数据层    lib-fav.js 加 kind / source / updatedAt，旧数据按 key 前缀与 type 自动推断
          normalize() 兜底；新增 clear() / update() / normalize 导出
          音乐喜欢并入同一份 nova.fav.items.v1，key = music:provider:rawId，kind = music
          历史仍以 nova.play.progress.v1 为主存储，readPlaybackRecords 补 url / t 供续播

页面层    #savedPage 换统一 logo 顶栏（安全区 80，(80,36) 1760×97）
          两 tab：观看历史 / 我的收藏；收藏 tab 显示筛选 chip（全部 / 电影 / 剧集 / 音乐）
          统计改动态：#savedStatHistory / #savedStatFav
          6 列网格 + 日期分组（今天 / 昨天 / 本周 / 更早）+ 类型角标

功能      点击卡片    历史有 url 直接续播（startAt），否则进详情
          长按 OK 650ms 删除单条 → 右侧出现撤销条，6 秒内可撤
          清理观看记录  页面内二次确认（确定清空 / 取消），真的清空 localStorage
          清空我的收藏  同上，走 NovaFav.clear()
          导出个人片单  Blob 下载 nova-片单-YYYY-MM-DD.json（收藏 + 历史）
          音乐收藏      全屏 dock 加星标按钮，已收藏时变紫，写 kind=music

实测      收藏 2 条（音乐 + 电影）→ 卡片角标「音乐 / 电影」正确
          筛「音乐」→ 1 条，副标题「只看音乐 · 共 1 项」
          长按删除 2 → 1，撤销条「已移出收藏 · 测试歌曲」，撤销回 2
          清空确认条文案随 tab 变化，取消不执行
          全屏点星标 → nova.fav 出现 music:netease:3460493895（冬天又来临）
          统计 1 历史 / 3 收藏 与实际一致

未做      直播频道收藏、播放器内直接收藏影片（P2）
```

### 收藏与历史 · 收尾（2026-11-19，P2 + 顶栏统一）

```
直播收藏      原来独立存 nova.live.fav.v1（Set of channel.key），片单页看不到
              现在 toggleFavorite 双向同步到 NovaFav：key = live:${channel.key}，kind = live
              启动时把 NovaFav 里的 live: 条目合并进直播收藏
              监听 nova:fav-changed：片单页删掉的后，直播侧也去掉；新增的补进来
              （用 state.unifiedLive 快照做差集，避免误删用户老数据）

播放器收藏    player.js 更多抽屉加「我的片单」一行
              未收藏：加入我的片单 / 已收藏：已收藏 · 点按取消（带 ★）
              写入 NovaFav，kind 按 kind 文案含「剧/集」判为 series，否则 movie

设置页顶栏    老 .page-header → 统一 logo 顶栏（(80,36) 1760×97，安全区 80）
              .settings-shell padding 36/80/40，flex 列布局，main flex:1 不溢出

实测          直播收藏：NovaFav 加 live:cctv1 → nova.live.fav.v1 = ["cctv1"]
              删除 → [] 回空
              片单页显示「直播 / 音乐 / 音乐」三种角标，统计 1 历史 / 3 收藏
              播放器抽屉点「加入我的片单」→ 条目变「已收藏 · 点按取消」带 ★
              设置页 logo (80,61) 123×46，导航面板 (80,173) 330×867，shell 无溢出

遗留          直播页需要先导入 M3U/TXT 源才有频道；
              本机浏览器配置里没导入源，所以直播收藏只用数据层验证，未做端到端点击
```

### 观看历史分类（2026-11-19）

```
背景      进度记录原本只有 {t,d,k,n,e,p,u,at}，没有类型字段；
          片库索引按页拉取，跨源/换页就查不到，不能靠运行时回查分类

三级回退  ① 写入端  player.js saveProgress 补 y（类型原文）+ g（归一化分类）
          ② 老数据  readPlaybackRecords 读 value.g，缺失则按 y/集名推断
          ③ 兜底    推断不出归 other，进「其他」chip，不丢记录

归一化    动漫|动画|番剧|新番|国漫|日漫            → anime
          综艺|真人秀|脱口秀|晚会|访谈|选秀        → variety
          电视剧|连续剧|美剧|韩剧|日剧|港剧|剧集   → series
          电影|影片|大片|剧场版                    → movie
          无类型时看集名：第N话→anime，第N期/第N季→variety，第N集→series，无集号→other

界面      历史 tab 顶部 chip：全部 / 电影 / 电视剧 / 综艺 / 动漫 / 其他
          动态生成，只显示有数据的分类，带计数（全部5 · 电影1 · 电视剧2 …）
          收藏 tab 仍用 全部 / 电影 / 剧集 / 音乐
          两个 tab 各自记 filter，切 tab 时失效值自动回落到「全部」
          筛选后日期分组（今天 / 昨天 / 本周 / 更早）仍然生效
          头部改成「标题 + 数量」在左、chip 靠右，避免长 chip 条把数量挤掉

实测      5 条混合记录 → 全部5 / 电影1 / 电视剧2 / 综艺1 / 动漫1
          切「综艺」→ 1 张卡带「综艺」角标；切「电视剧」→ 2 张带「剧集」
          老记录「第12话」且无 g 字段 → 正确推断为动漫
          切回「全部」→ 5 张，今天/本周两个分组正常

坑        历史 chip 点击曾经硬编码 renderSaved("favorites")，点了会跳到收藏；
          已改为 renderSaved(savedState.tab)，并在重渲染后重新查找 chip 节点

待办      历史记录 key 含源标识（src_…::lziapi:::166620），换源同一部剧会出现两条，
          去重逻辑这轮没做
```

### 片单网格排列修正（2026-11-19）

```
症状      片单页分组标题下方有一大块空白，卡片被顶到第二行
实测      grid-template-rows 计算成 178px 178px 25px 308px
          标题所在行高 178，卡片从 y=655 才开始（网格起点 274）

根因      早期 .saved-grid 规则里写死了 grid-template-rows: repeat(2, minmax(0, 1fr))，
          两行均分容器高度（743 / 2 - gap ≈ 178），显式轨道优先于 grid-auto-rows，
          所以后面加的 grid-auto-rows: auto 只对第 3 行以后生效

修法      .saved-grid 追加：
            grid-template-rows: none;   ← 清掉写死的两行均分
            grid-auto-rows: auto;
            align-content: start;
          .saved-card 取消 aspect-ratio，改固定 height: 308px
          （205 宽 × 308 高 = 2:3，和片库海报一致）

实测      行高变成 25 / 308 / 25 / 308
          标题 y=274 h=25，卡片 y=317 h=308，本周标题 y=643，卡片 y=686
          25 条记录时 6 列 × 4 行，scrollHeight 1698 / clientHeight 743，正常滚动
          空状态 .library-empty 补 grid-column: 1 / -1，不再挤在一格里
```

### 海报不显示：双重代理（2026-11-19）

```
症状      片单页卡片全是灰底，海报不出现（片库页正常）
实测      img 元素在，但 naturalWidth/Height = 0×0
          src = /api/proxy?url=http%3A%2F%2F127.0.0.1%3A4178%2Fapi%2Fproxy%3Furl%3D...
                                            ↑ 代理里套代理

根因      进度记录里存的 p 已经是「绝对地址的代理 URL」
          （http://127.0.0.1:4178/api/proxy?url=…）
          pages.js 的 proxyImage() 只识别以 /api/proxy 开头的相对地址，
          对这种 http://…/api/proxy?… 不认，于是又包了一层 → 二次代理 404

修法      ① proxyImage() 认绝对代理地址：/\/api\/proxy\?url=/i 命中就归一成相对路径
          ② player.js 存进度前用 rawImage() 还原成原始 URL
          ③ lib-fav.js 收藏前用 unwrap() 还原成原始 URL
          ④ 增加 unproxyImage() 备用（解析 query 取原始地址）

老数据    在页面里跑一次修复：把已有记录的 p 从二次代理地址还原成原始 URL
          实测修复 1 条

实测      修复后 natural = 270×404，显示尺寸 221×333
          收藏里的音乐封面 natural = 1813×1813，正常
```

### 片单卡片改版：海报不再被信息条压住（2026-11-19）

```
症状      海报「显示不全」，底部约三分之一看不到
实测      .saved-card-copy 高 107px，卡片 308px → 遮罩占 34%
          2:3 海报的片名/主视觉通常就在下缘，正好被渐变和文字盖掉

改版      卡片改成竖向两段：
            .saved-poster   aspect-ratio 2/3，overflow hidden，海报 100% 可见
            .saved-card-copy 移到海报下方，静态排版，不再叠加强渐变
          去掉了 .saved-card-shade 图层
          类型角标（电影/剧集/音乐）移到海报左上角内 8px
          没有海报时显示「暂无海报」占位

实测      卡片 213×386（聚焦态）
          海报 213×319，图片 210×317（差 3px 是 1px 边框 + 取整）
          copy 高度 59，位于海报下方 8px
          img 完整可见（coveredByCopy: false）
          网格行高 auto：25（分组标题）/ 373（卡片行）
          6 条记录单行排满，无卡片被面板边缘切断

副产品    img 的 object-fit 仍是 cover；natural 270×404 与框 210×317 比例几乎一致，
          裁切 < 1%，可以忽略

排查备注  测试时曾用错误的图片路径（截断的 jpg）导致 5 张 404，
          真实记录（webp，29 KB）正常，确认不是代码问题
```

### 片单海报对齐聚合片库（2026-11-19）

```
做法      不再自写一套海报样式，直接复用聚合片库的类：
            <button class="saved-card lib-card poster-card focusable">
              <span class="poster-cover"><img /></span>
              <span class="lib-card-shade"></span>
              <span class="poster-badges"><span class="poster-status">剧集</span></span>
              <span class="poster-copy">
                <span class="poster-title">标题</span>
                <span class="poster-meta">第05集</span>
                <span class="saved-poster-progress">…</span>   ← 只有历史卡有
              </span>
            </button>

补丁      只加两条：网格内自适应尺寸（width 100% / aspect-ratio 2:3）
          和进度条样式；上一版 .saved-poster 那套规则用 display:none 让位

逐项比对  圆角      13px        = 聚合片库 ✓
          背景      rgba(14,18,40,.6) ✓
          取景      object-fit cover / object-position 50% 18% ✓
          标题      22px / 700 / text-shadow 0 1px 8px rgba(4,6,18,.8) ✓
          副标      16px / rgba(255,255,255,.64) ✓
          卡片比例  0.667（2:3）✓
          投影      0 12px 26px rgba(6,10,32,.28)（未聚焦时）✓
          聚焦效果  继承 .poster-card.is-focused + tv-scale 的上浮语言，和片库一致

说明      底部渐变改回 .poster-card 的那条（顶部 42% 压角，底部 90% 收口），
          叠字区约 63px，占卡片 20%，和聚合片库完全一致
```

### 首页「热门内容」：在更国产剧 + 最新综艺（2026-11-19）

```
数据        NovaSources.loadLibraryItems({ type, limit })
              type 13 = 国产剧 → 20 条里 9 条在更
              type 25 = 大陆综艺 → 20 条全部在更
            关键：列表接口的 remarks 是空的，判断依据是 item.status
              「更新至第15集」/「更新至20261120期」

筛选        isUpdatingShow()：命中 更新至|更新到|连载|第N集|第N期，
            且不含 全N集|完结|已完结|BD|HD|全集
排序        剧集按 episodeIndex 倒序（第15集 → 第14 → 第10 → 第08）
            综艺按 periodStamp（20\d{6} 期号）倒序
渲染        复用聚合片库的 .lib-card.poster-card 卡片（cardFor 同款结构）
            左上「● 在更」呼吸角标，右上集数/期号
            每条最多 12 张，横滑；标题右边「查看全部」进聚合片库

纵向预算    首页原本 hero 168 + features 150 + recent 224 + trending 270 = 1014/1016，塞满且不可滚
            改造：.content 加 overflow-y auto（方案 B），两条带各 423 高
            实测 content scrollHeight 1725 / clientHeight 880
            并给 .trending-section 去掉写死的 height: 270

滚动跟随    app.js SCROLL_HOSTS 增加 .content（竖向）
            新增 scrollRailIntoView()：竖向滚动不会带横向 rail，
            按「最小位移」滚（只补刚好缺的那一段），避免一跳一整屏
            focusToElement / scrollIntoContainer 都会调用

踩坑        library.css 的 .lib-rail{overflow:visible} 在 pages.css 之后加载，
            直接写 .home-rail{overflow-x:auto} 被压掉 —— 实测 overflowX 仍是 visible，
            scrollLeft 永远 0。改用 .home-shelves .home-shelf .home-rail 提高优先级后正常

实测导航    下 1 → 继续观看；下 2 → shelfDrama（content 滚 315）；下 3 → shelfVariety（滚 824 = 底）
            右 5 步后 rail 开始横向滚：0 → 54 → 341 → 625 → 910，焦点卡始终 y=561
```

### 首页 3.0：搜索进顶栏 + 文字版最近观看（2026-11-19）

```
布局变化   topbar   品牌 226 + [搜索 420×46 @1230] + [网络 1666] + [通知] + [设置 1790]
           hero-row 左 时间天气 600×128 | 右 最近观看（纯文字，最多 3 行）
           删掉旧 .recent-section 整块（1760×224）
           #homeShelves 从 y=744 上移到 y=494

最近观看   数据仍取 nova.play.progress.v1（只看影视进度），按时间倒序取 3 条
           每行 44 高，grid 五列：标题 1.6fr / 进度条 120 / 百分比 52 / 时间 126 / 剩余 84
           聚焦：3px 白边 + 向右挪 4px
           点击：有 u 直接续播到 startAt，没有就回详情页
           右上「全部 N 条」→ 片单历史的「观看历史」
           hero-row 改成 height auto + min-height 168，3 条时会长到 188 不压住功能卡

踩坑       旧 app.js 第 1458 行是 searchTrigger.addEventListener(...)，
           删掉 #searchTrigger 后 searchTrigger 变成 null，
           这一行抛 TypeError 把后面 50 行一起中断 —— [data-action] 绑定、
           recent-card 点击、网络按钮全部失效（点搜索框没反应就是这个原因）
           修法：const searchTrigger = getElementById("searchTrigger") || querySelector(".topbar-search")
           修完后：搜索开/关正常、关闭后焦点回到顶栏搜索框、网络按钮能弹状态面板

实测       content scrollHeight 1475 / clientHeight 880
           顶栏搜索 (1230,49) 420×46，网络按钮 (1666,47) 50×50，间距 16
           最近观看 (822,178) 1018×84（1 条时），行内容
           「十万狂花入梦来 第05集 14% 07:03 / 50:07 还剩 43 分」
           点行 → 播放器打开，标题正确
```

### 热门内容压成一行（2026-11-19）

```
改法      两条带 → 一条 rail + chip 切换
          head 里：标题「热门内容」+〔正在更新的国产剧 9〕〔最新更新的综艺 12〕+ 数量 + 查看全部
          rail 只渲染当前分类，切换不重新请求（两类都预取在内存里）

高度      改前 热门内容 1089（484 + 484 + 间距）
          改后 521（head 90 + rail 423）
          content 883 / 880 —— 基本一屏放下（3px 差，仍留 4px 容差判断为不滚）

收紧      标题并入 chip 行（省掉独立 section-head 的 36 + 22）
          .home-shelves margin-top 22 → 14
          .home-rail padding 8/14 → 6/8
          .content padding-bottom 28 → 12

切换      点 chip：rail 重渲染、scrollLeft 归零、chip 选中态与 aria-selected 同步
          meta 跟随当前分类（「9 部在更 · 量子资源」/「12 部在更 · 量子资源」）
          切回时数据仍在，无 loading 闪烁

实测      国产剧 9 张（首张 十万狂花入梦来 / 第15集）
          切综艺 12 张（首张 第三调解室 / 20261120 期），scrollLeft 从 232 归零
          切回国产剧仍是 9 张

注意      library-ui 里原来的 #homeShelvesMeta 已随 section-head 删除，
          renderHomeShelves 末尾那段统计逻辑同步移除
```

### 首页电视化校准（2026-11-19，字号 +25%）

```
改前实测  14 处文字里 10 处低于电视标准：
          货架眉标 11px / 搜索提示 11.5px / 角标 12px / 次要 12.5-13px
          对比度：时间 4.06 / 剩余 4.06 / 眉标 4.07（低于 AA 4.5）
          可点区域：全部按钮 30 / chip 40 / 查看全部 38（低于 48）

字号      tv-scale.css 变量整体 +25%
            --t-cap 14→16  --t-sm 16→18  --t-md 17→19  --t-lg 19→22
            --t-xl 22→25   --t-2xl 23→26 --t-3xl 25→28 --t-4xl 36→40 --t-5xl 40→46
          首页单独校准（写在 tv-scale.css 末尾，最后生效）
            时钟 88→96  功能卡标题 28→30  货架标题 21→26  海报标题 22→24
            记录标题 16→22  功能卡描述 14.5→18  搜索占位 15→19
            次要（集名/时间/剩余/百分比）12.5-13→19
            最小（眉标/角标/搜索提示）11-12→15（全页无 15px 以下）

对比度    0.42→0.62（时间/剩余/眉标）、0.45-0.5→0.66（集名/副标）、0.75→0.82
          实测全部 ≥7.19（改前最低 4.06），11 项全过 AA

目标尺寸  顶栏搜索 46→56  状态圆钮 50→56  chip 40→52
          全部按钮 30→48  查看全部 38→48  最近观看行 44→52

焦点      描边 3→4px、offset 3→4px（!important 覆盖各页）
          卡片聚焦 scale 1.03→1.05 + brightness 1.08 + 紫色外发光

遥控器    chip 上 ←/→ 直接切分类并换带（不用移出 chip 再按 OK）
          返回键逐级回退：#homeShelves → chip → 最近观看 → 顶栏
          goBack 里原本判断的 .poster-grid / .recent-grid 已随旧结构删除，
          改成判断 #homeShelves / .hero-recent / .feature-grid
          长按 ←/→ 靠系统按键重复触发 moveFocus，无需额外实现

代价      content 924 / 880 —— 需要滚 44px（字号变大换来的）
          三行最近观看时约 960
          片单页卡片只有 205 宽，标题单独收到 20px，避免「十万狂花入…」
```

### 收尾审查（2026-11-19）

```
一、静态检查
  node --check 全部 JS 通过；四套回归 6/6 · 20/20 · 25/25 · 33 线路
  id 交叉核对：JS 引用 200 个 id，其中 13 个 HTML 里没有
    真问题 3 个（已修，见下）
    假阳性 10 个（由 JS 模板动态生成，或由 `||` 兜底）

二、修掉的 bug
  ① 片库页首次打开空白
     hydrateRealContent 在 1200ms 触发时源配置还没就绪，loadHotPool 返回空 →
     showShelfNotice 后不再重试，页面永久停在「没有可用内容」
     修：元素为空时退避重试 3 次（900/1800/2700ms），成功后重置计数
  ② Back 键顺序错误（影响最大）
     goBack 里先判断 NovaPages.isOpen 再判断 detailScreen，
     导致「页面 + 详情」叠着时按返回关的是下面的页面，详情悬空在首页上
     修：顺序改为 播放器 → 搜索 → 详情 → 页面
     实测：第一次返回关详情且页面仍在；第二次返回才退页面
  ③ 关闭片库页后焦点丢失
     回落目标是 #libSearch，该元素已随旧片库结构删除 → focusEl(null)
     修：回落到 #libraryPage .lib-tab
  ④ 关闭其他页焦点回落 #searchTrigger（已删除）
     修：回落到 .topbar-search
  ⑤ 死代码：library-ui 仍在读 #homeShelvesMeta（元素已删）
  ⑥ 审查中误删 #libraryGrid，导致 pages.js:703 抛 TypeError → 已恢复标记
     （这条是自己引入又回滚的，记录备查）

三、仍然存在的问题（按严重度，未修）
  P0 直播页无源时只有一句文字，没有「去导入」入口，是死路
  P0 片库页有两套实现并存：pages.js 的 hero + 精选片库网格（8 张 .library-card）
     和 library-ui 的海报货架（6 张 .lib-card），同页两套卡片样式与点击逻辑
  P1 「查看全部」统一跳聚合片库，不落到对应分类
  P1 观看历史 key 含源标识，换源同一部剧会出现两条（无去重）
  P1 设置页缺少「音乐源」面板（NovaMusicSources.status() 接口已就绪）
  P2 播放器 P2 项：返回提示、逐字歌词、频谱细节

四、交互设计建议（详见本轮答复正文）
  导航模型、键位规范、四态反馈、播放入口收敛、详情页一屏决策、搜索加速
```

### 收尾第二刀：把建议里的 P0/P1/P2 落地（2026-11-19）

```
已做
① 直播页空态出口
   lv-status 旁边加「去导入直播源」按钮（44 高），无频道时显示
   点击 → NovaPages.open("settings", null, { section: "lives" })
   实测：按钮可见，点击后落到 settingsPage / lives

② 片库页视觉收敛
   pages.js 的 library-hero + 「精选片库」网格只保留节点（渲染依赖），CSS 下线
   页面上只剩 library-ui 的 banner + 海报货架一套
   注：代码级删除需要同步改 pages.js 里 30+ 处引用，风险高，暂留

③ 「查看全部」直达分类
   首页热门带 → NovaCategories.open("series"/"variety")
   不再统一跳聚合片库

④ 搜索历史
   nova.search.history.v1 存最近 8 条；点搜索结果时记录
   空查询时把历史渲染成 suggestion-chip（沿用原点击处理）
   实测：无历史时保留默认热门词，不覆盖

⑤ 音乐源状态卡片
   设置 → 音乐设置 底部注入卡片：各源在线状态 + 聚合地址输入 + 保存
   MutationObserver 监听面板切换，只在「音乐设置」时注入
   实测：卡片存在，地址回填 https://music-api.gdstudio.xyz/api.php

未做（需要更长时间，且风险高，明确留到下一轮）
· 长按 OK 直接播：需要详情页数据就绪回调，简单 setTimeout 会点空
· 行式导航替换几何算法：影响全站焦点，必须配合回归手测
· 详情页双按钮合并：label 已改为「播放」，真正的状态机合并待做
· 观看历史去重：要引入按标题归一的合并策略
```

### 收尾第三刀：导航 / 快播 / 去重（2026-11-19）

```
① 行式导航（替换纯几何打分）
   moveFocusInner 增加 navAnchorX / navLastDirection
   竖直移动：候选按行聚合（顶部相差 24px 内算同一行），取最近一行，
             再在该行里挑最接近「起点列锚点」的
   水平移动：沿用方向 + 重叠打分
   实测：chip → 卡片 → 底部不乱跳；卡片右移 2 格后 ↑ 落在同列 chip
   坑：替换打分块时连 let best / bestScore 一起删掉，
       报 Uncaught ReferenceError: best is not defined，已补回

② 长按 OK 直接播
   卡片按住 700ms → window.__novaQuickPlayKey + toast「直接播放」
   详情渲染后 fireQuickPlay() 轮询 detailPlay.disabled（20 × 500ms），就绪即点
   超时兜底 toast「片源还在读取，按 OK 播放」
   注：本机源解析慢，轮询窗口内未就绪，起播未端到端验证

③ 观看历史按标题去重
   readWatchProgress / readPlaybackRecords 均改为
   titleKey = 标题去空格标点后小写，以 titleKey 作为 Map 键
   同标题跨源只留 at 最新一条

④ 详情页按钮
   本就有 paintDetailPlayLabel 状态机（播放 / 继续第N集 / 播放正片），
   本轮只把静态默认文案「播放测试片源」改成「播放」

待真机验证
· 长按快播的实际起播（受源解析速度影响）
· 行式导航在多行场景（片库/音乐/片单）的手感
```

### 内置源全开 + 状态持久化（2026-11-19）

```
问题      sources.js 的 loadSources() 每次启动都会执行：
            sources = sources.filter(s => s.kind !== "demo" && !String(s.url).startsWith("preset://"))
          内置订阅的 url 正是 preset://<id> —— 于是每次重启都被清掉，
          用户手动开启的开关也就一起消失了

改法      ① 删掉这段过滤
          ② 新增 seedBuiltinSources()：首次启动把 presets.list() 里全部内置源
             以 enabled:true 写入本地列表，成功后写 nova.tvbox.builtinSeeded.v2
          ③ 只播种一次：用户之后手动关闭/删除的状态以本地存储为准，重启不再覆盖
          ④ 老用户升级：若内置源已存在但 enabled=false，播种时不会强行打开（尊重用户）

实测      清空存储 → 重启：5 个内置源全部 enabled（量子/非凡/电影天堂/光速/素博）
          关掉「素博资源」→ 重启：仍为关闭，其余 4 个仍在
          导入自定义源「我的私有源」→ 重启：仍在且 enabled
          设置页「影视源」列出 5 个站点，片库正常出图（banner「罪恶拼图」+ 6 张卡）

APK       已用新 sources.js 重新打包：dist/nova-tv.apk 0.62 MB
          校验：内含 seedBuiltinSources、旧过滤已消失、签名通过
          顺手修了 build.ps1 的编码问题（中文模板在 PS5 下乱码 → 改 ASCII + UTF8-BOM）
```

### 首页锁定一屏（2026-11-19）

```
问题   首页 content 924 / 880，聚焦移动会带动整页上下滚 44px
       电视上没有滚动条，这种位移看起来像"页面在跳"

改法   tv-scale.css 末尾加一组无前缀覆盖规则（只在首页类名上生效）：
         main.content        overflow-y: hidden / scroll-behavior: auto
         .hero-row           min-height 196 → 178
         .hero-recent-row    52 → 48
         .feature-grid       margin-top 18 → 10
         .feature-card       155 → 126（内边距 14）
         .home-shelves       margin 14 → 8，padding 8/16/6
         .home-shelf         gap 16 → 10
         .home-rail          padding 4/6/6

实测   content 853 / 880（余量 27px）
       连按 ↓↑ 共 8 次，scrollTop 全程 0
       overflow-y: hidden 生效，程序性滚动也失效

坑     第一版规则全部加了 .page-home 前缀，实测无效 —— 首页没有这个类，
       只剩 scrollHeight 924→918 的 6px 变化，等于没改
```

### 手机扫码/输入推送订阅（2026-11-19）

```
痛点   电视上输远程订阅地址要按几百次方向键

方案   本地服务 + 手机浏览器中转（只做 A 方案，轮询传输）

服务端 LocalServer.java
  监听 0.0.0.0（原来只 127.0.0.1），手机才连得进来
  GET  /push              手机端表单页（内嵌 HTML，无外部依赖）
  GET  /push/api/info     {code, ip, port}
  POST /push/api/submit   c=配对码 & url=订阅地址 / raw=JSON
  GET  /push/api/poll     c=配对码 → 取走待处理项（取走即清空）
  5 分钟不活动自动换码并清空队列

电视端 push-bridge.js
  设置 →「订阅与内容源」注入卡片「手机推送订阅」
  点开全屏面板：显示 http://<IP>:<端口>/push + 4 位配对码 + 状态
  1.5s 轮询，收到就走 NovaSources.addRemote / importJson，然后自动关闭
  MutationObserver 保证设置面板重渲染后入口还在

实测（本机 Node 模拟移动端）
  面板显示 http://127.0.0.1:4179/push + 配对码 1234
  模拟手机 POST → 电视状态变「已接收 1 个订阅」
  源数量 5 → 6，面板自动关闭

坑     PowerShell 5 的 Set-Content -Encoding UTF8 会写 BOM，
       导致 javac 报「非法字符: '\ufeff'」，d8 拿不到 classes.dex，
       build.ps1 却继续往下跑并"成功"打包出旧代码的 APK。
       已给所有 .java 去 BOM；后续改 Java 文件不要用 Set-Content 写。

未做   二维码（需要内嵌 QR 编码器，约 30-40KB，或改用库），
       当前是「手机输入 IP 地址 + 4 位配对码」，手机上打字很轻松
```

### 品牌标识（2026-11-19 第三轮：logo 可点，回最首页）

```
交互      片库 / 直播 左上 logo 遥控器 OK → 直接回时钟首页（NovaPages.goHome）
          首页顶栏那个 logo 不绑定（本来就在首页）

实现      markup 换成 <button class="brand-button focusable" data-go-home tabindex="0">
          pages.js 加 goHome()：while (activePageKey) close()，一次清空页面栈
          pages.js 的 document click 委托里加 [data-go-home]（分类页克隆的顶栏也跟着生效）
          live-ui.js 的 NovaLiveUI 加 stop()：离开直播页时 destroyPlayer()，
          否则 HLS 在后台继续拉流、声音跟着回家

焦点      .brand-button.is-focused → outline 2px #fff / offset 6px / 底色 9%
          注意 pages.css 有 `.page-screen .focusable { outline: none }`（特异性 0,2,0），
          规则里必须带 .page-screen 前缀才压得住，否则焦点环不显示

导航可达  片库：← 从首页 Tab 到 logo，→ 从 logo 回 Tab（通用空间导航，天然成立）
          直播：轨道制导航没有出口，在 pages.js 的 live 分支补了三处
                · 焦点在 logo 上：→ / ↓ 回顶栏搜索
                · 焦点在顶栏搜索（最左）：← 到 logo
                · 向上已经无路可走（顶层行）：落到 logo
          初始焦点：initialFocusFor 兜底时跳过 [data-go-home]，
          否则一进直播/片库焦点就落在 logo 上，手一抖按 OK 就被送回首页（坑 #21）

验收      片库 logo (80,61) 123×46，图形仍在 (80,61) 46×46 —— 位置尺寸都没变
          OK → 时钟首页；直播 OK → 先停流（playUrl 清空）再回家
          片库 → 设置 两层栈也能一次回到底
```

### Hero 背景亮度（2026-11-19 提亮）

```
改前实测（0–255 感知亮度）   文字区 38 · 中段 23 · 右侧 43 · 海报 97（页面背景 121）
改后实测                     文字区 61 · 中段 66 · 右侧 102 · 海报 102

三层叠法
  ① .lib-banner 底色      #241b4a → #2c2159 → #352a68（品牌紫，原来 #0a0b12 近黑）
  ② .lib-banner::before   --hero-poster 模糊铺底：blur 46px / saturate 1.25 / brightness .95
                          mask 从 34% 才开始淡入，左半边靠底色撑亮度
  ③ .lib-banner-scrim     0.38 → 0.24 → 0.08 → 0（原来 0.88 → 0.78 → 0.42）
  ④ .lib-banner-art       JS 写入的海报提取色，第三层底由不透明近黑改成
                          rgba(36,27,74,.4) 半透明，让 ②透出来

文字配套
  .lib-banner-title  text-shadow 0 2px 14px
  .lib-banner-desc   0.62 → 0.8，加 0 1px 10px 阴影
  .lib-banner-meta   0.72

为什么中段原来最暗   蒙版 48% 处只剩 0.42，而提取色光晕在 74% 位置，
                     中间正好是「蒙版还在 + 光晕没到」的缝，实测只有 23
```

### 卡片焦点语言（2026-11-19 起：只上浮，不画边）

```
规则位置   tv-scale.css 末尾（最后加载，同特异性由它拍板）
覆盖对象   .poster-card / .lib-card / .cat-card / .recent-card / .feature-card /
           .detail-source-card / .library-card / .saved-card / .live-channel-card

效果       outline: none! · border-color: transparent!
           transform: translateY(-7px) scale(1.035)
           box-shadow: 0 28px 56px rgba(4,8,28,.62) + 0 10px 22px rgba(4,8,28,.42)
           z-index: 6；卡内图片再放大 1.05

为什么不画边   之前白圈是三条规则叠出来的：
               library.css:533  outline 2px #fff（离边 3px）
               library.css:903  border 1px 白 + 0 0 0 2px 白
               styles.css:1339  border 1px #fff + 三层白光晕
               ≈ 一条 8px 宽的白圈，深色海报上特别扎眼

保留描边的    只有小控件：顶栏图标、chip、排序档位、播放器按钮（它们面积小，
              靠边线才能在 3 米外辨认）
```

### 纵向预算（1080 基准，改任何一段都要重算）

```
36   .lib-shell 上留白
97   顶栏 .lib-topbar
22   .lib-main margin-top
386  Hero .lib-banner
24   .lib-main gap
40   带标题 .lib-shelf-head
10   .lib-shelf gap
415  卡片（2:3，内容宽 1760 → 6 列 277×415）
46   .lib-shell 下留白
────────────────────────────
1076 合计，Hero 底 541、卡片底 1030
```

### 顶部导航

```
高度        97px（占 1080 的 9%）
布局        grid: 品牌 auto | Tab 1fr | 图标 auto
背景        transparent（与页面同色）
分隔线      底部 1px rgba(255,255,255,.07)
Tab         6 个：首页/电影/电视剧/综艺/动漫/更多分类
Tab 尺寸    高 56px，圆角 28px，字号 20px
选中态      linear-gradient(135deg,#8f74f7,#6a6cf2 46%,#5a63ea)
            外发光 0 0 22px rgba(126,108,247,.45)
图标        3 个圆形 50×50，底 rgba(255,255,255,.07)，图标白色 22px
```

### Hero（方案 A + 右侧「接下来」海报簇）

```
尺寸        1792 × 386（内容区满宽，左右不留白，圆角 20）
背景        海报提取色光晕（canvas 采样主色 → HSL 提饱和）
            两层 radial + 一层深底 linear
文字区      框宽 600（左侧缩进 56），正文最大 544
标题        52px / 800，最多 2 行
基础信息    17px，竖线分隔，评分金色 #ffc247
简介        17px / 1.6，最多 2 行，最宽 544
按钮        高 52px，圆角 999px，三个（立即播放 / 详情 / 加入片单）
主海报      250 × 378，贴右，距右 56（与文字区左侧缩进对称）
接下来海报  2 张 232 × 348，gap 16，距主海报 24
            不透明度 0.5（近）/ 0.28（远），轮播换片时一起换
轮播点      5 个，左下 56 / 距底 24，当前紫色长条 30
水平分区    文字 64–664 ｜ 空档 382 ｜ 海报簇 1046–1800 ｜ 右留白 56
```

> 上一版的「1634 宽 + 左右各 135」是早期参数，现在的 Hero 已经回到内容区满宽 1792。
> 中间那块 382px 空档是刻意的呼吸位，再想收窄只能加内容，别再压海报尺寸。

### 轮播

```
池          前 5 部
间隔        8 秒
防打扰      焦点在 banner 上不切 / 页面隐藏不切 / 手切后暂停 12 秒
切换键      遥控器左右（banner 聚焦时）
```

### 内容带

```
每条带      固定 6 张（渲染层 slice(0,6)）
卡片        282 × 423（calc((100% - 100px) / 6) + aspect-ratio 2/3）
            与源海报 270×404 同比例，object-fit 不裁切
间距        20px
横向滚动    无
第 6 张     右边缘与容器右边界精确对齐（x 1856）
末排位置    y 611 → 1034，正好落在 .lib-main 底边，不再被屏幕下沿切掉
```

### 继续观看 →「最近观看」（在最首页，不在片库页）

```
位置        最首页 .recent-section（时间/天气/搜索 → 四个功能卡 → 最近观看 → 热门内容）
网格        .recent-grid 1746×138 @ y561，3 列单行，最多 3 张
卡片        复用现成 .recent-card：42% 图 + 58% 文案
              .recent-kicker         继续观看 · 第N集
              .recent-title          片名
              .progress-track > .progress-fill（style="--progress:38%"）
              .recent-progress-text  已看 38% · 还剩 25 分钟
数据        localStorage nova.play.progress.v1，按 at 倒序取前 3
点击        有 u（播放地址）→ NovaPlayer.open({ url, startAt: t }) 直接跳到上次位置
            没有 u / 地址失效 → NovaPages.openDetail({ key, title, image, meta })
空态        .home-empty「还没有观看记录 · 播过一集之后这里会排上进度」
查看全部    app.js 已有 data-action="recent-all" → 我的片单 / 观看历史（读同一份数据）
```

> 片库页（`#libraryPage`）那条「继续观看」货架**已整块移除**，片库页回到
> Hero 386 + 标题 36 + 卡片 423 = 879 的单带结构。

### 分类页（电影 / 电视剧 / 综艺 / 动漫 / 更多分类）

顶部用的就是片库首页那一组 `.lib-topbar`（克隆同一份 DOM），分类自己的东西落在第二行。

```
第 1 行     97px   .lib-topbar（品牌 | 6 Tab | 3 圆形图标）—— 与首页逐像素一致
间隔        14px
第 2 行     52px   .cat-toolbar
             左：eyebrow（MOVIE/SERIES…）+ 22px 标题 + 「在线」状态
             右：筛选 / 排序（更多分类页这行只有标题和计数）
间隔        18px
内容区      839px  .cat-scroll（内部纵向滚动，滚动条隐藏，不吃宽度）

分类页纵向  36 + 97 + 14 + 52 + 18 + 839 + 24 = 1080
```

```
卡片        282 × 423，间距 20，一屏 6 张，右缘 x 1856 —— 与首页完全同一套栅格
模块        每页 5 个货架，货架间距 30
```

### 「查看全部」列表页（#catPage-list）

```
第 1 行     97px   .lib-topbar（选中态 = 来源页那个 Tab：首页 / 电影 / … / 更多分类）
间隔        14
第 2 行     52px   .cat-toolbar：eyebrow（LIBRARY / MOVIE / SERIES…）+ 货架名 +
                   「已加载 N 部」+ 右侧「返回」
间隔        12
chips       44px   同级分类（pid 相同的兄弟 type），当前项紫色高亮；
                   只有一个 type 时整行 hidden，内容区自动上提 56px
间隔        16
内容区      785px  .cat-scroll：6 列 282×423、gap 20、右缘 1856，滚到底自动续拉

入口        首页「正在热播」1 个 + 四个分类页 × 5 个货架 = 21 个
取数        单 type：首屏 3 页 × 24 → 之后每页 +24
            多 type（首页热播 = HOT_TYPES 那 10 个 typeId）：每个 type 取同一页 × 8
            → 合并去重 → 翻页时整批 +10×8
            排序全在客户端，不额外请求
排序档位    热播优先（默认）｜最新更新｜评分优先｜年份优先
            热播优先 = 与首页那条带共用 NovaLibraryUI.compareHot：
              在更 +3 → 今年 +2 → 有评分 +1 → 有简介 +1 → 评分降序 → 更新集数降序
            多 type 时隐藏「最新更新」（服务端顺序对一个混合池没意义）；
            多 type 时也隐藏分类 chips（没有「同级分类」可言）
            列表把抓取顺序原样留在 listState.items，排序只作用于渲染视图，
            所以切回「最新更新」能还原服务端顺序
状态        加载中：6 张 tone 占位卡
            空    ：「这个分类暂时没有内容」，不给重试按钮
            失败  ：「内容源没有返回数据」+ 错误原文 + 「重新加载」按钮
            区分方式：三页请求全部失败才判失败，有一页成功就用它的数据
```

> 首页那条带（6 张）和「查看全部」的排序现在是同一个 `compareHot`，
> 所以带上那 6 张必然出现在列表开头（第 1 位通常是 Hero 拿走的那一部）。
> 改排序规则只改 `library-ui.js` 的 `compareHot`，列表会自动跟着变。

> `loadLibraryItems()` 只吃 `{ type, page, limit, query }`，**没有 region / year / genre 参数**，
> 所以列表页故意不放筛选面板——放上去也是假的。chips 切 type 是真的。

### 详情页 3.0（点卡片进来那一页）

```
整体        #detailScreen 全屏 overlay，背景 = 海报模糊铺底 + 左侧压暗
主体        .detail-body  left 112 · top 120 · 1696×840，grid 440px | 1fr，gap 48

左 440      .detail-rail 竖向排列
              海报 300×450 @ y120
              按钮列 300 宽 @ y586：播放 50 + 收藏 50，竖排 gap 10
              信息小卡 @ y712：2 列 × 3 行，label 14 / value 17
                类型 · 地区 · 年份 · 状态 · 集数 · 线路（最多 6 项）
              脚注 25 高钉在 y935（margin-top:auto，内容源说明）

右 1208     .detail-head：类型胶囊 32 → 标题 40/1.15（2 行）→ meta 17 →
              简介 19/1.6（3 行，max-width 1120）
            .detail-picker @ y334（flex:1）：
              标题行 44 + 线路 chips 42 + 分组条 38 + 滚动区
              剧集 12 列 × 62，gap 12，每格 90 宽；>50 集出「1-50 / 51-60」
              电影 → 播放源卡片：3 列网格，每张 405×150，gap 16

判定         max(各线路集数) > 1 → 选集模式；否则 → 播放源模式
播放         点集 = NovaLines.fromDetail(detail,{episodeIndex:N}) → NovaPlayer.open({lines,startAt})
             点播放源 = 同一函数，取该线路第 1 集
续播         「播放」按钮文案由 detailPlayTarget() 决定：有进度 → 继续 第N集 · 42%
             集数按钮右上打紫点 = 看过；白边高亮 = 当前集
收藏         接 lib-fav.js（NovaFav.toggle），按钮变「已加入片单」+ 实心图标
补数据       item 没有 lines 时 ensureDetailLines() 自己补一次 getLibraryDetail，
             不依赖 pages.js 的 libraryDataState 是不是 "sources"
没有做       相关推荐（2026-11-19 按需求去掉），左栏空白用信息小卡填满
```

> 调试口：`window.NovaDetailPicker` 直接暴露选集状态
> （`mode / lineIndex / group / currentIndex / lines`），控制台可查。

### 播放器 2.0（遥控器交互）

```
控制栏收起（播放中的默认态）
  ←/→      快退 / 快进；连按加速 10→20→30→60→120→300 秒
  OK       播放 / 暂停（按住 5 秒开「播放信息」面板）
  ↑ ↓      呼出控制栏（焦点落在进度条）
  返回      提示「再按一次退出播放」→ 3 秒内再按才真退出

控制栏展开
  ←/→      在按钮行走：关闭 / -10 / ⏯ / +10 / 音量 / 选集 / 线路 / 更多 / 重试（9 格循环）
  ↓        焦点落到进度条（进度条不在左右循环里，避免「进去出不来」）
  ↑        进度条上按 ↑ 回按钮行；按钮行上按 ↑ 收起控制栏
  进度条聚焦时 ←/→ = ±60 秒（连按到 ±30 分钟），OK 立即落点
  返回      收起控制栏（不退出）

按钮尺寸（2026-11-19 放大 + 分组）
  播放组 68×68（主键 84×84 圆形，图标 32）· 间距 18
  工具组 64×64（图标 26）· 间距 12
  组间距 40 · 圆角 22 / 20 · 「10」标签 13px · 焦点环 4px
  整行 80→744，只占 1760 的 39%

抽屉（选集 / 线路 / 更多）
  ←/→/↑/↓  选集是 6 列网格，线路与设置是单列；OK 选中；返回关闭

自动收起     4.5 秒无操作淡出，只留 3px 迷你进度线
             暂停 / 抽屉打开 / 出错 / 自动连播倒计时期间不收起
快进提示     只亮进度条 + 时间气泡，不弹整排按钮
             （否则第二下 ←/→ 会变成「移动焦点」而不是继续快进）
片尾         autoplayNext 开着且有下一集 → 8 秒倒计时卡（立即播放 / 取消）
续播         从进度续播时提示「已从 12:34 继续」4 秒
错误         网络中断 / 解码失败 / 404·403 / 不支持 HLS 分开报，
             面板里直接给「换线路」「重新加载」，焦点自动落到可点的那颗
防烧屏       暂停 3 分钟后画面降到 34% 亮度

更多设置（抽屉）
  倍速      0.5 / 0.75 / 1 / 1.25 / 1.5 / 2（顶部标签显示 1.5×）
  画面比例   适应 contain / 铺满 cover / 拉伸 fill
  睡眠定时   关 / 30 / 60 / 90 分钟（到点提示并关窗）
  播放信息   标题 / 线路 / 分辨率+码率 / 进度 / 缓冲 / 丢帧 / 倍速比例 / 分片

实现要点
  键盘      document 捕获阶段接管，stopPropagation 之后 app.js 的全局焦点导航不再插手
  连按加速  同一方向 800ms 内的重复按下累加档位（state.dirBurst）
  跳转      ←/→ 只改预览位置，停手 350ms 才真的 currentTime，避免 HLS 反复重拉
  已知限制  HLS 走 MSE + 跨源分片，canvas 被污染抓不出帧，
            所以时间气泡里的缩略图只对直连 mp4 有效（抓不到时自动隐藏）
```

---


## 三、顶栏与页面切换

### 结构

```
#libraryPage .lib-topbar   ← 唯一真身，写在 index.html 里
        │  category-ui.js 启动时 cloneNode(true)
        ├─ #catPage-movie / series / variety / anime / more 各自的 header
        └─ 选中态由 lib-nav.js 的 paintActive() 一次性刷所有副本
```

- 改顶栏（加 Tab、换图标、调高度）**只改 index.html 那一份**，分类页自动跟着变
- `paintActive(key)` 用 `querySelectorAll("[data-lib-tab]")` → 6 份顶栏永远同步
- 点击事件是 document 级委托（`[data-lib-tab]` / `[data-lib-action]`），克隆出来的按钮天然可用

### 路由

| Tab | 目标 | 说明 |
|---|---|---|
| 首页 | `NovaCategories.back()` → 片库首页 | 已在首页时不做任何事 |
| 电影/电视剧/综艺/动漫 | `NovaCategories.open(key)` | 对应 `#catPage-<key>` |
| 更多分类 | `NovaCategories.openMore()` | `#catPage-more`，五个货架：纪录片 / 体育 / 少儿 / 短剧 / AI 漫剧 |

> 纪录片**不再是 Tab**（和「更多分类」指向同一页，属于重复入口，已删）。它的入口只剩
> 「更多分类」的第一个货架，`MORE_SHELVES` 里的 `{ key: "doc", types: [20] }`。
> 想恢复独立 Tab：在 index.html 的 `.lib-tabs` 里加回按钮 + `TAB_ROUTE` 补一条 + `openMore` 收回 tabKey 参数。

规则：

1. **幂等**：点当前页的 Tab 只刷选中态，不重开页面（避免重渲染抢焦点）
2. **选中态由页面状态驱动**：`open()` / `openMore()` / `back()` 各自调用 `paintActive()`，不靠点击反推
3. **返回**：分类页按 Escape 或遥控返回 → 面板开着先关面板，否则 `back()` 回首页并刷「首页」选中
4. **顶栏图标**：搜索/片单/设置会先 `back(true)` 退出分类页再进目标页，否则两个 `.page-screen` 会叠在一起
5. **直接链接**：`?page=movie` / `?page=more` 走同一套 `open()`，选中态一样会同步
6. **焦点走向**：Tab 上按 ↓ 先到工具条的「筛选」，再 ↓ 才进卡片（`category-ui.js` 的 `move()` 里写死这条）

### 列表页（查看全部）

```
入口        NovaCategories.openList({ pageKey, index })
            pageKey: "library"（首页热播池：10 个 typeId）| "movie"|"series"|"variety"|"anime"
            index  : 货架序号，对应 SECTION_RULES[pageKey][index] 或 MORE_SHELVES[index]
状态        state.key = "list"，current() 返回 #catPage-list
排序        listState.sort ∈ hot|new|score|year，切档只重画不重取
            渲染走 renderListGrid()：items 永远是抓取顺序，排序在视图层做
            重排时按「当前视口顶部那张卡」做锚点，滚动位置不会跳
返回        Escape / 工具条「返回」→ closeList()：
            恢复来源页（含 more）、恢复选中态、恢复该页 scrollTop、焦点回到刚才那个「查看全部」
顶栏 Tab    列表页里照常可用：goTab → open()/back()，都会把 listPage 收起来
卡片        .cat-page .lib-card[data-vod] → NovaPages.openLibraryEntry(item)
            条目对象存在 catalogItems（Map，posterCard() 渲染时顺手登记）
```

---

## 四、文件职责

| 文件 | 作用 | 备注 |
|---|---|---|
| `index.html` | 页面骨架 | library 页结构、script 引入顺序 |
| `library.css` | 片库页全部样式 | **约 1750 行，末尾是历次追加的覆盖规则，新改动一律追加到最末** |
| `library-ui.js` | 片库渲染 + 轮播 + 取色 + 继续观看 + 卡片点击 | `paintHero` / `paintHeroPeek` / `tintFromPoster` / `renderRecent` |
| `lib-nav.js` | 顶部导航跳转 | 6 个 Tab → `NovaCategories.open()` / `openMore()` |
| `lib-fav.js` | 收藏读写 | **已引入**，键 `nova.fav.items.v1`；Banner「加入片单」就是它 |
| `lib-backdrop.js` | TMDB 横版图（已写但未引入） | 横版字段覆盖率 0%，暂时用不上 |
| `app.js` | 全局焦点导航 + 详情页 | `ensureFocusVisible` 负责滚动兜底 |
| `pages.js` | 页面路由 + 旧版渲染 | **非常大（3500 行）**，`renderSaved` 在这里 |
| `sources.js` | 内容源与数据层 | `window.NovaSources` |
| `category-ui.js` | 五个分类页（movie / series / variety / anime / more） | `window.NovaCategories`；顶栏靠 `topbarMarkup()` 克隆首页那份 |
| `category.css` | 分类页样式 | 顶栏样式在 library.css，这里只管 `.cat-toolbar` 和货架 |
| `player.js` | 播放器 | 播完写进度，喂「继续观看」 |
| `nova-*.js` | 新架构（**未引入**） | 文件在，index.html 没挂，别顺着它们查问题 |

---

## 五、数据契约

### 播放进度 `nova.play.progress.v1`

```json
{
  "vod-key::第03集": {
    "t": 1200,      // 当前秒数
    "d": 2400,      // 总时长秒数
    "k": "vod-key",  // 条目 key（显式存一份，key 自己带 :: 时靠它兜底）
    "n": "剧名",     // 卡片标题
    "e": "第03集",   // 集名，可空
    "p": "海报URL",  // 封面，可空（空则走渐变兜底）
    "u": "https://…/index.m3u8",  // 播放地址，供首页「最近观看」续播
    "at": 1763600000000
  }
}
```

- 写入方 `player.js`：`timeupdate` 每 5 秒一次、`pause` 与 `close()` 各强制一次
- `t < 5` 或 `d < 30` 不记；`d - t` 小于 4% 视为看完，直接删记录
- `u` 存的是**拆掉代理后的原始地址**（`rawStreamUrl()`），代理包装存进去会被二次代理
- 读取方：`app.js`（最近观看 / 详情页选集打点）、`pages.js`（观看历史）
- **解析「key::集名」只能从右边找最后一个 `::`**：条目 key 形如
  `src_xxx::lziapi:::166620`，`split("::")[0]` 会把 key 截成一半，导致
  看过标记与「继续」全部失效（三处读取都已改成 `lastIndexOf`）

### 片单 `nova.fav.items.v1`

```json
[{ "key": "...", "title": "...", "image": "...", "type": "电影",
   "meta": "2026 · 美国 · 8.2 分", "remarks": "", "score": 8.2, "at": 1763600000000 }]
```

- 卡片存的是**已经过代理**的 `/api/proxy?url=...`，渲染时 `proxyImage()` 会跳过二次包装
- `pages.js` 的 `renderSaved` 优先读它；读不到才退回写死的演示数组，再读不到就显示 `.library-empty` 空状态

---

## 六、待办

```
已完成（2026-11-19）
① Hero 中间留白 → 文字区 540→600，右侧补「接下来 2 部」海报簇，空档 823 → 382
② 「继续观看」模块 → player.js 写进度，library-ui.js 渲染，无记录整块隐藏
③ 「我的片单」→ renderSaved 优先读 nova.fav.items.v1；观看历史改读播放进度
④ 分类页统一顶栏 → 五个分类页克隆首页 .lib-topbar，筛选/排序降到第二行工具条，
   切换逻辑集中在 lib-nav.js（幂等 + 选中态由页面状态驱动）
⑤ 「查看全部」→ 独立 #catPage-list：21 个入口、3 页首屏 + 逐页续拉、chips 切子分类、
   加载/空/失败三态、返回恢复焦点与滚动；顺带把分类页卡片接到详情页
⑥ 列表页排序 → 热播优先（默认）/ 最新更新 / 评分优先 / 年份优先，纯客户端；
   热播优先与首页那条带共用 compareHot，带上 6 张必然出现在列表开头
⑦ 「继续观看」搬家 → 片库页那条货架删掉，数据改由最首页「最近观看」渲染
   （.recent-card 三张 + 进度条 + 续播 startAt），player.js 进度记录补 u 字段
⑧ 详情页 → 封面柱布局（左 400 信息 + 右 1248 选集/选源），点集即播、线路切换、已看打点、
   继续按钮、收藏同步、>50 集分组、播放器关掉后回填标记；相关推荐按需求已移除
⑨ 播放器 2.0 → 遥控器语义（←→ 快进/连按加速、OK 播放暂停、↑↓ 控制栏、返回双确认）、
   可聚焦进度条 + 时间气泡、自动收起、选集/线路/更多三个抽屉、片尾自动连播、
   续播提示、错误分型、倍速/比例/睡眠/统计、暂停防烧屏

下一批
⑩ 播放器真机手测
   键盘模拟已覆盖，还没在实体遥控器上验过：长按 OK 的 repeat 频率、返回键的键码
   （部分盒子发 GoBack / BrowserBack，需要在 onKeyDown 的白名单里补）
⑪ 最近观看的卡片只有 3 格
   .recent-grid 是 3 列单行 138 高，第 4 条以后看不到；要更多得改首页纵向预算
⑫ 多带纵向滚动实测
   .lib-main / .cat-scroll 都开了 overflow auto（滚动条隐藏），靠 app.js 的
   ensureFocusVisible 兜滚动，但还没在真机遥控器上验过
⑬ 直播页 / 音乐页 / 片单页还没有这套顶栏
   那三页仍是 NovaPages 的老页面结构（自带 page-header），要不要一起换得先定
⑭ 「更多分类」5 个货架也切到列表页，删掉 showMoreResult / loadMoreResults / renderChips
   openList 已经支持 pageKey: "more"，改两行就能切，风险在删旧代码
⑮ 「最新更新」在单分类下也只是近似
   CMS 按 pg 分页，站内顺序是更新序；跨站是并发完成顺序，没有统一的更新时间字段可用
⑯ 音乐模块（2026-11-19 收尾，用户决定此版本先冻结）
   现状：顶栏统一 / 曲库来自聚合 API（20 首，热歌榜 200 可扩）/ 电台来自 Radio Browser
        （53,184 个，默认 24 个）/ 搜索面板每页 50 可翻 / 全屏歌词屏（LRC + 制作信息过滤）
        / 背景是封面模糊 + 取色光斑（59/68/40）/ dock 五键（上一首·播放·下一首·模式·静音）
        / 状态胶囊 + 缓冲条 + 暂停视觉 + 错误卡 + 下一首预告 + 进度气泡 + 音量条
        / MediaSession / nova.music.v1 持久化（索引·时间·音量·静音·播放模式）
   后续版本可选
     · 曲库上限 20 → 60，并合并三个榜单去重（热歌200 + 新歌100 + 飙升100）
     · Jamendo 正版 CC 源（需申请 client_id），做「发现/歌单」
     · 设置页「音乐源」面板：provider 开关 + 连通性测试 + 聚合基址输入框
       （接口已就绪：NovaMusicSources.status() / setAggregatorBase()）
     · 喜欢/收藏（nova.fav.music.v1），音乐页加「我的喜欢」筛选
     · 自建 NeteaseCloudMusicApi 替掉公共实例，基址指过去即可，代码不用改
     · 电台按国家/标签筛选 UI（接口已支持 radio.list({country, tag})）
     · 播放器 P2：返回提示、频谱细节、歌词逐字高亮
   已知限制
     · 曲库/搜索完全依赖公共聚合实例，会限流或换域名
     · 预览服务器不支持 Range，本地文件类音源拖动会提示不支持
     · 频谱走 WebAudio，跨域音源会被静音 → 电台只走 /api/proxy（同源）
```

---

## 七、踩过的坑（重要）

**1. `.stage` 用 transform 缩放，px 才是可靠单位**

1080 逻辑像素按视口高度整体缩放（1366×768 → scale 0.711）。所以内部一律写 px，`vh` 会算错。缩放后 `getBoundingClientRect` 拿到的是缩放值，比对时要么除 scale，要么都在同一视口测。

**2. 旧 CSS 带 `!important` 会压住新规则**

例如 `.lib-rail .lib-card { width: … !important }`、`.lib-banner-copy { max-width: none !important }`。改样式前先 `grep !important`，新规则追加到文件末尾。

**3. `app.js` 的方向键处理有 `stopPropagation`**

挂在冒泡阶段的监听收不到方向键事件，必须用 capture 阶段（`addEventListener(..., true)`）。

**4. 聚合接口的横版字段全空**

`vod_pic_slide` / `vod_pic_screenshot` / `vod_pic_thumb` 在三个活跃源里覆盖率 **0%**。只有 `vod_pic`（竖版 270×404）。所以 Hero 不能用横版剧照铺底，卡片比例也按 2:3 对齐源图。

**5. `fallbackLibraryItems` 是空数组**

`pages.js` 里 `const fallbackLibraryItems = []`，`getLibraryItem()` 对演示 key（dune / yourname…）查不到东西。所以：
- 「我的片单」不能只靠 `getLibraryItem`，本机收藏的条目要自带标题与海报
- 查不到时给 `.library-empty` 空状态，别留一块空白网格

**6. Banner 主海报的 `<img>` 不能再写 `onerror="this.remove()"`**

旧代码图片加载失败就把 img 删掉，但外层 `.lib-banner-poster` 还在，`paintHero` 只在 div 不存在时才重建 → 海报位从此永远空白。现在由 `posterImage()` 负责补回节点。

**7. 服务器会崩**

连续跑 CDP 验证脚本（每次开一个 headless Chrome）时，代理转发并发过多会让 node 进程退出。用 `agent-browser` 会话复用，别反复开新浏览器。

**8. `NovaCategories.open()` 不会自动收起「更多分类」页**

`open()` 只隐藏 `pages`（四个分类）和 `libraryPage`。从更多分类直接切到电影时，`#catPage-more` 仍是非隐藏状态，两个页面 z-index 都是 60，谁在后面谁盖住 → 现在 `open()` 里补了 `morePage.hidden = true`。

**9. 顶栏图标跳页前必须先退分类页**

分类页不在 `NovaPages` 的页面栈里。从分类页直接 `NovaPages.open("saved")`，结果 saved 页和分类页同时可见、z-index 相同，DOM 靠后的分类页反而盖在上面。`lib-nav.js` 的 `goAction()` 现在先 `NovaCategories.back(true)` 再跳（`true` = 别把焦点抢回分类卡）。

**10. 分类页的顶栏是克隆出来的，改完记得只改真身**

顶栏 = `index.html` 里 `#libraryPage .lib-topbar` 那一份，五个分类页在 `category-ui.js` 启动时 `cloneNode(true)`。所以：
- 别在 index.html 之外手改分类页顶栏的 HTML（会被下次加载覆盖）
- 给顶栏加元素/改结构，只改真身；要加“只在分类页出现”的东西，放到 `.cat-toolbar` 那行

**11. 4178 端口跑的是镜像目录，不是 work/preview**

`preview-server.mjs` 的 `root` 取的是**进程自己的 CWD**，当前那个 node 进程的 CWD 是
`outputs/nova-tv-preview/`。改完 `work/nova-tv-github-upload/preview/` 里的文件，
**必须同步到 `outputs/nova-tv-preview/` 才会生效**，否则浏览器里永远是旧版（文件大小差几十字节，很难看出来）。

```powershell
Copy-Item preview\* outputs\nova-tv-preview\ -Force   # 或者只拷改过的几个
```

排查手法：`Get-FileHash` 比两边 MD5；或看 node 进程的 CWD（PEB 里读，`Win32_Process` 拿不到）。

**12. 列表页失败态要区分「没内容」和「取不到」**

`loadLibraryItems()` 抛错和返回空数组是两回事。列表页把每页请求包成 `{ ok, items | error }`：
三页全失败 → 失败态（给「重新加载」），有一页成功就照常用它的数据；全部成功但都为空 → 空态。

**13. hotScore 在一批真实数据上会全部打平**

第一版「热播优先」只有 `+3 在更 / +2 今年 / +1 评分 / +1 简介`，实测 80 条全是今年、都在更、大多没评分 →
分数完全一样，稳定排序后和「最新更新」一字不差，chip 形同虚设。
现在的比较器加了第二三层：评分降序 → 更新集数降序（`compareHot`），单分类列表实测 60 条里 60 个位置都变了。

**14. 排序不能就地改 listState.items**

第一版在 `renderListGrid()` 里 `listState.items = sortListItems(items, sort)`，结果切到「最新更新」时
只是把「已经按热播排过的数组」再排一次 → 永远和热播一样。现在 items 只存抓取顺序，排序只生成渲染视图。

**15. 首页那条带和「查看全部」必须共用同一份池子与比较器**

- 池子：`library-ui.js` 的 `HOT_TYPES`（10 个 typeId），通过 `NovaLibraryUI.hotTypes` 暴露
- 比较器：`compareHot`，通过 `NovaLibraryUI.compareHot` 暴露
- 两者都改的话只改 `library-ui.js`；一级类型用 `type=0` 时，列表和带上的内容几乎不重合（实测 6 张里只对得上 1 张）

**16. 进度里存播放地址会被二次代理**

`player.js` 的 `PROXY()` 会按 `.m3u8` 正则判断，而 `/api/proxy?url=…%2Fx.m3u8` 这个字符串**也以 .m3u8 结尾** →
再喂回播放器会被包成 `/api/proxy?url=%2Fapi%2Fproxy…`，服务端去抓一个相对地址，直接报「片源暂时无法播放」。
现在 `saveProgress` 用 `rawStreamUrl()` 拆掉包装再存，`app.js` 读回来时也再拆一次（兼容老记录）。

**17. 首页 `.content` 是固定 880px，不滚动**

`applyHomeVisibility()` 里「有 home rows 就把最近观看/热门顶掉」是**故意的**：
`.content` 高度写死 880，多塞一块就溢到屏幕外。所以最近的迁移没有放松这条规则——
如果以后内容源开始返回首页行，「最近观看」会被整块替换，那时要么把它并进 homeRows，要么给 `.content` 加滚动。

**18. 详情页里「渲染一次」的状态只能初始化一次**

`renderDetailPicker()` 每次切线路、切分组都会整体重跑。凡是「用户选择」
（`group`、`lineIndex`）都不能在渲染函数里重置，否则点了分组立刻被弹回第 1 组。
现在只在 `openDetail()` 换片时重置，`currentIndex` 的默认定位用
`detailPickerState.initialized` 一次性门闩。

**19. `item.image` 可能已经是代理地址**

数据层返回的图有时是 `http://127.0.0.1:4178/api/proxy?url=…`，再套一层
`/api/proxy?url=…` 会 404（海报空白）。`proxiedPoster()` 用 `includes("/api/proxy?")`
判断，不能只判 `startsWith`。

**20. `.source-list` 是内容源设置页的老类名，别在详情页复用**

`sources.css:169` 早就定义了 `.source-list`（设置页的站点竖列表，`display:flex`），
详情页的播放源网格如果也叫这个名，会被压成单列满宽。详情页现在用
`.detail-source-list` / `.detail-source-card`，加前缀避开。

---

## 八、验证方式

```powershell
# 回归测试（4 个，2026-11-19 全绿：6/6 · 20/20 · 25/25 · 20/20）
node tools/verify-presets.mjs
node tools/verify-settings.mjs
node tools/verify-sources.mjs
node tools/verify-lines.mjs
```

页面验证两种路子：

1. `?page=library&diag=1` → 页面底部 `#libDiag` 输出 topbar / banner / 卡片几何
2. `agent-browser` 会话里 `eval`：取 `getBoundingClientRect` 核对
   - 首页：Hero 386、文字区 600、主海报 250×378（右边缘 1800）
   - 首页：卡片 282×423，末张右边缘 1856，末排底 1034
   - `.lib-main` 在单带时 `scrollHeight === clientHeight`
   - 分类页：顶栏 97 @ y36、工具条 52 @ y147、内容区 839 @ y217
   - 分类页：卡片 282×423，右缘 1856，`scrollHeight > clientHeight`（该滚）
   - 列表页：顶栏 97 @ y36、工具条 52 @ y147、chips 44 @ y211、内容区 785 @ y271
   - 列表页：卡片 282×423、右缘 1856；chips 隐藏时内容区自动变成 841
3. 切换逻辑冒烟（在 eval 里连点即可）

```js
// 六个 Tab 依次点一遍，检查「可见页面」和「选中态的 6 份副本」是否一致
[["movie"],["series"],["variety"],["anime"],["more"],["home"]].forEach(([k]) =>
  document.querySelector(`[data-lib-tab="${k}"]`).click()
);
```
