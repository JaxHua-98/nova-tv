package com.novatv.app.ui.music

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.data.MusicCatalog
import com.novatv.app.data.MusicTrack
import com.novatv.app.playback.MusicControllerState
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaGlassPanel
import com.novatv.app.ui.components.NovaIconButton
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaMint
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private enum class MusicTarget {
    BACK,
    PREVIOUS,
    PLAY_PAUSE,
    NEXT,
    SOURCE,
    TRACK_1,
    TRACK_2,
    TRACK_3,
    TRACK_4,
}

@Composable
fun MusicScreen(
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onToast: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val controller = remember(context) { MusicControllerState(context.applicationContext) }
    val requesters = remember {
        MusicTarget.values().associateWith { FocusRequester() }
    }
    var focusedTarget by remember { mutableStateOf(MusicTarget.PLAY_PAUSE) }
    var entered by remember { mutableStateOf(false) }

    fun request(target: MusicTarget) {
        runCatching { requesters.getValue(target).requestFocus() }
    }

    LaunchedEffect(Unit) {
        entered = true
        delay(180)
        request(MusicTarget.PLAY_PAUSE)
    }

    LaunchedEffect(controller.connected) {
        while (isActive && controller.connected) {
            delay(500)
            controller.syncPosition()
        }
    }

    DisposableEffect(controller) {
        onDispose { controller.release() }
    }

    BackHandler(onBack = onBack)

    Box(
        modifier = modifier
            .fillMaxSize()
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                val target = when (focusedTarget) {
                    MusicTarget.BACK -> when (event.key) {
                        Key.DirectionDown -> MusicTarget.PLAY_PAUSE
                        else -> null
                    }

                    MusicTarget.PREVIOUS -> when (event.key) {
                        Key.DirectionRight -> MusicTarget.PLAY_PAUSE
                        Key.DirectionUp -> MusicTarget.BACK
                        Key.DirectionDown -> MusicTarget.TRACK_1
                        else -> null
                    }

                    MusicTarget.PLAY_PAUSE -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.PREVIOUS
                        Key.DirectionRight -> MusicTarget.NEXT
                        Key.DirectionUp -> MusicTarget.BACK
                        Key.DirectionDown -> MusicTarget.TRACK_1
                        else -> null
                    }

                    MusicTarget.NEXT -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.PLAY_PAUSE
                        Key.DirectionUp -> MusicTarget.BACK
                        Key.DirectionDown -> MusicTarget.TRACK_2
                        else -> null
                    }

                    MusicTarget.SOURCE -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.BACK
                        Key.DirectionDown -> MusicTarget.TRACK_1
                        else -> null
                    }

                    MusicTarget.TRACK_1 -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.PLAY_PAUSE
                        Key.DirectionUp -> MusicTarget.PLAY_PAUSE
                        Key.DirectionDown -> MusicTarget.TRACK_2
                        Key.DirectionRight -> return@onPreviewKeyEvent true
                        else -> null
                    }

                    MusicTarget.TRACK_2 -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.PLAY_PAUSE
                        Key.DirectionUp -> MusicTarget.TRACK_1
                        Key.DirectionDown -> MusicTarget.TRACK_3
                        Key.DirectionRight -> return@onPreviewKeyEvent true
                        else -> null
                    }

                    MusicTarget.TRACK_3 -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.PLAY_PAUSE
                        Key.DirectionUp -> MusicTarget.TRACK_2
                        Key.DirectionDown -> MusicTarget.TRACK_4
                        Key.DirectionRight -> return@onPreviewKeyEvent true
                        else -> null
                    }

                    MusicTarget.TRACK_4 -> when (event.key) {
                        Key.DirectionLeft -> MusicTarget.PLAY_PAUSE
                        Key.DirectionUp -> MusicTarget.TRACK_3
                        Key.DirectionRight -> return@onPreviewKeyEvent true
                        else -> null
                    }
                } ?: return@onPreviewKeyEvent false
                request(target)
                true
            },
    ) {
        val enterAlpha by animateFloatAsState(
            targetValue = if (entered) 1f else 0f,
            animationSpec = tween(520),
            label = "music-entry",
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 64.dp, top = 40.dp, end = 64.dp)
                .height(56.dp)
                .graphicsLayer {
                    alpha = enterAlpha
                    translationY = (1f - enterAlpha) * 14.dp.toPx()
                },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            NovaIconButton(
                icon = NovaIcons.ArrowBack,
                contentDescription = "返回首页",
                focusRequester = requesters.getValue(MusicTarget.BACK),
                onFocusChanged = { if (it) focusedTarget = MusicTarget.BACK },
                onClick = onBack,
            )
            Column(modifier = Modifier.padding(start = 16.dp)) {
                Text(
                    text = "NOVA MUSIC",
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 25.sp,
                    letterSpacing = 0.8.sp,
                )
                Text(
                    text = "本地音乐 · MV · 歌单 · 网络电台",
                    color = Color.White.copy(alpha = 0.55f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 11.sp,
                    letterSpacing = 0.9.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Spacer(Modifier.weight(1f))
            ConnectionBadge(
                connected = controller.connected,
                error = controller.errorMessage,
            )
            SourceButton(
                modifier = Modifier.padding(start = 14.dp),
                requester = requesters.getValue(MusicTarget.SOURCE),
                onFocused = { focusedTarget = MusicTarget.SOURCE },
                onClick = onOpenSettings,
            )
        }

        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 64.dp, top = 118.dp, end = 64.dp, bottom = 64.dp)
                .graphicsLayer {
                    alpha = enterAlpha
                    translationY = (1f - enterAlpha) * 20.dp.toPx()
                },
            horizontalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            NovaGlassPanel(
                modifier = Modifier
                    .width(720.dp)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                NowPlayingPanel(
                    controller = controller,
                    requesters = requesters,
                    onFocused = { focusedTarget = it },
                    onPrevious = controller::skipToPrevious,
                    onPlayPause = controller::togglePlayPause,
                    onNext = controller::skipToNext,
                )
            }

            NovaGlassPanel(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                shape = RoundedCornerShape(32.dp),
            ) {
                MusicQueuePanel(
                    currentIndex = controller.currentIndex,
                    queueSize = controller.queueSize,
                    requesters = requesters,
                    onFocused = { focusedTarget = it },
                    onTrackClick = { index ->
                        if (!controller.connected) {
                            onToast("音乐服务正在连接，请稍后重试")
                            return@MusicQueuePanel
                        }
                        controller.playIndex(index)
                        onToast("正在播放：${MusicCatalog.trackAt(index).title}")
                    },
                )
            }
        }
    }
}

