package com.novatv.app.ui.home

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.R
import com.novatv.app.data.ChineseLunarDate
import com.novatv.app.data.DemoCatalog
import com.novatv.app.data.FeatureCardData
import com.novatv.app.data.FeatureTarget
import com.novatv.app.data.MediaItem
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaGlassPanel
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaAmber
import com.novatv.app.ui.theme.NovaAmberDeep
import com.novatv.app.ui.theme.NovaCoral
import com.novatv.app.ui.theme.NovaCoralDeep
import com.novatv.app.ui.theme.NovaInkMuted
import com.novatv.app.ui.theme.NovaInkSoft
import com.novatv.app.ui.theme.NovaLibraryA
import com.novatv.app.ui.theme.NovaLibraryB
import com.novatv.app.ui.theme.NovaMint
import com.novatv.app.ui.theme.NovaMintDeep
import com.novatv.app.ui.theme.NovaSuccess
import com.novatv.app.ui.theme.NovaWhite
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private const val DESIGN_WIDTH = 1920f
private const val SAFE_X = 64f
private const val TOP_BAR_TOP = 40f
private const val CONTENT_TOP = 136f

private enum class HomeTarget {
    WIFI,
    SOURCE,
    NOTIFICATIONS,
    SETTINGS,
    SEARCH,
    FEATURE_LIVE,
    FEATURE_LIBRARY,
    FEATURE_MUSIC,
    FEATURE_SAVED,
    RECENT_ALL,
    RECENT_1,
    RECENT_2,
    RECENT_3,
    TRENDING_ALL,
    POSTER_1,
    POSTER_2,
    POSTER_3,
    POSTER_4,
    POSTER_5,
}

private enum class NavDirection {
    LEFT,
    RIGHT,
    UP,
    DOWN,
}

private data class NavTargets(
    val left: HomeTarget? = null,
    val right: HomeTarget? = null,
    val up: HomeTarget? = null,
    val down: HomeTarget? = null,
) {
    fun target(direction: NavDirection): HomeTarget? = when (direction) {
        NavDirection.LEFT -> left
        NavDirection.RIGHT -> right
        NavDirection.UP -> up
        NavDirection.DOWN -> down
    }
}

