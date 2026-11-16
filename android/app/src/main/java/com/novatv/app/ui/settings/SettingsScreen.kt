package com.novatv.app.ui.settings

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaGlassPanel
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.components.SecondaryHeader
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaMint
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay

enum class SettingsSection(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
) {
    SOURCES("内容源管理", "影视 · 直播 · 音乐", NovaIcons.Source),
    BROWSING("浏览与首页", "模块 · 聚合 · 排序", NovaIcons.Movie),
    PLAYBACK("播放设置", "解码 · 线路 · 续播", NovaIcons.Play),
    MUSIC("音乐设置", "后台 · 音质 · 歌单", NovaIcons.Music),
    APPEARANCE("外观与语言", "焦点 · 动效 · 字幕", NovaIcons.Tune),
    ABOUT("关于 NOVA TV", "版本 · 组件 · 声明", NovaIcons.Settings),
}

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
    initialSection: SettingsSection = SettingsSection.SOURCES,
) {
    var selected by remember(initialSection) { mutableStateOf(initialSection) }
    val requesters = remember {
        SettingsSection.values().associateWith { FocusRequester() }
    }

    LaunchedEffect(initialSection) {
        delay(150)
        runCatching { requesters.getValue(initialSection).requestFocus() }
    }

    BackHandler(onBack = onBack)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(start = 64.dp, top = 40.dp, end = 64.dp, bottom = 40.dp),
    ) {
        SecondaryHeader(
            eyebrow = "NOVA SYSTEM · 设置",
            title = "系统与内容源",
            onBack = onBack,
        ) {
            Row(
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.07f), RoundedCornerShape(12.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.11f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 13.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(7.dp).background(NovaMint, CircleShape))
                Text(
                    text = "本地试玩版 0.1.0",
                    color = Color.White.copy(alpha = 0.62f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        }

        Spacer(Modifier.height(22.dp))

        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            NovaGlassPanel(
                modifier = Modifier
                    .width(390.dp)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp),
                ) {
                    Text(
                        text = "设置分类",
                        color = Color.White.copy(alpha = 0.46f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        letterSpacing = 1.1.sp,
                        modifier = Modifier.padding(start = 8.dp, bottom = 12.dp),
                    )
                    SettingsSection.values().forEach { section ->
                        SettingsNavRow(
                            section = section,
                            selected = selected == section,
                            requester = requesters.getValue(section),
                            onClick = { selected = section },
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                    Spacer(Modifier.weight(1f))
                    Text(
                        text = "内容源只在设置中管理，首页不单独显示源模块。",
                        color = Color.White.copy(alpha = 0.34f),
                        fontFamily = Manrope,
                        fontSize = 10.5.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier.padding(horizontal = 9.dp),
                    )
                }
            }

            NovaGlassPanel(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                SettingsDetailPanel(
                    section = selected,
                    onToast = onToast,
                )
            }
        }
    }
}

@Composable
private fun SettingsNavRow(
    section: SettingsSection,
    selected: Boolean,
    requester: FocusRequester,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(76.dp),
        shape = RoundedCornerShape(18.dp),
        focusRequester = requester,
        focusedScale = 1.018f,
        transformOrigin = TransformOrigin(0f, 0.5f),
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    when {
                        focused -> Color.White.copy(alpha = 0.14f)
                        selected -> Color.White.copy(alpha = 0.09f)
                        else -> Color.White.copy(alpha = 0.025f)
                    },
                    RoundedCornerShape(18.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = if (selected) 0.15f else 0.07f),
                    RoundedCornerShape(18.dp),
                )
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .background(
                        if (selected) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.055f),
                        RoundedCornerShape(13.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = section.icon,
                    contentDescription = null,
                    tint = if (selected || focused) NovaWhite else Color.White.copy(alpha = 0.55f),
                    modifier = Modifier.size(22.dp),
                )
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 13.dp),
            ) {
                Text(
                    text = section.title,
                    color = if (selected || focused) NovaWhite else Color.White.copy(alpha = 0.62f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
                Text(
                    text = section.subtitle,
                    color = Color.White.copy(alpha = 0.37f),
                    fontFamily = Manrope,
                    fontSize = 10.5.sp,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
            Icon(
                imageVector = NovaIcons.ChevronRight,
                contentDescription = null,
                tint = Color.White.copy(alpha = if (selected) 0.52f else 0.24f),
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun SettingsDetailPanel(
    section: SettingsSection,
    onToast: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(30.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(
                    text = section.title,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 29.sp,
                    letterSpacing = (-0.8).sp,
                )
                Text(
                    text = section.subtitle,
                    color = Color.White.copy(alpha = 0.46f),
                    fontFamily = Manrope,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
            Text(
                text = "试玩版设置 · 持久化将在下一阶段接入",
                color = Color.White.copy(alpha = 0.35f),
                fontFamily = Manrope,
                fontSize = 10.5.sp,
            )
        }

        Spacer(Modifier.height(24.dp))

        when (section) {
            SettingsSection.SOURCES -> SourcesSettings(onToast)
            SettingsSection.BROWSING -> BrowsingSettings(onToast)
            SettingsSection.PLAYBACK -> PlaybackSettings(onToast)
            SettingsSection.MUSIC -> MusicSettings(onToast)
            SettingsSection.APPEARANCE -> AppearanceSettings(onToast)
            SettingsSection.ABOUT -> AboutSettings()
        }
    }
}

@Composable
private fun SourcesSettings(onToast: (String) -> Unit) {
    SourceSection(
        title = "影视聚合源",
        badge = "0 / 3 已连接",
        description = "支持远程 URL、本地 JSON 两种配置入口；下一阶段会接入 CMS type 3/4 与 HTML 规则源。",
    ) {
        SourceActionRow(
            title = "添加远程配置",
            subtitle = "通过 HTTPS 订阅 JSON 配置",
            action = "导入",
            onClick = { onToast("远程配置导入将在下一阶段启用") },
        )
        SourceActionRow(
            title = "导入本地 JSON",
            subtitle = "从电视本地文件选择配置",
            action = "选择",
            onClick = { onToast("本地配置选择器将在下一阶段启用") },
        )
    }

    Spacer(Modifier.height(14.dp))

    SourceSection(
        title = "电视直播源",
        badge = "标准源",
        description = "仅接入标准 m3u / txt 播放列表，按分组、频道和同名线路整理。",
    ) {
        SourceActionRow(
            title = "直播源地址",
            subtitle = "支持 http / https / rtmp / rtsp",
            action = "管理",
            onClick = { onToast("直播源管理将在下一阶段启用") },
        )
    }

    Spacer(Modifier.height(14.dp))

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0x22FFBD62), RoundedCornerShape(18.dp))
            .border(1.dp, Color(0x55FFBD62), RoundedCornerShape(18.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = NovaIcons.Source,
            contentDescription = null,
            tint = Color(0xFFFFD087),
            modifier = Modifier.size(23.dp),
        )
        Text(
            text = "不包含虎牙 / 抖音房间号换取真实播放地址，也不内置平台专用防盗链逻辑。",
            color = Color.White.copy(alpha = 0.58f),
            fontFamily = Manrope,
            fontSize = 11.5.sp,
            lineHeight = 18.sp,
            modifier = Modifier.padding(start = 12.dp),
        )
    }
}

@Composable
private fun BrowsingSettings(onToast: (String) -> Unit) {
    SettingToggleGroup(
        toggles = listOf(
            "首页显示最近观看" to true,
            "首页显示热门内容" to true,
            "跨源聚合搜索结果" to true,
            "启动时刷新订阅源" to false,
        ),
        onToast = onToast,
    )
}

@Composable
private fun PlaybackSettings(onToast: (String) -> Unit) {
    SettingToggleGroup(
        toggles = listOf(
            "优先硬件解码" to true,
            "播放失败自动切换线路" to true,
            "记录续播位置" to true,
            "跳过片头片尾" to false,
        ),
        onToast = onToast,
    )
}

@Composable
private fun MusicSettings(onToast: (String) -> Unit) {
    SettingToggleGroup(
        toggles = listOf(
            "允许后台播放" to true,
            "耳机拔出自动暂停" to true,
            "优先无损音质" to false,
            "音乐继续播放时进入首页" to true,
        ),
        onToast = onToast,
    )
}

@Composable
private fun AppearanceSettings(onToast: (String) -> Unit) {
    SettingToggleGroup(
        toggles = listOf(
            "显示焦点白色描边" to true,
            "启用流体背景缓慢动画" to true,
            "保持 16:9 安全边距" to true,
            "使用高对比度字幕" to false,
        ),
        onToast = onToast,
    )
}

@Composable
private fun AboutSettings() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(480.dp)
            .background(
                Brush.linearGradient(listOf(Color(0x667D6CE8), Color(0x432B91B7))),
                RoundedCornerShape(25.dp),
            )
            .border(1.dp, Color.White.copy(alpha = 0.15f), RoundedCornerShape(25.dp))
            .padding(28.dp),
    ) {
        Column {
            Text(
                text = "NOVA TV",
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 40.sp,
                letterSpacing = 1.sp,
            )
            Text(
                text = "智能电视影视聚合平台 · 原生 Android TV 试玩版",
                color = Color.White.copy(alpha = 0.58f),
                fontFamily = Manrope,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
            Spacer(Modifier.height(28.dp))
            listOf(
                "UI：Jetpack Compose · 1920×1080 逻辑画布",
                "播放：AndroidX Media3 / ExoPlayer",
                "计划数据层：Room · DataStore · OkHttp · Jsoup",
                "最低系统：Android 6.0 (API 23)",
            ).forEach { line ->
                Text(
                    text = line,
                    color = Color.White.copy(alpha = 0.54f),
                    fontFamily = Manrope,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 9.dp),
                )
            }
        }
        Text(
            text = "本轮源码可试用，不交付 APK。",
            color = Color.White.copy(alpha = 0.36f),
            fontFamily = Manrope,
            fontSize = 10.5.sp,
            modifier = Modifier.align(Alignment.BottomStart),
        )
    }
}

@Composable
private fun SettingToggleGroup(
    toggles: List<Pair<String, Boolean>>,
    onToast: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        toggles.forEach { (label, initial) ->
            var enabled by remember(label) { mutableStateOf(initial) }
            SettingToggle(
                label = label,
                enabled = enabled,
                onClick = {
                    enabled = !enabled
                    onToast("$label：${if (enabled) "已开启" else "已关闭"}")
                },
            )
        }
    }
}