@Composable
private fun NowPlayingPanel(
    controller: MusicControllerState,
    requesters: Map<MusicTarget, FocusRequester>,
    onFocused: (MusicTarget) -> Unit,
    onPrevious: () -> Unit,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(362.dp)
                .clip(RoundedCornerShape(26.dp)),
        ) {
            Image(
                painter = painterResource(controller.currentTrack.artworkRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0x10101840), Color(0xA80C173A)),
                        ),
                    ),
            )
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(18.dp)
                    .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(11.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.20f), RoundedCornerShape(11.dp))
                    .padding(horizontal = 12.dp, vertical = 7.dp),
            ) {
                Text(
                    text = "NOW PLAYING",
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    letterSpacing = 1.2.sp,
                )
            }
            Text(
                text = if (controller.isPlaying) "正在播放" else "已暂停",
                color = NovaWhite.copy(alpha = 0.75f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(18.dp)
                    .background(Color.Black.copy(alpha = 0.24f), RoundedCornerShape(10.dp))
                    .padding(horizontal = 11.dp, vertical = 7.dp),
            )
        }

        Text(
            text = controller.currentTrack.title,
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.Bold,
            fontSize = 31.sp,
            letterSpacing = (-1.1).sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp),
        )
        Text(
            text = controller.currentTrack.artist,
            color = Color.White.copy(alpha = 0.54f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 6.dp),
        )

        val progress = if (controller.durationMs > 0) {
            (controller.positionMs.toFloat() / controller.durationMs).coerceIn(0f, 1f)
        } else {
            0f
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp)
                .height(6.dp)
                .background(Color.White.copy(alpha = 0.14f), RoundedCornerShape(50)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(progress)
                    .fillMaxHeight()
                    .background(
                        Brush.horizontalGradient(listOf(NovaMint, Color(0xFFEAF8FF))),
                        RoundedCornerShape(50),
                    ),
            )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = formatDuration(controller.positionMs),
                color = Color.White.copy(alpha = 0.45f),
                fontFamily = Manrope,
                fontSize = 11.sp,
            )
            Text(
                text = formatDuration(controller.durationMs),
                color = Color.White.copy(alpha = 0.45f),
                fontFamily = Manrope,
                fontSize = 11.sp,
            )
        }

        Row(
            modifier = Modifier.padding(top = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(19.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MusicControlButton(
                icon = NovaIcons.Previous,
                label = "上一首",
                size = 58,
                requester = requesters.getValue(MusicTarget.PREVIOUS),
                onFocused = { onFocused(MusicTarget.PREVIOUS) },
                onClick = onPrevious,
            )
            MusicControlButton(
                icon = if (controller.isPlaying) NovaIcons.Pause else NovaIcons.Play,
                label = if (controller.isPlaying) "暂停" else "播放",
                size = 76,
                primary = true,
                requester = requesters.getValue(MusicTarget.PLAY_PAUSE),
                onFocused = { onFocused(MusicTarget.PLAY_PAUSE) },
                onClick = onPlayPause,
            )
            MusicControlButton(
                icon = NovaIcons.Next,
                label = "下一首",
                size = 58,
                requester = requesters.getValue(MusicTarget.NEXT),
                onFocused = { onFocused(MusicTarget.NEXT) },
                onClick = onNext,
            )
        }
    }
}