private val homeNavigation = mapOf(
    HomeTarget.WIFI to NavTargets(
        right = HomeTarget.SOURCE,
        down = HomeTarget.FEATURE_LIVE,
    ),
    HomeTarget.SOURCE to NavTargets(
        left = HomeTarget.WIFI,
        right = HomeTarget.NOTIFICATIONS,
        down = HomeTarget.FEATURE_LIBRARY,
    ),
    HomeTarget.NOTIFICATIONS to NavTargets(
        left = HomeTarget.SOURCE,
        right = HomeTarget.SETTINGS,
        down = HomeTarget.FEATURE_MUSIC,
    ),
    HomeTarget.SETTINGS to NavTargets(
        left = HomeTarget.NOTIFICATIONS,
        down = HomeTarget.SEARCH,
    ),
    HomeTarget.SEARCH to NavTargets(
        up = HomeTarget.SETTINGS,
        down = HomeTarget.FEATURE_SAVED,
    ),
    HomeTarget.FEATURE_LIVE to NavTargets(
        right = HomeTarget.FEATURE_LIBRARY,
        up = HomeTarget.SEARCH,
        down = HomeTarget.RECENT_1,
    ),
    HomeTarget.FEATURE_LIBRARY to NavTargets(
        left = HomeTarget.FEATURE_LIVE,
        right = HomeTarget.FEATURE_MUSIC,
        up = HomeTarget.SEARCH,
        down = HomeTarget.RECENT_2,
    ),
    HomeTarget.FEATURE_MUSIC to NavTargets(
        left = HomeTarget.FEATURE_LIBRARY,
        right = HomeTarget.FEATURE_SAVED,
        up = HomeTarget.SEARCH,
        down = HomeTarget.RECENT_3,
    ),
    HomeTarget.FEATURE_SAVED to NavTargets(
        left = HomeTarget.FEATURE_MUSIC,
        up = HomeTarget.SEARCH,
        down = HomeTarget.RECENT_ALL,
    ),
    HomeTarget.RECENT_ALL to NavTargets(
        left = HomeTarget.RECENT_3,
        up = HomeTarget.FEATURE_SAVED,
        down = HomeTarget.TRENDING_ALL,
    ),
    HomeTarget.RECENT_1 to NavTargets(
        right = HomeTarget.RECENT_2,
        up = HomeTarget.FEATURE_LIVE,
        down = HomeTarget.POSTER_1,
    ),
    HomeTarget.RECENT_2 to NavTargets(
        left = HomeTarget.RECENT_1,
        right = HomeTarget.RECENT_3,
        up = HomeTarget.FEATURE_LIBRARY,
        down = HomeTarget.POSTER_3,
    ),
    HomeTarget.RECENT_3 to NavTargets(
        left = HomeTarget.RECENT_2,
        right = HomeTarget.RECENT_ALL,
        up = HomeTarget.FEATURE_MUSIC,
        down = HomeTarget.POSTER_5,
    ),
    HomeTarget.TRENDING_ALL to NavTargets(
        up = HomeTarget.RECENT_ALL,
        down = HomeTarget.POSTER_5,
    ),
    HomeTarget.POSTER_1 to NavTargets(
        right = HomeTarget.POSTER_2,
        up = HomeTarget.RECENT_1,
    ),
    HomeTarget.POSTER_2 to NavTargets(
        left = HomeTarget.POSTER_1,
        right = HomeTarget.POSTER_3,
        up = HomeTarget.RECENT_1,
    ),
    HomeTarget.POSTER_3 to NavTargets(
        left = HomeTarget.POSTER_2,
        right = HomeTarget.POSTER_4,
        up = HomeTarget.RECENT_2,
    ),
    HomeTarget.POSTER_4 to NavTargets(
        left = HomeTarget.POSTER_3,
        right = HomeTarget.POSTER_5,
        up = HomeTarget.RECENT_2,
    ),
    HomeTarget.POSTER_5 to NavTargets(
        left = HomeTarget.POSTER_4,
        up = HomeTarget.TRENDING_ALL,
    ),
)

