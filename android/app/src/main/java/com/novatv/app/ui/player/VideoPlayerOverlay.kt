package com.novatv.app.ui.player

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.VolumeOff
import androidx.compose.material.icons.automirrored.outlined.VolumeUp
import androidx.compose.material.icons.outlined.Forward10
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Replay10
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.novatv.app.ui.components.NovaFocusable
import com.novatv.app.ui.components.NovaIcons
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay
import java.util.Locale

data class PlaybackRequest(
    val title: String,
    val meta: String,
    val sourceLabel: String,
    val streamUrl: String,
    val isLive: Boolean = false,
)

private enum class PlayerTarget {
    CLOSE,
    REWIND,
    TOGGLE,
    FORWARD,
    MUTE,
    RETRY,
}

@Composable
fun VideoPlayerOverlay(
    request: PlaybackRequest,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var focusedTarget by remember { mutableStateOf(PlayerTarget.TOGGLE) }
    var isPlaying by remember { mutableStateOf(false) }
    var isMuted by remember { mutableStateOf(false) }
    var isBuffering by remember { mutableStateOf(true) }
    var playbackError by remember { mutableStateOf<String?>(null) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    val requesters = remember { PlayerTarget.entries.associateWith { FocusRequester() } }

    val player = remember(request.streamUrl) {
        ExoPlayer.Builder(context).build().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .setUsage(C.USAGE_MEDIA)
                    .build(),
                true,
            )
            repeatMode = Player.REPEAT_MODE_OFF
        }
    }

    val visibleTargets = remember(request.isLive) {
        buildList {
            if (!request.isLive) add(PlayerTarget.REWIND)
            add(PlayerTarget.TOGGLE)
            if (!request.isLive) add(PlayerTarget.FORWARD)
            add(PlayerTarget.MUTE)
            add(PlayerTarget.RETRY)
        }
    }

    fun requestFocus(target: PlayerTarget) {
        runCatching { requesters.getValue(target).requestFocus() }
    }

    fun moveHorizontal(offset: Int) {
        val index = visibleTargets.indexOf(focusedTarget).takeIf { it >= 0 }
            ?: visibleTargets.indexOf(PlayerTarget.TOGGLE)
        val next = (index + offset + visibleTargets.size) % visibleTargets.size
        requestFocus(visibleTargets[next])
    }

    fun retryPlayback() {
        playbackError = null
        isBuffering = true
        player.stop()
        player.clearMediaItems()
        player.setMediaItem(MediaItem.fromUri(request.streamUrl))
        player.prepare()
        player.playWhenReady = true
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                isBuffering = playbackState == Player.STATE_BUFFERING
                if (playbackState == Player.STATE_READY) {
                    playbackError = null
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                playbackError = error.localizedMessage ?: "测试片源加载失败"
                isBuffering = false
            }
        }
        player.addListener(listener)

        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(player, request.streamUrl) {
        player.setMediaItem(MediaItem.fromUri(request.streamUrl))
        player.prepare()
        player.playWhenReady = true
    }

    LaunchedEffect(player) {
        while (true) {
            positionMs = player.currentPosition.coerceAtLeast(0L)
            durationMs = player.duration.takeIf { it > 0L } ?: 0L
            isMuted = player.volume == 0f
            delay(500)
        }
    }

    LaunchedEffect(Unit) {
        delay(100)
        requestFocus(PlayerTarget.TOGGLE)
    }

    BackHandler(onBack = onClose)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionLeft -> {
                        moveHorizontal(-1)
                        true
                    }

                    Key.DirectionRight -> {
                        moveHorizontal(1)
                        true
                    }

                    Key.DirectionUp -> {
                        requestFocus(PlayerTarget.CLOSE)
                        true
                    }

                    Key.DirectionDown -> {
                        requestFocus(PlayerTarget.TOGGLE)
                        true
                    }

                    else -> false
                }
            },
    ) {
        AndroidView(
            factory = { viewContext ->
                val exoPlayer = player
                PlayerView(viewContext).apply {
                    this.player = exoPlayer
                    useController = false
                    keepScreenOn = true
                }
            },
            update = { playerView ->
                playerView.player = player
                playerView.keepScreenOn = true
            },
            modifier = Modifier.fillMaxSize(),
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(260.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Black.copy(alpha = 0.78f), Color.Transparent),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(390.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.88f)),
                    ),
                ),
        )

        PlayerTopBar(
            request = request,
            closeRequester = requesters.getValue(PlayerTarget.CLOSE),
            onFocused = { focusedTarget = PlayerTarget.CLOSE },
            onClose = onClose,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxWidth()
                .padding(start = 64.dp, top = 42.dp, end = 64.dp),
        )

        if (isBuffering || playbackError != null) {
            PlayerStatePanel(
                title = if (playbackError != null) "片源暂时无法播放" else "正在连接公开测试信号",
                detail = playbackError ?: "首次加载 HLS / MP4 片源可能需要几秒",
                isError = playbackError != null,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(start = 64.dp, end = 64.dp, bottom = 42.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (request.isLive) {
                    Row(
                        modifier = Modifier
                            .background(Color(0xB3D94C69), RoundedCornerShape(50))
                            .padding(horizontal = 11.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(6.dp)
                                .background(NovaWhite, CircleShape),
                        )
                        Text(
                            text = "LIVE",
                            color = NovaWhite,
                            fontFamily = Manrope,
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.sp,
                            letterSpacing = 1.sp,
                            modifier = Modifier.padding(start = 6.dp),
                        )
                    }
                }
                Text(
                    text = request.sourceLabel,
                    color = Color.White.copy(alpha = 0.64f),
                    fontFamily = Manrope,
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp,
                )
                Text(
                    text = "公开授权测试信号",
                    color = Color.White.copy(alpha = 0.38f),
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                )
            }

            if (!request.isLive) {
                Spacer(Modifier.height(17.dp))
                val progress = if (durationMs > 0L) {
                    (positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
                } else {
                    0f
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(5.dp)
                        .background(Color.White.copy(alpha = 0.18f), RoundedCornerShape(50)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .fillMaxWidth(progress)
                            .background(NovaWhite, RoundedCornerShape(50)),
                    )
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 7.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = formatTime(positionMs),
                        color = Color.White.copy(alpha = 0.52f),
                        fontFamily = Manrope,
                        fontSize = 11.sp,
                    )
                    Text(
                        text = formatTime(durationMs),
                        color = Color.White.copy(alpha = 0.52f),
                        fontFamily = Manrope,
                        fontSize = 11.sp,
                    )
                }
            } else {
                Text(
                    text = if (isPlaying) "正在直播" else "直播已暂停",
                    color = Color.White.copy(alpha = 0.52f),
                    fontFamily = Manrope,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }

            Spacer(Modifier.height(17.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                if (!request.isLive) {
                    PlayerControl(
                        icon = Icons.Outlined.Replay10,
                        label = "快退 10 秒",
                        requester = requesters.getValue(PlayerTarget.REWIND),
                        onFocused = { focusedTarget = PlayerTarget.REWIND },
                        onClick = {
                            player.seekTo((player.currentPosition - 10_000L).coerceAtLeast(0L))
                        },
                    )
                }

                PlayerControl(
                    icon = if (isPlaying) NovaIcons.Pause else NovaIcons.Play,
                    label = if (isPlaying) "暂停" else "播放",
                    primary = true,
                    requester = requesters.getValue(PlayerTarget.TOGGLE),
                    onFocused = { focusedTarget = PlayerTarget.TOGGLE },
                    onClick = {
                        if (player.isPlaying) {
                            player.pause()
                        } else {
                            if (player.playbackState == Player.STATE_IDLE) retryPlayback()
                            else player.play()
                        }
                    },
                )

                if (!request.isLive) {
                    PlayerControl(
                        icon = Icons.Outlined.Forward10,
                        label = "快进 10 秒",
                        requester = requesters.getValue(PlayerTarget.FORWARD),
                        onFocused = { focusedTarget = PlayerTarget.FORWARD },
                        onClick = {
                            val target = if (durationMs > 0L) {
                                (player.currentPosition + 10_000L).coerceAtMost(durationMs)
                            } else {
                                player.currentPosition + 10_000L
                            }
                            player.seekTo(target)
                        },
                    )
                }

                PlayerControl(
                    icon = if (isMuted) {
                        Icons.AutoMirrored.Outlined.VolumeOff
                    } else {
                        Icons.AutoMirrored.Outlined.VolumeUp
                    },
                    label = if (isMuted) "取消静音" else "静音",
                    requester = requesters.getValue(PlayerTarget.MUTE),
                    onFocused = { focusedTarget = PlayerTarget.MUTE },
                    onClick = {
                        player.volume = if (player.volume == 0f) 1f else 0f
                    },
                )

                PlayerControl(
                    icon = Icons.Outlined.Refresh,
                    label = "重新加载片源",
                    requester = requesters.getValue(PlayerTarget.RETRY),
                    onFocused = { focusedTarget = PlayerTarget.RETRY },
                    onClick = ::retryPlayback,
                )
            }

            Text(
                text = "方向键选择 · Enter 确认 · Back 返回",
                color = Color.White.copy(alpha = 0.34f),
                fontFamily = Manrope,
                fontSize = 10.5.sp,
                modifier = Modifier.padding(top = 15.dp),
            )
        }
    }
}

@Composable
private fun PlayerTopBar(
    request: PlaybackRequest,
    closeRequester: FocusRequester,
    onFocused: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = if (request.isLive) "LIVE · 电视直播测试" else "NOVA PLAYER · 影视播放测试",
                color = Color.White.copy(alpha = 0.58f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                letterSpacing = 1.2.sp,
            )
            Text(
                text = request.title,
                color = NovaWhite,
                fontFamily = Manrope,
                fontWeight = FontWeight.Bold,
                fontSize = 34.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                text = request.meta,
                color = Color.White.copy(alpha = 0.52f),
                fontFamily = Manrope,
                fontWeight = FontWeight.Medium,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 7.dp),
            )
        }

        PlayerControl(
            icon = NovaIcons.Close,
            label = "关闭播放器",
            compact = true,
            requester = closeRequester,
            onFocused = onFocused,
            onClick = onClose,
        )
    }
}