@Composable
private fun MusicControlButton(
    icon: ImageVector,
    label: String,
    size: Int,
    primary: Boolean = false,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    val shape = CircleShape
    NovaFocusable(
        modifier = Modifier.size(size.dp),
        shape = shape,
        focusRequester = requester,
        focusedScale = 1.09f,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    if (primary) {
                        Brush.linearGradient(listOf(Color(0xFFF4F8FF), Color(0xFFDDE9FF)))
                    } else {
                        Brush.verticalGradient(
                            listOf(Color.White.copy(alpha = 0.16f), Color.White.copy(alpha = 0.07f)),
                        )
                    },
                    shape,
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = if (primary) 0.55f else 0.19f),
                    shape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (primary) Color(0xFF1B2A4D) else NovaWhite,
                modifier = Modifier.size((size * 0.43f).dp),
            )
        }
    }
}

@Composable
private fun MusicQueuePanel(
    currentIndex: Int,
    queueSize: Int,
    requesters: Map<MusicTarget, FocusRequester>,
    onFocused: (MusicTarget) -> Unit,
    onTrackClick: (Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(start = 30.dp, end = 30.dp, top = 30.dp, bottom = 26.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Text(
                    text = "为你推荐",
                    color = NovaWhite,
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Bold,
                    fontSize = 27.sp,
                    letterSpacing = (-0.7).sp,
                )
                Text(
                    text = "本地音乐 · M3U 电台 · JSON 音乐源",
                    color = Color.White.copy(alpha = 0.48f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
            Text(
                text = "播放队列 $queueSize",
                color = Color.White.copy(alpha = 0.46f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                modifier = Modifier
                    .background(Color.White.copy(alpha = 0.07f), RoundedCornerShape(11.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.11f), RoundedCornerShape(11.dp))
                    .padding(horizontal = 13.dp, vertical = 8.dp),
            )
        }

        Spacer(Modifier.height(23.dp))

        MusicCatalog.tracks.forEachIndexed { index, item ->
            val target = MusicTarget.values()[MusicTarget.TRACK_1.ordinal + index]
            QueueRow(
                item = item,
                active = index == currentIndex,
                requester = requesters.getValue(target),
                onFocused = { onFocused(target) },
                onClick = { onTrackClick(index) },
            )
            if (index < MusicCatalog.tracks.lastIndex) {
                Spacer(Modifier.height(10.dp))
            }
        }

        Spacer(Modifier.weight(1f))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.055f), RoundedCornerShape(18.dp))
                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(18.dp))
                .padding(horizontal = 18.dp, vertical = 15.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = NovaIcons.LibraryMusic,
                contentDescription = null,
                tint = NovaMint,
                modifier = Modifier.size(27.dp),
            )
            Column(modifier = Modifier.padding(start = 14.dp)) {
                Text(
                    text = "独立音乐播放域",
                    color = NovaWhite.copy(alpha = 0.86f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
                Text(
                    text = "Media3 MediaSession · 后台播放 · 耳机拔出自动暂停",
                    color = Color.White.copy(alpha = 0.43f),
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun QueueRow(
    item: MusicTrack,
    active: Boolean,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = Modifier
            .fillMaxWidth()
            .height(108.dp),
        shape = RoundedCornerShape(20.dp),
        focusRequester = requester,
        focusedScale = 1.015f,
        transformOrigin = TransformOrigin(0f, 0.5f),
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    if (active) Color(0x4A5DD5B7) else Color.White.copy(alpha = if (focused) 0.11f else 0.045f),
                    RoundedCornerShape(20.dp),
                )
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = if (active) 0.24f else 0.09f),
                    RoundedCornerShape(20.dp),
                )
                .padding(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(
                painter = painterResource(item.artworkRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(88.dp)
                    .clip(RoundedCornerShape(15.dp)),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(start = 15.dp, end = 12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (active) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .background(NovaMint, CircleShape),
                        )
                        Spacer(Modifier.width(9.dp))
                    }
                    Text(
                        text = item.title,
                        color = NovaWhite,
                        fontFamily = Manrope,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 17.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    text = item.artist,
                    color = Color.White.copy(alpha = 0.47f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Normal,
                    fontSize = 11.5.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            Text(
                text = item.durationLabel,
                color = Color.White.copy(alpha = 0.40f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 11.sp,
                modifier = Modifier.padding(end = 10.dp),
            )
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(Color.White.copy(alpha = 0.06f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (active) NovaIcons.Music else NovaIcons.Play,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.55f),
                    modifier = Modifier.size(15.dp),
                )
            }
        }
    }
}

@Composable
private fun ConnectionBadge(connected: Boolean, error: String?) {
    val color = when {
        error != null -> Color(0xFFFF8B9A)
        connected -> NovaMint
        else -> Color.White.copy(alpha = 0.42f)
    }
    Row(
        modifier = Modifier
            .background(Color.White.copy(alpha = 0.07f), RoundedCornerShape(12.dp))
            .border(1.dp, Color.White.copy(alpha = 0.11f), RoundedCornerShape(12.dp))
            .padding(horizontal = 13.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(7.dp)
                .background(color, CircleShape),
        )
        Text(
            text = when {
                error != null -> "音乐服务异常"
                connected -> "MediaSession 已连接"
                else -> "正在连接音乐服务"
            },
            color = Color.White.copy(alpha = 0.62f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Medium,
            fontSize = 11.sp,
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

@Composable
private fun SourceButton(
    modifier: Modifier,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    NovaFocusable(
        modifier = modifier.height(46.dp),
        shape = RoundedCornerShape(15.dp),
        focusRequester = requester,
        focusedScale = 1.05f,
        transformOrigin = TransformOrigin(1f, 0.5f),
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Row(
            modifier = Modifier
                .fillMaxHeight()
                .background(Color.White.copy(alpha = if (focused) 0.16f else 0.07f), RoundedCornerShape(15.dp))
                .border(
                    if (focused) 2.dp else 1.dp,
                    if (focused) NovaWhite else Color.White.copy(alpha = 0.15f),
                    RoundedCornerShape(15.dp),
                )
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = NovaIcons.Tune,
                contentDescription = null,
                tint = NovaWhite.copy(alpha = 0.82f),
                modifier = Modifier.size(19.dp),
            )
            Text(
                text = "音乐源管理",
                color = NovaWhite.copy(alpha = 0.76f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
    }
}

private fun formatDuration(milliseconds: Long): String {
    val safe = (milliseconds / 1000).coerceAtLeast(0)
    return "%02d:%02d".format(safe / 60, safe % 60)
}