@Composable
fun HomeScreen(
    onOpenFeature: (FeatureTarget) -> Unit,
    onOpenSearch: () -> Unit,
    onOpenDetail: (MediaItem) -> Unit,
    onOpenSettings: () -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val requesters = remember {
        HomeTarget.values().associateWith { FocusRequester() }
    }
    var focusedTarget by remember { mutableStateOf(HomeTarget.FEATURE_LIVE) }
    var entered by remember { mutableStateOf(false) }

    fun request(target: HomeTarget) {
        runCatching { requesters.getValue(target).requestFocus() }
    }

    LaunchedEffect(Unit) {
        delay(80)
        entered = true
        delay(700)
        request(HomeTarget.FEATURE_LIVE)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false

                if (event.key == Key.Back) {
                    val backTarget = when (focusedTarget) {
                        HomeTarget.SEARCH -> HomeTarget.SETTINGS
                        HomeTarget.FEATURE_LIVE,
                        HomeTarget.FEATURE_LIBRARY,
                        HomeTarget.FEATURE_MUSIC,
                        HomeTarget.FEATURE_SAVED,
                        -> HomeTarget.SEARCH

                        HomeTarget.RECENT_ALL -> HomeTarget.FEATURE_SAVED
                        HomeTarget.RECENT_1 -> HomeTarget.FEATURE_LIVE
                        HomeTarget.RECENT_2 -> HomeTarget.FEATURE_LIBRARY
                        HomeTarget.RECENT_3 -> HomeTarget.FEATURE_MUSIC
                        HomeTarget.TRENDING_ALL -> HomeTarget.RECENT_ALL
                        HomeTarget.POSTER_1, HomeTarget.POSTER_2 -> HomeTarget.RECENT_1
                        HomeTarget.POSTER_3, HomeTarget.POSTER_4 -> HomeTarget.RECENT_2
                        HomeTarget.POSTER_5 -> HomeTarget.RECENT_3
                        HomeTarget.WIFI,
                        HomeTarget.SOURCE,
                        HomeTarget.NOTIFICATIONS,
                        HomeTarget.SETTINGS,
                        -> null
                    }
                    if (backTarget != null) {
                        request(backTarget)
                    } else {
                        onToast("已在 NOVA TV 首页")
                    }
                    return@onPreviewKeyEvent true
                }

                val direction = when (event.key) {
                    Key.DirectionLeft -> NavDirection.LEFT
                    Key.DirectionRight -> NavDirection.RIGHT
                    Key.DirectionUp -> NavDirection.UP
                    Key.DirectionDown -> NavDirection.DOWN
                    else -> return@onPreviewKeyEvent false
                }
                homeNavigation[focusedTarget]?.target(direction)?.let(::request)
                true
            },
    ) {
        NovaTopBar(
            enteredAlpha = enterAlpha(40),
            requesters = requesters,
            focusedTarget = focusedTarget,
            onFocused = { focusedTarget = it },
            onNetwork = { onToast("Wi-Fi 已连接 · 网络状态良好") },
            onSources = onOpenSettings,
            onNotifications = { onToast("2 条提醒 · 内容源同步完成，片库已更新") },
            onSettings = onOpenSettings,
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = SAFE_X.dp, top = CONTENT_TOP.dp),
        ) {
            HeroRow(
                enteredAlpha = enterAlpha(70),
                searchRequester = requesters.getValue(HomeTarget.SEARCH),
                onSearchFocused = { focusedTarget = HomeTarget.SEARCH },
                onSearch = onOpenSearch,
            )

            Spacer(Modifier.height(18.dp))

            FeatureRow(
                enteredAlpha = enterAlpha(135),
                requesters = requesters,
                focusedTarget = focusedTarget,
                onFocused = { focusedTarget = it },
                onOpenFeature = onOpenFeature,
            )

            Spacer(Modifier.height(26.dp))

            RecentSection(
                enteredAlpha = enterAlpha(365),
                requesters = requesters,
                focusedTarget = focusedTarget,
                onFocused = { focusedTarget = it },
                onViewAll = { onOpenFeature(FeatureTarget.SAVED) },
                onOpenDetail = onOpenDetail,
            )

            Spacer(Modifier.height(22.dp))

            TrendingSection(
                enteredAlpha = enterAlpha(430),
                requesters = requesters,
                focusedTarget = focusedTarget,
                onFocused = { focusedTarget = it },
                onViewAll = { onOpenFeature(FeatureTarget.LIBRARY) },
                onOpenDetail = onOpenDetail,
            )
        }
    }
}

@Composable
private fun enterAlpha(delayMillis: Int): Float {
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(40)
        started = true
    }
    val alpha by animateFloatAsState(
        targetValue = if (started) 1f else 0f,
        animationSpec = tween(durationMillis = 620, delayMillis = delayMillis),
        label = "section-entry-$delayMillis",
    )
    return alpha
}

private fun Modifier.entryLayer(alpha: Float): Modifier = graphicsLayer {
    this.alpha = alpha
    translationY = (1f - alpha) * 18.dp.toPx()
}