@Composable
private fun SettingToggle(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(70.dp),
        shape = RoundedCornerShape(18.dp),
        focusedScale = 1.012f,
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.11f else 0.045f), RoundedCornerShape(18.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.09f),
                    RoundedCornerShape(18.dp),
                )
                .padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                color = NovaWhite.copy(alpha = 0.78f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .width(46.dp)
                    .height(26.dp)
                    .background(
                        if (enabled) NovaMint.copy(alpha = 0.80f) else Color.White.copy(alpha = 0.14f),
                        CircleShape,
                    ),
            ) {
                Box(
                    modifier = Modifier
                        .padding(3.dp)
                        .size(20.dp)
                        .align(if (enabled) Alignment.CenterEnd else Alignment.CenterStart)
                        .background(Color.White, CircleShape),
                )
            }
        }
    }
}

@Composable
private fun SourceSection(
    title: String,
    badge: String,
    description: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.045f), RoundedCornerShape(22.dp))
            .border(1.dp, Color.White.copy(alpha = 0.09f), RoundedCornerShape(22.dp))
            .padding(18.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = title,
                color = NovaWhite.copy(alpha = 0.88f),
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
            )
            Text(
                text = badge,
                color = Color.White.copy(alpha = 0.46f),
                fontFamily = Manrope,
                fontSize = 10.sp,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.06f), RoundedCornerShape(9.dp))
                    .padding(horizontal = 9.dp, vertical = 5.dp),
            )
        }
        Text(
            text = description,
            color = Color.White.copy(alpha = 0.43f),
            fontFamily = Manrope,
            fontSize = 11.sp,
            lineHeight = 17.sp,
            modifier = Modifier.padding(top = 7.dp, bottom = 12.dp),
        )
        content()
    }
}

@Composable
private fun SourceActionRow(
    title: String,
    subtitle: String,
    action: String,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(58.dp),
        shape = RoundedCornerShape(15.dp),
        focusedScale = 1.01f,
        onClick = onClick,
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = if (focused) 0.11f else 0.035f), RoundedCornerShape(15.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.08f),
                    RoundedCornerShape(15.dp),
                )
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = NovaWhite.copy(alpha = 0.78f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.5.sp,
                )
                Text(
                    text = subtitle,
                    color = Color.White.copy(alpha = 0.38f),
                    fontFamily = Manrope,
                    fontSize = 10.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
            Text(
                text = action,
                color = NovaWhite.copy(alpha = 0.58f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 10.5.sp,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.065f), RoundedCornerShape(9.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            )
        }
    }
    Spacer(Modifier.height(8.dp))
}
