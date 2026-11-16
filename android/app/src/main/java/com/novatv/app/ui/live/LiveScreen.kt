package com.novatv.app.ui.live

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.data.StandardLiveChannel
import com.novatv.app.data.StandardLiveSourceParser
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaGlassPanel
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.components.SecondaryHeader
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaCoral
import com.novatv.app.ui.theme.NovaCoralDeep
import com.novatv.app.ui.theme.NovaMint
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay

private val demoLiveSource = """
    #EXTM3U
    #EXTINF:-1 group-title="央视",CCTV-1 综合
    https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
    #EXTINF:-1 group-title="央视",CCTV-5 体育
    https://test-streams.mux.dev/pts_shift/master.m3u8
    #EXTINF:-1 group-title="央视",CCTV-6 电影
    https://test-streams.mux.dev/tos_ismc/main.m3u8
    #EXTINF:-1 group-title="央视",CCTV-13 新闻
    https://test-streams.mux.dev/test_001/stream.m3u8
    #EXTINF:-1 group-title="卫视",湖南卫视
    https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8
    #EXTINF:-1 group-title="卫视",东方卫视
    https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
    #EXTINF:-1 group-title="卫视",浙江卫视
    https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
    #EXTINF:-1 group-title="卫视",江苏卫视
    https://test-streams.mux.dev/pts_shift/master.m3u8
    #EXTINF:-1 group-title="地方",安庆新闻综合
    https://test-streams.mux.dev/tos_ismc/main.m3u8
    #EXTINF:-1 group-title="地方",安徽公共
    https://test-streams.mux.dev/test_001/stream.m3u8
    #EXTINF:-1 group-title="音乐",音乐现场
    https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8
    #EXTINF:-1 group-title="音乐",经典演唱会
    https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8
""".trimIndent()

@Composable
fun LiveScreen(
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onPlayChannel: (StandardLiveChannel) -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val allChannels = remember { StandardLiveSourceParser.parseM3u(demoLiveSource) }
    val groups = remember(allChannels) { listOf("全部") + allChannels.map { it.group }.distinct() }
    var selectedGroup by remember { mutableStateOf("全部") }
    var selectedIndex by remember { mutableIntStateOf(0) }
    val channels = remember(selectedGroup, allChannels) {
        if (selectedGroup == "全部") allChannels else allChannels.filter { it.group == selectedGroup }
    }
    val channelRequesters = remember(allChannels) {
        allChannels.associate { it.name to FocusRequester() }
    }
    val firstFocus = remember(allChannels) {
        channelRequesters.getValue(allChannels.first().name)
    }

    LaunchedEffect(Unit) {
        delay(160)
        runCatching { firstFocus.requestFocus() }
    }

    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(start = 64.dp, top = 40.dp, end = 64.dp, bottom = 40.dp),
    ) {
        SecondaryHeader(
            eyebrow = "NOVA LIVE · 标准直播源",
            title = "电视直播",
            onBack = onBack,
        ) {
            HeaderBadge(text = "${allChannels.size} 个测试频道", color = NovaMint)
            Box(Modifier.width(12.dp))
            HeaderAction(
                text = "直播源管理",
                onClick = onOpenSettings,
            )
        }

        Spacer(Modifier.height(20.dp))

        Row(
            modifier = Modifier
                .fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            NovaGlassPanel(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(26.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        groups.forEach { group ->
                            FilterChip(
                                text = group,
                                selected = selectedGroup == group,
                                onClick = {
                                    selectedGroup = group
                                    selectedIndex = 0
                                },
                            )
                        }
                    }

                    Spacer(Modifier.height(22.dp))

                    channels.chunked(4).forEachIndexed { rowIndex, rowChannels ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(142.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            rowChannels.forEachIndexed { columnIndex, channel ->
                                val globalIndex = rowIndex * 4 + columnIndex
                                ChannelCard(
                                    channel = channel,
                                    index = globalIndex,
                                    selected = selectedIndex == globalIndex,
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight(),
                                    requester = channelRequesters.getValue(channel.name),
                                    onClick = {
                                        selectedIndex = globalIndex
                                    },
                                )
                            }
                            repeat(4 - rowChannels.size) {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                        Spacer(Modifier.height(14.dp))
                    }
                }
            }

            NovaGlassPanel(
                modifier = Modifier
                    .width(470.dp)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                ChannelPreview(
                    channel = channels.getOrNull(selectedIndex) ?: channels.firstOrNull(),
                    onPlay = {
                        val channel = channels.getOrNull(selectedIndex) ?: channels.firstOrNull()
                        if (channel == null) {
                            onToast("当前分组没有可播放频道")
                        } else {
                            onPlayChannel(channel)
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun FilterChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier.height(38.dp),
        shape = RoundedCornerShape(13.dp),
        focusedScale = 1.05f,
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .background(
                    if (selected) Color.White.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.055f),
                    RoundedCornerShape(13.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.12f),
                    RoundedCornerShape(13.dp),
                )
                .padding(horizontal = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = text,
                color = if (selected || focused) NovaWhite else Color.White.copy(alpha = 0.54f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.5.sp,
            )
        }
    }
}

@Composable
private fun ChannelCard(
    channel: StandardLiveChannel,
    index: Int,
    selected: Boolean,
    modifier: Modifier,
    requester: FocusRequester,
    onClick: () -> Unit,
) {
    val palette = listOf(
        listOf(NovaCoral, NovaCoralDeep),
        listOf(Color(0xFF8D78EC), Color(0xFF586BE2)),
        listOf(Color(0xFF57C5A5), Color(0xFF248C8A)),
        listOf(Color(0xFFF5BB67), Color(0xFFD77F43)),
    )
    val colors = palette[index % palette.size]
    NovaFocusable(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        focusRequester = requester,
        focusedScale = 1.025f,
        transformOrigin = TransformOrigin(0.5f, 0.5f),
        onClick = onClick,
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        colors.map { it.copy(alpha = if (selected) 0.95f else 0.72f) },
                    ),
                    RoundedCornerShape(20.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.18f),
                    RoundedCornerShape(20.dp),
                )
                .padding(17.dp),
        ) {
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .background(Color.Black.copy(alpha = 0.13f), RoundedCornerShape(9.dp))
                    .padding(horizontal = 9.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = NovaIcons.LiveTv,
                    contentDescription = null,
                    tint = NovaWhite,
                    modifier = Modifier.size(15.dp),
                )
                Text(
                    text = "LIVE",
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 9.sp,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(start = 5.dp),
                )
            }
            Column(modifier = Modifier.align(Alignment.BottomStart)) {
                Text(
                    text = channel.name,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = channel.group,
                    color = Color.White.copy(alpha = 0.62f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
        }
    }
}

@Composable
private fun ChannelPreview(
    channel: StandardLiveChannel?,
    onPlay: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(28.dp),
    ) {
        Text(
            text = "当前选择",
            color = Color.White.copy(alpha = 0.46f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            letterSpacing = 1.2.sp,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp)
                .height(250.dp)
                .background(
                    Brush.linearGradient(listOf(Color(0x99625EDA), Color(0x992F8FB9))),
                    RoundedCornerShape(24.dp),
                )
                .border(1.dp, Color.White.copy(alpha = 0.19f), RoundedCornerShape(24.dp)),
        ) {
            Icon(
                imageVector = NovaIcons.LiveTv,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.82f),
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(68.dp),
            )
            Row(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(15.dp)
                    .background(Color.Black.copy(alpha = 0.20f), RoundedCornerShape(9.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(6.dp).background(NovaCoral, CircleShape))
                Text(
                    text = "公开测试信号",
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(start = 7.dp),
                )
            }
        }
        Text(
            text = channel?.name ?: "请选择频道",
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 28.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 20.dp),
        )
        Text(
            text = "${channel?.group ?: "未分组"} · 公开 HLS 测试信号",
            color = Color.White.copy(alpha = 0.50f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 7.dp),
        )
        Spacer(Modifier.height(22.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.055f), RoundedCornerShape(17.dp))
                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(17.dp))
                .padding(16.dp),
        ) {
            Text(
                text = "频道名称仅用于界面演示。播放时将连接公开授权的 HLS 测试信号；不实现按虎牙 / 抖音房间号换取真实播放地址。",
                color = Color.White.copy(alpha = 0.48f),
                fontFamily = Manrope,
                fontSize = 11.5.sp,
                lineHeight = 19.sp,
            )
        }
        Spacer(Modifier.weight(1f))
        LivePlayButton(onClick = onPlay)
    }
}