@Composable
private fun NovaTopBar(
    enteredAlpha: Float,
    requesters: Map<HomeTarget, FocusRequester>,
    focusedTarget: HomeTarget,
    onFocused: (HomeTarget) -> Unit,
    onNetwork: () -> Unit,
    onSources: () -> Unit,
    onNotifications: () -> Unit,
    onSettings: () -> Unit,
) {
    Row(
        modifier = Modifier
            .padding(start = SAFE_X.dp, top = TOP_BAR_TOP.dp)
            .width((DESIGN_WIDTH - SAFE_X * 2).dp)
            .height(64.dp)
            .entryLayer(enteredAlpha),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(17.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Color(0xFF9B80F5), Color(0xFF596CE5), Color(0xFF2F8ADF)),
                        ),
                    )
                    .border(1.dp, Color.White.copy(alpha = 0.52f), RoundedCornerShape(17.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Image(
                    painter = painterResource(R.drawable.nova_mark),
                    contentDescription = null,
                    modifier = Modifier.size(38.dp),
                )
            }
            Column(
                modifier = Modifier
                    .padding(start = 15.dp)
                    .width(320.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "NOVA",
                        color = NovaWhite,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 29.sp,
                        letterSpacing = 0.8.sp,
                    )
                    Text(
                        text = " TV",
                        color = Color.White.copy(alpha = 0.92f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Medium,
                        fontSize = 29.sp,
                        letterSpacing = 1.5.sp,
                    )
                }
                Text(
                    text = "电影 · 电视直播 · 全网聚合",
                    color = Color.White.copy(alpha = 0.62f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.5.sp,
                    letterSpacing = 1.1.sp,
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatusButton(
                icon = NovaIcons.Wifi,
                label = "Wi-Fi 已连接",
                target = HomeTarget.WIFI,
                focusedTarget = focusedTarget,
                requester = requesters.getValue(HomeTarget.WIFI),
                onFocused = onFocused,
                onClick = onNetwork,
                online = true,
            )
            StatusButton(
                icon = NovaIcons.Source,
                label = "内容源状态",
                target = HomeTarget.SOURCE,
                focusedTarget = focusedTarget,
                requester = requesters.getValue(HomeTarget.SOURCE),
                onFocused = onFocused,
                onClick = onSources,
                online = true,
            )
            StatusButton(
                icon = NovaIcons.Notifications,
                label = "消息通知",
                target = HomeTarget.NOTIFICATIONS,
                focusedTarget = focusedTarget,
                requester = requesters.getValue(HomeTarget.NOTIFICATIONS),
                onFocused = onFocused,
                onClick = onNotifications,
                alert = true,
            )
            StatusButton(
                icon = NovaIcons.Settings,
                label = "设置",
                target = HomeTarget.SETTINGS,
                focusedTarget = focusedTarget,
                requester = requesters.getValue(HomeTarget.SETTINGS),
                onFocused = onFocused,
                onClick = onSettings,
                transformOrigin = TransformOrigin(1f, 0.5f),
            )
        }
    }
}

@Composable
private fun StatusButton(
    icon: ImageVector,
    label: String,
    target: HomeTarget,
    focusedTarget: HomeTarget,
    requester: FocusRequester,
    onFocused: (HomeTarget) -> Unit,
    onClick: () -> Unit,
    online: Boolean = false,
    alert: Boolean = false,
    transformOrigin: TransformOrigin = TransformOrigin.Center,
) {
    NovaFocusable(
        modifier = Modifier.size(46.dp),
        shape = RoundedCornerShape(15.dp),
        focusRequester = requester,
        focusedScale = 1.08f,
        transformOrigin = transformOrigin,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused(target) },
    ) { focused ->
        Box(
            modifier = Modifier
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.White.copy(alpha = if (focused) 0.22f else 0.14f),
                            Color.White.copy(alpha = 0.05f),
                        ),
                    ),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.18f),
                    RoundedCornerShape(15.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = NovaWhite.copy(alpha = 0.94f),
                modifier = Modifier.size(22.dp),
            )
            if (online) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(7.dp)
                        .size(6.dp)
                        .background(NovaSuccess, CircleShape)
                        .border(1.dp, Color(0xFF3353A0), CircleShape),
                )
            }
            if (alert) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(7.dp)
                        .background(Color(0xFFFF5D6C), CircleShape)
                        .border(1.dp, Color(0xFF766DBE), CircleShape),
                )
            }
        }
    }
}

