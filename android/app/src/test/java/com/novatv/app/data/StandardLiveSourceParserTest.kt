package com.novatv.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StandardLiveSourceParserTest {
    @Test
    fun parsesM3uGroupsAndRejectsUnsupportedSchemes() {
        val content = """
            #EXTM3U
            #EXTINF:-1 group-title="央视",CCTV-1
            https://example.com/cctv1.m3u8
            #EXTINF:-1 group-title="测试",Unsupported
            huya://room/123
        """.trimIndent()

        val channels = StandardLiveSourceParser.parseM3u(content)

        assertEquals(1, channels.size)
        assertEquals("CCTV-1", channels.single().name)
        assertEquals("央视", channels.single().group)
        assertEquals(listOf("https://example.com/cctv1.m3u8"), channels.single().urls)
    }

    @Test
    fun parsesTxtGenreAndMultipleStandardLines() {
        val content = """
            央视,#genre#
            CCTV-1,https://example.com/1.m3u8#rtmp://example.com/backup
            卫视,#genre#
            湖南卫视,https://example.com/hunan.m3u8
            Invalid,not-a-url
        """.trimIndent()

        val channels = StandardLiveSourceParser.parseTxt(content)

        assertEquals(2, channels.size)
        assertEquals("央视", channels[0].group)
        assertEquals(2, channels[0].urls.size)
        assertEquals("卫视", channels[1].group)
        assertTrue(channels.none { it.name == "Invalid" })
    }
}