@Composable
private fun LivePlayButton(onClick: () -> Unit) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(17.dp),
        focusedScale = 1.02f,
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    if (focused) Color.White else Color.White.copy(alpha = 0.92f),
                    RoundedCornerShape(17.dp),
                )
                .border(if (focused) 2.dp else 1.dp, NovaWhite, RoundedCornerShape(17.dp)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = NovaIcons.Play,
                contentDescription = null,
                tint = Color(0xFF1B294B),
                modifier = Modifier.size(21.dp),
            )
            Text(
                text = "播放测试信号",
                color = Color(0xFF1B294B),
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                modifier = Modifier.padding(start = 9.dp),
            )
        }
    }
}

@Composable
private fun HeaderBadge(text: String, color: Color) {
    Row(
        modifier = Modifier
            .background(Color.White.copy(alpha = 0.07f), RoundedCornerShape(12.dp))
            .border(1.dp, Color.White.copy(alpha = 0.11f), RoundedCornerShape(12.dp))
            .padding(horizontal = 13.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).background(color, CircleShape))
        Text(
            text = text,
            color = Color.White.copy(alpha = 0.62f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

@Composable
private fun HeaderAction(text: String, onClick: () -> Unit) {
    NovaFocusable(
        modifier = Modifier.height(42.dp),
        shape = RoundedCornerShape(14.dp),
        focusedScale = 1.05f,
        transformOrigin = TransformOrigin(1f, 0.5f),
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .background(Color.White.copy(alpha = if (focused) 0.16f else 0.07f), RoundedCornerShape(14.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.14f),
                    RoundedCornerShape(14.dp),
                )
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = NovaIcons.Tune,
                contentDescription = null,
                tint = NovaWhite.copy(alpha = 0.80f),
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = text,
                color = NovaWhite.copy(alpha = 0.76f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 11.5.sp,
                modifier = Modifier.padding(start = 7.dp),
            )
        }
    }
}