@Composable
private fun HeroRow(
    enteredAlpha: Float,
    searchRequester: FocusRequester,
    onSearchFocused: () -> Unit,
    onSearch: () -> Unit,
) {
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) {
        while (isActive) {
            delay(1000)
            now = Date()
        }
    }

    val calendar = remember(now) {
        Calendar.getInstance().apply { time = now }
    }
    val timeText = remember(now) {
        SimpleDateFormat("HH:mm", Locale.SIMPLIFIED_CHINESE).format(now)
    }
    val dateText = remember(now) {
        "${calendar.get(Calendar.MONTH) + 1}月${calendar.get(Calendar.DAY_OF_MONTH)}日"
    }
    val weekdayText = remember(now) {
        val weekdays = arrayOf("星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六")
        weekdays[calendar.get(Calendar.DAY_OF_WEEK) - 1]
    }
    val lunarText = remember(
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.DAY_OF_YEAR),
    ) {
        ChineseLunarDate.label(now)
    }

    Row(
        modifier = Modifier
            .width((DESIGN_WIDTH - SAFE_X * 2).dp)
            .height(168.dp)
            .entryLayer(enteredAlpha),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.width(600.dp)) {
            Text(
                text = timeText,
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 96.sp,
                lineHeight = 86.sp,
                letterSpacing = (-4.8).sp,
            )
            Row(
                modifier = Modifier.padding(top = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = dateText,
                    color = Color.White.copy(alpha = 0.82f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 20.sp,
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 10.dp)
                        .size(3.dp)
                        .background(Color.White.copy(alpha = 0.55f), CircleShape),
                )
                Text(
                    text = weekdayText,
                    color = Color.White.copy(alpha = 0.82f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 20.sp,
                )
                Text(
                    text = lunarText,
                    color = Color.White.copy(alpha = 0.55f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Normal,
                    fontSize = 15.sp,
                    letterSpacing = 0.4.sp,
                    modifier = Modifier.padding(start = 13.dp),
                )
            }
            Row(
                modifier = Modifier.padding(top = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(33.dp)
                        .background(Color.White.copy(alpha = 0.10f), RoundedCornerShape(11.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.14f), RoundedCornerShape(11.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = NovaIcons.Cloud,
                        contentDescription = "多云",
                        tint = Color(0xFFFFF3D1),
                        modifier = Modifier.size(22.dp),
                    )
                }
                Text(
                    text = "17°",
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    modifier = Modifier.padding(start = 10.dp),
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 11.dp)
                        .height(16.dp)
                        .width(1.dp)
                        .background(Color.White.copy(alpha = 0.23f)),
                )
                Text(
                    text = "安庆",
                    color = Color.White.copy(alpha = 0.84f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 18.sp,
                )
                Text(
                    text = "多云",
                    color = Color.White.copy(alpha = 0.84f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 18.sp,
                    modifier = Modifier.padding(start = 14.dp),
                )
                Text(
                    text = "19° / 15°",
                    color = Color.White.copy(alpha = 0.64f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(start = 18.dp),
                )
            }
        }

        SearchBar(
            requester = searchRequester,
            onFocused = onSearchFocused,
            onClick = onSearch,
        )
    }
}

@Composable
private fun SearchBar(
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .width(1018.dp)
            .height(76.dp),
        shape = RoundedCornerShape(24.dp),
        focusRequester = requester,
        focusedScale = 1.018f,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.linearGradient(
                        listOf(
                            Color(0x66305CC2),
                            Color(0x3D5D5BC6),
                            Color(0x455A92CE),
                        ),
                    ),
                )
                .background(Color.White.copy(alpha = 0.055f))
                .border(
                    width = if (focused) 2.dp else 1.dp,
                    color = if (focused) NovaWhite else Color.White.copy(alpha = 0.31f),
                    shape = RoundedCornerShape(24.dp),
                )
                .padding(horizontal = 22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .background(Color.White.copy(alpha = 0.11f), RoundedCornerShape(14.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = NovaIcons.Search,
                    contentDescription = null,
                    tint = NovaWhite,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                text = "搜索电影、剧集、演员、频道...",
                color = Color.White.copy(alpha = 0.66f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 18.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 16.dp),
            )
            Text(
                text = "搜索",
                color = Color.White.copy(alpha = if (focused) 0.95f else 0.58f),
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                letterSpacing = 0.8.sp,
            )
        }
    }
}

@Composable
private fun FeatureRow(
    enteredAlpha: Float,
    requesters: Map<HomeTarget, FocusRequester>,
    focusedTarget: HomeTarget,
    onFocused: (HomeTarget) -> Unit,
    onOpenFeature: (FeatureTarget) -> Unit,
) {
    val targetByFeature = mapOf(
        FeatureTarget.LIVE to HomeTarget.FEATURE_LIVE,
        FeatureTarget.LIBRARY to HomeTarget.FEATURE_LIBRARY,
        FeatureTarget.MUSIC to HomeTarget.FEATURE_MUSIC,
        FeatureTarget.SAVED to HomeTarget.FEATURE_SAVED,
    )
    val gradientByFeature = mapOf(
        FeatureTarget.LIVE to listOf(NovaCoral, NovaCoralDeep),
        FeatureTarget.LIBRARY to listOf(NovaLibraryA, NovaLibraryB),
        FeatureTarget.MUSIC to listOf(NovaMint, NovaMintDeep),
        FeatureTarget.SAVED to listOf(NovaAmber, NovaAmberDeep),
    )
    val iconByFeature = mapOf(
        FeatureTarget.LIVE to NovaIcons.LiveTv,
        FeatureTarget.LIBRARY to NovaIcons.Movie,
        FeatureTarget.MUSIC to NovaIcons.Music,
        FeatureTarget.SAVED to NovaIcons.Bookmark,
    )

    Row(
        modifier = Modifier
            .width((DESIGN_WIDTH - SAFE_X * 2).dp)
            .height(150.dp)
            .entryLayer(enteredAlpha),
        horizontalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        DemoCatalog.features.forEachIndexed { index, feature ->
            val target = targetByFeature.getValue(feature.target)
            val origin = when (index) {
                0 -> TransformOrigin(0f, 0.5f)
                3 -> TransformOrigin(1f, 0.5f)
                else -> TransformOrigin.Center
            }
            FeatureCard(
                feature = feature,
                icon = iconByFeature.getValue(feature.target),
                colors = gradientByFeature.getValue(feature.target),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                requester = requesters.getValue(target),
                focused = focusedTarget == target,
                transformOrigin = origin,
                onFocused = { onFocused(target) },
                onClick = { onOpenFeature(feature.target) },
            )
        }
    }
}

@Composable
private fun FeatureCard(
    feature: FeatureCardData,
    icon: ImageVector,
    colors: List<Color>,
    modifier: Modifier,
    requester: FocusRequester,
    focused: Boolean,
    transformOrigin: TransformOrigin,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier,
        shape = RoundedCornerShape(28.dp),
        focusRequester = requester,
        focusedScale = 1.032f,
        transformOrigin = transformOrigin,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { isFocused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(colors))
                .border(
                    if (isFocused) 2.dp else 1.dp,
                    if (isFocused) NovaWhite else Color.White.copy(alpha = 0.25f),
                    RoundedCornerShape(28.dp),
                ),
        ) {
            Canvas(Modifier.fillMaxSize()) {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(Color.White.copy(alpha = 0.23f), Color.Transparent),
                        center = androidx.compose.ui.geometry.Offset(size.width * 0.9f, size.height * 0.1f),
                        radius = size.width * 0.45f,
                    ),
                    radius = size.width * 0.45f,
                    center = androidx.compose.ui.geometry.Offset(size.width * 0.9f, size.height * 0.1f),
                )
                drawRect(
                    brush = Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.08f), Color.Transparent),
                    ),
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 24.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(16.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = NovaWhite,
                        modifier = Modifier.size(27.dp),
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = 16.dp),
                ) {
                    Text(
                        text = feature.title,
                        color = NovaWhite,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Bold,
                        fontSize = 21.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = feature.description,
                        color = Color.White.copy(alpha = 0.80f),
                        fontFamily = Manrope,
                        fontWeight = FontWeight.Medium,
                        fontSize = 12.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
                Icon(
                    imageVector = NovaIcons.ArrowForward,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = if (isFocused) 1f else 0.55f),
                    modifier = Modifier
                        .size(21.dp)
                        .graphicsLayer { translationX = if (isFocused) 4.dp.toPx() else 0f },
                )
            }
        }
    }
}

