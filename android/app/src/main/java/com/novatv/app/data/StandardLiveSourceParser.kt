package com.novatv.app.data

data class StandardLiveChannel(
    val name: String,
    val group: String,
    val urls: List<String>,
)

object StandardLiveSourceParser {
    private val supportedSchemes = setOf("http", "https", "rtmp", "rtsp")

    fun parseM3u(content: String): List<StandardLiveChannel> {
        val channels = mutableListOf<StandardLiveChannel>()
        var pendingName: String? = null
        var pendingGroup = "未分组"

        content.lineSequence().forEach { rawLine ->
            val line = rawLine.trim()
            when {
                line.startsWith("#EXTINF", ignoreCase = true) -> {
                    val metadata = line.substringBeforeLast(",", "")
                    val name = line.substringAfterLast(",", "").trim()
                    pendingName = name.ifBlank { metadata.substringAfter("tvg-name=\"", "").substringBefore("\"") }
                    pendingGroup = metadata.substringAfter("group-title=\"", "")
                        .substringBefore("\"")
                        .ifBlank { "未分组" }
                }

                line.isNotEmpty() && !line.startsWith("#") && pendingName != null -> {
                    if (isSupportedUrl(line)) {
                        channels += StandardLiveChannel(
                            name = pendingName.orEmpty(),
                            group = pendingGroup,
                            urls = listOf(line),
                        )
                    }
                    pendingName = null
                }
            }
        }

        return channels
    }

    fun parseTxt(content: String): List<StandardLiveChannel> {
        val channels = mutableListOf<StandardLiveChannel>()
        var group = "未分组"

        content.lineSequence().forEach { rawLine ->
            val line = rawLine.trim()
            if (line.isBlank() || line.startsWith("#")) return@forEach

            if (line.contains(",#genre#")) {
                group = line.substringBefore(",#genre#").trim().ifBlank { "未分组" }
                return@forEach
            }

            val separator = line.indexOf(',')
            if (separator <= 0) return@forEach

            val name = line.substring(0, separator).trim().ifBlank { return@forEach }
            val urls = line.substring(separator + 1)
                .split('#')
                .map(String::trim)
                .filter(::isSupportedUrl)

            if (urls.isNotEmpty()) {
                channels += StandardLiveChannel(name = name, group = group, urls = urls)
            }
        }

        return channels
    }

    private fun isSupportedUrl(value: String): Boolean {
        val scheme = value.substringBefore("://", "").lowercase()
        return scheme in supportedSchemes
    }
}