@Composable
private fun PlayerControl(
    icon: ImageVector,
    label: String,
    requester: FocusRequester,
    onFocused: () -> Unit,
    onClick: () -> Unit,
    primary: Boolean = false,
    compact: Boolean = false,
) {
    val size = when {
        compact -> 52.dp
        primary -> 62.dp
        else -> 52.dp
    }
    NovaFocusable(
        modifier = Modifier
            .size(size)
            .semantics { contentDescription = label },
        shape = if (primary) CircleShape else RoundedCornerShape(17.dp),
        focusRequester = requester,
        focusedScale = 1.09f,
        onClick = onClick,
        onFocusChanged = { if (it) onFocused() },
    ) { focused ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    when {
                        primary -> Color.White.copy(alpha = if (focused) 1f else 0.92f)
                        focused -> Color.White.copy(alpha = 0.24f)
                        else -> Color.Black.copy(alpha = 0.28f)
                    },
                    if (primary) CircleShape else RoundedCornerShape(17.dp),
                )
                .border(
                    width = if (focused) 2.dp else 1.dp,
                    color = if (focused) NovaWhite else Color.White.copy(alpha = 0.24f),
                    shape = if (primary) CircleShape else RoundedCornerShape(17.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (primary) Color(0xFF172443) else NovaWhite,
                modifier = Modifier.size(if (primary) 28.dp else 24.dp),
            )
        }
    }
}

