package com.novatv.app.data

import androidx.annotation.DrawableRes
import androidx.annotation.RawRes

data class MediaItem(
    val id: String,
    val title: String,
    val type: String,
    val meta: String,
    val description: String,
    @DrawableRes val imageRes: Int,
    val keywords: String,
    val progressLabel: String? = null,
    val progress: Float = 0f,
    val badge: String? = null,
    val streamUrl: String? = null,
    val sourceLabel: String? = null,
    val isLive: Boolean = false,
)

enum class FeatureTarget {
    LIVE,
    LIBRARY,
    MUSIC,
    SAVED,
}

data class FeatureCardData(
    val target: FeatureTarget,
    val title: String,
    val description: String,
)

data class MusicTrack(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationLabel: String,
    val durationMs: Long,
    @DrawableRes val artworkRes: Int,
    @RawRes val audioRes: Int,
    val audioUri: String?,
)