@Composable
private fun RecentSection(
    enteredAlpha: Float,
    requesters: Map<HomeTarget, FocusRequester>,
    focusedTarget: HomeTarget,
    onFocused: (HomeTarget) -> Unit,
    onViewAll: () -> Unit,
    onOpenDetail: (MediaItem) -> Unit,
) {
    NovaGlassPanel(
        modifier = Modifier
            .width((DESIGN_WIDTH - SAFE_X * 2).dp)
            .height(224.dp)
            .entryLayer(enteredAlpha),
        shape = RoundedCornerShape(30.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 22.dp, end = 22.dp, top = 17.dp, bottom = 20.dp),
        ) {
            SectionHeader(
                title = "最近观看",
                icon = NovaIcons.Clock,
                linkText = "查看全部",
                requester = requesters.getValue(HomeTarget.RECENT_ALL),
                onFocused = { onFocused(HomeTarget.RECENT_ALL) },
                onLink = onViewAll,
            )
            Spacer(Modifier.height(9.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(138.dp),
                horizontalArrangement = Arrangement.spacedBy(22.dp),
            ) {
                DemoCatalog.recent.forEachIndexed { index, item ->
                    val target = when (index) {
                        0 -> HomeTarget.RECENT_1
                        1 -> HomeTarget.RECENT_2
                        else -> HomeTarget.RECENT_3
                    }
                    val origin = when (index) {
                        0 -> TransformOrigin(0f, 0.5f)
                        2 -> TransformOrigin(1f, 0.5f)
                        else -> TransformOrigin.Center
                    }
                    RecentCard(
                        item = item,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight(),
                        requester = requesters.getValue(target),
                        focused = focusedTarget == target,
                        transformOrigin = origin,
                        onFocused = { onFocused(target) },
                        onClick = { onOpenDetail(item) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    icon: ImageVector,
    linkText: String,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onLink: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(36.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(31.dp)
                    .background(Color.White.copy(alpha = 0.10f), RoundedCornerShape(10.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(10.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = NovaWhite.copy(alpha = 0.92f),
                    modifier = Modifier.size(19.dp),
                )
            }
            Text(
                text = title,
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.SemiBold,
                fontSize = 22.sp,
                letterSpacing = (-0.4).sp,
                modifier = Modifier.padding(start = 11.dp),
            )
        }
        SectionLink(
            text = linkText,
            requester = requester,
            onFocused = onFocused,
            onClick = onLink,
        )
    }
}

@Composable
private fun SectionLink(
    text: String,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier.height(34.dp),
        shape = RoundedCornerShape(11.dp),
        focusRequester = requester,
        focusedScale = 1.045f,
        transformOrigin = TransformOrigin(1f, 0.5f),
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .background(Color.White.copy(alpha = if (focused) 0.17f else 0.02f), RoundedCornerShape(11.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.Transparent,
                    RoundedCornerShape(11.dp),
                )
                .padding(start = 12.dp, end = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = text,
                color = Color.White.copy(alpha = if (focused) 1f else 0.60f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
            )
            Icon(
                imageVector = NovaIcons.ArrowForward,
                contentDescription = null,
                tint = Color.White.copy(alpha = if (focused) 1f else 0.60f),
                modifier = Modifier
                    .padding(start = 8.dp)
                    .size(18.dp),
            )
        }
    }
}

@Composable
private fun RecentCard(
    item: MediaItem,
    modifier: Modifier,
    requester: FocusRequester,
    focused: Boolean,
    transformOrigin: TransformOrigin,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        focusRequester = requester,
        focusedScale = 1.018f,
        transformOrigin = transformOrigin,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { isFocused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    if (isFocused) Color(0x6B203476) else Color(0x4015265C),
                    RoundedCornerShape(20.dp),
                )
                .border(
                    if (isFocused) 2.dp else 1.dp,
                    if (isFocused) NovaWhite else Color.White.copy(alpha = 0.13f),
                    RoundedCornerShape(20.dp),
                ),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.42f),
            ) {
                Image(
                    painter = painterResource(item.imageRes),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = if (isFocused) 1.045f else 1f
                            scaleY = if (isFocused) 1.045f else 1f
                        },
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color.Transparent, Color(0x681C275E)),
                            ),
                        ),
                )
            }
            Column(
                modifier = Modifier
                    .weight(0.58f)
                    .fillMaxHeight()
                    .padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 12.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = item.badge.orEmpty(),
                    color = Color.White.copy(alpha = 0.55f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.5.sp,
                    letterSpacing = 0.4.sp,
                    maxLines = 1,
                )
                Text(
                    text = item.title,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 5.dp),
                )
                Text(
                    text = item.progressLabel.orEmpty(),
                    color = Color.White.copy(alpha = 0.63f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 13.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(top = 7.dp),
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 9.dp)
                        .height(5.dp)
                        .background(Color.White.copy(alpha = 0.15f), RoundedCornerShape(50)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(item.progress)
                            .fillMaxHeight()
                            .background(
                                Brush.horizontalGradient(listOf(Color(0xFFEFF4FF), Color(0xFFFFD8EA))),
                                RoundedCornerShape(50),
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun TrendingSection(
    enteredAlpha: Float,
    requesters: Map<HomeTarget, FocusRequester>,
    focusedTarget: HomeTarget,
    onFocused: (HomeTarget) -> Unit,
    onViewAll: () -> Unit,
    onOpenDetail: (MediaItem) -> Unit,
) {
    NovaGlassPanel(
        modifier = Modifier
            .width((DESIGN_WIDTH - SAFE_X * 2).dp)
            .height(270.dp)
            .entryLayer(enteredAlpha),
        shape = RoundedCornerShape(30.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 22.dp, end = 22.dp, top = 14.dp, bottom = 18.dp),
        ) {
            SectionHeader(
                title = "热门内容",
                icon = NovaIcons.Flame,
                linkText = "",
                requester = requesters.getValue(HomeTarget.TRENDING_ALL),
                onFocused = { onFocused(HomeTarget.TRENDING_ALL) },
                onLink = onViewAll,
            )
            Spacer(Modifier.height(9.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(190.dp),
                horizontalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                DemoCatalog.trending.forEachIndexed { index, item ->
                    val target = HomeTarget.values()[HomeTarget.POSTER_1.ordinal + index]
                    val origin = when (index) {
                        0 -> TransformOrigin(0f, 0.5f)
                        4 -> TransformOrigin(1f, 0.5f)
                        else -> TransformOrigin.Center
                    }
                    PosterCard(
                        item = item,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight(),
                        requester = requesters.getValue(target),
                        focused = focusedTarget == target,
                        transformOrigin = origin,
                        onFocused = { onFocused(target) },
                        onClick = { onOpenDetail(item) },
                    )
                }
            }
        }
    }
}

@Composable
private fun PosterCard(
    item: MediaItem,
    modifier: Modifier,
    requester: FocusRequester,
    focused: Boolean,
    transformOrigin: TransformOrigin,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        focusRequester = requester,
        focusedScale = 1.025f,
        transformOrigin = transformOrigin,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { isFocused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0x57162252), RoundedCornerShape(20.dp))
                .border(
                    if (isFocused) 2.dp else 1.dp,
                    if (isFocused) NovaWhite else Color.White.copy(alpha = 0.16f),
                    RoundedCornerShape(20.dp),
                ),
        ) {
            Image(
                painter = painterResource(item.imageRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = if (isFocused) 1.055f else 1f
                        scaleY = if (isFocused) 1.055f else 1f
                    },
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0f to Color(0x16111439),
                                0.40f to Color.Transparent,
                                0.68f to Color(0x38101336),
                                1f to Color(0xE60C102A),
                            ),
                        ),
                    ),
            )
            Text(
                text = item.badge.orEmpty(),
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                letterSpacing = 0.5.sp,
                modifier = Modifier.padding(start = 14.dp, top = 12.dp),
            )
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .padding(start = 14.dp, end = 14.dp, bottom = 12.dp),
            ) {
                Text(
                    text = item.title,
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 17.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = when (item.id) {
                        "dune" -> "科幻史诗"
                        "joker" -> "犯罪剧情"
                        "avengers" -> "超级英雄"
                        "lostyou" -> "东方古装"
                        else -> "青春动画"
                    },
                    color = Color.White.copy(alpha = 0.58f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.5.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .height(2.dp)
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color.Transparent, Color.White.copy(alpha = 0.42f), Color.Transparent),
                        ),
                    ),
            )
        }
    }
}
