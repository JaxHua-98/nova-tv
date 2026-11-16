package com.novatv.app.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.novatv.app.data.FeatureTarget
import com.novatv.app.data.MediaItem
import com.novatv.app.ui.components.NovaBackground
import com.novatv.app.ui.detail.DetailOverlay
import com.novatv.app.ui.home.HomeScreen
import com.novatv.app.ui.library.LibraryScreen
import com.novatv.app.ui.live.LiveScreen
import com.novatv.app.ui.music.MusicScreen
import com.novatv.app.ui.player.PlaybackRequest
import com.novatv.app.ui.player.VideoPlayerOverlay
import com.novatv.app.ui.saved.SavedScreen
import com.novatv.app.ui.search.SearchOverlay
import com.novatv.app.ui.settings.SettingsSection
import com.novatv.app.ui.settings.SettingsScreen
import com.novatv.app.ui.theme.Manrope
import com.novatv.app.ui.theme.NovaDeepSpace
import com.novatv.app.ui.theme.NovaMint
import com.novatv.app.ui.theme.NovaWhite
import kotlinx.coroutines.delay

private enum class NovaDestination {
    HOME,
    LIVE,
    LIBRARY,
    MUSIC,
    SAVED,
    SETTINGS,
}

private sealed interface NovaOverlay {
    data object Search : NovaOverlay

    data class Detail(
        val item: MediaItem,
        val fromSearch: Boolean = false,
    ) : NovaOverlay
}

@Composable
fun NovaTvRoot() {
    var destination by remember { mutableStateOf(NovaDestination.HOME) }
    var settingsReturn by remember { mutableStateOf(NovaDestination.HOME) }
    var settingsSection by remember { mutableStateOf(SettingsSection.SOURCES) }
    var overlay by remember { mutableStateOf<NovaOverlay?>(null) }
    var playerRequest by remember { mutableStateOf<PlaybackRequest?>(null) }
    var toastMessage by remember { mutableStateOf<String?>(null) }

    fun showToast(message: String) {
        toastMessage = message
    }

    fun openSettings(
        returnTo: NovaDestination = NovaDestination.HOME,
        section: SettingsSection = SettingsSection.SOURCES,
    ) {
        settingsReturn = returnTo
        settingsSection = section
        destination = NovaDestination.SETTINGS
        overlay = null
    }

    fun openDetail(item: MediaItem, fromSearch: Boolean = false) {
        overlay = NovaOverlay.Detail(item = item, fromSearch = fromSearch)
    }

    LaunchedEffect(toastMessage) {
        if (toastMessage != null) {
            delay(2200)
            toastMessage = null
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(NovaDeepSpace),
    ) {
        NovaBackground(Modifier.fillMaxSize())

        BoxWithConstraints(Modifier.fillMaxSize()) {
            val scale = minOf(
                maxWidth.value / 1920f,
                maxHeight.value / 1080f,
            )

            Box(
                modifier = Modifier
                    .size(1920.dp, 1080.dp)
                    .align(Alignment.Center)
                    .graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                    },
            ) {
                AnimatedContent(
                    targetState = destination,
                    transitionSpec = {
                        fadeIn(tween(300)) togetherWith fadeOut(tween(180))
                    },
                    label = "nova-destination",
                ) { currentDestination ->
                    when (currentDestination) {
                        NovaDestination.HOME -> HomeScreen(
                            onOpenFeature = { feature ->
                                destination = when (feature) {
                                    FeatureTarget.LIVE -> NovaDestination.LIVE
                                    FeatureTarget.LIBRARY -> NovaDestination.LIBRARY
                                    FeatureTarget.MUSIC -> NovaDestination.MUSIC
                                    FeatureTarget.SAVED -> NovaDestination.SAVED
                                }
                            },
                            onOpenSearch = { overlay = NovaOverlay.Search },
                            onOpenDetail = { openDetail(it) },
                            onOpenSettings = { openSettings(NovaDestination.HOME) },
                            onToast = ::showToast,
                        )

                        NovaDestination.LIVE -> LiveScreen(
                            onBack = { destination = NovaDestination.HOME },
                            onOpenSettings = { openSettings(NovaDestination.LIVE) },
                            onPlayChannel = { channel ->
                                val streamUrl = channel.urls.firstOrNull()
                                if (streamUrl == null) {
                                    showToast("${channel.name} · 当前没有可用测试信号")
                                } else {
                                    playerRequest = PlaybackRequest(
                                        title = channel.name,
                                        meta = "${channel.group} · 频道名称仅用于界面演示",
                                        sourceLabel = "公开 HLS 测试信号",
                                        streamUrl = streamUrl,
                                        isLive = true,
                                    )
                                }
                            },
                            onToast = ::showToast,
                        )

                        NovaDestination.LIBRARY -> LibraryScreen(
                            onBack = { destination = NovaDestination.HOME },
                            onOpenSettings = { openSettings(NovaDestination.LIBRARY) },
                            onOpenDetail = { openDetail(it) },
                            onToast = ::showToast,
                        )

                        NovaDestination.MUSIC -> MusicScreen(
                            onBack = { destination = NovaDestination.HOME },
                            onOpenSettings = {
                                openSettings(
                                    returnTo = NovaDestination.MUSIC,
                                    section = SettingsSection.MUSIC,
                                )
                            },
                            onToast = ::showToast,
                        )

                        NovaDestination.SAVED -> SavedScreen(
                            onBack = { destination = NovaDestination.HOME },
                            onOpenDetail = { openDetail(it) },
                            onToast = ::showToast,
                        )

                        NovaDestination.SETTINGS -> SettingsScreen(
                            initialSection = settingsSection,
                            onBack = {
                                destination = settingsReturn
                                settingsReturn = NovaDestination.HOME
                                settingsSection = SettingsSection.SOURCES
                            },
                            onToast = ::showToast,
                        )
                    }
                }

                when (val activeOverlay = overlay) {
                    NovaOverlay.Search -> SearchOverlay(
                        onClose = { overlay = null },
                        onOpenResult = { openDetail(it, fromSearch = true) },
                    )

                    is NovaOverlay.Detail -> DetailOverlay(
                        item = activeOverlay.item,
                        onClose = {
                            overlay = if (activeOverlay.fromSearch) NovaOverlay.Search else null
                        },
                        onPlay = {
                            val streamUrl = activeOverlay.item.streamUrl
                            if (streamUrl == null) {
                                showToast("当前条目仅用于界面演示，暂无可用测试片源")
                            } else {
                                playerRequest = PlaybackRequest(
                                    title = activeOverlay.item.title,
                                    meta = activeOverlay.item.meta,
                                    sourceLabel = activeOverlay.item.sourceLabel
                                        ?: "公开授权测试片源",
                                    streamUrl = streamUrl,
                                    isLive = activeOverlay.item.isLive,
                                )
                            }
                        },
                        onToast = ::showToast,
                    )

                    null -> Unit
                }

                toastMessage?.let { message ->
                    NovaToast(
                        message = message,
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 58.dp),
                    )
                }

                playerRequest?.let { request ->
                    VideoPlayerOverlay(
                        request = request,
                        onClose = { playerRequest = null },
                    )
                }
            }
        }
    }
}

@Composable
private fun NovaToast(
    message: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .background(Color(0xD91A295B), RoundedCornerShape(50))
            .padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(NovaMint, CircleShape),
        )
        Text(
            text = message,
            color = NovaWhite.copy(alpha = 0.92f),
            fontFamily = Manrope,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            modifier = Modifier.padding(start = 10.dp),
        )
    }
}
