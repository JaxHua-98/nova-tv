package com.novatv.app.data

import com.novatv.app.R

object DemoCatalog {
    private const val W3C_SINTEL =
        "https://media.w3.org/2010/05/sintel/trailer.mp4"
    private const val W3C_BUNNY =
        "https://media.w3.org/2010/05/bunny/trailer.mp4"
    private const val W3C_MOVIE =
        "https://media.w3.org/2010/05/video/movie_300.mp4"
    private const val W3C_SOURCE = "W3C 开放授权 MP4 测试片源"
    private const val MUX_LIVE =
        "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    private const val MUX_LIVE_SOURCE = "Mux 开放 HLS 测试信号"

    val interstellar = MediaItem(
        id = "interstellar",
        title = "星际穿越",
        type = "电影",
        meta = "2014 · 科幻 / 冒险 · 2小时49分",
        description = "宇航员库珀穿过虫洞寻找人类新家园。时间、引力与亲情在星际之间彼此牵引。",
        imageRes = R.drawable.nova_interstellar,
        keywords = "诺兰 克里斯托弗诺兰 马修麦康纳 太空 虫洞 科幻",
        progressLabel = "已观看 58%",
        progress = 0.58f,
        badge = "继续观看",
        streamUrl = W3C_MOVIE,
        sourceLabel = W3C_SOURCE,
    )

    val peaky = MediaItem(
        id = "peaky",
        title = "浴血黑帮 第6季",
        type = "剧集",
        meta = "2022 · 犯罪 / 剧情 · 第6季",
        description = "汤米·谢尔比在时代剧变中继续守住家族与生意，旧日敌友也逐一回到伯明翰。",
        imageRes = R.drawable.nova_peaky,
        keywords = "浴血黑帮 汤米谢尔比 伯明翰 犯罪 英剧",
        progressLabel = "已观看 第3集",
        progress = 0.43f,
        badge = "剧集 · S06",
        streamUrl = W3C_SINTEL,
        sourceLabel = W3C_SOURCE,
    )

    val totoro = MediaItem(
        id = "totoro",
        title = "龙猫",
        type = "动画电影",
        meta = "1988 · 动画 / 奇幻 · 1小时26分",
        description = "小月和小梅在乡间遇见森林守护者龙猫，一段温柔而奇妙的夏日冒险由此展开。",
        imageRes = R.drawable.nova_totoro,
        keywords = "宫崎骏 吉卜力 龙猫 森林 治愈 动画",
        progressLabel = "已观看 72%",
        progress = 0.72f,
        badge = "家庭 · 治愈",
        streamUrl = W3C_BUNNY,
        sourceLabel = W3C_SOURCE,
    )

    val dune = MediaItem(
        id = "dune",
        title = "沙丘 II",
        type = "电影",
        meta = "2024 · 科幻 / 冒险 · 2小时46分",
        description = "保罗·厄崔迪与契妮和弗雷曼人并肩作战，在复仇与预言之间寻找自己的道路。",
        imageRes = R.drawable.nova_dune,
        keywords = "沙丘 保罗厄崔迪 科幻 沙漠 史诗",
        badge = "01",
        streamUrl = W3C_SINTEL,
        sourceLabel = W3C_SOURCE,
    )

    val joker = MediaItem(
        id = "joker",
        title = "小丑",
        type = "电影",
        meta = "2019 · 剧情 / 犯罪 · 2小时02分",
        description = "在冷漠而失衡的城市里，一个被忽视的喜剧演员逐渐走向崩溃，也走向聚光灯中央。",
        imageRes = R.drawable.nova_joker,
        keywords = "小丑 亚瑟弗莱克 犯罪 剧情 哥谭",
        badge = "02",
        streamUrl = W3C_BUNNY,
        sourceLabel = W3C_SOURCE,
    )

    val avengers = MediaItem(
        id = "avengers",
        title = "复仇者联盟4：终局之战",
        type = "电影",
        meta = "2019 · 动作 / 科幻 · 3小时01分",
        description = "幸存的英雄们再次集结，穿越时间与失去，为宇宙争取最后一次逆转机会。",
        imageRes = R.drawable.nova_avengers,
        keywords = "复仇者联盟 漫威 终局之战 超级英雄",
        badge = "03",
        streamUrl = W3C_SINTEL,
        sourceLabel = W3C_SOURCE,
    )

    val lostYou = MediaItem(
        id = "lostyou",
        title = "长相思",
        type = "剧集",
        meta = "2023 · 古装 / 爱情 · 全39集",
        description = "小夭在漫长岁月中辗转流离，与故人重逢，也被卷入家国、身份与选择的漩涡。",
        imageRes = R.drawable.nova_lostyou,
        keywords = "长相思 小夭 古装 爱情 东方",
        badge = "04",
        streamUrl = W3C_MOVIE,
        sourceLabel = W3C_SOURCE,
    )

    val yourName = MediaItem(
        id = "yourname",
        title = "你的名字。",
        type = "动画电影",
        meta = "2016 · 动画 / 爱情 · 1小时46分",
        description = "两个陌生少年在梦中交换身体，并在时间与距离之间寻找彼此。",
        imageRes = R.drawable.nova_yourname,
        keywords = "新海诚 你的名字 动画 爱情 彗星 青春",
        badge = "05",
        streamUrl = W3C_BUNNY,
        sourceLabel = W3C_SOURCE,
    )

    val cctv = MediaItem(
        id = "cctv1",
        title = "央视一套",
        type = "直播",
        meta = "综合频道 · 公开 HLS 测试信号",
        description = "NOVA TV 只接入标准 m3u / txt 直播源，不实现虎牙、抖音房间号换真实地址。",
        imageRes = R.drawable.nova_avengers,
        keywords = "央视 CCTV 综合 频道 直播 新闻",
        streamUrl = MUX_LIVE,
        sourceLabel = MUX_LIVE_SOURCE,
        isLive = true,
    )

    val musicPreview = MediaItem(
        id = "music-night",
        title = "夜航星",
        type = "音乐",
        meta = "NOVA Session · 试听音轨 · 00:24",
        description = "音乐模块独立承载本地音乐、网络电台、歌单、播放队列与后台播放。",
        imageRes = R.drawable.nova_yourname,
        keywords = "夜航星 音乐 歌曲 电台 歌单",
    )

    val recent = listOf(interstellar, peaky, totoro)

    val trending = listOf(dune, joker, avengers, lostYou, yourName)

    val searchable = listOf(
        interstellar,
        peaky,
        totoro,
        dune,
        joker,
        avengers,
        lostYou,
        yourName,
        cctv,
        musicPreview,
    )

    val features = listOf(
        FeatureCardData(
            target = FeatureTarget.LIVE,
            title = "电视直播",
            description = "央视卫视 · 地方频道",
        ),
        FeatureCardData(
            target = FeatureTarget.LIBRARY,
            title = "聚合片库",
            description = "电影 · 剧集 · 动漫 · 综艺",
        ),
        FeatureCardData(
            target = FeatureTarget.MUSIC,
            title = "音乐",
            description = "音乐 · MV · 歌单",
        ),
        FeatureCardData(
            target = FeatureTarget.SAVED,
            title = "收藏与历史",
            description = "我的收藏 · 观看记录",
        ),
    )

    fun search(query: String): List<MediaItem> {
        val needle = query.trim().lowercase().replace(" ", "")
        if (needle.isEmpty()) return searchable.take(6)
        return searchable.filter { item ->
            "${item.title}${item.type}${item.meta}${item.keywords}${item.description}"
                .lowercase()
                .replace(" ", "")
                .contains(needle)
        }
    }
}
