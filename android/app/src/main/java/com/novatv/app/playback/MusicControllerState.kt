package com.novatv.app.playback

import android.content.ComponentName
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.novatv.app.data.MusicCatalog
import com.novatv.app.data.MusicTrack

class MusicControllerState(private val context: Context) {
    var connected by mutableStateOf(false)
        private set
    var isPlaying by mutableStateOf(false)
        private set
    var currentIndex by mutableIntStateOf(0)
        private set
    var queueSize by mutableIntStateOf(MusicCatalog.tracks.size)
        private set
    var positionMs by mutableLongStateOf(0L)
        private set
    var durationMs by mutableLongStateOf(MusicCatalog.trackAt(0).durationMs)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    val currentTrack: MusicTrack
        get() = MusicCatalog.trackAt(currentIndex)

    private val future = MediaController.Builder(
        context,
        SessionToken(context, ComponentName(context, MusicPlaybackService::class.java)),
    ).buildAsync()

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(playing: Boolean) {
            isPlaying = playing
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            syncFromController()
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            syncFromController()
        }

        override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
            errorMessage = error.localizedMessage ?: "音乐播放器初始化失败"
        }
    }

    private var controller: MediaController? = null

    init {
        future.addListener(
            {
                runCatching {
                    future.get().also { mediaController ->
                        controller = mediaController
                        mediaController.addListener(listener)
                        connected = true
                        syncFromController()
                    }
                }.onFailure {
                    errorMessage = it.localizedMessage ?: "无法连接音乐服务"
                }
            },
            ContextCompat.getMainExecutor(context),
        )
    }

    fun togglePlayPause() {
        val mediaController = controller ?: return
        if (mediaController.isPlaying) {
            mediaController.pause()
        } else {
            mediaController.play()
        }
        syncPosition()
    }

    fun skipToPrevious() {
        playIndex(currentIndex - 1)
    }

    fun skipToNext() {
        playIndex(currentIndex + 1)
    }

    fun playIndex(index: Int) {
        val mediaController = controller ?: return
        if (mediaController.mediaItemCount == 0) return

        val safeIndex = MusicCatalog.normalizedIndex(index)
            .coerceAtMost(mediaController.mediaItemCount - 1)
        if (mediaController.currentMediaItemIndex != safeIndex) {
            mediaController.seekToDefaultPosition(safeIndex)
        }
        mediaController.play()
        syncFromController()
    }

    fun syncPosition() {
        syncFromController()
    }

    private fun syncFromController() {
        val mediaController = controller ?: return
        queueSize = MusicCatalog.tracks.size
        if (mediaController.mediaItemCount > 0) {
            currentIndex = mediaController.currentMediaItemIndex
                .coerceIn(0, MusicCatalog.tracks.lastIndex)
        }
        positionMs = mediaController.currentPosition.coerceAtLeast(0L)
        val reportedDuration = mediaController.duration
        durationMs = reportedDuration
            .takeIf { it > 0L }
            ?: currentTrack.durationMs
        isPlaying = mediaController.isPlaying
    }

    fun release() {
        controller?.removeListener(listener)
        if (future.isDone) {
            MediaController.releaseFuture(future)
        } else {
            future.cancel(true)
        }
        controller = null
        connected = false
    }
}