@Composable
private fun PlayerStatePanel(
    title: String,
    detail: String,
    isError: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .width(430.dp)
            .background(Color(0xD9152143), RoundedCornerShape(24.dp))
            .border(1.dp, Color.White.copy(alpha = 0.16f), RoundedCornerShape(24.dp))
            .padding(horizontal = 28.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (!isError) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .border(2.dp, Color.White.copy(alpha = 0.22f), CircleShape)
                    .border(2.dp, NovaWhite, CircleShape),
            )
            Spacer(Modifier.height(15.dp))
        }
        Text(
            text = title,
            color = NovaWhite,
            fontFamily = Manrope,
            fontWeight = FontWeight.SemiBold,
            fontSize = 17.sp,
        )
        Text(
            text = detail,
            color = Color.White.copy(alpha = 0.52f),
            fontFamily = Manrope,
            fontSize = 12.sp,
            modifier = Modifier.padding(top = 7.dp),
        )
    }
}

private fun formatTime(milliseconds: Long): String {
    val totalSeconds = (milliseconds.coerceAtLeast(0L) / 1000L)
    val hours = totalSeconds / 3600L
    val minutes = (totalSeconds % 3600L) / 60L
    val seconds = totalSeconds % 60L
    return if (hours > 0L) {
        String.format(Locale.ROOT, "%02d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.ROOT, "%02d:%02d", minutes, seconds)
    }
}
