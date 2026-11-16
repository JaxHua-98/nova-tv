package com.novatv.app.data

import com.novatv.app.R

object MusicCatalog {
    val tracks = listOf(
        MusicTrack(
            id = "nova-night-flight",
            title = "夜航星 · NOVA Session",
            artist = "NOVA TV · 本地原创合成试听",
            album = "NOVA Sessions",
            durationLabel = "00:24",
            durationMs = 24_000,
            artworkRes = R.drawable.nova_yourname,
            audioRes = R.raw.nova_demo_ambient,
            audioUri = null,
        ),
        MusicTrack(
            id = "nova-morning-mist",
            title = "晨雾电台",
            artist = "NOVA TV · 晨间环境音乐",
            album = "客厅电台",
            durationLabel = "00:24",
            durationMs = 24_000,
            artworkRes = R.drawable.nova_interstellar,
            audioRes = R.raw.nova_morning_mist,
            audioUri = null,
        ),
        MusicTrack(
            id = "nova-blue-hour",
            title = "蓝色时刻",
            artist = "NOVA TV · 深夜蓝调",
            album = "Blue Hour",
            durationLabel = "00:24",
            durationMs = 24_000,
            artworkRes = R.drawable.nova_dune,
            audioRes = R.raw.nova_blue_hour,
            audioUri = null,
        ),
        MusicTrack(
            id = "nova-rainy-night",
            title = "雨夜歌单",
            artist = "NOVA TV · 雨声氛围选段",
            album = "Rainy Night",
            durationLabel = "00:24",
            durationMs = 24_000,
            artworkRes = R.drawable.nova_peaky,
            audioRes = R.raw.nova_rainy_night,
            audioUri = null,
        ),
    )

    fun trackAt(index: Int): MusicTrack = tracks[normalizedIndex(index)]

    fun normalizedIndex(index: Int): Int =
        if (tracks.isEmpty()) 0 else ((index % tracks.size) + tracks.size) % tracks.size
}
